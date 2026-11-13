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
    const email = String(process.env.SMSMESSENGER_EMAIL || '').trim();
    const apiKey = String(process.env.SMSMESSENGER_API_KEY || '').trim();
    return Boolean(email && apiKey
        && !/^REPLACE_WITH_/i.test(email)
        && !/^REPLACE_WITH_/i.test(apiKey));
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

    const text = await response.text();
    let result = {};
    try { result = text ? JSON.parse(text) : {}; } catch { result = { raw: text }; }
    if (!result || typeof result !== 'object') result = {};
    if (!response.ok || result.error) {
        throw new Error(`SMSMessenger send failed (${response.status}): ${result.error || text || 'no response body'}`);
    }
    if (!result.messageId) {
        throw new Error('SMSMessenger did not confirm acceptance. Check the provider before retrying.');
    }
    return { sent: true, messageId: result.messageId };
}

export function buildMapsLink(address) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(String(address || '').trim())}`;
}

export function buildAddressSmsLines(address) {
    const clean = String(address || '').trim();
    return clean ? [`Address: ${clean}`, `Map: ${buildMapsLink(clean)}`] : [];
}

function normaliseGsmField(value) {
    return String(value || '')
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^A-Za-z0-9 @._,+()'/:;-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

export function buildBusinessBookingSmsText({ name, email, address, packageName }) {
    const safeName = normaliseGsmField(name) || 'Customer';
    const safeEmail = normaliseGsmField(email) || 'Not provided';
    const safeAddress = normaliseGsmField(address) || 'Not provided';
    const safePackage = normaliseGsmField(packageName) || 'Wash package';
    const prefix = `A10tion; N:${safeName}; E:${safeEmail}; A:`;
    const suffix = `; P:${safePackage}`;
    const addressLimit = Math.max(0, 160 - prefix.length - suffix.length);
    const clippedAddress = safeAddress.slice(0, addressLimit).trimEnd();
    return `${prefix}${clippedAddress}${suffix}`.slice(0, 160);
}

export function buildBookingRequestSmsText(request) {
    const booking = request.booking || {};
    const customer = booking.customer || {};
    const name = `${customer.firstName || ''} ${customer.surname || ''}`.trim() || 'Customer';
    return buildBusinessBookingSmsText({
        name,
        email: customer.email,
        address: customer.address,
        packageName: booking.packageName || booking.packageId,
    });
}

export function buildCustomerBookingRequestSmsText(request, statusUrl = '') {
    const booking = request.booking || {};
    const customer = booking.customer || {};
    const firstName = String(customer.firstName || '').trim() || 'there';
    return [
        `A10tion: Hi ${firstName}, we received your booking request.`,
        `Ref: ${request.reference || 'Pending'}`,
        `Requested: ${`${booking.bookingDate || ''} ${booking.bookingTime || ''}`.trim() || 'To be confirmed'}`,
        'Your request is pending review. We will update you after it has been reviewed.',
        statusUrl ? `Track your request: ${statusUrl}` : '',
    ].filter(Boolean).join('\n');
}

export function buildCustomerBookingConfirmationSmsText(receipt) {
    return [
        `A10tion: Your booking is confirmed, ${String(receipt.customerName || 'thank you').trim()}.`,
        `Ref: ${receipt.reference || '—'}`,
        `Date: ${`${receipt.bookingDate || ''} ${receipt.bookingTime || ''}`.trim() || '—'}`,
        `Vehicle: ${receipt.registration || '—'}`,
        `Amount: ${receipt.amountZar || '—'}`,
    ].join('\n');
}

export async function sendCustomerBookingRequestSms(request, statusUrl = '') {
    return sendSms({
        to: request.booking?.customer?.mobile,
        message: buildCustomerBookingRequestSmsText(request, statusUrl),
        campaign: 'Customer booking updates',
        dataField: request.reference,
    });
}

export async function sendCustomerBookingConfirmationSms(receipt) {
    return sendSms({
        to: receipt.customerMobile,
        message: buildCustomerBookingConfirmationSmsText(receipt),
        campaign: 'Customer booking updates',
        dataField: receipt.reference,
    });
}

export async function sendBookingRequestSms(request) {
    return sendSms({
        to: getBusinessSmsNumber(),
        message: buildBookingRequestSmsText(request),
        campaign: 'Booking requests',
        dataField: request.reference,
    });
}
