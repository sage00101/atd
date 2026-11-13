import crypto from 'node:crypto';
import { applyCors } from '../api/_lib/cors.js';
import {
    acceptBookingRequest,
    declineBookingRequest,
    clearBookingActivityFromAdmin,
    deleteBookingRequestFromAdmin,
    getBookingRequestForAdmin,
    getPublicBookingRequest,
    listBookingRequests,
} from '../api/_lib/booking-approval.js';
import {
    sendBookingRequestApprovedEmail,
    sendBookingRequestDeclinedEmail,
} from '../api/_lib/email.js';
import { sendBusinessBookingApprovalSms, sendCustomerBookingApprovalSms } from '../api/_lib/sms.js';

function safeEqual(left, right) {
    const leftDigest = crypto.createHash('sha256').update(String(left)).digest();
    const rightDigest = crypto.createHash('sha256').update(String(right)).digest();
    return crypto.timingSafeEqual(leftDigest, rightDigest);
}

function isAdminKeyValid(suppliedKey) {
    const keys = [process.env.ADMIN_API_KEY, process.env.CALENDAR_API_KEY].filter(Boolean);
    return Boolean(suppliedKey && keys.some((key) => safeEqual(suppliedKey, key)));
}

function getContinuationUrl(token) {
    const siteUrl = process.env.SITE_URL || 'https://sage00101.github.io/atd/';
    const url = new URL(siteUrl);
    url.searchParams.set('booking-continuation', token);
    url.hash = '';
    return url.toString();
}

async function sendApprovalSms(send, request, recipient) {
    try {
        const result = await send(request);
        if (result?.sent) return { sent: true };
        return { sent: false, problem: 'SMS is not configured or the recipient number is missing.' };
    } catch (error) {
        console.error(`[${recipient} approval sms failed]`, request.reference, error);
        return { sent: false, problem: error instanceof Error ? error.message : 'SMS could not be confirmed.' };
    }
}

export default async function handler(req, res) {
    if (applyCors(req, res)) return;
    res.setHeader('Cache-Control', 'no-store');
    if (!['GET', 'POST'].includes(req.method)) {
        res.status(405).json({ message: 'Method not allowed.' });
        return;
    }
    if (!isAdminKeyValid(req.headers['x-admin-key'])) {
        res.status(401).json({ message: 'Admin key is missing or invalid.' });
        return;
    }

    try {
        if (req.method === 'GET') {
            const requests = await listBookingRequests();
            res.status(200).json({ requests });
            return;
        }

        const action = String(req.body?.action || '');
        const id = String(req.body?.id || '').trim();
        const adminName = String(req.body?.adminName || '').trim();
        if (action === 'accept') {
            const { request, continuationToken } = await acceptBookingRequest(id, adminName);
            const [email, customerSms, businessSms] = await Promise.all([
                sendBookingRequestApprovedEmail(request, getContinuationUrl(continuationToken)).catch((error) => {
                    console.error('[approval email failed]', error);
                    return { skipped: true, failed: true, reason: error instanceof Error ? error.message : String(error) };
                }),
                sendApprovalSms(sendCustomerBookingApprovalSms, request, 'customer'),
                sendApprovalSms(sendBusinessBookingApprovalSms, request, 'business'),
            ]);
            res.status(200).json({
                request: getPublicBookingRequest(request),
                emailSent: !email?.skipped,
                emailProblem: email?.failed ? email.reason : (email?.skipped ? 'Email is not configured on the server (RESEND_API_KEY / RESEND_FROM_EMAIL missing).' : ''),
                customerSms,
                businessSms,
            });
            return;
        }
        if (action === 'decline') {
            const request = await declineBookingRequest(id, adminName, req.body?.reason);
            const email = await sendBookingRequestDeclinedEmail(request).catch((error) => {
                console.error('[decline email failed]', error);
                return { skipped: true, failed: true, reason: error instanceof Error ? error.message : String(error) };
            });
            res.status(200).json({
                request: getPublicBookingRequest(request),
                emailSent: !email?.skipped,
                emailProblem: email?.failed ? email.reason : (email?.skipped ? 'Email is not configured on the server (RESEND_API_KEY / RESEND_FROM_EMAIL missing).' : ''),
            });
            return;
        }
        if (action === 'clear-activity') {
            res.status(200).json(await clearBookingActivityFromAdmin());
            return;
        }
        if (action === 'delete') {
            res.status(200).json(await deleteBookingRequestFromAdmin(id));
            return;
        }
        if (action === 'resend-email') {
            const request = await getBookingRequestForAdmin(id);
            if (!request) {
                res.status(404).json({ message: 'Booking request not found.' });
                return;
            }
            const retryId = crypto.randomUUID();
            let email;
            if (request.status === 'declined') {
                email = await sendBookingRequestDeclinedEmail(request, retryId);
            } else if (['approved', 'awaiting_completion'].includes(request.status) && request.continuationToken) {
                email = await sendBookingRequestApprovedEmail(
                    request,
                    getContinuationUrl(request.continuationToken),
                    retryId,
                );
            } else {
                res.status(409).json({ message: 'This request does not have a resendable decision email.' });
                return;
            }
            res.status(200).json({ emailSent: !email?.skipped });
            return;
        }
        res.status(400).json({ message: 'Unknown booking request action.' });
    } catch (error) {
        console.error('[booking request admin action failed]', error);
        const message = error instanceof Error ? error.message : 'Could not update the booking request.';
        const status = /not found/i.test(message) ? 404
            : /already|declined|expired|approved|confirmed|processing|no longer available/i.test(message) ? 409
                : 400;
        res.status(status).json({ message });
    }
}
