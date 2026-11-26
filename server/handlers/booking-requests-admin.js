import crypto from 'node:crypto';
import { applyCors } from '../api/_lib/cors.js';
import {
    acceptBookingRequest,
    declineBookingRequest,
    clearBookingActivityFromAdmin,
    deleteBookingRequestFromAdmin,
    getBookingRequestByContinuationToken,
    getBookingRequestForAdmin,
    getPublicBookingRequest,
    listBookingRequests,
} from '../api/_lib/booking-approval.js';
import {
    sendBookingRequestApprovedEmail,
    sendBookingRequestDeclinedEmail,
    sendOnsiteBookingConfirmedEmail,
} from '../api/_lib/email.js';
import { sendCustomerBookingApprovalSms, sendCustomerBookingDeclinedSms } from '../api/_lib/sms.js';
import { getBooking } from '../api/_lib/store.js';

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

function getWhatsAppRecipient(value) {
    const raw = String(value || '').trim();
    if (!/^[+\d\s().-]+$/.test(raw) || (raw.includes('+') && !/^\+[^+]*$/.test(raw))) {
        throw new Error('The customer cell number is invalid. Check the booking details before opening WhatsApp.');
    }
    let digits = raw.replace(/\D/g, '');
    if (digits.startsWith('00')) digits = digits.slice(2);
    else if (!raw.startsWith('+') && /^0\d{9}$/.test(digits)) digits = `27${digits.slice(1)}`;
    else if (!raw.startsWith('+') && /^[1-9]\d{8}$/.test(digits)) digits = `27${digits}`;
    else if (!raw.startsWith('+') && !/^27\d{9}$/.test(digits)) {
        throw new Error('The customer cell number needs a country code. Check the booking details before opening WhatsApp.');
    }
    if (!/^[1-9]\d{7,14}$/.test(digits) || (digits.startsWith('27') && !/^27[1-9]\d{8}$/.test(digits))) {
        throw new Error('The customer cell number is invalid. Check the booking details before opening WhatsApp.');
    }
    return digits;
}

async function buildWhatsAppApprovalUrl(request) {
    if (!['approved', 'awaiting_completion', 'confirmed'].includes(request.status)) {
        throw new Error('This request is not approved or is no longer available.');
    }
    const booking = request.booking || {};
    const recipient = getWhatsAppRecipient(booking.customer?.mobile);
    if (!booking.bookingDate || !booking.bookingTime || !request.reference) {
        throw new Error('This booking is missing the date, time or reference needed for the WhatsApp message.');
    }
    const confirmed = request.status === 'confirmed';
    const lines = [
        'Dear client,',
        '',
        confirmed
            ? 'Great news! Your booking with A10tion To Detail has been approved and confirmed.'
            : 'Great news! Your booking request with A10tion To Detail has been approved.',
        '',
        `Date and time: ${booking.bookingDate} at ${booking.bookingTime}`,
        `Booking reference: ${request.reference}`,
        '',
    ];
    if (confirmed && booking.requestedPaymentMethod === 'onsite') {
        const stored = await getBooking(request.reference);
        if (!stored || !['confirmed_unpaid', 'paid'].includes(stored.status)) {
            throw new Error('The on-site payment status could not be verified. Refresh the booking before contacting the customer.');
        }
        lines.push(stored.status === 'paid'
            ? 'Thank you for your on-site payment.'
            : 'No payment has been taken yet. Please pay our technician on arrival using the Yoco card machine.', '');
    } else if (!confirmed) {
        if (!request.continuationToken) throw new Error('The booking continuation link is missing or expired.');
        const current = await getBookingRequestByContinuationToken(request.continuationToken);
        if (!current || current.id !== request.id || !['approved', 'awaiting_completion'].includes(current.status)) {
            throw new Error('The booking continuation link is missing or expired. Refresh the request before contacting the customer.');
        }
        if (booking.bookingType === 'monthly-entitlement') {
            lines.push('To confirm your booking, please use the link below to verify your monthly wash entitlement:', getContinuationUrl(request.continuationToken),
                '', 'Your booking will be confirmed once you complete the booking through the link.', '');
        } else if (booking.requestedPaymentMethod === 'onsite') {
            lines.push('To confirm your booking, please use the link below. You can pay our technician on arrival using the Yoco card machine:',
                getContinuationUrl(request.continuationToken), '', 'Your booking will be confirmed once you complete this step.', '');
        } else if (booking.requestedPaymentMethod === 'online') {
            lines.push('To confirm your booking, please use the link below to continue to secure Yoco checkout:',
                getContinuationUrl(request.continuationToken), '', 'Your booking will be confirmed once payment has been completed.', '');
        } else {
            throw new Error('The booking payment method is not recognised.');
        }
    }
    lines.push('Thank you for choosing A10tion To Detail. We look forward to taking care of your vehicle!');
    const url = new URL(`https://wa.me/${recipient}`);
    url.searchParams.set('text', lines.join('\n'));
    return url.toString();
}

async function sendDecisionSms(send, request, recipient, decision) {
    try {
        const result = await send(request);
        if (result?.sent) return { sent: true };
        return { sent: false, problem: 'SMS is not configured or the recipient number is missing.' };
    } catch (error) {
        console.error(`[${recipient} ${decision} sms failed]`, request.reference, error);
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
            const [email, customerSms] = await Promise.all([
                (request.status === 'confirmed' && request.booking?.requestedPaymentMethod === 'onsite'
                    ? sendOnsiteBookingConfirmedEmail(request)
                    : sendBookingRequestApprovedEmail(request, getContinuationUrl(continuationToken))).catch((error) => {
                    console.error('[approval email failed]', error);
                    return { skipped: true, failed: true, reason: error instanceof Error ? error.message : String(error) };
                }),
                sendDecisionSms(sendCustomerBookingApprovalSms, request, 'customer', 'approval'),
            ]);
            res.status(200).json({
                request: getPublicBookingRequest(request),
                emailSent: !email?.skipped,
                emailProblem: email?.failed ? email.reason : (email?.skipped ? 'Email is not configured on the server (RESEND_API_KEY / RESEND_FROM_EMAIL missing).' : ''),
                customerSms,
            });
            return;
        }
        if (action === 'decline') {
            const request = await declineBookingRequest(id, adminName, req.body?.reason);
            const [email, customerSms] = await Promise.all([
                sendBookingRequestDeclinedEmail(request).catch((error) => {
                    console.error('[decline email failed]', error);
                    return { skipped: true, failed: true, reason: error instanceof Error ? error.message : String(error) };
                }),
                sendDecisionSms(sendCustomerBookingDeclinedSms, request, 'customer', 'decline'),
            ]);
            res.status(200).json({
                request: getPublicBookingRequest(request),
                emailSent: !email?.skipped,
                emailProblem: email?.failed ? email.reason : (email?.skipped ? 'Email is not configured on the server (RESEND_API_KEY / RESEND_FROM_EMAIL missing).' : ''),
                customerSms,
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
        if (action === 'whatsapp-approval') {
            const request = await getBookingRequestForAdmin(id);
            if (!request) {
                res.status(404).json({ message: 'Booking request not found.' });
                return;
            }
            res.status(200).json({ url: await buildWhatsAppApprovalUrl(request) });
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
            } else if (request.status === 'confirmed' && request.booking?.requestedPaymentMethod === 'onsite'
                && request.booking?.bookingType !== 'monthly-entitlement') {
                const booking = await getBooking(request.reference);
                if (booking?.status !== 'confirmed_unpaid') {
                    res.status(409).json({ message: 'This booking is not awaiting on-site payment. Use the paid receipt option if payment was recorded.' });
                    return;
                }
                email = await sendOnsiteBookingConfirmedEmail(request, retryId);
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
