import crypto from 'node:crypto';
import { applyCors } from '../_lib/cors.js';
import { redis } from '../_lib/redis.js';

const MAX_ATTEMPTS = 10;
const ATTEMPT_WINDOW_SECONDS = 60 * 60; // 1 hour

function timingSafeEqualStrings(a, b) {
    const bufferA = Buffer.from(String(a));
    const bufferB = Buffer.from(String(b));
    if (bufferA.length !== bufferB.length) return false;
    return crypto.timingSafeEqual(bufferA, bufferB);
}

// POST /api/promo/unlock
// Body: { passphrase }
// Gate for the shared "Discount Code" marketing passphrase — unrelated to
// the per-person single-wash promo codes issued via /api/promos/issue.
export default async function handler(req, res) {
    if (applyCors(req, res)) return;
    if (req.method !== 'POST') {
        res.status(405).json({ message: 'Method not allowed.' });
        return;
    }

    const passphrase = String(req.body?.passphrase || '').trim();
    if (!passphrase) {
        res.status(400).json({ message: 'Enter the passphrase.' });
        return;
    }

    const configuredPassphrase = process.env.PROMO_PASSPHRASE;
    const configuredCode = process.env.PROMO_UNLOCK_CODE;
    if (!configuredPassphrase || !configuredCode) {
        res.status(503).json({ message: 'Promo unlock is not configured yet.' });
        return;
    }

    // Basic brute-force protection, keyed by client IP.
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';
    const attemptsKey = `promo-unlock:attempts:${ip}`;
    const attempts = Number(await redis.get(attemptsKey)) || 0;
    if (attempts >= MAX_ATTEMPTS) {
        res.status(429).json({ message: 'Too many attempts. Please try again later.' });
        return;
    }

    if (!timingSafeEqualStrings(passphrase, configuredPassphrase)) {
        await redis.set(attemptsKey, attempts + 1, { ex: ATTEMPT_WINDOW_SECONDS });
        res.status(401).json({ message: 'That passphrase doesn\u2019t match.' });
        return;
    }

    await redis.del(attemptsKey);
    res.status(200).json({ promoCode: configuredCode });
}
