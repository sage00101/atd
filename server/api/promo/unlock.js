import { applyCors } from '../_lib/cors.js';
import { redis } from '../_lib/redis.js';
import { findSharedPromoForPassword } from '../_lib/store.js';

const MAX_ATTEMPTS = 10;
const ATTEMPT_WINDOW_SECONDS = 60 * 60; // 1 hour

// POST /api/promo/unlock
// Body: { passphrase }
// The active password/code batch is stored in Redis and never sent to the client.
export default async function handler(req, res) {
    if (applyCors(req, res)) return;
    if (req.method !== 'POST') {
        res.status(405).json({ message: 'Method not allowed.' });
        return;
    }

    const password = String(req.body?.passphrase || '').trim();
    if (!password) {
        res.status(400).json({ message: 'Enter your password.' });
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

    const match = await findSharedPromoForPassword(password);
    if (match.status === 'unconfigured') {
        res.status(503).json({ message: 'Promo codes have not been loaded yet.' });
        return;
    }
    if (match.status === 'used') {
        res.status(410).json({ message: 'The promo code linked to this password has already been redeemed.' });
        return;
    }
    if (match.status === 'reserved') {
        res.status(409).json({ message: 'This promo code is currently being used in a checkout.' });
        return;
    }
    if (match.status !== 'available') {
        await redis.set(attemptsKey, attempts + 1, { ex: ATTEMPT_WINDOW_SECONDS });
        res.status(401).json({ message: 'That password does not match.' });
        return;
    }

    await redis.del(attemptsKey);
    res.status(200).json({ promoCode: match.promoCode });
}
