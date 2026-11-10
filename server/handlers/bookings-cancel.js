import { applyCors } from '../api/_lib/cors.js';
import { cancelPendingBookingByToken } from '../api/_lib/store.js';
import { finishPendingBookingCancellation } from '../api/_lib/booking-cancellation.js';

export default async function handler(req, res) {
    if (applyCors(req, res)) return;
    if (req.method !== 'POST') {
        res.status(405).json({ message: 'Method not allowed.' });
        return;
    }

    const cancellationToken = String(req.body?.cancellationToken || '').trim();
    if (!cancellationToken) {
        res.status(400).json({ message: 'Cancellation token is required.' });
        return;
    }

    try {
        const result = await cancelPendingBookingByToken(cancellationToken);
        const cancelled = await finishPendingBookingCancellation(result);

        res.status(200).json({ cancelled });
    } catch (error) {
        console.error('[booking cancellation failed]', error);
        res.status(500).json({ message: 'Could not cancel the pending booking.' });
    }
}
