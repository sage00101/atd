import test, { mock } from 'node:test';
import assert from 'node:assert/strict';

const request = {
    id: 'request-1',
    reference: 'REQ123',
    booking: {
        bookingDate: '2026-11-20',
        bookingTime: '10:30',
        packageName: 'Standard Wash',
        customer: {
            firstName: 'Jane',
            surname: 'Doe',
            mobile: '082 123 4567',
            address: '1 Main Road, Cape Town',
        },
    },
};
let declineError = '';
let declineEmailError = '';
let declineEmailCalls = 0;
let declinedEmailRequest;
let approvalEmailCalls = 0;
let confirmationEmailCalls = 0;
let confirmationEmailError = '';
let storedBookingStatus = 'confirmed_unpaid';
let continuationValid = true;

mock.module('../api/_lib/store.js', { exports: {
    getBooking: async () => ({ status: storedBookingStatus }),
} });
mock.module('../api/_lib/booking-approval.js', { exports: {
    acceptBookingRequest: async () => ({ request, continuationToken: 'test-token' }),
    declineBookingRequest: async (_id, _adminName, reason) => {
        if (declineError) throw new Error(declineError);
        return { ...request, status: 'declined', declineReason: reason };
    },
    clearBookingActivityFromAdmin: async () => ({}),
    deleteBookingRequestFromAdmin: async () => ({}),
    getBookingRequestByContinuationToken: async () => continuationValid ? request : null,
    getBookingRequestForAdmin: async () => request,
    getPublicBookingRequest: (record) => record,
    listBookingRequests: async () => [],
} });
mock.module('../api/_lib/email.js', { exports: {
    sendBookingRequestApprovedEmail: async () => { approvalEmailCalls += 1; return { sent: true }; },
    sendOnsiteBookingConfirmedEmail: async () => {
        confirmationEmailCalls += 1;
        if (confirmationEmailError) throw new Error(confirmationEmailError);
        return { sent: true };
    },
    sendBookingRequestDeclinedEmail: async (record) => {
        declineEmailCalls += 1;
        declinedEmailRequest = record;
        if (declineEmailError) throw new Error(declineEmailError);
        return { sent: true };
    },
} });

const [{ default: handler }, sms] = await Promise.all([
    import('../handlers/booking-requests-admin.js'),
    import('../api/_lib/sms.js'),
]);

function response() {
    return {
        setHeader() { return this; },
        status(code) { this.statusCode = code; return this; },
        json(body) { this.body = body; return this; },
    };
}

test('accepting a request sends the approval SMS only to the customer and reports its result', async (t) => {
    const keys = ['ADMIN_API_KEY', 'CALENDAR_API_KEY', 'SMSMESSENGER_EMAIL', 'SMSMESSENGER_API_KEY', 'BUSINESS_SMS'];
    const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
    t.after(() => keys.forEach((key) => {
        if (previous[key] === undefined) delete process.env[key];
        else process.env[key] = previous[key];
    }));
    process.env.ADMIN_API_KEY = 'admin-test-key';
    process.env.SMSMESSENGER_EMAIL = 'sms-test@example.com';
    process.env.SMSMESSENGER_API_KEY = 'test-token';
    process.env.BUSINESS_SMS = '+27831234567';

    const calls = [];
    let failedRecipient = '';
    t.mock.method(globalThis, 'fetch', async (_url, options) => {
        const payload = JSON.parse(options.body);
        calls.push(payload);
        return new Response(JSON.stringify(payload.recipientNumber === failedRecipient
            ? { error: 'Insufficient credit' }
            : { messageId: 'message-123', error: null }), { status: 200 });
    });

    async function perform(action) {
        const res = response();
        await handler({
            method: 'POST',
            headers: { 'x-admin-key': 'admin-test-key' },
            body: { action, id: request.id, adminName: 'Manager' },
        }, res);
        return res;
    }

    const approved = await perform('accept');
    assert.equal(approved.statusCode, 200);
    assert.equal(approved.body.customerSms.sent, true);
    assert.equal(approved.body.businessSms, undefined);
    assert.equal(calls.length, 1);
    const customer = calls[0];
    assert.equal(customer.recipientNumber, '27821234567');
    assert.equal(customer.message, [
        'A10tion To Detail: Booking Request Approved!',
        'Date/Time: 20.11.2026 at 10:30',
        'Please complete your booking using the link in your email.',
    ].join('\n'));
    assert.ok(customer.message.length <= 160);

    failedRecipient = '27821234567';
    const partial = await perform('accept');
    assert.equal(partial.statusCode, 200);
    assert.equal(partial.body.customerSms.sent, false);
    assert.match(partial.body.customerSms.problem, /Insufficient credit/);
    assert.equal(partial.body.businessSms, undefined);
    assert.equal(calls.length, 2);
    assert.throws(() => sms.sendCustomerBookingApprovalSms({ booking: { bookingDate: 'invalid' } }), /date and time/);
});

test('onsite acceptance sends a confirmation rather than a continuation link', async (t) => {
    const keys = ['ADMIN_API_KEY', 'SMSMESSENGER_EMAIL', 'SMSMESSENGER_API_KEY'];
    const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
    process.env.ADMIN_API_KEY = 'admin-test-key';
    process.env.SMSMESSENGER_EMAIL = 'sms-test@example.com';
    process.env.SMSMESSENGER_API_KEY = 'test-token';
    request.status = 'confirmed';
    request.booking.requestedPaymentMethod = 'onsite';
    t.after(() => {
        keys.forEach((key) => {
            if (previous[key] === undefined) delete process.env[key];
            else process.env[key] = previous[key];
        });
        delete request.status;
        delete request.booking.requestedPaymentMethod;
        confirmationEmailError = '';
        storedBookingStatus = 'confirmed_unpaid';
    });
    t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({ messageId: 'message-123' }), { status: 200 }));
    const expectedSms = sms.buildCustomerBookingApprovalSmsText(request);
    assert.match(expectedSms, /booking is confirmed/i);
    assert.match(expectedSms, /Pay on arrival by Yoco card machine/);
    assert.doesNotMatch(expectedSms, /complete your booking/);
    const res = response();
    const oldApprovalCalls = approvalEmailCalls;
    const oldConfirmationCalls = confirmationEmailCalls;
    await handler({ method: 'POST', headers: { 'x-admin-key': 'admin-test-key' },
        body: { action: 'accept', id: request.id, adminName: 'Manager' } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.request.status, 'confirmed');
    assert.equal(res.body.customerSms.sent, true);
    assert.equal(approvalEmailCalls, oldApprovalCalls);
    assert.equal(confirmationEmailCalls, oldConfirmationCalls + 1);
    confirmationEmailError = 'Email provider failed';
    const failed = response();
    await handler({ method: 'POST', headers: { 'x-admin-key': 'admin-test-key' },
        body: { action: 'accept', id: request.id, adminName: 'Manager' } }, failed);
    assert.equal(failed.body.request.status, 'confirmed');
    assert.equal(failed.body.emailSent, false);
    assert.match(failed.body.emailProblem, /Email provider failed/);
    assert.equal(failed.body.customerSms.sent, true);
    confirmationEmailError = '';
    const resend = response();
    await handler({ method: 'POST', headers: { 'x-admin-key': 'admin-test-key' },
        body: { action: 'resend-email', id: request.id } }, resend);
    assert.equal(resend.body.emailSent, true);
    storedBookingStatus = 'paid';
    const paidResend = response();
    await handler({ method: 'POST', headers: { 'x-admin-key': 'admin-test-key' },
        body: { action: 'resend-email', id: request.id } }, paidResend);
    assert.equal(paidResend.statusCode, 409);
});

test('WhatsApp action prepares state-specific messages for the booking customer', async (t) => {
    const previousKey = process.env.ADMIN_API_KEY;
    const previousSite = process.env.SITE_URL;
    process.env.ADMIN_API_KEY = 'admin-test-key';
    process.env.SITE_URL = 'https://example.com/';
    request.status = 'approved';
    request.continuationToken = 'private-token';
    request.booking.requestedPaymentMethod = 'online';
    t.after(() => {
        if (previousKey === undefined) delete process.env.ADMIN_API_KEY;
        else process.env.ADMIN_API_KEY = previousKey;
        if (previousSite === undefined) delete process.env.SITE_URL;
        else process.env.SITE_URL = previousSite;
        delete request.status;
        delete request.continuationToken;
        delete request.booking.requestedPaymentMethod;
        delete request.booking.bookingType;
        request.booking.customer.mobile = '082 123 4567';
        continuationValid = true;
        storedBookingStatus = 'confirmed_unpaid';
    });
    async function prepare(key = 'admin-test-key') {
        const res = response();
        await handler({ method: 'POST', headers: { 'x-admin-key': key },
            body: { action: 'whatsapp-approval', id: request.id } }, res);
        return res;
    }
    assert.equal((await prepare('wrong-key')).statusCode, 401);
    const online = await prepare();
    assert.equal(online.statusCode, 200);
    const url = new URL(online.body.url);
    assert.equal(url.origin, 'https://wa.me');
    assert.equal(url.pathname, '/27821234567');
    const text = url.searchParams.get('text');
    assert.match(text, /^Dear client,/);
    assert.match(text, /secure Yoco checkout/);
    assert.match(text, /https:\/\/example\.com\/\?booking-continuation=private-token/);
    assert.match(text, /confirmed once payment has been completed/);

    request.booking.customer.mobile = '+44 7700 900123';
    const international = new URL((await prepare()).body.url);
    assert.equal(international.pathname, '/447700900123');
    request.booking.customer.mobile = '082 123 4567';
    request.booking.bookingType = 'monthly-entitlement';
    request.booking.requestedPaymentMethod = 'monthly';
    const monthly = new URL((await prepare()).body.url).searchParams.get('text');
    assert.match(monthly, /verify your monthly wash entitlement/);
    assert.doesNotMatch(monthly, /Yoco checkout|payment has been completed/);

    delete request.booking.bookingType;
    request.booking.requestedPaymentMethod = 'onsite';
    const legacyOnsite = new URL((await prepare()).body.url).searchParams.get('text');
    assert.match(legacyOnsite, /complete this step/);
    assert.match(legacyOnsite, /booking-continuation=private-token/);
    request.status = 'confirmed';
    let onsite = new URL((await prepare()).body.url).searchParams.get('text');
    assert.match(onsite, /approved and confirmed/);
    assert.match(onsite, /pay our technician on arrival/);
    assert.doesNotMatch(onsite, /private-token/);
    storedBookingStatus = 'paid';
    onsite = new URL((await prepare()).body.url).searchParams.get('text');
    assert.match(onsite, /Thank you for your on-site payment/);
    assert.doesNotMatch(onsite, /pay our technician/);
    request.booking.requestedPaymentMethod = 'online';
    const confirmedOnline = new URL((await prepare()).body.url).searchParams.get('text');
    assert.match(confirmedOnline, /approved and confirmed/);
    assert.doesNotMatch(confirmedOnline, /private-token|Yoco checkout|pay our technician/);

    request.status = 'approved';
    request.booking.requestedPaymentMethod = 'online';
    continuationValid = false;
    assert.match((await prepare()).body.message, /missing or expired/);
    continuationValid = true;
    request.booking.customer.mobile = '123';
    assert.match((await prepare()).body.message, /cell number/);
    request.booking.customer.mobile = '082 123 4567';
    request.status = 'declined';
    assert.equal((await prepare()).statusCode, 409);
});

test('declining a request sends email and SMS independently and reports failures', async (t) => {
    const keys = ['ADMIN_API_KEY', 'CALENDAR_API_KEY', 'SMSMESSENGER_EMAIL', 'SMSMESSENGER_API_KEY'];
    const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
    t.after(() => {
        keys.forEach((key) => {
            if (previous[key] === undefined) delete process.env[key];
            else process.env[key] = previous[key];
        });
        declineError = '';
        declineEmailError = '';
        declineEmailCalls = 0;
        declinedEmailRequest = undefined;
        delete request.status;
    });
    process.env.ADMIN_API_KEY = 'admin-test-key';
    process.env.SMSMESSENGER_EMAIL = 'sms-test@example.com';
    process.env.SMSMESSENGER_API_KEY = 'test-token';

    const calls = [];
    let smsFails = false;
    t.mock.method(globalThis, 'fetch', async (_url, options) => {
        calls.push(JSON.parse(options.body));
        return new Response(JSON.stringify(smsFails
            ? { error: 'Insufficient credit' }
            : { messageId: 'message-123', error: null }), { status: 200 });
    });
    async function perform(action, key = 'admin-test-key') {
        const res = response();
        await handler({
            method: 'POST', headers: { 'x-admin-key': key },
            body: { action, id: request.id, adminName: 'Manager', reason: 'Unavailable' },
        }, res);
        return res;
    }

    assert.equal((await perform('decline', 'wrong-key')).statusCode, 401);
    declineError = 'This request has already been declined.';
    assert.equal((await perform('decline')).statusCode, 409);
    assert.equal(declineEmailCalls, 0);
    assert.equal(calls.length, 0);
    declineError = '';

    const declined = await perform('decline');
    assert.equal(declined.statusCode, 200);
    assert.equal(declined.body.emailSent, true);
    assert.equal(declined.body.customerSms.sent, true);
    assert.equal(declined.body.request.declineReason, 'Unavailable');
    assert.equal(declineEmailCalls, 1);
    assert.equal(declinedEmailRequest.declineReason, 'Unavailable');
    assert.equal(calls.length, 1);
    assert.equal(calls[0].recipientNumber, '27821234567');
    assert.equal(calls[0].message, 'A10tion To Detail: Hi Jane, unfortunately your booking request was declined. Ref: REQ123. Please check your email for details.');

    smsFails = true;
    const smsFailure = await perform('decline');
    assert.equal(smsFailure.body.emailSent, true);
    assert.equal(smsFailure.body.customerSms.sent, false);
    assert.match(smsFailure.body.customerSms.problem, /Insufficient credit/);
    smsFails = false;
    declineEmailError = 'Email provider failed';
    const emailFailure = await perform('decline');
    assert.equal(emailFailure.body.emailSent, false);
    assert.match(emailFailure.body.emailProblem, /Email provider failed/);
    assert.equal(emailFailure.body.customerSms.sent, true);
    declineEmailError = '';

    delete process.env.SMSMESSENGER_API_KEY;
    const missingConfig = await perform('decline');
    assert.equal(missingConfig.body.emailSent, true);
    assert.equal(missingConfig.body.customerSms.sent, false);
    assert.match(missingConfig.body.customerSms.problem, /not configured/);

    request.status = 'declined';
    const beforeResend = calls.length;
    assert.equal((await perform('resend-email')).body.emailSent, true);
    assert.equal(calls.length, beforeResend);
});
