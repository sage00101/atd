import { applyCors } from '../_lib/cors.js';
import { getBlockedSlotsInRange, getBookedSlotsInRange, seedDefaultCalendarBlocks } from '../_lib/store.js';

// GET /api/bookings/availability?from=YYYY-MM-DD&to=YYYY-MM-DD
// Returns the combined live set of booked + admin-blocked slots, so the
// website updates instantly whenever a booking or calendar block changes.
export default async function handler(req, res) {
    if (applyCors(req, res)) return;
    if (req.method !== 'GET') {
        res.status(405).json({ message: 'Method not allowed.' });
        return;
    }

    const { from, to } = req.query || {};
    const [bookedSlots, blockedSlots] = await Promise.all([
        getBookedSlotsInRange(from, to),
        getBlockedSlotsInRange(from, to),
    ]);

    await seedDefaultCalendarBlocks();

    const mergedSlots = { ...bookedSlots };
    for (const [date, times] of Object.entries(blockedSlots)) {
        const merged = new Set([...(mergedSlots[date] || []), ...(times || [])]);
        mergedSlots[date] = [...merged].sort();
    }

    res.status(200).json({ bookedSlots: mergedSlots, blockedSlots });
}
