import { markBookingRequestCancelled } from './booking-approval.js';
import { releaseMonthlyWashReservation } from './monthly-promos.js';
import { releaseSharedPromoCode } from './store.js';

export async function finishPendingBookingCancellation(result) {
    const booking = result?.booking;
    const cancelled = result?.status === 'CANCELLED' || result?.status === 'cancelled';
    if (!cancelled) return false;

    if (booking?.reference) await markBookingRequestCancelled(booking.reference);
    if (booking?.appliedPromoType === 'shared-code' && booking.appliedPromo && booking.promoReservationId) {
        await releaseSharedPromoCode(booking.appliedPromo, booking.promoReservationId);
    }
    if (booking?.bookingType === 'monthly-entitlement'
        && booking.monthlyEntitlementId && booking.monthlyUsagePeriod && booking.promoReservationId) {
        await releaseMonthlyWashReservation({
            entitlementId: booking.monthlyEntitlementId,
            period: booking.monthlyUsagePeriod,
            reservationId: booking.promoReservationId,
        });
    }
    return true;
}
