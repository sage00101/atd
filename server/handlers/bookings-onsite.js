import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import { IncomingForm } from 'formidable';
import { applyCors } from '../api/_lib/cors.js';
import { sendReceiptEmail } from '../api/_lib/email.js';
import { getServiceAreaError } from '../api/_lib/service-area.js';
import {
    authorizeBookingContinuation,
    completeMonthlyBookingRequest,
    markBookingRequestConfirmed,
    resetBookingRequestCheckout,
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
    normaliseEmail,
    normaliseReg,
    releaseBookingSlot,
    releaseSharedPromoCode,
    reserveSharedPromoCode,
    saveOnsiteBooking,
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

// POST /api/bookings/onsite
// Reserves a real appointment slot with no online payment collected — the
// customer pays the business directly on the day (Yoco card machine, tap to
// pay, or Google/Apple Pay from their phone). Mirrors the validation and
// pricing logic in /api/payments/yoco/checkout.js, minus the Yoco call.
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
            res.status(403).json({ message: 'A business-approved booking request is required before finalising a booking.' });
            return;
        }
        const authorization = await authorizeBookingContinuation(approvalReference, continuationToken);
        if (authorization.error) {
            res.status(403).json({ message: authorization.error });
            return;
        }
        approvalRequest = authorization.request;
        if (approvalRequest.paymentMethod !== 'onsite') {
            res.status(400).json({ message: 'This booking request was set up for online payment.' });
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
        if (!looksLikeVehicleRegistration(customer?.registration) || !looksLikeEmail(customer?.email)) {
            res.status(400).json({ message: 'Enter a valid email address and vehicle registration.' });
            return;
        }
        const isMonthly = purchaseType === 'monthly';
        if (bookingType && !isMonthlyWashBooking) {
            res.status(400).json({ message: 'Unknown booking type.' });
            return;
        }
        if (isMonthlyWashBooking
            && (!String(customer?.firstName || '').trim() || !String(customer?.surname || '').trim()
                || !String(customer?.mobile || '').trim())) {
            res.status(400).json({ message: 'Enter your name and mobile number for the monthly booking.' });
            return;
        }
        if (isMonthlyWashBooking && (isMonthly || !['private', 'business'].includes(monthlyClientType)
            || !['standard', 'premium'].includes(monthlyPackageTier) || !approvalRequest.monthlyReservation)) {
            res.status(400).json({ message: 'Select a valid monthly client package with an active wash reservation.' });
            return;
        }
        if (isMonthly && promoCode) {
            res.status(400).json({ message: 'Promo codes are available for single washes only.' });
            return;
        }
        const reference = approvalRequest.reference;

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

        // --- Amount calculation (quoted for the receipt; no money moves online) ---
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
                    const promoHoldSeconds = Math.max(60 * 60, Math.ceil((slotDateTime.getTime() + 48 * 60 * 60 * 1000 - Date.now()) / 1000));
                    const reserved = await reserveSharedPromoCode(status.promoCode, promoReservationId, promoHoldSeconds);
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

        const bookingRecord = {
            ...booking,
            reference,
            originalAmountCents,
            amountCents,
            discountCents,
            appliedPromo,
            appliedPromoType,
            promoCode: reservedMonthlyWash ? null : promoCode,
            bookingType: reservedMonthlyWash ? 'monthly-entitlement' : bookingType,
            packageName: reservedMonthlyWash
                ? `Monthly Client Wash - ${reservedMonthlyWash.packageTier === 'premium' ? 'Premium' : 'Standard'} Package`
                : packageName,
            promoReservationId: reservedMonthlyWash?.reservationId || promoReservationId,
            monthlyEntitlementId: reservedMonthlyWash?.entitlementId || null,
            monthlyUsagePeriod: reservedMonthlyWash?.period || null,
            monthlyClientType: reservedMonthlyWash?.clientType || null,
            monthlyPackageTier: reservedMonthlyWash?.packageTier || null,
            monthlyAllowance: reservedMonthlyWash?.monthlyAllowance || null,
            promoCodeReference: reservedMonthlyWash?.entitlementId.slice(0, 8).toUpperCase() || null,
            contractFileBase64,
            contractFileName,
            paymentMethod: 'onsite',
            customer: { ...customer, email: normaliseEmail(customer.email), registration: normaliseReg(customer.registration) },
            createdAt: new Date().toISOString(),
        };
        const monthlyCovered = Boolean(reservedMonthlyWash);
        if (reservedMonthlyWash) {
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
        } else {
            await startBookingRequestCheckout(approvalRequest.reference, continuationToken);
            checkoutRequestStarted = true;
            await saveOnsiteBooking(reference, bookingRecord);
            await markBookingRequestConfirmed(approvalRequest.reference);
        }

        const formatZar = (cents) => `R${(cents / 100).toFixed(2)}`;
        const receipt = {
            reference,
            bookingDate,
            bookingTime,
            packageName: monthlyCovered ? bookingRecord.packageName : packageName,
            vehicleType: vehicleType || '',
            registration: normaliseReg(customer.registration),
            customerName: `${customer.firstName} ${customer.surname}`.trim(),
            customerEmail: customer.email,
            customerMobile: customer.mobile,
            address: customer.address,
            bookingType: monthlyCovered ? 'monthly-entitlement' : 'single-wash',
            customerType: monthlyEntitlementDetails?.clientType === 'business' ? 'Business / Fleet / Family' : monthlyEntitlementDetails ? 'Private Client' : null,
            monthlyPackageTier: monthlyEntitlementDetails?.packageTier || null,
            monthlyAllowance: monthlyEntitlementDetails?.monthlyAllowance || null,
            originalAmountZar: formatZar(originalAmountCents),
            discountZar: discountCents > 0 ? formatZar(discountCents) : null,
            amountZar: formatZar(amountCents),
            promoCode: monthlyCovered ? null : appliedPromo || null,
            promoCodeReference: monthlyEntitlementDetails?.entitlementId.slice(0, 8).toUpperCase() || null,
            promoApplied: Boolean(appliedPromo && discountCents > 0),
            promoDiscountPercent: monthlyCovered ? 100 : 50,
            paymentMethod: monthlyCovered ? 'monthly-entitlement' : 'onsite',
            paymentStatus: monthlyCovered ? 'covered' : 'unpaid',
        };

        let receiptSent = false;
        try {
            const contractAttachment = contractFileBase64 && contractFileName
                ? { filename: contractFileName, content: contractFileBase64 }
                : null;
            const result = await sendReceiptEmail(receipt, contractAttachment);
            receiptSent = !result?.skipped;
        } catch (err) {
            console.error('[onsite receipt email failed]', receipt.reference, err);
        }

        res.status(200).json({ success: true, reference, receiptSent, monthlyCovered });
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
        res.status(500).json({ message: 'Booking could not be confirmed. Please try again.' });
    }
}
