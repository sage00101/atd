import crypto from 'node:crypto';
import { applyCors } from '../../_lib/cors.js';
import { pendingBookings, processedWebhookIds, promoCodes } from '../../_lib/store.js';

// Vercel must not pre-parse the body — signature verification requires the
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

    if (processedWebhookIds.has(webhookId)) {
        res.status(200).send('already processed');
        return;
    }
    processedWebhookIds.add(webhookId);

    let event;
    try {
        event = JSON.parse(rawBody.toString('utf8'));
    } catch {
        res.status(400).send('bad payload');
        return;
    }

    if (event.type !== 'payment.succeeded') {
        res.status(200).send('ignored');
        return;
    }

    const checkoutId = event.payload?.metadata?.checkoutId;
    const pending = checkoutId ? pendingBookings.get(checkoutId) : null;
    const meta = event.payload?.metadata || pending || {};

    // Mark the promo used only after payment is confirmed.
    const promo = meta.promoCode || pending?.appliedPromo;
    if (promo && promoCodes.has(promo)) {
        const record = promoCodes.get(promo);
        if (!record.usedAt) {
            record.usedAt = new Date().toISOString();
            promoCodes.set(promo, record);
        }
    }

    // TODO: persist the confirmed booking in a real database here.

    const amountCents = pending?.amountCents || event.payload?.amount || 0;
    const receipt = {
        bookingDate: meta.bookingDate || pending?.bookingDate,
        bookingTime: meta.bookingTime || pending?.bookingTime,
        packageName: meta.packageName || pending?.packageName,
        vehicleType: meta.vehicleType || pending?.vehicleType,
        registration: meta.registration || pending?.customer?.registration,
        customerName: meta.customerName || `${pending?.customer?.firstName || ''} ${pending?.customer?.surname || ''}`.trim(),
        customerEmail: meta.customerEmail || pending?.customer?.email,
        customerMobile: meta.customerMobile || pending?.customer?.mobile,
        address: pending?.customer?.address,
        amountZar: `R${(amountCents / 100).toFixed(2)}`,
        promoCode: promo || null,
        yocoRef: checkoutId || event.id,
    };

    // TODO: send receipt email / business SMS (Resend, Twilio, etc.) using `receipt`.
    console.log('[payment.succeeded]', receipt);

    if (checkoutId) pendingBookings.delete(checkoutId);
    res.status(200).send('ok');
}
