import { applyCors } from '../api/_lib/cors.js';
import {
    checkMonthlyWashAvailability,
    lookupMonthlyCodeProfile,
    getMonthlyReservationError,
} from '../api/_lib/monthly-promos.js';

export default async function handler(req, res) {
    if (applyCors(req, res)) return;
    if (req.method !== 'POST') {
        res.status(405).json({ message: 'Method not allowed.' });
        return;
    }

    try {
        if (req.body?.lookup === true) {
            const found = await lookupMonthlyCodeProfile({
                promoCode: req.body?.promoCode,
                clientType: req.body?.clientType,
                packageTier: req.body?.packageTier,
                vehicleType: req.body?.vehicleType,
            });
            const label = { standard: 'Standard', premium: 'Premium' };
            const clientLabel = { private: 'Private Client', business: 'Business / Fleet / Family' };
            const actual = found.profile
                ? `Your code is for a ${clientLabel[found.profile.clientType]} · ${label[found.profile.packageTier]} package${found.profile.vehicleType ? ' · ' + found.profile.vehicleType : ''}.`
                : '';
            const message = found.status === 'OK'
                ? `Code verified. ${actual}`
                : ['CLIENT_TYPE_MISMATCH', 'PACKAGE_MISMATCH', 'VEHICLE_MISMATCH'].includes(found.status)
                    ? `This code does not match your selection. ${actual} Go back and choose what you bought.`
                    : getMonthlyReservationError(found.status).message;
            res.status(200).json({ ...found, message });
            return;
        }
        const eligibility = await checkMonthlyWashAvailability({
            promoCode: req.body?.promoCode,
            email: req.body?.email,
            bookingDate: req.body?.bookingDate,
            expectedClientType: req.body?.clientType,
            expectedPackageTier: req.body?.packageTier,
            expectedVehicleType: req.body?.vehicleType,
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
