import crypto from 'node:crypto';
import { IncomingForm } from 'formidable';
import { applyCors } from '../../_lib/cors.js';
import { generateReferenceNumber } from '../../_lib/reference.js';
import {
    getPromoCode,
    looksLikeVehicleRegistration,
    normaliseName,
    normalisePhone,
    normaliseReg,
    savePendingBooking,
    PROMO_DISCOUNT_RATE,
    SINGLE_WASH_CENTS,
} from '../../_lib/store.js';

// Vercel must not pre-parse the multipart body — formidable needs the raw stream.
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
        if (!looksLikeVehicleRegistration(customer?.registration)) {
            res.status(400).json({ message: 'Invalid vehicle registration format.' });
            return;
        }

        const isMonthly = purchaseType === 'monthly';
        if (isMonthly) {
            const contractFiles = files.contract_files
                ? (Array.isArray(files.contract_files) ? files.contract_files : [files.contract_files])
                : [];
            if (!contractAccepted || contractFiles.length === 0) {
                res.status(400).json({ message: 'All completed package documents are required for a monthly package.' });
                return;
            }
        }

        // --- Amount calculation (server is the only source of truth for price) ---
        let originalAmountCents;
        let amountCents;
        let discountCents = 0;
        let appliedPromo = null;

        if (!isMonthly) {
            originalAmountCents = SINGLE_WASH_CENTS[vehicleType];
            if (!originalAmountCents) {
                res.status(400).json({ message: 'Unknown vehicle type.' });
                return;
            }
            amountCents = originalAmountCents;

            if (promoCode) {
                const code = String(promoCode).trim().toUpperCase();
                const record = await getPromoCode(code);
                const firstName = normaliseName(customer.firstName);
                const surname = normaliseName(customer.surname);
                const mobile = normalisePhone(customer.mobile);
                if (record && !record.usedAt && record.firstName === firstName && record.surname === surname && record.mobile === mobile) {
                    discountCents = Math.round(originalAmountCents * PROMO_DISCOUNT_RATE);
                    amountCents = originalAmountCents - discountCents;
                    appliedPromo = code;
                }
            }
        } else {
            // Monthly package pricing depends on a business decision (per-vehicle rate
            // card vs. quote-based fleet pricing) that isn't encoded in the booking
            // payload yet. Reject rather than guess an amount.
            res.status(501).json({ message: 'Monthly package payments are not yet automated. Please contact the business to arrange payment.' });
            return;
        }

        const yocoSecret = process.env.YOCO_SECRET_KEY;
        if (!yocoSecret) {
            res.status(500).json({ message: 'Payment gateway not configured.' });
            return;
        }

        const siteUrl = process.env.SITE_URL || 'https://sage00101.github.io/atd/';
        const idempotencyKey = crypto.randomUUID();
        const reference = generateReferenceNumber();

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
            yocoCheckoutId: yocoBody.id,
            createdAt: new Date().toISOString(),
        });

        res.status(200).json({ redirectUrl: yocoBody.redirectUrl, checkoutId: yocoBody.id, reference });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Secure payment could not be started.' });
    }
}
