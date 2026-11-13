import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import { IncomingForm } from 'formidable';
import { hasMinimumBookingNotice } from '../api/_lib/booking-time.js';
import { applyCors } from '../api/_lib/cors.js';
import { sendReceiptEmail } from '../api/_lib/email.js';
import { getServiceAddressError } from '../api/_lib/service-address.js';
import {
    beginBookingContinuation,
    completeBookingContinuation,
    resetBookingContinuation,
} from '../api/_lib/booking-approval.js';
import {
    confirmMonthlyWashReservation,
    getMonthlyReservationError,
    releaseMonthlyWashReservation,
    reserveMonthlyWash,
} from '../api/_lib/monthly-promos.js';
import {
    claimUniqueReferenceNumber,
    getSharedPromoCodeStatus,
    looksLikeEmail,
    looksLikeVehicleRegistration,
    normaliseEmail,
    normaliseReg,
    releaseBookingSlot as releaseUnapprovedBookingSlot,
    releaseBookingSlotIfOwned,
    releaseSharedPromoCode,
    reserveBookingSlot,
    reserveSharedPromoCode,
    saveOnsiteBooking,
    getMonthlyPackageTotalCents,
    PROMO_DISCOUNT_RATE,
    SINGLE_WASH_CENTS,
} from '../api/_lib/store.js';

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
    const releaseBookingSlot = async (date, time) => {
        if (!approvalRequest) {
            await releaseUnapprovedBookingSlot(date, time);
            return;
        }
        const remainingTtl = Math.ceil((Number(approvalRequest.approvalExpiresAt) - Date.now()) / 1000);
        if (remainingTtl > 0) {
            await reserveBookingSlot(date, time, approvalRequest.reference, remainingTtl);
        } else {
            await releaseBookingSlotIfOwned(date, time, approvalRequest.reference);
        }
    };
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

        const approvalToken = String(booking.approvalToken || '').trim();
        if (!approvalToken) {
            res.status(403).json({ message: 'A valid approved booking request is required before booking.' });
            return;
        }
        let continuation;
        try {
            continuation = await beginBookingContinuation(approvalToken);
        } catch (error) {
            res.status(403).json({ message: error instanceof Error ? error.message : 'This booking approval link is invalid or expired.' });
            return;
        }
        if (continuation.status === 'EXISTING_CHECKOUT') {
            res.status(409).json({ message: 'This booking is already awaiting completion.' });
            return;
        }
        approvalRequest = continuation.request;
        if (approvalRequest.booking.requestedPaymentMethod !== 'onsite') {
            await resetBookingContinuation(approvalRequest.id);
            approvalRequest = null;
            res.status(400).json({ message: 'Continue this booking using the payment method selected in your request.' });
            return;
        }
        booking = { ...approvalRequest.booking, paymentMethod: 'onsite' };

        booking = {
            ...booking,
            paymentMethod: 'onsite',
            customer: {
                ...booking.customer,
                email: normaliseEmail(booking.customer?.email),
                registration: normaliseReg(booking.customer?.registration),
            },
        };

        const {
            purchaseType,
            packageId,
            packageName,
            vehicleType,
            fleetSizeTier,
            fleetVehicleCount,
            bookingDate,
            bookingTime,
            promoCode,
            customer,
            termsAccepted,
            contractAccepted,
            bookingType,
            monthlyClientType,
            monthlyPackageTier,
        } = booking;
        const isMonthlyWashBooking = bookingType === 'monthly-entitlement';

        if (!termsAccepted) {
            res.status(400).json({ message: 'Required confirmations missing.' });
            return;
        }
        const serviceAddressError = getServiceAddressError(customer?.address);
        if (serviceAddressError) {
            res.status(400).json({ message: serviceAddressError });
            return;
        }
        if (!bookingDate || !bookingTime) {
            res.status(400).json({ message: 'Choose a date and time.' });
            return;
        }
        if (!hasMinimumBookingNotice(bookingDate, bookingTime)) {
            res.status(400).json({ message: 'Bookings require at least 1 hour notice. Please choose a later time.' });
            return;
        }
        if (!looksLikeVehicleRegistration(customer?.registration) || !looksLikeEmail(customer?.email)) {
            res.status(400).json({ message: 'Enter a valid email address and vehicle registration.' });
            return;
        }
        if (!String(customer?.firstName || '').trim()
            || !String(customer?.surname || '').trim()
            || !String(customer?.mobile || '').trim()) {
            res.status(400).json({ message: 'Enter your name and mobile number.' });
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
            || !['standard', 'premium'].includes(monthlyPackageTier))) {
            res.status(400).json({ message: 'Select a valid monthly client package with an active wash reservation.' });
            return;
        }
        if (isMonthly && promoCode) {
            res.status(400).json({ message: 'Promo codes are available for single washes only.' });
            return;
        }
        const reference = approvalRequest.reference || await claimUniqueReferenceNumber();
        if (!await reserveBookingSlot(bookingDate, bookingTime, reference, 60 * 60 * 24 * 90)) {
            res.status(409).json({ message: 'That time slot was just booked by someone else. Please choose another.' });
            return;
        }
        reservedSlotDate = bookingDate;
        reservedSlotTime = bookingTime;

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
                const reservationId = crypto.randomUUID();
                const monthly = await reserveMonthlyWash({
                    promoCode,
                    email: customer.email,
                    bookingDate,
                    reservationId,
                    reference,
                    expectedClientType: monthlyClientType,
                    expectedPackageTier: monthlyPackageTier,
                    expectedVehicleType: vehicleType,
                    bookingDetails: {
                        customerName: `${customer.firstName} ${customer.surname}`.trim(),
                        vehicleType,
                    },
                });
                if (monthly.status !== 'OK') {
                    await releaseBookingSlot(reservedSlotDate, reservedSlotTime);
                    reservedSlotDate = null;
                    reservedSlotTime = null;
                    const error = getMonthlyReservationError(monthly.status);
                    res.status(error.statusCode).json({ message: error.message });
                    return;
                }
                reservedMonthlyWash = {
                    entitlementId: monthly.entitlement.id,
                    period: monthly.period,
                    reservationId,
                    clientType: monthly.entitlement.clientType,
                    packageTier: monthly.entitlement.packageTier,
                    monthlyAllowance: monthly.entitlement.monthlyAllowance,
                };
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
                    expectedVehicleType: isMonthlyWashBooking ? vehicleType : '',
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
            originalAmountCents = getMonthlyPackageTotalCents(packageId, vehicleType, fleetSizeTier, fleetVehicleCount);
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
            const confirmation = await confirmMonthlyWashReservation({
                ...reservedMonthlyWash,
                reference,
                booking: bookingRecord,
            });
            if (confirmation !== 'OK' && confirmation !== 'DUPLICATE') {
                await releaseMonthlyWashReservation(reservedMonthlyWash);
                reservedMonthlyWash = null;
                await releaseBookingSlot(reservedSlotDate, reservedSlotTime);
                reservedSlotDate = null;
                reservedSlotTime = null;
                const error = getMonthlyReservationError(confirmation);
                res.status(error.statusCode).json({ message: error.message });
                return;
            }
            reservedMonthlyWash = null;
            reservedSlotDate = null;
            reservedSlotTime = null;
        } else {
            await saveOnsiteBooking(reference, bookingRecord);
            reservedSlotDate = null;
            reservedSlotTime = null;
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

        await completeBookingContinuation(approvalRequest.id, { status: 'confirmed' });
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
        console.error(err);
        res.status(500).json({ message: 'Booking could not be confirmed. Please try again.' });
    } finally {
        if (approvalRequest) {
            await resetBookingContinuation(approvalRequest.id).catch((error) => {
                console.error('[booking approval continuation lock release failed]', approvalRequest.reference, error);
            });
        }
    }
}
