import { buildReceiptEmailHtml } from './email-template.js';
import { buildVehiclePromoApprovedEmailHtml } from './promo-email-template.js';
import { buildSupportEmailHtml } from './support-email-template.js';
import { buildMonthlyCodeEmailHtml } from './monthly-code-email-template.js';
import { buildDistributionReportHtml } from './distribution-report-template.js';
import { buildBookingRequestEmailHtml } from './booking-request-email-template.js';

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
        console.log('[sms skipped — AFRICAS_TALKING_USERNAME/API_KEY or BUSINESS_SMS not set]', { to, reference: receipt.reference });
        return { skipped: true };
    }

    const body = [
        receipt.bookingRequest
            ? `A10tion NEW BOOKING REQUEST: ${receipt.customerName || 'Customer'} ${receipt.packageName || 'wash'} awaiting approval.`
            : `A10tion booking: ${receipt.customerName || 'Customer'} ${receipt.packageName || 'wash'} booked.`,
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

async function sendViaResend({ to, bcc, subject, html, replyTo, attachments, safeFailure = false, idempotencyKey }) {
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
        subject: `Monthly code distribution report — ${run.id}`,
        html: buildDistributionReportHtml(run),
        replyTo: BOOKINGS_EMAIL,
        idempotencyKey: `monthly-distribution-report-${run.id}`,
        safeFailure: true,
    });
}

export async function sendBookingApprovalEmail(request, continuationUrl, status) {
    const isPending = status === 'pending';
    const subject = status === 'pending'
        ? `Booking request awaiting approval — ${request.reference}`
        : status === 'approved'
            ? `Booking request approved — ${request.reference}`
            : `Booking request update — ${request.reference}`;
    const jobs = [];
    if (request.booking?.customer?.email) {
        jobs.push(sendViaResend({
            to: request.booking.customer.email,
            subject,
            html: buildBookingRequestEmailHtml(request, { status, continuationUrl }),
            replyTo: BOOKINGS_EMAIL,
            idempotencyKey: `booking-request-${request.reference}-${status}-customer`,
            safeFailure: true,
        }));
    }
    if (isPending) {
        jobs.push(sendViaResend({
            to: BOOKINGS_EMAIL,
            subject: `Review booking request — ${request.reference}`,
            html: buildBookingRequestEmailHtml(request, { status, businessCopy: true }),
            replyTo: request.booking?.customer?.email || undefined,
            idempotencyKey: `booking-request-${request.reference}-pending-business`,
            safeFailure: true,
        }));
    }
    if (!jobs.length) throw new Error('Booking request has no customer email address.');
    const results = await Promise.allSettled(jobs);
    const failures = results.filter((result) => result.status === 'rejected');
    const skipped = results.filter((result) => result.status === 'fulfilled' && result.value?.skipped);
    const sent = results.length - failures.length - skipped.length;
    if (failures.length) {
        failures.forEach((result) => console.error('[booking approval email failed]', request.reference, result.reason));
    }
    if (skipped.length) {
        console.error('[booking approval email skipped — Resend is not configured]', request.reference);
    }
    if (sent === 0) throw failures[0]?.reason || new Error('Booking approval email service is not configured.');
    return { sent, failed: failures.length + skipped.length };
}

export async function sendBookingRequestSms(request) {
    const booking = request.booking;
    const monthly = booking.bookingType === 'monthly-entitlement';
    const clientType = booking.monthlyClientType === 'business' ? 'Business / Fleet / Family' : 'Private Client';
    const tier = booking.monthlyPackageTier === 'premium' ? 'Premium' : 'Standard';
    return sendBusinessBookingSms({
        bookingRequest: true,
        reference: request.reference,
        customerName: `${booking.customer?.firstName || ''} ${booking.customer?.surname || ''}`.trim(),
        customerEmail: booking.customer?.email,
        customerMobile: booking.customer?.mobile,
        packageName: monthly ? `${clientType} ${tier} monthly wash` : booking.packageName || 'Single Wash',
        bookingDate: booking.bookingDate,
        bookingTime: booking.bookingTime,
        registration: booking.customer?.registration,
        address: booking.customer?.address,
        amountZar: monthly ? 'R0.00 after approval' : 'Pending approval',
    });
}

/** Sends booking receipts to the customer and business; optional contract attachments go only to the business. */
export async function sendReceiptEmail(receipt, contractAttachment = null) {
    const html = buildReceiptEmailHtml(receipt);
    const isMonthlyBooking = receipt.bookingType === 'monthly-entitlement'
        || receipt.paymentMethod === 'monthly-entitlement';
    const subject = `${isMonthlyBooking ? 'Monthly booking confirmed' : 'Booking confirmed'} — ${receipt.reference}`;

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
