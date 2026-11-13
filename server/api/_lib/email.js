import { buildReceiptEmailHtml } from './email-template.js';
import { buildVehiclePromoApprovedEmailHtml } from './promo-email-template.js';
import { buildSupportEmailHtml } from './support-email-template.js';
import { buildMonthlyCodeEmailHtml } from './monthly-code-email-template.js';
import { buildPassphraseEmailHtml } from './passphrase-email-template.js';
import { buildDistributionReportHtml } from './distribution-report-template.js';
import { buildBusinessBookingSmsText, buildCustomerBookingConfirmationSmsText, getBusinessSmsNumber, sendSms } from './sms.js';
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
async function sendBusinessBookingSms(receipt) {
    return sendSms({
        to: getBusinessSmsNumber(),
        message: buildBusinessBookingSmsText({
            name: receipt.customerName,
            email: receipt.customerEmail,
            address: receipt.address,
            packageName: receipt.packageName,
        }),
        campaign: 'Confirmed bookings',
        dataField: receipt.reference,
    });
}

async function sendCustomerBookingSms(receipt) {
    return sendSms({
        to: receipt.customerMobile,
        message: buildCustomerBookingConfirmationSmsText(receipt),
        campaign: 'Customer booking updates',
        dataField: receipt.reference,
    });
}

async function sendViaResend({ to, bcc, subject, html, replyTo, attachments, safeFailure = false, idempotencyKey }) {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM_EMAIL;

    if (!apiKey || !from) {
        console.log('[email skipped — RESEND_API_KEY/RESEND_FROM_EMAIL not set]', { to, bcc, subject });
        return { skipped: true };
    }

    const payload = {
            from,
            to: [to],
            bcc: bcc ? [bcc] : undefined,
            reply_to: replyTo,
            subject,
            html,
            attachments: attachments?.length ? attachments : undefined,
    };
    let response;
    for (let attempt = 0; attempt < 4; attempt += 1) {
        response = await fetch(RESEND_ENDPOINT, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${apiKey}`,
            ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        });
        // Resend allows about 2 requests a second; wait and retry when rate limited or briefly unavailable.
        if (response.status !== 429 && response.status < 500) break;
        await new Promise((resolve) => setTimeout(resolve, 700 * (attempt + 1)));
    }

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

export async function sendPassphraseEmail({ recipientName, email, passphrase, promoCode, message }) {
    const html = buildPassphraseEmailHtml({
        recipientName,
        passphrase,
        promoCode,
        message,
        siteUrl: process.env.SITE_URL || 'https://sage00101.github.io/atd/',
    });
    return sendViaResend({
        to: email,
        subject: 'Your A10tion To Detail access details',
        html,
        replyTo: BOOKINGS_EMAIL,
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

export function buildBookingSmsNotificationPayload(request) {
    const booking = request.booking || {};
    const customer = booking.customer || {};
    return {
        to: process.env.BUSINESS_SMS || process.env.BUSINESS_SMS_NUMBER || '',
        reference: request.reference,
        message: [
            'PENDING APPROVAL · New booking request',
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
    const attachments = request.booking?.contractFileBase64 && request.booking?.contractFileName
        ? [{ filename: request.booking.contractFileName, content: request.booking.contractFileBase64 }]
        : undefined;
    const sendBusiness = (withAttachments) => sendViaResend({
        to: BOOKINGS_EMAIL,
        subject: businessSubject,
        html: businessHtml,
        replyTo: customerEmail || undefined,
        attachments: withAttachments ? attachments : undefined,
        idempotencyKey: `${idempotencyPrefix}-business-${request.id}${withAttachments ? '' : '-plain'}`,
    });
    // The business email goes first, one at a time, so it is never lost to the provider rate limit.
    let businessResult;
    try {
        businessResult = await sendBusiness(true);
    } catch (firstError) {
        console.error(`[booking request ${idempotencyPrefix} business email failed, retrying]`, request.reference, firstError);
        try {
            businessResult = await sendBusiness(false);
        } catch (secondError) {
            businessResult = { failedReason: secondError };
        }
    }
    let customerResult = null;
    if (customerEmail) {
        try {
            customerResult = await sendViaResend({
                to: customerEmail,
                subject: customerSubject,
                html: customerHtml,
                replyTo: BOOKINGS_EMAIL,
                idempotencyKey: `${idempotencyPrefix}-customer-${request.id}`,
            });
        } catch (error) {
            customerResult = { failedReason: error };
        }
    }
    const results = [customerResult, businessResult].filter((result) => result !== null)
        .map((value) => (value.failedReason ? { status: 'rejected', reason: value.failedReason } : { status: 'fulfilled', value }));
    const failures = [];
    if (customerResult?.failedReason) failures.push({ recipient: 'customer', result: results[0] });
    if (businessResult?.failedReason) failures.push({ recipient: 'business', result: results.at(-1) });
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
        customerSubject: `Booking request received — ${request.reference}`,
        customerHtml: buildBookingRequestReceivedEmail(request, statusUrl),
        businessSubject: `PENDING APPROVAL · New booking request — ${request.reference}`,
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
        subject: `Booking request approved — ${request.reference}`,
        html: buildBookingApprovedEmail(request, continuationUrl),
        replyTo: BOOKINGS_EMAIL,
        idempotencyKey: `booking-request-approved-${request.id}${retryId ? `-${retryId}` : ''}`,
    });
}

export async function sendBookingRequestDeclinedEmail(request, retryId = '') {
    return sendViaResend({
        to: request.booking.customer.email,
        subject: `Booking request update — ${request.reference}`,
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

    const emailJobCount = jobs.length;
    jobs.push(sendCustomerBookingSms(receipt));
    jobs.push(sendBusinessBookingSms(receipt));

    const results = await Promise.allSettled(jobs);
    const emailResults = results.slice(0, emailJobCount);
    const emailFailures = emailResults.filter((result) => result.status === 'rejected');
    if (emailFailures.length) {
        emailFailures.forEach((result) => console.error('[receipt email failed]', receipt.reference, result.reason));
        if (results.every((result) => result.status === 'rejected')) throw emailFailures[0].reason;
    }

    const smsResults = results.slice(emailJobCount);
    if (smsResults[0]?.status === 'rejected') console.error('[customer receipt sms failed]', receipt.reference, smsResults[0].reason);
    if (smsResults[1]?.status === 'rejected') console.error('[business receipt sms failed]', receipt.reference, smsResults[1].reason);

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
