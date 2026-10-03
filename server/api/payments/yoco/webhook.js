import crypto from 'node:crypto';
import { applyCors } from '../../_lib/cors.js';
import { sendReceiptEmail } from '../../_lib/email.js';
import {
    getBooking,
    getVehiclePromo,
    hasProcessedWebhook,
    markBookingConfirmed,
    markSharedPromoCodeUsed,
    markVehiclePromoUsed,
    markWebhookProcessed,
    releaseBookingSlot,
    releaseSharedPromoCode,
} from '../../_lib/store.js';

// Do not pre-parse the body — signature verification requires the
// exact raw bytes that Yoco signed.
export const config = { api: { bodyParser: false } };

function readRawBody(req) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        req.on('data', (chunk) => chunks.push(chunk));
        req.on('end', () => resolve(Buffer.concat(chunks)));
        req.on('error', reject);
    });
}

/** Verifies the Yoco Standard Webhooks signature. Returns true only if authentic and fresh. */
function verifySignature({ webhookId, timestamp, rawBody, signatureHeader, secret }) {
    if (!webhookId || !timestamp || !signatureHeader || !secret) return false;

    const timestampSeconds = Number(timestamp);
    if (!Number.isFinite(timestampSeconds) || Math.abs(Date.now() / 1000 - timestampSeconds) > 180) {
        return false; // reject stale/replayed events (>3 minutes old)
    }

    const secretBytes = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
    const signedContent = `${webhookId}.${timestamp}.${rawBody.toString('utf8')}`;
    const expectedSignature = crypto.createHmac('sha256', secretBytes).update(signedContent).digest('base64');
    const expectedBuffer = Buffer.from(expectedSignature);

    return signatureHeader
        .split(' ')
        .map((entry) => entry.split(',')[1])
        .filter(Boolean)
        .some((candidate) => {
            const candidateBuffer = Buffer.from(candidate);
            return candidateBuffer.length === expectedBuffer.length
                && crypto.timingSafeEqual(candidateBuffer, expectedBuffer);
        });
}

// POST /api/payments/yoco/webhook
export default async function handler(req, res) {
    if (applyCors(req, res)) return;
    if (req.method !== 'POST') {
        res.status(405).send('method not allowed');
        return;
    }

    const rawBody = await readRawBody(req);
    const webhookId = req.headers['webhook-id'];
    const timestamp = req.headers['webhook-timestamp'];
    const signatureHeader = req.headers['webhook-signature'];
    const secret = process.env.YOCO_WEBHOOK_SECRET;

    const verified = verifySignature({ webhookId, timestamp, rawBody, signatureHeader, secret });
    if (!verified) {
        res.status(403).send('invalid signature');
        return;
    }

    if (await hasProcessedWebhook(webhookId)) {
        res.status(200).send('already processed');
        return;
    }
    await markWebhookProcessed(webhookId);

    let event;
    try {
        event = JSON.parse(rawBody.toString('utf8'));
    } catch {
        res.status(400).send('bad payload');
        return;
    }

    const checkoutId = event.payload?.metadata?.checkoutId;
    const pending = checkoutId ? await getBooking(checkoutId) : null;
    const meta = event.payload?.metadata || pending || {};

    if (event.type === 'payment.failed') {
        const promo = meta.promoCode || pending?.appliedPromo;
        const reservationId = meta.promoReservationId || pending?.promoReservationId;
        if (meta.promoCodeType === 'shared-code' && promo && reservationId) {
            await releaseSharedPromoCode(promo, reservationId);
        }
        await releaseBookingSlot(meta.bookingDate || pending?.bookingDate, meta.bookingTime || pending?.bookingTime);
        res.status(200).send('ignored');
        return;
    }
    if (event.type !== 'payment.succeeded') {
        res.status(200).send('ignored');
        return;
    }

    const payment = event.payload;
    if (
        !pending
        || payment?.type !== 'payment'
        || payment?.status !== 'succeeded'
        || payment?.currency !== 'ZAR'
        || Number(payment?.amount) !== Number(pending.amountCents)
    ) {
        console.error('[payment confirmation rejected]', {
            checkoutId,
            pendingFound: Boolean(pending),
            paymentType: payment?.type,
            paymentStatus: payment?.status,
            currency: payment?.currency,
            amount: payment?.amount,
        });
        res.status(200).send('ignored');
        return;
    }

    // Redeem a shared code or vehicle promo only after payment is confirmed.
    const promo = meta.promoCode || pending?.appliedPromo;
    const promoCodeType = meta.promoCodeType || pending?.appliedPromoType;
    if (promo && promoCodeType === 'shared-code') {
        const reservationId = meta.promoReservationId || pending?.promoReservationId;
        if (reservationId) await markSharedPromoCodeUsed(promo, reservationId);
    } else if (promo && await getVehiclePromo(promo)) {
        await markVehiclePromoUsed(promo);
    }

    // TODO: persist the confirmed booking in a real database here.

    const amountCents = pending?.amountCents || event.payload?.amount || 0;
    const discountCents = Number(meta.discountCents || pending?.discountCents || 0);
    const originalAmountCents = Number(meta.originalAmountCents || pending?.originalAmountCents || amountCents + discountCents);
    const formatZar = (cents) => `R${(cents / 100).toFixed(2)}`;
    const receipt = {
        reference: meta.reference || pending?.reference || (checkoutId || event.id),
        bookingDate: meta.bookingDate || pending?.bookingDate,
        bookingTime: meta.bookingTime || pending?.bookingTime,
        packageName: meta.packageName || pending?.packageName,
        vehicleType: meta.vehicleType || pending?.vehicleType,
        registration: meta.registration || pending?.customer?.registration,
        customerName: meta.customerName || `${pending?.customer?.firstName || ''} ${pending?.customer?.surname || ''}`.trim(),
        customerEmail: meta.customerEmail || pending?.customer?.email,
        customerMobile: meta.customerMobile || pending?.customer?.mobile,
        address: pending?.customer?.address,
        originalAmountZar: formatZar(originalAmountCents),
        discountZar: discountCents > 0 ? formatZar(discountCents) : null,
        amountZar: formatZar(amountCents),
        promoCode: promo || null,
        promoApplied: Boolean(promo && discountCents > 0),
        paymentMethod: 'online',
        yocoRef: checkoutId || event.id,
    };

    try {
        const contractAttachment = pending?.contractFileBase64 && pending?.contractFileName
            ? { filename: pending.contractFileName, content: pending.contractFileBase64 }
            : null;
        await sendReceiptEmail(receipt, contractAttachment);
    } catch (err) {
        console.error('[receipt email failed]', receipt.reference, err);
    }

    // Keep the slot durably blocked (booking stays, just flipped to "paid").
    if (checkoutId) await markBookingConfirmed(checkoutId);
    res.status(200).send('ok');
}
