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

function bookingSmsDateTime(request) {
    const date = String(request.booking?.bookingDate || '');
    const time = String(request.booking?.bookingTime || '');
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
    if (!match || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) {
        throw new Error('Booking date and time are required for the SMS.');
    }
    return `${match[3]}.${match[2]}.${match[1]} at ${time}`;
}

function shortenSmsField(value, limit) {
    if (value.length <= limit) return value;
    return `${value.slice(0, limit - 3).trimEnd()}...`;
}

export function buildBookingRequestSmsText(request) {
    const customer = request.booking?.customer || {};
    const name = normaliseGsmField(`${customer.firstName || ''} ${customer.surname || ''}`) || 'Customer';
    const address = normaliseGsmField(customer.address) || 'Not provided';
    const dateTime = bookingSmsDateTime(request);
    const header = 'A10tion To Detail: Booking Request\nCustomer: ';
    const middle = `\nDate/Time: ${dateTime}\nAddress: `;
    const available = 160 - header.length - middle.length;
    let nameLimit = name.length;
    let addressLimit = address.length;
    if (nameLimit + addressLimit > available) {
        nameLimit = Math.min(name.length, Math.floor(available / 2));
        addressLimit = Math.min(address.length, available - nameLimit);
        nameLimit = Math.min(name.length, available - addressLimit);
    }
    return `${header}${shortenSmsField(name, nameLimit)}${middle}${shortenSmsField(address, addressLimit)}`;
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

export function buildCustomerBookingApprovalSmsText(request) {
    if (request.status === 'confirmed' && request.booking?.requestedPaymentMethod === 'onsite') {
        return [
            'A10tion To Detail: Your booking is confirmed!',
            `Date/Time: ${bookingSmsDateTime(request)}`,
            `Ref: ${request.reference}`,
            'Pay on arrival by Yoco card machine. Check your email for details.',
        ].join('\n');
    }
    return [
        'A10tion To Detail: Booking Request Approved!',
        `Date/Time: ${bookingSmsDateTime(request)}`,
        'Please complete your booking using the link in your email, or WhatsApp.',
    ].join('\n');
}

function sendBookingApprovalSms(to, message, reference) {
    if (message.length > 612) {
        throw new Error('Booking approval SMS exceeds the 612-character limit.');
    }
    return sendSms({ to, message, campaign: 'Booking approvals', dataField: reference });
}

export function sendCustomerBookingApprovalSms(request) {
    return sendBookingApprovalSms(
        request.booking?.customer?.mobile,
        buildCustomerBookingApprovalSmsText(request),
        request.reference,
    );
}

export function sendCustomerBookingDeclinedSms(request) {
    const firstName = String(request.booking?.customer?.firstName || '').trim().slice(0, 80) || 'there';
    const reference = String(request.reference || '').trim().slice(0, 40);
    const message = [
        `A10tion To Detail: Hi ${firstName}, unfortunately your booking request was declined.`,
        reference ? `Ref: ${reference}.` : '',
        'Please check your email for details.',
    ].filter(Boolean).join(' ');
    return sendSms({
        to: request.booking?.customer?.mobile,
        message,
        campaign: 'Customer booking updates',
        dataField: request.reference,
    });
}

export async function sendCustomerBookingRequestSms(request, statusUrl = '') {
    return sendSms({
        to: request.booking?.customer?.mobile,
        message: buildCustomerBookingRequestSmsText(request, statusUrl),
        campaign: 'Customer booking updates',
        dataField: request.reference,
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
