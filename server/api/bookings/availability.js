import { applyCors } from '../_lib/cors.js';
import { getBookedSlotsInRange } from '../_lib/store.js';

// GET /api/bookings/availability?from=YYYY-MM-DD&to=YYYY-MM-DD
// Returns { bookedSlots: { [date]: [time, ...] } } from the per-date Redis
// slot index (covers both pending and confirmed bookings).
export default async function handler(req, res) {
    if (applyCors(req, res)) return;
    if (req.method !== 'GET') {
        res.status(405).json({ message: 'Method not allowed.' });
        return;
    }

    const { from, to } = req.query || {};
    const bookedSlots = await getBookedSlotsInRange(from, to);
    res.status(200).json({ bookedSlots });
}
