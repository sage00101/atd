import { applyCors } from '../api/_lib/cors.js';
import {
    checkMonthlyWashAvailability,
    getMonthlyReservationError,
} from '../api/_lib/monthly-promos.js';

export default async function handler(req, res) {
    if (applyCors(req, res)) return;
    if (req.method !== 'POST') {
        res.status(405).json({ message: 'Method not allowed.' });
        return;
    }

    try {
        const eligibility = await checkMonthlyWashAvailability({
            promoCode: req.body?.promoCode,
            email: req.body?.email,
            bookingDate: req.body?.bookingDate,
            expectedClientType: req.body?.clientType,
            expectedPackageTier: req.body?.packageTier,
        });
        const message = eligibility.status === 'OK'
            ? `Code verified. ${eligibility.availableWashes} prepaid wash${eligibility.availableWashes === 1 ? '' : 'es'} available for this billing period.`
            : eligibility.status === 'LIMIT_REACHED'
                ? `You have reached the limit of ${eligibility.allowance} covered bookings for this billing period (${eligibility.used} used, ${eligibility.reserved} pending).`
                : eligibility.status === 'CREDITS_EXHAUSTED'
                    ? 'You have run out of prepaid washes on this monthly package. Contact the business to record a renewal payment.'
                    : getMonthlyReservationError(eligibility.status).message;
        res.status(200).json({ ...eligibility, message });
    } catch (error) {
        res.status(400).json({
            message: error instanceof Error ? error.message : 'Could not check the monthly account.',
        });
    }
}
