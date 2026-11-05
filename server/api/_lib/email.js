import { buildReceiptEmailHtml } from './email-template.js';
import { buildVehiclePromoApprovedEmailHtml } from './promo-email-template.js';
import { buildSupportEmailHtml } from './support-email-template.js';
import { buildMonthlyCodeEmailHtml } from './monthly-code-email-template.js';
import { buildDistributionReportHtml } from './distribution-report-template.js';
import {
    buildBookingApprovedEmail,
    buildBookingCancelledEmail,
    buildBookingDeclinedEmail,
    buildBookingRequestBusinessEmail,
    buildBookingRequestReceivedEmail,
} from './booking-request-email-template.js';

const RESEND_ENDPOINT = 'https://api.resend.com/emails';
const BOOKINGS_EMAIL = process.env.BUSINESS_EMAIL || 'bookings@a10tion.co.za';
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
        console.log('[sms skipped â€” AFRICAS_TALKING_USERNAME/API_KEY or BUSINESS_SMS not set]', { to, reference: receipt.reference });
        return { skipped: true };
    }

    const body = [
        `A10tion booking: ${receipt.customerName || 'Customer'} ${receipt.packageName || 'wash'} booked.`,
        `Ref: ${receipt.reference}`,
        `Date: ${receipt.bookingDate} ${receipt.bookingTime}`,
        `Vehicle: ${receipt.registration || 'â€”'}`,
        `Address: ${receipt.address || 'â€”'}`,
        `Amount: ${receipt.amountZar || 'â€”'}`,
        `Contact: ${receipt.customerMobile || receipt.customerEmail || 'â€”'}`,
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

async function sendViaResend({ to, bcc, subject, html, replyTo, attachments, safeFailure = false, idempotencyKey }) {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM_EMAIL;

    if (!apiKey || !from) {
        console.log('[email skipped â€” RESEND_API_KEY/RESEND_FROM_EMAIL not set]', { to, bcc, subject });
        return { skipped: true };
    }

    const response = await fetch(RESEND_ENDPOINT, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${apiKey}`,
            ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
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
        throw new Error(safeFailure
            ? `Resend send failed (${response.status}).`
            : `Resend send failed (${response.status}): ${body}`);
    }

    return response.json();
}

export async function sendMonthlyAccessCodeEmail(client, idempotencyKey) {
    const siteUrl = process.env.SITE_URL || 'https://sage00101.github.io/atd/';
    const bookingUrl = new URL(siteUrl);
    bookingUrl.searchParams.set('monthly-checkout', '1');
    bookingUrl.searchParams.set('clientType', client.clientType);
    bookingUrl.searchParams.set('packageTier', client.packageTier);
    const html = buildMonthlyCodeEmailHtml({
        ...client,
        checkoutUrl: bookingUrl.toString(),
    });
    return sendViaResend({
        to: client.customerEmail,
        subject: 'Your A10tion To Detail monthly wash access',
        html,
        replyTo: BOOKINGS_EMAIL,
        idempotencyKey,
        safeFailure: true,
    });
}

export async function sendMonthlyDistributionReport(run) {
    return sendViaResend({
        to: BOOKINGS_EMAIL,
        subject: `Monthly code distribution report â€” ${run.id}`,
        html: buildDistributionReportHtml(run),
        replyTo: BOOKINGS_EMAIL,
        idempotencyKey: `monthly-distribution-report-${run.id}`,
        safeFailure: true,
    });
}

export function buildBookingSmsNotificationPayload(request) {
    const booking = request.booking || {};
    const customer = booking.customer || {};
    return {
        to: process.env.BUSINESS_SMS || process.env.BUSINESS_SMS_NUMBER || '',
        reference: request.reference,
        message: [
            'PENDING APPROVAL Â· New booking request',
            `Ref: ${request.reference}`,
            `Customer: ${customer.firstName || ''} ${customer.surname || ''}`.trim(),
            `Date: ${booking.bookingDate || ''} ${booking.bookingTime || ''}`.trim(),
            `Contact: ${customer.mobile || customer.email || ''}`,
        ].join(' | '),
        sent: false,
        configured: false,
    };
}

async function sendBookingRequestEmailPair({ request, customerSubject, customerHtml, businessSubject, businessHtml, idempotencyPrefix }) {
    const customerEmail = request.booking?.customer?.email;
    const jobs = [
        sendViaResend({
            to: BOOKINGS_EMAIL,
            subject: businessSubject,
            html: businessHtml,
            replyTo: customerEmail || undefined,
            attachments: request.booking?.contractFileBase64 && request.booking?.contractFileName
                ? [{ filename: request.booking.contractFileName, content: request.booking.contractFileBase64 }]
                : undefined,
            idempotencyKey: `${idempotencyPrefix}-business-${request.id}`,
        }),
    ];
    if (customerEmail) {
        jobs.unshift(sendViaResend({
            to: customerEmail,
            subject: customerSubject,
            html: customerHtml,
            replyTo: BOOKINGS_EMAIL,
            idempotencyKey: `${idempotencyPrefix}-customer-${request.id}`,
        }));
    }
    const results = await Promise.allSettled(jobs);
    const failures = results
        .map((result, index) => ({ result, recipient: index === 0 && customerEmail ? 'customer' : 'business' }))
        .filter(({ result }) => result.status === 'rejected');
    if (failures.length) {
        failures.forEach(({ recipient, result }) => {
            console.error(`[booking request ${idempotencyPrefix} email failed]`, request.reference, recipient, result.reason);
        });
    }
    return {
        customerSent: Boolean(customerEmail && results[0]?.status === 'fulfilled' && !results[0].value?.skipped),
        businessSent: results.at(-1)?.status === 'fulfilled' && !results.at(-1).value?.skipped,
        customerSkipped: Boolean(customerEmail && results[0]?.status === 'fulfilled' && results[0].value?.skipped),
        businessSkipped: results.at(-1)?.status === 'fulfilled' && results.at(-1).value?.skipped,
        failed: failures.length > 0,
    };
}

export async function sendBookingRequestReceivedEmails(request, statusUrl) {
    return sendBookingRequestEmailPair({
        request,
        customerSubject: `Booking request received â€” ${request.reference}`,
        customerHtml: buildBookingRequestReceivedEmail(request, statusUrl),
        businessSubject: `PENDING APPROVAL Â· New booking request â€” ${request.reference}`,
        businessHtml: buildBookingRequestBusinessEmail(
            request,
            process.env.BUSINESS_MANAGER_URL || '',
        ),
        idempotencyPrefix: 'booking-request-received',
    });
}

export async function sendBookingRequestApprovedEmail(request, continuationUrl, retryId = '') {
    return sendViaResend({
        to: request.booking.customer.email,
        subject: `Booking request approved â€” ${request.reference}`,
        html: buildBookingApprovedEmail(request, continuationUrl),
        replyTo: BOOKINGS_EMAIL,
        idempotencyKey: `booking-request-approved-${request.id}${retryId ? `-${retryId}` : ''}`,
    });
}

export async function sendBookingRequestDeclinedEmail(request, retryId = '') {
    return sendViaResend({
        to: request.booking.customer.email,
        subject: `Booking request update â€” ${request.reference}`,
        html: buildBookingDeclinedEmail(request),
        replyTo: BOOKINGS_EMAIL,
        idempotencyKey: `booking-request-declined-${request.id}${retryId ? `-${retryId}` : ''}`,
    });
}

export async function sendBookingCancelledEmail(request, reason, retryId = '') {
    return sendViaResend({
        to: request.booking.customer.email,
        subject: `Booking cancelled — ${request.reference}`,
        html: buildBookingCancelledEmail(request, reason),
        replyTo: BOOKINGS_EMAIL,
        idempotencyKey: `booking-cancelled-${request.id}${retryId ? `-${retryId}` : ''}`,
    });
}

/** Sends booking receipts to the customer and business; optional contract attachments go only to the business. */
export async function sendReceiptEmail(receipt, contractAttachment = null) {
    const html = buildReceiptEmailHtml(receipt);
    const isMonthlyBooking = receipt.bookingType === 'monthly-entitlement'
        || receipt.paymentMethod === 'monthly-entitlement';
    const subject = `${isMonthlyBooking ? 'Monthly booking confirmed' : 'Booking confirmed'} â€” ${receipt.reference}`;

    // Separate direct send so the business copy never depends on bcc or on the customer send succeeding.
    const jobs = [sendViaResend({
        to: BOOKINGS_EMAIL,
        subject: `${subject} (${isMonthlyBooking ? 'monthly client' : 'business copy'}: ${receipt.customerName || receipt.customerEmail || 'customer'})`,
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
