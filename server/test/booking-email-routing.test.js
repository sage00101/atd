import test, { mock } from 'node:test';
import assert from 'node:assert/strict';

process.env.RESEND_API_KEY = 'test-key';
process.env.RESEND_FROM_EMAIL = 'Test <test@example.com>';
process.env.BUSINESS_EMAIL = 'other@example.com';
delete process.env.BOOKING_REQUEST_EMAIL;

const smsCalls = [];
mock.module('../api/_lib/sms.js', {
    exports: {
        buildCustomerBookingConfirmationSmsText: () => 'Customer SMS',
        sendSms: async (args) => { smsCalls.push(args); return { sent: true }; },
    },
});

const {
    sendBookingRequestReceivedEmails,
    sendBookingRequestApprovedEmail,
    sendBookingRequestDeclinedEmail,
    sendReceiptEmail,
} = await import('../api/_lib/email.js');

const request = {
    id: 'test-request',
    reference: 'TEST123',
    booking: {
        customer: { firstName: 'Test', email: 'customer@example.com' },
        contractFileName: 'contract.pdf',
        contractFileBase64: 'ZmlsZQ==',
    },
};

test('only booking requests send a business copy to the booking inbox', async (t) => {
    smsCalls.length = 0;
    const sent = [];
    t.mock.method(globalThis, 'fetch', async (_url, options) => {
        sent.push(JSON.parse(options.body));
        return { ok: true, status: 200, json: async () => ({ id: 'test-email' }) };
    });

    const status = await sendBookingRequestReceivedEmails(request, 'https://example.com/status');
    assert.equal(status.customerSent, true);
    assert.equal(status.businessSent, true);
    assert.deepEqual(sent.map((email) => email.to), [['bookings@a10tion.co.za'], ['customer@example.com']]);
    assert.equal(sent[0].attachments[0].filename, 'contract.pdf');
    assert.equal(sent[1].attachments, undefined);
    sent.length = 0;

    await sendBookingRequestApprovedEmail(request, 'https://example.com/continue');
    await sendBookingRequestDeclinedEmail(request);
    await sendReceiptEmail({
        reference: 'TEST123',
        customerEmail: 'customer@example.com',
        customerMobile: '123',
        amountZar: 'R250.00',
    });
    assert.equal(smsCalls.length, 0);
    assert.equal(sent.length, 3);
    for (const email of sent) {
        assert.deepEqual(email.to, ['customer@example.com']);
        assert.equal(email.bcc, undefined);
    }
});

test('receipt email failures are reported', async (t) => {
    t.mock.method(globalThis, 'fetch', async () => ({
        ok: false,
        status: 400,
        text: async () => 'Provider rejected email',
    }));
    await assert.rejects(sendReceiptEmail({
        reference: 'TEST123',
        customerEmail: 'customer@example.com',
        customerMobile: '123',
    }), /Provider rejected email/);
});
