import { applyCors } from '../_lib/cors.js';
import { getPromoCode, normaliseName, normalisePhone } from '../_lib/store.js';

// POST /api/promos/verify
// Body: { promoCode, firstName, surname, mobile, purchaseType }
export default async function handler(req, res) {
    if (applyCors(req, res)) return;
    if (req.method !== 'POST') {
        res.status(405).json({ valid: false, message: 'Method not allowed.' });
        return;
    }

    const promoCode = String(req.body?.promoCode || '').trim().toUpperCase();
    const firstName = normaliseName(req.body?.firstName);
    const surname = normaliseName(req.body?.surname);
    const mobile = normalisePhone(req.body?.mobile);
    const purchaseType = req.body?.purchaseType || 'single';

    if (purchaseType !== 'single') {
        res.status(400).json({ valid: false, message: 'Promo codes apply to single washes only.' });
        return;
    }
    if (!promoCode) {
        res.status(400).json({ valid: false, message: 'Enter a promo code.' });
        return;
    }
    if (!firstName || !surname || mobile.length < 7) {
        res.status(400).json({ valid: false, message: 'Enter your first name, surname and cell number above.' });
        return;
    }

    const record = await getPromoCode(promoCode);
    if (!record) {
        res.status(404).json({ valid: false, message: 'This promo code was not found.' });
        return;
    }
    if (record.usedAt) {
        res.status(410).json({ valid: false, message: 'This promo code has already been used.' });
        return;
    }
    if (record.firstName !== firstName || record.surname !== surname || record.mobile !== mobile) {
        res.status(400).json({
            valid: false,
            message: 'This promo code is not linked to the name and cell number you entered.',
        });
        return;
    }

    res.status(200).json({
        valid: true,
        discountPercent: 10,
        message: 'Promo verified. A 10% single-wash discount will be applied securely at checkout. The code becomes invalid after a successful purchase.',
    });
}
