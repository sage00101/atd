import { buildReceiptEmailHtml } from './email-template.js';
import { buildVehiclePromoApprovedEmailHtml } from './promo-email-template.js';

const RESEND_ENDPOINT = 'https://api.resend.com/emails';
const BOOKINGS_EMAIL = 'bookings@a10tion.co.za';

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

/** Sends the branded booking-confirmation receipt to the customer, bcc'd to the business inbox. */
export async function sendReceiptEmail(receipt) {
    const html = buildReceiptEmailHtml(receipt);
    const businessEmail = process.env.BUSINESS_EMAIL || BOOKINGS_EMAIL;

    if (!receipt.customerEmail) {
        console.warn('[email] no customer email on receipt, skipping send', receipt.reference);
        return;
    }

    return sendViaResend({
        to: receipt.customerEmail,
        bcc: businessEmail,
        subject: `Booking confirmed — ${receipt.reference}`,
        html,
        replyTo: businessEmail,
    });
}

/** Emails a newly approved customer confirming their vehicle registration now works as a promo code. */
export async function sendVehiclePromoApprovedEmail({ vehicleRegistration, email }) {
    const html = buildVehiclePromoApprovedEmailHtml({ vehicleRegistration });
    const businessEmail = process.env.BUSINESS_EMAIL;

    await sendViaResend({
        to: email,
        bcc: businessEmail,
        subject: 'Your 50% single-wash discount is ready',
        html,
        replyTo: businessEmail,
    });
}

/** Sends the customer's signed contract agreement to the business inbox only — never attached to the customer's own copy. */
export async function sendMonthlyContractEmail({ receipt, contractFileBase64, contractFileName }) {
    const businessEmail = process.env.BUSINESS_EMAIL || BOOKINGS_EMAIL;
    if (!contractFileBase64 || !contractFileName) return;

    const html = `
<!doctype html>
<html>
<body style="margin:0;padding:24px;background:#F6F7F3;font-family:Segoe UI,Helvetica,Arial,sans-serif;">
    <p style="color:#161B18;font-size:14px;line-height:1.6;">
        New monthly package booking — <strong>${receipt.reference}</strong><br>
        Customer: ${receipt.customerName || 'n/a'} (${receipt.customerEmail || 'n/a'})<br>
        Package: ${receipt.packageName || 'n/a'}${receipt.vehicleType ? ` · ${receipt.vehicleType}` : ''}<br>
        The customer's signed supplier/client contract agreement is attached.
    </p>
</body>
</html>`;

    await sendViaResend({
        to: businessEmail,
        subject: `Monthly package contract attached — ${receipt.reference}`,
        html,
        attachments: [{ filename: contractFileName, content: contractFileBase64 }],
    });
}
