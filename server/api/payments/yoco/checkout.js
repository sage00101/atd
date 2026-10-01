import crypto from 'node:crypto';
import { IncomingForm } from 'formidable';
import { applyCors } from '../../_lib/cors.js';
import {
    claimUniqueReferenceNumber,
    getSharedPromoCodeStatus,
    looksLikeVehicleRegistration,
    normaliseReg,
    releaseBookingSlot,
    releaseSharedPromoCode,
    reserveBookingSlot,
    reserveSharedPromoCode,
    savePendingBooking,
    PROMO_DISCOUNT_RATE,
    SINGLE_WASH_CENTS,
} from '../../_lib/store.js';

// Business operates in South Africa (UTC+2, no DST) — anchor the quoted
// booking date/time to that fixed offset regardless of the server's own TZ.
const SA_UTC_OFFSET = '+02:00';
const MIN_LEAD_TIME_MS = 3 * 60 * 60 * 1000; // customers must book at least 3 hours ahead

// Do not pre-parse the multipart body — formidable needs the raw stream.
export const config = { api: { bodyParser: false } };

const REQUIRED_CONTRACT_FILE_NAME = 'Supplier_Client Contract Agreement.docx';

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
        if (!looksLikeVehicleRegistration(customer?.registration)) {
            res.status(400).json({ message: 'Invalid vehicle registration format.' });
            return;
        }
        const reference = await claimUniqueReferenceNumber();
        const slotReserved = await reserveBookingSlot(bookingDate, bookingTime, reference);
        if (!slotReserved) {
            res.status(409).json({ message: 'That time slot was just booked by someone else. Please choose another.' });
            return;
        }
        reservedSlotDate = bookingDate;
        reservedSlotTime = bookingTime;

        const isMonthly = purchaseType === 'monthly';
        if (isMonthly) {
            const contractFiles = files.contract_files
                ? (Array.isArray(files.contract_files) ? files.contract_files : [files.contract_files])
                : [];
            const [contractFile] = contractFiles;
            const isValidContractFile = contractFiles.length === 1
                && contractFile?.originalFilename === REQUIRED_CONTRACT_FILE_NAME
                && (contractFile.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
                    || contractFile.originalFilename.toLowerCase().endsWith('.docx'))
                && contractFile.size <= 10 * 1024 * 1024;
            if (!contractAccepted || !isValidContractFile) {
                await releaseBookingSlot(reservedSlotDate, reservedSlotTime);
                reservedSlotDate = null;
                reservedSlotTime = null;
                res.status(400).json({ message: `Attach the completed ${REQUIRED_CONTRACT_FILE_NAME} to continue.` });
                return;
            }
        }

        const yocoSecret = process.env.YOCO_SECRET_KEY;
        if (!yocoSecret) {
            await releaseBookingSlot(reservedSlotDate, reservedSlotTime);
            reservedSlotDate = null;
            reservedSlotTime = null;
            res.status(500).json({ message: 'Payment gateway not configured.' });
            return;
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
        } else {
            // Monthly package pricing depends on a business decision (per-vehicle rate
            // card vs. quote-based fleet pricing) that isn't encoded in the booking
            // payload yet. Reject rather than guess an amount.
            await releaseBookingSlot(reservedSlotDate, reservedSlotTime);
            reservedSlotDate = null;
            reservedSlotTime = null;
            res.status(501).json({ message: 'Monthly package payments are not yet automated. Please contact the business to arrange payment.' });
            return;
        }

        const siteUrl = process.env.SITE_URL || 'https://sage00101.github.io/atd/';
        const idempotencyKey = crypto.randomUUID();

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
                successUrl: `${siteUrl}?payment=success&ref=${reference}#booking`,
                cancelUrl: `${siteUrl}?payment=cancelled#booking`,
                failureUrl: `${siteUrl}?payment=failed#booking`,
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
            yocoCheckoutId: yocoBody.id,
            createdAt: new Date().toISOString(),
        });

        res.status(200).json({ redirectUrl: yocoBody.redirectUrl, checkoutId: yocoBody.id, reference });
    } catch (err) {
        if (reservedPromoCode && promoReservationId) {
            await releaseSharedPromoCode(reservedPromoCode, promoReservationId).catch(() => {});
        }
        if (reservedSlotDate && reservedSlotTime) {
            await releaseBookingSlot(reservedSlotDate, reservedSlotTime).catch(() => {});
        }
        console.error(err);
        res.status(500).json({ message: 'Secure payment could not be started.' });
    }
}
