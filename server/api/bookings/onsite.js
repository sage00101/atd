import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import { IncomingForm } from 'formidable';
import { applyCors } from '../_lib/cors.js';
import { sendReceiptEmail } from '../_lib/email.js';
import {
    claimUniqueReferenceNumber,
    getSharedPromoCodeStatus,
    looksLikeEmail,
    looksLikeVehicleRegistration,
    normaliseEmail,
    normaliseReg,
    releaseBookingSlot,
    releaseSharedPromoCode,
    reserveBookingSlot,
    reserveSharedPromoCode,
    saveOnsiteBooking,
    MONTHLY_PACKAGE_CENTS,
    PROMO_DISCOUNT_RATE,
    SINGLE_WASH_CENTS,
} from '../_lib/store.js';

// Business operates in South Africa (UTC+2, no DST) — anchor the quoted
// booking date/time to that fixed offset regardless of the server's own TZ.
const SA_UTC_OFFSET = '+02:00';
const MIN_LEAD_TIME_MS = 3 * 60 * 60 * 1000; // customers must book at least 3 hours ahead

// Do not pre-parse the multipart body — formidable needs the raw stream.
export const config = { api: { bodyParser: false } };

const ONSITE_SLOT_TTL_SECONDS = 60 * 60 * 24 * 365;

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
    let reservedSlotDate = null;
    let reservedSlotTime = null;
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

        const {
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
        } = booking;

        if (!serviceAreaAccepted || !termsAccepted) {
            res.status(400).json({ message: 'Required confirmations missing.' });
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
        if (isMonthly && promoCode) {
            res.status(400).json({ message: 'Promo codes are available for single washes only.' });
            return;
        }
        const reference = await claimUniqueReferenceNumber();
        const slotReserved = await reserveBookingSlot(bookingDate, bookingTime, reference, ONSITE_SLOT_TTL_SECONDS);
        if (!slotReserved) {
            res.status(409).json({ message: 'That time slot was just booked by someone else. Please choose another.' });
            return;
        }
        reservedSlotDate = bookingDate;
        reservedSlotTime = bookingTime;

        let contractFileBase64 = null;
        let contractFileName = null;
        if (isMonthly) {
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
            const fileBuffer = await fs.readFile(contractFile.filepath);
            contractFileBase64 = fileBuffer.toString('base64');
            contractFileName = contractFile.originalFilename;
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

            if (promoCode) {
                const submittedCode = String(promoCode).trim().toUpperCase();
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

        await saveOnsiteBooking(reference, {
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
            paymentMethod: 'onsite',
            customer: { ...customer, email: normaliseEmail(customer.email), registration: normaliseReg(customer.registration) },
            createdAt: new Date().toISOString(),
        });

        const formatZar = (cents) => `R${(cents / 100).toFixed(2)}`;
        const receipt = {
            reference,
            bookingDate,
            bookingTime,
            packageName,
            vehicleType: vehicleType || '',
            registration: normaliseReg(customer.registration),
            customerName: `${customer.firstName} ${customer.surname}`.trim(),
            customerEmail: customer.email,
            customerMobile: customer.mobile,
            address: customer.address,
            originalAmountZar: formatZar(originalAmountCents),
            discountZar: discountCents > 0 ? formatZar(discountCents) : null,
            amountZar: formatZar(amountCents),
            promoCode: appliedPromo || null,
            promoApplied: Boolean(appliedPromo && discountCents > 0),
            paymentMethod: 'onsite',
            paymentStatus: 'unpaid',
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

        res.status(200).json({ success: true, reference, receiptSent });
    } catch (err) {
        if (reservedPromoCode && promoReservationId) {
            await releaseSharedPromoCode(reservedPromoCode, promoReservationId).catch(() => {});
        }
        if (reservedSlotDate && reservedSlotTime) {
            await releaseBookingSlot(reservedSlotDate, reservedSlotTime).catch(() => {});
        }
        console.error(err);
        res.status(500).json({ message: 'Booking could not be confirmed. Please try again.' });
    }
}
