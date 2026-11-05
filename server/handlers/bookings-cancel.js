import { applyCors } from '../api/_lib/cors.js';
import { releaseMonthlyWashReservation } from '../api/_lib/monthly-promos.js';
import { cancelPendingBookingByToken, releaseSharedPromoCode } from '../api/_lib/store.js';
import { markBookingRequestCancelled } from '../api/_lib/booking-approval.js';

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
        const booking = result?.booking;
        const cancelled = result?.status === 'CANCELLED' || result?.status === 'cancelled';
        if (cancelled && booking?.reference) await markBookingRequestCancelled(booking.reference);

        if (cancelled && booking?.appliedPromoType === 'shared-code' && booking.appliedPromo && booking.promoReservationId) {
            await releaseSharedPromoCode(booking.appliedPromo, booking.promoReservationId);
        }
        if (cancelled && booking?.bookingType === 'monthly-entitlement'
            && booking.monthlyEntitlementId && booking.monthlyUsagePeriod && booking.promoReservationId) {
            await releaseMonthlyWashReservation({
                entitlementId: booking.monthlyEntitlementId,
                period: booking.monthlyUsagePeriod,
                reservationId: booking.promoReservationId,
            });
        }

        res.status(200).json({ cancelled });
    } catch (error) {
        console.error('[booking cancellation failed]', error);
        res.status(500).json({ message: 'Could not cancel the pending booking.' });
    }
}
