import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import { IncomingForm } from 'formidable';
import '../api/_lib/load-env.js';
import { applyCors } from '../api/_lib/cors.js';
import { sendReceiptEmail } from '../api/_lib/email.js';
import { getServiceAreaError } from '../api/_lib/service-area.js';
import {
    authorizeBookingContinuation,
    completeMonthlyBookingRequest,
    markBookingRequestConfirmed,
    resetBookingRequestCheckout,
    saveBookingRequestCheckout,
    startBookingRequestCheckout,
} from '../api/_lib/booking-requests.js';
import {
    getMonthlyReservationError,
    releaseMonthlyWashReservation,
    reserveMonthlyWash,
} from '../api/_lib/monthly-promos.js';
import {
    getSharedPromoCodeStatus,
    looksLikeEmail,
    looksLikeVehicleRegistration,
    normaliseReg,
    releaseBookingSlot,
    releaseSharedPromoCode,
    reserveSharedPromoCode,
    savePendingBooking,
    MONTHLY_PACKAGE_CENTS,
    PROMO_DISCOUNT_RATE,
    SINGLE_WASH_CENTS,
} from '../api/_lib/store.js';

// Business operates in South Africa (UTC+2, no DST) — anchor the quoted
// booking date/time to that fixed offset regardless of the server's own TZ.
const SA_UTC_OFFSET = '+02:00';
const MIN_LEAD_TIME_MS = 3 * 60 * 60 * 1000; // customers must book at least 3 hours ahead

// Do not pre-parse the multipart body — formidable needs the raw stream.
export const config = { api: { bodyParser: false } };

function parseMultipart(req) {
    return new Promise((resolve, reject) => {
        const form = new IncomingForm({ multiples: true, maxFileSize: 10 * 1024 * 1024 });
        form.parse(req, (err, fields, files) => {
            if (err) reject(err);
            else resolve({ fields, files });
        });
    });
}

// POST /api/payments/yoco/checkout
// multipart: field "booking" (JSON string) + optional contract_files (monthly only)
export default async function handler(req, res) {
    if (applyCors(req, res)) return;
    if (req.method !== 'POST') {
        res.status(405).json({ message: 'Method not allowed.' });
        return;
    }

    let reservedPromoCode = null;
    let promoReservationId = null;
    let reservedMonthlyWash = null;
    let monthlyEntitlementDetails = null;
    let reservedSlotDate = null;
    let reservedSlotTime = null;
    let approvalRequest = null;
    let checkoutRequestStarted = false;
    try {
        const { fields, files } = await parseMultipart(req);
        const bookingRaw = Array.isArray(fields.booking) ? fields.booking[0] : fields.booking;

        let booking;
        try {
            booking = JSON.parse(bookingRaw || '{}');
        } catch {
            res.status(400).json({ message: 'Invalid booking payload.' });
            return;
        }

        const approvalReference = String(booking.approvalReference || '').trim();
        const continuationToken = String(booking.continuationToken || '');
        if (!approvalReference || !continuationToken) {
            res.status(403).json({ message: 'A business-approved booking request is required before checkout.' });
            return;
        }
        const authorization = await authorizeBookingContinuation(approvalReference, continuationToken);
        if (authorization.error) {
            res.status(403).json({ message: authorization.error });
            return;
        }
        approvalRequest = authorization.request;
        if (approvalRequest.paymentMethod !== 'online') {
            res.status(400).json({ message: 'This booking request was set up for on-site payment.' });
            return;
        }
        booking = approvalRequest.booking;

        const {
            serviceLocation,
            purchaseType,
            packageId,
            packageName,
            vehicleType,
            bookingDate,
            bookingTime,
            promoCode,
            customer,
            serviceAreaAccepted,
            termsAccepted,
            contractAccepted,
            bookingType,
            monthlyClientType,
            monthlyPackageTier,
        } = booking;
        const isMonthlyWashBooking = bookingType === 'monthly-entitlement';

        if (!serviceAreaAccepted || !termsAccepted) {
            res.status(400).json({ message: 'Required confirmations missing.' });
            return;
        }
        const serviceAreaError = getServiceAreaError(serviceLocation, customer?.address);
        if (serviceAreaError) {
            res.status(400).json({ message: serviceAreaError });
            return;
        }
        if (!bookingDate || !bookingTime) {
            res.status(400).json({ message: 'Choose a date and time.' });
            return;
        }
        const slotDateTime = new Date(`${bookingDate}T${bookingTime}:00${SA_UTC_OFFSET}`);
        if (Number.isNaN(slotDateTime.getTime()) || slotDateTime.getTime() - Date.now() < MIN_LEAD_TIME_MS) {
            res.status(400).json({ message: 'Bookings require at least 3 hours notice. Please choose a later time.' });
            return;
        }
        if (!looksLikeVehicleRegistration(customer?.registration)) {
            res.status(400).json({ message: 'Invalid vehicle registration format.' });
            return;
        }
        const isMonthly = purchaseType === 'monthly';
        if (bookingType && !isMonthlyWashBooking) {
            res.status(400).json({ message: 'Unknown booking type.' });
            return;
        }
        if (isMonthlyWashBooking
            && (!looksLikeEmail(customer?.email) || !String(customer?.firstName || '').trim()
                || !String(customer?.surname || '').trim() || !String(customer?.mobile || '').trim())) {
            res.status(400).json({ message: 'Enter your name, mobile number and assigned account email for the monthly booking.' });
            return;
        }
        if (isMonthlyWashBooking && (isMonthly || !['private', 'business'].includes(monthlyClientType)
            || !['standard', 'premium'].includes(monthlyPackageTier) || !approvalRequest.monthlyReservation)) {
            res.status(400).json({ message: 'Select a valid monthly client package with an active wash reservation.' });
            return;
        }
        if (isMonthly && promoCode) {
            res.status(400).json({ message: 'Promo codes apply to single washes only. Monthly package purchases are charged at the package rate.' });
            return;
        }
        const reference = approvalRequest.reference;
        reservedSlotDate = null;
        reservedSlotTime = null;

        let contractFileBase64 = null;
        let contractFileName = null;
        if (isMonthly && !booking.contractFileBase64) {
            const contractFiles = files.contract_files
                ? (Array.isArray(files.contract_files) ? files.contract_files : [files.contract_files])
                : [];
            const [contractFile] = contractFiles;
            const uploadedContractFileName = contractFile?.originalFilename?.toLowerCase() ?? '';
            const isValidContractFile = contractFiles.length === 1
                && (contractFile?.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
                    || contractFile?.mimetype === 'application/msword'
                    || contractFile?.mimetype === 'application/pdf'
                    || uploadedContractFileName.endsWith('.docx')
                    || uploadedContractFileName.endsWith('.doc')
                    || uploadedContractFileName.endsWith('.pdf'))
                && contractFile.size <= 10 * 1024 * 1024;
            if (!contractAccepted || !isValidContractFile) {
                await releaseBookingSlot(reservedSlotDate, reservedSlotTime);
                reservedSlotDate = null;
                reservedSlotTime = null;
                res.status(400).json({ message: 'Attach the completed Supplier Client Contract Agreement as a Word document or PDF no larger than 10 MB.' });
                return;
            }
            if (contractFile) {
                const fileBuffer = await fs.readFile(contractFile.filepath);
                contractFileBase64 = fileBuffer.toString('base64');
                contractFileName = contractFile.originalFilename;
            }
        }
        if (isMonthly && booking.contractFileBase64) {
            contractFileBase64 = booking.contractFileBase64;
            contractFileName = booking.contractFileName;
        }

        // --- Amount calculation (server is the only source of truth for price) ---
        let originalAmountCents;
        let amountCents;
        let discountCents = 0;
        let appliedPromo = null;
        let appliedPromoType = null;

        if (!isMonthly) {
            originalAmountCents = SINGLE_WASH_CENTS[vehicleType];
            if (!originalAmountCents) {
                await releaseBookingSlot(reservedSlotDate, reservedSlotTime);
                reservedSlotDate = null;
                reservedSlotTime = null;
                res.status(400).json({ message: 'Unknown vehicle type.' });
                return;
            }
            amountCents = originalAmountCents;

            if (isMonthlyWashBooking) {
                if (!approvalRequest.monthlyReservation) {
                    res.status(409).json({ message: 'The monthly wash reservation has expired. Submit a new booking request.' });
                    return;
                }
                reservedMonthlyWash = approvalRequest.monthlyReservation;
                monthlyEntitlementDetails = reservedMonthlyWash;
                appliedPromo = `Monthly entitlement ${reservedMonthlyWash.entitlementId.slice(0, 8).toUpperCase()}`;
                appliedPromoType = 'monthly-entitlement';
                discountCents = originalAmountCents;
                amountCents = 0;
            } else if (promoCode) {
                const submittedCode = String(promoCode).trim().toUpperCase();
                const monthlyReservationId = crypto.randomUUID();
                const monthly = await reserveMonthlyWash({
                    promoCode: submittedCode,
                    email: customer.email,
                    bookingDate,
                    reservationId: monthlyReservationId,
                    reference,
                    expectedClientType: isMonthlyWashBooking ? monthlyClientType : '',
                    expectedPackageTier: isMonthlyWashBooking ? monthlyPackageTier : '',
                    bookingDetails: {
                        customerName: `${customer.firstName || ''} ${customer.surname || ''}`.trim(),
                        vehicleType,
                    },
                });
                if (isMonthlyWashBooking && monthly.status !== 'OK') {
                    await releaseBookingSlot(reservedSlotDate, reservedSlotTime);
                    reservedSlotDate = null;
                    reservedSlotTime = null;
                    const error = getMonthlyReservationError(monthly.status);
                    res.status(error.statusCode).json({ message: error.message });
                    return;
                }
                if (isMonthlyWashBooking && monthly.status === 'OK') {
                    reservedMonthlyWash = {
                        entitlementId: monthly.entitlement.id,
                        period: monthly.period,
                        reservationId: monthlyReservationId,
                        clientType: monthly.entitlement.clientType,
                        packageTier: monthly.entitlement.packageTier,
                        monthlyAllowance: monthly.entitlement.monthlyAllowance,
                    };
                    monthlyEntitlementDetails = reservedMonthlyWash;
                    appliedPromo = `Monthly entitlement ${monthly.entitlement.id.slice(0, 8).toUpperCase()}`;
                    appliedPromoType = 'monthly-entitlement';
                    discountCents = originalAmountCents;
                    amountCents = 0;
                } else if (monthly.status !== 'NOT_FOUND') {
                    if (monthly.status === 'OK') {
                        await releaseMonthlyWashReservation({
                            entitlementId: monthly.entitlement.id,
                            period: monthly.period,
                            reservationId: monthlyReservationId,
                        });
                    }
                    await releaseBookingSlot(reservedSlotDate, reservedSlotTime);
                    reservedSlotDate = null;
                    reservedSlotTime = null;
                    res.status(400).json({ message: 'Monthly client codes can only be used through Monthly Clients checkout.' });
                    return;
                }

                if (!isMonthlyWashBooking) {
                    const status = await getSharedPromoCodeStatus(submittedCode);
                    if (status.status === 'invalid') {
                        await releaseBookingSlot(reservedSlotDate, reservedSlotTime);
                        reservedSlotDate = null;
                        reservedSlotTime = null;
                        res.status(400).json({ message: 'That promo code is not in the active promo batch.' });
                        return;
                    }
                    if (status.status === 'used') {
                        await releaseBookingSlot(reservedSlotDate, reservedSlotTime);
                        reservedSlotDate = null;
                        reservedSlotTime = null;
                        res.status(410).json({ message: 'That promo code has already been redeemed.' });
                        return;
                    }
                    if (status.status === 'reserved') {
                        await releaseBookingSlot(reservedSlotDate, reservedSlotTime);
                        reservedSlotDate = null;
                        reservedSlotTime = null;
                        res.status(409).json({ message: 'That promo code is already being used in another checkout.' });
                        return;
                    }

                    promoReservationId = crypto.randomUUID();
                    const reserved = await reserveSharedPromoCode(status.promoCode, promoReservationId);
                    if (!reserved) {
                        promoReservationId = null;
                        await releaseBookingSlot(reservedSlotDate, reservedSlotTime);
                        reservedSlotDate = null;
                        reservedSlotTime = null;
                        res.status(409).json({ message: 'That promo code was just claimed by another checkout. Please try another code.' });
                        return;
                    }
                    reservedPromoCode = status.promoCode;
                    appliedPromo = status.promoCode;
                    appliedPromoType = 'shared-code';
                    discountCents = Math.round(originalAmountCents * PROMO_DISCOUNT_RATE);
                    amountCents = originalAmountCents - discountCents;
                }
            }
        } else if (isMonthlyWashBooking) {
            await releaseBookingSlot(reservedSlotDate, reservedSlotTime);
            reservedSlotDate = null;
            reservedSlotTime = null;
            res.status(400).json({ message: 'Enter the monthly promo code assigned to your entitlement.' });
            return;
        } else {
            // First monthly installment, charged according to the package + vehicle rate card.
            const vehicleRates = MONTHLY_PACKAGE_CENTS[packageId];
            originalAmountCents = vehicleRates?.[vehicleType];
            if (!originalAmountCents) {
                await releaseBookingSlot(reservedSlotDate, reservedSlotTime);
                reservedSlotDate = null;
                reservedSlotTime = null;
                res.status(400).json({ message: 'Unknown monthly package or vehicle type.' });
                return;
            }
            amountCents = originalAmountCents; // promo codes don't apply to monthly packages
        }

        if (reservedMonthlyWash) {
            const bookingRecord = {
                ...booking,
                reference,
                originalAmountCents,
                amountCents,
                discountCents,
                appliedPromo,
                appliedPromoType,
                promoCode: null,
                bookingType: 'monthly-entitlement',
                packageName: `Monthly Client Wash - ${reservedMonthlyWash.packageTier === 'premium' ? 'Premium' : 'Standard'} Package`,
                monthlyEntitlementId: reservedMonthlyWash.entitlementId,
                monthlyUsagePeriod: reservedMonthlyWash.period,
                monthlyClientType: reservedMonthlyWash.clientType,
                monthlyPackageTier: reservedMonthlyWash.packageTier,
                monthlyAllowance: reservedMonthlyWash.monthlyAllowance,
                promoCodeReference: reservedMonthlyWash.entitlementId.slice(0, 8).toUpperCase(),
                promoReservationId: reservedMonthlyWash.reservationId,
                customer: {
                    ...customer,
                    email: String(customer.email).trim().toLowerCase(),
                    registration: normaliseReg(customer.registration),
                },
                createdAt: new Date().toISOString(),
            };
            await startBookingRequestCheckout(approvalRequest.reference, continuationToken);
            checkoutRequestStarted = true;
            const confirmation = await completeMonthlyBookingRequest(approvalRequest, bookingRecord);
            if (confirmation !== 'OK' && confirmation !== 'DUPLICATE') {
                await releaseMonthlyWashReservation(reservedMonthlyWash);
                reservedMonthlyWash = null;
                await resetBookingRequestCheckout(approvalRequest.reference);
                checkoutRequestStarted = false;
                await releaseBookingSlot(reservedSlotDate, reservedSlotTime);
                reservedSlotDate = null;
                reservedSlotTime = null;
                const error = getMonthlyReservationError(confirmation);
                res.status(error.statusCode).json({ message: error.message });
                return;
            }
            reservedMonthlyWash = null;

            const formatZar = (cents) => `R${(cents / 100).toFixed(2)}`;
            const receipt = {
                reference,
                bookingDate,
                bookingTime,
                packageName: bookingRecord.packageName,
                vehicleType: vehicleType || '',
                registration: normaliseReg(customer.registration),
                customerName: `${customer.firstName || ''} ${customer.surname || ''}`.trim(),
                customerEmail: customer.email,
                customerMobile: customer.mobile,
                address: customer.address,
                bookingType: 'monthly-entitlement',
                customerType: monthlyEntitlementDetails?.clientType === 'business' ? 'Business / Fleet / Family' : 'Private Client',
                monthlyPackageTier: monthlyEntitlementDetails?.packageTier || null,
                monthlyAllowance: monthlyEntitlementDetails?.monthlyAllowance || null,
                originalAmountZar: formatZar(originalAmountCents),
                discountZar: formatZar(discountCents),
                amountZar: formatZar(amountCents),
                promoCode: null,
                promoCodeReference: monthlyEntitlementDetails?.entitlementId.slice(0, 8).toUpperCase() || null,
                promoApplied: true,
                promoDiscountPercent: 100,
                paymentMethod: 'monthly-entitlement',
                paymentStatus: 'covered',
            };
            let receiptSent = false;
            try {
                const result = await sendReceiptEmail(receipt);
                receiptSent = !result?.skipped;
            } catch (error) {
                console.error('[monthly entitlement receipt email failed]', reference, error);
            }
            res.status(200).json({ success: true, monthlyCovered: true, receiptSent, reference });
            return;
        }

        const yocoSecret = process.env.YOCO_SECRET_KEY;
        if (!yocoSecret) {
            await releaseBookingSlot(reservedSlotDate, reservedSlotTime);
            reservedSlotDate = null;
            reservedSlotTime = null;
            console.error('[Yoco checkout] Missing YOCO_SECRET_KEY. Add it to the runtime environment or root .env file and restart the API.');
            res.status(500).json({ message: 'Payment gateway is not configured. Please contact the site administrator.' });
            return;
        }

        const siteUrl = process.env.SITE_URL || 'https://sage00101.github.io/atd/';
        const idempotencyKey = crypto.randomUUID();
        await startBookingRequestCheckout(approvalRequest.reference, continuationToken);
        checkoutRequestStarted = true;

        const yocoRes = await fetch('https://payments.yoco.com/api/checkouts', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${yocoSecret}`,
                'Content-Type': 'application/json',
                'Idempotency-Key': idempotencyKey,
            },
            body: JSON.stringify({
                amount: amountCents,
                currency: 'ZAR',
                subtotalAmount: originalAmountCents,
                totalDiscount: discountCents || undefined,
                successUrl: `${siteUrl}?booking-request=${encodeURIComponent(reference)}&token=${encodeURIComponent(continuationToken)}&payment=success`,
                cancelUrl: `${siteUrl}?booking-request=${encodeURIComponent(reference)}&token=${encodeURIComponent(continuationToken)}&payment=cancelled`,
                failureUrl: `${siteUrl}?booking-request=${encodeURIComponent(reference)}&token=${encodeURIComponent(continuationToken)}&payment=failed`,
                metadata: {
                    reference,
                    packageId,
                    packageName,
                    purchaseType,
                    vehicleType: vehicleType || '',
                    bookingDate,
                    bookingTime,
                    registration: normaliseReg(customer.registration),
                    promoCode: appliedPromo || '',
                    promoCodeType: appliedPromoType || '',
                    promoReservationId: promoReservationId || '',
                    originalAmountCents,
                    discountCents,
                    customerEmail: customer.email,
                    customerMobile: customer.mobile,
                    customerName: `${customer.firstName} ${customer.surname}`.trim(),
                },
            }),
        });

        const yocoBody = await yocoRes.json().catch(() => ({}));
        if (!yocoRes.ok || !yocoBody.redirectUrl) {
            if (reservedPromoCode && promoReservationId) {
                await releaseSharedPromoCode(reservedPromoCode, promoReservationId);
                reservedPromoCode = null;
            }
            await releaseBookingSlot(reservedSlotDate, reservedSlotTime);
            reservedSlotDate = null;
            reservedSlotTime = null;
            await resetBookingRequestCheckout(approvalRequest.reference);
            checkoutRequestStarted = false;
            console.error('Yoco error', yocoBody);
            res.status(502).json({ message: yocoBody.message || 'Could not start secure payment.' });
            return;
        }

        // Store pending booking until the webhook confirms payment.
        await savePendingBooking(yocoBody.id, {
            ...booking,
            reference,
            originalAmountCents,
            amountCents,
            discountCents,
            appliedPromo,
            appliedPromoType,
            promoReservationId,
            contractFileBase64,
            contractFileName,
            yocoCheckoutId: yocoBody.id,
            approvalReference: approvalRequest.reference,
            createdAt: new Date().toISOString(),
        });
        await saveBookingRequestCheckout(approvalRequest.reference, yocoBody.redirectUrl, yocoBody.id);

        res.status(200).json({ redirectUrl: yocoBody.redirectUrl, checkoutId: yocoBody.id, reference });
    } catch (err) {
        if (reservedMonthlyWash) {
            await releaseMonthlyWashReservation(reservedMonthlyWash).catch(() => {});
        }
        if (reservedPromoCode && promoReservationId) {
            await releaseSharedPromoCode(reservedPromoCode, promoReservationId).catch(() => {});
        }
        if (reservedSlotDate && reservedSlotTime) {
            await releaseBookingSlot(reservedSlotDate, reservedSlotTime).catch(() => {});
        }
        if (checkoutRequestStarted && approvalRequest) {
            await resetBookingRequestCheckout(approvalRequest.reference).catch(() => {});
        }
        console.error(err);
        res.status(500).json({ message: 'Secure payment could not be started.' });
    }
}
