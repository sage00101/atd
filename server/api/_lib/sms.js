const DEFAULT_API_BASE = 'https://sms1.smsmessenger.co.za/app/api/rest/v1';
const DEFAULT_BUSINESS_SMS = '+27733069217';

/** Converts any South African style number to the 27XXXXXXXXX format SMSMessenger expects. */
export function normaliseSmsRecipient(rawNumber) {
    const digits = String(rawNumber || '').replace(/\D/g, '');
    if (!digits) return '';
    if (digits.startsWith('27') && digits.length >= 11) return digits;
    if (digits.startsWith('0') && digits.length === 10) return `27${digits.slice(1)}`;
    if (digits.length === 9) return `27${digits}`;
    return digits;
}

export function getBusinessSmsNumber() {
    return normaliseSmsRecipient(process.env.BUSINESS_SMS || process.env.BUSINESS_SMS_NUMBER || DEFAULT_BUSINESS_SMS);
}

export function isSmsConfigured() {
    return Boolean(process.env.SMSMESSENGER_EMAIL && process.env.SMSMESSENGER_API_KEY);
}

/**
 * Sends one SMS through SMSMessenger's REST API.
 * Resolves { skipped: true } when credentials are missing and throws on provider errors.
 */
export async function sendSms({ to, message, campaign = 'A10tion', dataField = '' }) {
    const recipientNumber = normaliseSmsRecipient(to);
    if (!isSmsConfigured() || !recipientNumber) {
        console.log('[sms skipped — SMSMESSENGER_EMAIL/SMSMESSENGER_API_KEY or recipient not set]', { to: recipientNumber });
        return { skipped: true };
    }

    const base = (process.env.SMSMESSENGER_API_BASE || DEFAULT_API_BASE).replace(/\/$/, '');
    const response = await fetch(`${base}/sms/send.json`, {
        method: 'POST',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            email: process.env.SMSMESSENGER_EMAIL,
            token: process.env.SMSMESSENGER_API_KEY,
        },
        body: JSON.stringify({
            recipientNumber,
            message: String(message || '').slice(0, 612),
            campaign,
            ...(dataField ? { dataField: String(dataField).slice(0, 100) } : {}),
        }),
    });

    const text = await response.text().catch(() => '');
    let result = {};
    try { result = text ? JSON.parse(text) : {}; } catch { result = { raw: text }; }
    if (!response.ok || result.error) {
        throw new Error(`SMSMessenger send failed (${response.status}): ${result.error || text || 'no response body'}`);
    }
    return { sent: true, messageId: result.messageId || '' };
}

export function buildBookingRequestSmsText(request) {
    const booking = request.booking || {};
    const customer = booking.customer || {};
    const name = `${customer.firstName || ''} ${customer.surname || ''}`.trim() || 'Customer';
    const kind = booking.bookingType === 'monthly-entitlement' ? 'Monthly' : 'Single wash';
    return [
        'A10tion: NEW booking request awaiting approval',
        `${kind} · ${name}`,
        `Date: ${`${booking.bookingDate || ''} ${booking.bookingTime || ''}`.trim() || '—'}`,
        `Contact: ${customer.mobile || customer.email || '—'}`,
        `Ref: ${request.reference}`,
        'Open the Business Manager to accept or decline.',
    ].join('\n');
}

export async function sendBookingRequestSms(request) {
    return sendSms({
        to: getBusinessSmsNumber(),
        message: buildBookingRequestSmsText(request),
        campaign: 'Booking requests',
        dataField: request.reference,
    });
}
