import { applyCors } from '../_lib/cors.js';
import { pendingBookings } from '../_lib/store.js';

// GET /api/bookings/availability?from=YYYY-MM-DD&to=YYYY-MM-DD
// Returns { bookedSlots: { [date]: [time, ...] } } built from unpaid + paid
// bookings held in memory. Replace with a real database query once bookings
// are persisted durably.
export default async function handler(req, res) {
    if (applyCors(req, res)) return;
    if (req.method !== 'GET') {
        res.status(405).json({ message: 'Method not allowed.' });
        return;
    }

    const { from, to } = req.query || {};
    const bookedSlots = {};

    for (const booking of pendingBookings.values()) {
        const date = booking.bookingDate;
        const time = booking.bookingTime;
        if (!date || !time) continue;
        if (from && date < from) continue;
        if (to && date > to) continue;
        bookedSlots[date] = [...(bookedSlots[date] || []), time];
    }

    res.status(200).json({ bookedSlots });
}
