import { buildReceiptEmailHtml } from './email-template.js';
import { buildVehiclePromoApprovedEmailHtml } from './promo-email-template.js';
import { buildSupportEmailHtml } from './support-email-template.js';

const RESEND_ENDPOINT = 'https://api.resend.com/emails';
const BOOKINGS_EMAIL = 'bookings@a10tion.co.za';
const SUPPORT_EMAIL = 'support@a10tion.co.za';
const DEFAULT_BUSINESS_SMS = '+27733069217';

function normaliseBusinessSmsNumber(rawNumber) {
    if (!rawNumber) return '';
    const digits = String(rawNumber).replace(/\D/g, '');
    if (!digits) return '';

    if (digits.startsWith('27') && digits.length >= 11) return `+${digits}`;
    if (digits.startsWith('0') && digits.length === 10) return `+27${digits.slice(1)}`;
    if (digits.length === 9) return `+27${digits}`;
    return `+${digits}`;
}

async function sendBusinessBookingSms(receipt) {
    const to = normaliseBusinessSmsNumber(
        process.env.BUSINESS_SMS || process.env.BUSINESS_SMS_NUMBER || DEFAULT_BUSINESS_SMS
    );
    const username = process.env.AFRICAS_TALKING_USERNAME;
    const apiKey = process.env.AFRICAS_TALKING_API_KEY;
    const senderId = process.env.AFRICAS_TALKING_SENDER_ID || process.env.AFRICAS_TALKING_FROM;

    if (!username || !apiKey || !to) {
        console.log('[sms skipped — AFRICAS_TALKING_USERNAME/API_KEY or BUSINESS_SMS not set]', { to, reference: receipt.reference });
        return { skipped: true };
    }

    const body = [
        `A10tion booking: ${receipt.customerName || 'Customer'} ${receipt.packageName || 'wash'} booked.`,
        `Ref: ${receipt.reference}`,
        `Date: ${receipt.bookingDate} ${receipt.bookingTime}`,
        `Vehicle: ${receipt.registration || '—'}`,
        `Address: ${receipt.address || '—'}`,
        `Amount: ${receipt.amountZar || '—'}`,
        `Contact: ${receipt.customerMobile || receipt.customerEmail || '—'}`,
    ].join(' | ');

    const payload = new URLSearchParams({ username, to, message: body });
    if (senderId) payload.set('from', senderId);

    const response = await fetch('https://api.africastalking.com/version1/messaging', {
        method: 'POST',
        headers: {
            Accept: 'application/json',
            apikey: apiKey,
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: payload,
    });

    if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`Africa's Talking SMS failed (${response.status}): ${text}`);
    }

    return response.json();
}

async function sendViaResend({ to, bcc, subject, html, replyTo, attachments }) {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM_EMAIL;

    if (!apiKey || !from) {
        console.log('[email skipped — RESEND_API_KEY/RESEND_FROM_EMAIL not set]', { to, bcc, subject });
        return { skipped: true };
    }

    const response = await fetch(RESEND_ENDPOINT, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            from,
            to: [to],
            bcc: bcc ? [bcc] : undefined,
            reply_to: replyTo,
            subject,
            html,
            attachments: attachments?.length ? attachments : undefined,
        }),
    });

    if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(`Resend send failed (${response.status}): ${body}`);
    }

    return response.json();
}

/** Sends booking receipts to the customer and business; optional contract attachments go only to the business. */
export async function sendReceiptEmail(receipt, contractAttachment = null) {
    const html = buildReceiptEmailHtml(receipt);
    const subject = `Booking confirmed — ${receipt.reference}`;

    // Separate direct send so the business copy never depends on bcc or on the customer send succeeding.
    const jobs = [sendViaResend({
        to: BOOKINGS_EMAIL,
        subject: `${subject} (business copy: ${receipt.customerName || receipt.customerEmail || 'customer'})`,
        html,
        replyTo: receipt.customerEmail || undefined,
        attachments: contractAttachment ? [contractAttachment] : undefined,
    })];

    if (receipt.customerEmail) {
        jobs.unshift(sendViaResend({
            to: receipt.customerEmail,
            subject,
            html,
            replyTo: BOOKINGS_EMAIL,
        }));
    } else {
        console.warn('[email] no customer email on receipt, sending business copy only', receipt.reference);
    }

    jobs.push(sendBusinessBookingSms(receipt));

    const results = await Promise.allSettled(jobs);
    const failed = results.find((r) => r.status === 'rejected');
    if (failed) {
        results.filter((r) => r.status === 'rejected').forEach((r) => console.error('[receipt email failed]', receipt.reference, r.reason));
        if (results.every((r) => r.status === 'rejected')) throw failed.reason;
    }

    const smsResult = results.at(-1);
    if (smsResult?.status === 'rejected') {
        console.error('[receipt sms failed]', receipt.reference, smsResult.reason);
    }

    return results.find((r) => r.status === 'fulfilled' && r.value && !r.value?.skipped)?.value;
}

/** Emails a newly approved customer confirming their vehicle registration now works as a promo code. */
export async function sendVehiclePromoApprovedEmail({ vehicleRegistration, email }) {
    const html = buildVehiclePromoApprovedEmailHtml({ vehicleRegistration });
    await sendViaResend({
        to: email,
        bcc: BOOKINGS_EMAIL,
        subject: 'Your 50% single-wash discount is ready',
        html,
        replyTo: BOOKINGS_EMAIL,
    });
}

export async function sendSupportRequestEmail(request) {
    const subject = `[Website support] ${request.issueType}${request.reference ? ` - ${request.reference}` : ''}`;
    return sendViaResend({
        to: SUPPORT_EMAIL,
        subject,
        html: buildSupportEmailHtml(request),
        replyTo: request.email,
    });
}

