import { applyCors } from '../_lib/cors.js';
import { sendVehiclePromoApprovedEmail } from '../_lib/email.js';
import { approveVehicleForPromo } from '../_lib/store.js';

// POST /api/promos/issue
// Header: x-admin-key: <ADMIN_API_KEY>
// Body: { vehicleRegistration, email }
// Call this yourself once you've manually verified a promo registration
// (e.g. from the Formspree submission email). There's no separate code to
// generate — the vehicle's own registration number becomes usable as the
// promo code at single-wash checkout. One approval per vehicle, ever.
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
    if (!vehicleRegistration) {
        res.status(400).json({ message: 'vehicleRegistration is required.' });
        return;
    }

    let record;
    try {
        record = await approveVehicleForPromo({ vehicleRegistration, email });
    } catch (err) {
        res.status(400).json({ message: err instanceof Error ? err.message : 'Could not approve this vehicle.' });
        return;
    }

    if (record.email) {
        try {
            await sendVehiclePromoApprovedEmail({ vehicleRegistration: record.vehicleRegistration, email: record.email });
        } catch (err) {
            console.error('[promo approval email failed]', record.vehicleRegistration, err);
            // The approval still stands even if the email failed to send.
        }
    }

    res.status(200).json({ vehicleRegistration: record.vehicleRegistration, email: record.email });
}
