import { applyCors } from '../_lib/cors.js';
import { getVehiclePromo, looksLikeVehicleRegistration, normaliseReg } from '../_lib/store.js';

// POST /api/promos/verify
// Body: { vehicleRegistration, purchaseType }
export default async function handler(req, res) {
    if (applyCors(req, res)) return;
    if (req.method !== 'POST') {
        res.status(405).json({ valid: false, message: 'Method not allowed.' });
        return;
    }

    const vehicleRegistration = normaliseReg(req.body?.vehicleRegistration);
    const purchaseType = req.body?.purchaseType || 'single';

    if (purchaseType !== 'single') {
        res.status(400).json({ valid: false, message: 'The vehicle registration discount applies to single washes only.' });
        return;
    }
    if (!looksLikeVehicleRegistration(vehicleRegistration)) {
        res.status(400).json({ valid: false, message: 'Enter a valid-looking vehicle registration number.' });
        return;
    }

    const record = await getVehiclePromo(vehicleRegistration);
    if (!record) {
        res.status(404).json({ valid: false, message: 'This vehicle isn\u2019t approved for a discount yet.' });
        return;
    }
    if (record.usedAt) {
        res.status(410).json({ valid: false, message: 'This vehicle\u2019s discount has already been used.' });
        return;
    }

    res.status(200).json({
        valid: true,
        discountPercent: 10,
        message: 'This vehicle qualifies for a 10% single-wash discount, applied securely at checkout. It becomes invalid after a successful purchase.',
    });
}
