import { applyCors } from '../api/_lib/cors.js';
import { redis } from '../api/_lib/redis.js';
import { getMonthlyPromoForCode } from '../api/_lib/monthly-promos.js';
import { getSharedPromoCodeStatus, PROMO_DISCOUNT_RATE } from '../api/_lib/store.js';

const RATE_LIMIT_SCRIPT = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
return count
`;

export default async function handler(req, res) {
    if (applyCors(req, res)) return;
    if (req.method !== 'POST') {
        res.status(405).json({ message: 'Method not allowed.' });
        return;
    }

    const code = typeof req.body?.promoCode === 'string' ? req.body.promoCode.trim().toUpperCase() : '';
    if (!code || code.length > 200) {
        res.status(400).json({ message: 'Enter a valid promo code.' });
        return;
    }

    try {
        const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';
        const attempts = await redis.eval(RATE_LIMIT_SCRIPT, [`promo-validation:attempts:${ip}`], ['600']);
        if (Number(attempts) > 60) {
            res.status(429).json({ message: 'Too many promo checks. Please try again later.' });
            return;
        }

        if (await getMonthlyPromoForCode(code)) {
            res.status(400).json({ message: 'Monthly client codes must be used through Monthly Users booking.' });
            return;
        }
        const result = await getSharedPromoCodeStatus(code);
        const messages = {
            invalid: 'That promo code is not valid.',
            used: 'That promo code has already been redeemed.',
            reserved: 'That promo code is currently being used in another checkout.',
        };
        if (result.status !== 'available') {
            res.status(400).json({ message: messages[result.status] || 'That promo code is unavailable.' });
            return;
        }
        res.status(200).json({ valid: true, discountPercent: PROMO_DISCOUNT_RATE * 100 });
    } catch (error) {
        console.error('[promo validation failed]', error);
        res.status(503).json({ message: 'Promo verification is temporarily unavailable. Please try again.' });
    }
}
