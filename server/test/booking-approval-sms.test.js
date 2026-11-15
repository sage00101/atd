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

mock.module('../api/_lib/booking-approval.js', { exports: {
    acceptBookingRequest: async () => ({ request, continuationToken: 'test-token' }),
    declineBookingRequest: async (_id, _adminName, reason) => {
        if (declineError) throw new Error(declineError);
        return { ...request, status: 'declined', declineReason: reason };
    },
    clearBookingActivityFromAdmin: async () => ({}),
    deleteBookingRequestFromAdmin: async () => ({}),
    getBookingRequestForAdmin: async () => request,
    getPublicBookingRequest: (record) => record,
    listBookingRequests: async () => [],
} });
mock.module('../api/_lib/email.js', { exports: {
    sendBookingRequestApprovedEmail: async () => ({ sent: true }),
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

test('accepting a request sends the approved templates and reports each SMS result', async (t) => {
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
    assert.equal(approved.body.businessSms.sent, true);
    const customer = calls.find((call) => call.recipientNumber === '27821234567');
    const business = calls.find((call) => call.recipientNumber === '27831234567');
    assert.equal(customer.message, [
        'A10tion To Detail: Hi Jane, your booking request has been approved.',
        'Date: 2026-11-20',
        'Time: 10:30',
        'Wash: Standard Wash',
        'Address: 1 Main Road, Cape Town',
        'Please complete your booking using the link in your email.',
    ].join('\n'));
    assert.equal(business.message, [
        'A10tion To Detail: Booking request approved.',
        'Customer: Jane Doe',
        'Phone: 082 123 4567',
        'Date: 2026-11-20',
        'Time: 10:30',
        'Wash: Standard Wash',
        'Address: 1 Main Road, Cape Town',
    ].join('\n'));

    failedRecipient = '27821234567';
    const partial = await perform('accept');
    assert.equal(partial.statusCode, 200);
    assert.equal(partial.body.customerSms.sent, false);
    assert.match(partial.body.customerSms.problem, /Insufficient credit/);
    assert.equal(partial.body.businessSms.sent, true);
    const beforeLongRequest = calls.length;
    const longRequest = { ...request, booking: { ...request.booking, customer: { ...request.booking.customer, address: 'x'.repeat(612) } } };
    assert.throws(() => sms.sendCustomerBookingApprovalSms(longRequest), /612-character limit/);
    assert.equal(calls.length, beforeLongRequest);
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
