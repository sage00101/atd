import crypto from 'node:crypto';
import '../_lib/load-env.js';
import { applyCors } from '../_lib/cors.js';
import {
    getBookingRequestsForAdmin,
    resendBookingRequestDecisionEmail,
    transitionBookingRequest,
} from '../_lib/booking-requests.js';

function safeEqual(left, right) {
    const leftDigest = crypto.createHash('sha256').update(String(left)).digest();
    const rightDigest = crypto.createHash('sha256').update(String(right)).digest();
    return crypto.timingSafeEqual(leftDigest, rightDigest);
}

function hasAdminKey(suppliedKey) {
    const expectedKeys = [process.env.ADMIN_API_KEY, process.env.CALENDAR_API_KEY].filter(Boolean);
    return Boolean(suppliedKey && expectedKeys.some((expectedKey) => safeEqual(suppliedKey, expectedKey)));
}

export default async function handler(req, res) {
    if (applyCors(req, res)) return;
    if (!['GET', 'POST'].includes(req.method)) {
        res.status(405).json({ message: 'Method not allowed.' });
        return;
    }
    if (!hasAdminKey(req.headers['x-admin-key'])) {
        res.status(401).json({ message: 'Admin key is missing or invalid.' });
        return;
    }

    try {
        if (req.method === 'GET') {
            res.status(200).json({ requests: await getBookingRequestsForAdmin() });
            return;
        }
        const reference = String(req.body?.reference || '').trim();
        const action = String(req.body?.action || '').trim();
        if (action === 'resend-notification') {
            if (!reference) {
                res.status(400).json({ message: 'A booking reference is required.' });
                return;
            }
            const request = await resendBookingRequestDecisionEmail(reference);
            res.status(200).json({ request });
            return;
        }
        if (!reference || !['approve', 'decline'].includes(action)) {
            res.status(400).json({ message: 'A booking reference and approve/decline action are required.' });
            return;
        }
        const request = await transitionBookingRequest(reference, action, req.body?.reason);
        res.status(200).json({ request });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Booking request could not be updated.';
        const status = message === 'Booking request not found.' ? 404 : 409;
        res.status(status).json({ message });
    }
}
