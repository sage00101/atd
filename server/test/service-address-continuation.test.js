import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';

let approvedBooking;
mock.module('../api/_lib/redis.js', { exports: { redis: {} } });
mock.module('../api/_lib/booking-approval.js', {
    exports: {
        beginBookingContinuation: async () => ({ request: { id: 'test', booking: approvedBooking } }),
        completeBookingContinuation: async () => {},
        resetBookingContinuation: async () => {},
    },
});
const [{ default: onsite }, { default: online }] = await Promise.all([
    import('../handlers/bookings-onsite.js'),
    import('../handlers/yoco-checkout.js'),
]);

function request() {
    const body = Buffer.from('--test-boundary\r\nContent-Disposition: form-data; name="booking"\r\n\r\n{"approvalToken":"test"}\r\n--test-boundary--\r\n');
    const req = Readable.from([body]);
    req.method = 'POST';
    req.headers = { 'content-type': 'multipart/form-data; boundary=test-boundary', 'content-length': String(body.length) };
    return req;
}

function response() {
    return {
        statusCode: 200,
        setHeader() { return this; },
        status(code) { this.statusCode = code; return this; },
        json(body) { this.body = body; return this; },
    };
}

test('approved onsite, online and monthly continuations accept manual and distant addresses', async () => {
    for (const [handler, paymentMethod, bookingType] of [
        [onsite, 'onsite', undefined],
        [online, 'online', undefined],
        [online, 'monthly', 'monthly-entitlement'],
    ]) {
        approvedBooking = {
            requestedPaymentMethod: paymentMethod,
            bookingType,
            customer: { address: 'Manual address', email: 'test@example.com', registration: 'ABC123' },
            termsAccepted: true,
        };
        for (const serviceLocation of [undefined, { latitude: -26.2, longitude: 28.0 }]) {
            approvedBooking.serviceLocation = serviceLocation;
            const res = response();
            await handler(request(), res);
            assert.equal(res.statusCode, 400);
            assert.equal(res.body.message, 'Choose a date and time.');
        }
        approvedBooking.customer.address = ' ';
        const missingAddress = response();
        await handler(request(), missingAddress);
        assert.match(missingAddress.body.message, /service address/);
        approvedBooking.customer.address = 'Manual address';
        approvedBooking.termsAccepted = false;
        const missingTerms = response();
        await handler(request(), missingTerms);
        assert.match(missingTerms.body.message, /confirmations missing/i);
    }
});
