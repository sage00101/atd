import crypto from 'node:crypto';
import '../../_lib/load-env.js';
import { applyCors } from '../_lib/cors.js';
import { recordResendEmailEvent } from '../_lib/monthly-promos.js';

export const config = { api: { bodyParser: false } };

function readRawBody(req) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        req.on('data', (chunk) => chunks.push(chunk));
        req.on('end', () => resolve(Buffer.concat(chunks)));
        req.on('error', reject);
    });
}

function verifySignature({ webhookId, timestamp, rawBody, signatureHeader, secret }) {
    if (!webhookId || !timestamp || !signatureHeader || !secret) return false;
    const timestampSeconds = Number(timestamp);
    if (!Number.isFinite(timestampSeconds) || Math.abs(Date.now() / 1000 - timestampSeconds) > 300) return false;

    let secretBytes;
    try {
        secretBytes = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
    } catch {
        return false;
    }
    if (!secretBytes.length) return false;
    const content = `${webhookId}.${timestamp}.${rawBody.toString('utf8')}`;
    const expected = crypto.createHmac('sha256', secretBytes).update(content).digest('base64');
    const expectedBuffer = Buffer.from(expected);
    return signatureHeader.split(' ').some((part) => {
        const candidate = part.split(',')[1];
        if (!candidate) return false;
        const candidateBuffer = Buffer.from(candidate);
        return candidateBuffer.length === expectedBuffer.length
            && crypto.timingSafeEqual(candidateBuffer, expectedBuffer);
    });
}

export default async function handler(req, res) {
    if (applyCors(req, res)) return;
    if (req.method !== 'POST') {
        res.status(405).send('method not allowed');
        return;
    }

    const rawBody = await readRawBody(req);
    const webhookId = req.headers['svix-id'];
    const timestamp = req.headers['svix-timestamp'];
    const signatureHeader = req.headers['svix-signature'];
    const verified = verifySignature({
        webhookId,
        timestamp,
        rawBody,
        signatureHeader,
        secret: process.env.RESEND_WEBHOOK_SECRET,
    });
    if (!verified) {
        res.status(403).send('invalid signature');
        return;
    }

    let event;
    try {
        event = JSON.parse(rawBody.toString('utf8'));
    } catch {
        res.status(400).send('bad payload');
        return;
    }
    const providerEmailId = event.data?.email_id || event.data?.id;
    if (!providerEmailId || !event.type) {
        res.status(400).send('missing email event data');
        return;
    }

    try {
        const result = await recordResendEmailEvent({
            webhookId,
            providerEmailId,
            eventType: event.type,
            occurredAt: event.created_at,
        });
        res.status(200).json({ received: true, result });
    } catch (error) {
        console.error('[Resend webhook] Could not record email event.', error);
        res.status(500).send('could not record email event');
    }
}
