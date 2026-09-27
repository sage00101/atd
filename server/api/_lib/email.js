import { buildReceiptEmailHtml } from './email-template.js';
import { buildPromoCodeEmailHtml } from './promo-email-template.js';

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

async function sendViaResend({ to, bcc, subject, html, replyTo }) {
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
        }),
    });

    if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(`Resend send failed (${response.status}): ${body}`);
    }

    return response.json();
}

/** Sends the branded booking-confirmation receipt to the customer, bcc'd to the business inbox. */
export async function sendReceiptEmail(receipt) {
    const html = buildReceiptEmailHtml(receipt);
    const businessEmail = process.env.BUSINESS_EMAIL;

    if (!receipt.customerEmail) {
        console.warn('[email] no customer email on receipt, skipping send', receipt.reference);
        return;
    }

    await sendViaResend({
        to: receipt.customerEmail,
        bcc: businessEmail,
        subject: `Booking confirmed — ${receipt.reference}`,
        html,
        replyTo: businessEmail,
    });
}

/** Emails a newly issued one-time promo code to the verified customer. */
export async function sendPromoCodeEmail({ code, vehicleRegistration, email }) {
    const html = buildPromoCodeEmailHtml({ code, vehicleRegistration });
    const businessEmail = process.env.BUSINESS_EMAIL;

    await sendViaResend({
        to: email,
        bcc: businessEmail,
        subject: 'Your 10% single-wash promo code',
        html,
        replyTo: businessEmail,
    });
}
