import { applyCors } from '../_lib/cors.js';
import { sendPromoCodeEmail } from '../_lib/email.js';
import { issuePromoForRegistration } from '../_lib/store.js';

// POST /api/promos/issue
// Header: x-admin-key: <ADMIN_API_KEY>
// Body: { vehicleRegistration, email }
// Call this yourself once you've manually verified a vehicle promo
// registration (e.g. from the Formspree submission email).
export default async function handler(req, res) {
    if (applyCors(req, res)) return;
    if (req.method !== 'POST') {
        res.status(405).json({ message: 'Method not allowed.' });
        return;
    }

    const adminKey = process.env.ADMIN_API_KEY;
    if (!adminKey || req.headers['x-admin-key'] !== adminKey) {
        res.status(401).json({ message: 'Unauthorized.' });
        return;
    }

    const { vehicleRegistration, email } = req.body || {};
    if (!vehicleRegistration || !email) {
        res.status(400).json({ message: 'vehicleRegistration and email are required.' });
        return;
    }

    let record;
    try {
        record = await issuePromoForRegistration({ vehicleRegistration, email });
    } catch (err) {
        res.status(400).json({ message: err instanceof Error ? err.message : 'Could not issue promo code.' });
        return;
    }

    try {
        await sendPromoCodeEmail({ code: record.code, vehicleRegistration: record.vehicleRegistration, email: record.email });
    } catch (err) {
        console.error('[promo email failed]', record.code, err);
        // The code is still issued and valid even if the email failed to send.
    }

    res.status(200).json({ code: record.code, vehicleRegistration: record.vehicleRegistration, email: record.email });
}
