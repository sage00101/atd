import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { Readable } from 'node:stream';

let booking;
let approvedBooking;
let provisionResult;
let provisionCalls;
let receipts;
let receiptFailure;
let processed;

mock.module('../api/_lib/booking-cancellation.js', { exports: {
    finishPendingBookingCancellation: async () => {},
} });
mock.module('../api/_lib/email.js', { exports: {
    sendReceiptEmail: async (receipt) => {
        receipts.push(receipt);
        if (receiptFailure) throw new Error('Receipt provider failed');
        return { id: 'receipt' };
    },
} });
mock.module('../api/_lib/monthly-promos.js', { exports: {
    provisionMonthlyEntitlementFromPaidPurchase: async (paidBooking) => {
        provisionCalls.push(paidBooking);
        return provisionResult;
    },
    reserveMonthlyWash: async () => ({
        status: 'OK', entitlement: { id: 'monthly-id', clientType: 'private', packageTier: 'standard', monthlyAllowance: 2 },
        period: '2027-01-01',
    }),
    confirmMonthlyWashReservation: async () => 'OK',
    releaseMonthlyWashReservation: async () => {},
    getMonthlyReservationError: () => ({ statusCode: 409, message: 'Not available' }),
} });
mock.module('../api/_lib/booking-approval.js', { exports: {
    beginBookingContinuation: async () => ({
        request: { id: 'request-id', reference: 'REF123', booking: approvedBooking, continuationToken: 'test-token', approvalExpiresAt: Date.now() + 300000, checkoutExpiresAt: Date.now() + 5 * 86400000 },
    }),
    completeBookingContinuation: async () => true,
    resetBookingContinuation: async () => {},
    markBookingRequestConfirmed: async () => {},
    findBookingRequestBySlot: async () => ({}),
} });
mock.module('../api/_lib/store.js', { exports: {
    getBooking: async () => booking,
    markOnsiteBookingPaid: async () => {
        if (booking.status !== 'confirmed_unpaid') return null;
        booking = { ...booking, status: 'paid', paidAt: '2026-11-23T12:00:00Z' };
        return booking;
    },
    markBookingConfirmed: async () => {
        if (booking.status === 'paid') return null;
        booking = { ...booking, status: 'paid', paidAt: '2026-11-23T12:00:00Z' };
        return booking;
    },
    hasProcessedWebhook: async () => processed,
    markWebhookProcessed: async () => { processed = true; },
    markSharedPromoCodeUsed: async () => true,
    getVehiclePromo: async () => null,
    markVehiclePromoUsed: async () => {},
    cancelPendingBookingById: async () => null,
    claimUniqueReferenceNumber: async () => 'REF123',
    getSharedPromoCodeStatus: async () => ({ status: 'invalid' }),
    looksLikeEmail: (value) => String(value).includes('@'),
    looksLikeVehicleRegistration: () => true,
    normaliseEmail: (value) => String(value).trim().toLowerCase(),
    normaliseReg: (value) => String(value).trim().toUpperCase(),
    releaseBookingSlot: async () => {},
    releaseBookingSlotIfOwned: async () => {},
    releaseSharedPromoCode: async () => {},
    reserveBookingSlot: async () => true,
    reserveSharedPromoCode: async () => true,
    savePendingBooking: async () => {},
    saveOnsiteBooking: async () => {},
    getMonthlyPackageTotalCents: () => 42000,
    PROMO_DISCOUNT_RATE: 0.5,
    SINGLE_WASH_CENTS: { 'Sedan / Hatchback': 25000 },
} });

const [{ default: confirmOnsite }, { default: online }, { default: onsite }, { default: webhook }] = await Promise.all([
    import('../handlers/onsite-confirm-payment.js'),
    import('../handlers/yoco-checkout.js'),
    import('../handlers/bookings-onsite.js'),
    import('../api/payments/yoco/webhook.js'),
]);

function response() {
    return {
        setHeader() { return this; },
        status(code) { this.statusCode = code; return this; },
        json(body) { this.body = body; return this; },
        send(body) { this.body = body; return this; },
    };
}

function monthlyBooking(term = '1-months') {
    return {
        reference: 'REF123', purchaseType: 'monthly', packageId: 'private-standard',
        packageName: 'Private Standard', vehicleType: 'Sedan / Hatchback',
        contractOption: term, bookingDate: '2030-01-15', bookingTime: '14:30',
        amountCents: 42000, paymentMethod: 'onsite', status: 'confirmed_unpaid',
        customer: { firstName: 'Test', surname: 'Client', email: 'client@example.test', mobile: '0821234567', registration: 'ABC123', address: '12 Main Road' },
    };
}

function reset() {
    provisionResult = { status: 'created', monthlyCode: 'ATDM-TESTCODE' };
    provisionCalls = [];
    receipts = [];
    receiptFailure = false;
    processed = false;
}

test('on-site card payments provision after confirmation and include the code on the paid receipt', async (t) => {
    const previous = process.env.CALENDAR_API_KEY;
    process.env.CALENDAR_API_KEY = 'test-calendar-key';
    t.after(() => {
        if (previous === undefined) delete process.env.CALENDAR_API_KEY;
        else process.env.CALENDAR_API_KEY = previous;
    });
    for (const term of ['1-months', '3-months']) {
        reset();
        booking = monthlyBooking(term);
        const req = { method: 'POST', headers: { 'x-admin-key': 'test-calendar-key' }, body: { reference: 'REF123' } };
        const res = response();
        await confirmOnsite(req, res);
        assert.equal(res.body.paid, true);
        assert.equal(res.body.monthlyProvisioned, true);
        assert.equal(provisionCalls.length, 1);
        assert.equal(provisionCalls[0].status, 'paid');
        assert.equal(provisionCalls[0].contractOption, term);
        assert.equal(receipts[0].monthlyCode, 'ATDM-TESTCODE');
        assert.equal(receipts[0].paymentStatus, 'paid');
        const retry = response();
        await confirmOnsite(req, retry);
        assert.equal(retry.body.alreadyConfirmed, true);
        assert.equal(receipts[1].receiptIdempotencyKey, receipts[0].receiptIdempotencyKey);
    }
    reset();
    booking = { ...monthlyBooking(), status: 'cancelled' };
    const res = response();
    await confirmOnsite({ method: 'POST', headers: { 'x-admin-key': 'test-calendar-key' }, body: { reference: 'REF123' } }, res);
    assert.equal(res.statusCode, 409);
    assert.equal(provisionCalls.length, 0);
});

test('covered wash receipts include the validated access code', async () => {
    for (const [handler, method] of [[online, 'monthly'], [onsite, 'onsite']]) {
        reset();
        approvedBooking = {
            ...monthlyBooking(), purchaseType: 'single', bookingType: 'monthly-entitlement',
            requestedPaymentMethod: method, monthlyClientType: 'private', monthlyPackageTier: 'standard',
            promoCode: 'atdm-testcode', termsAccepted: true,
        };
        const body = Buffer.from('--test\r\nContent-Disposition: form-data; name="booking"\r\n\r\n{"approvalToken":"test"}\r\n--test--\r\n');
        const req = Readable.from([body]);
        req.method = 'POST';
        req.headers = { 'content-type': 'multipart/form-data; boundary=test', 'content-length': String(body.length) };
        const res = response();
        await handler(req, res);
        assert.equal(res.body.monthlyCovered, true);
        assert.equal(receipts[0].monthlyCode, 'ATDM-TESTCODE');
        assert.equal(receipts[0].customerEmail, 'client@example.test');
    }
});

test('online checkout requests a five-day Yoco expiry', async (t) => {
    reset();
    const now = Date.parse('2029-12-01T10:00:00Z');
    t.mock.method(Date, 'now', () => now);
    const previous = process.env.YOCO_SECRET_KEY;
    process.env.YOCO_SECRET_KEY = 'test-secret';
    t.after(() => {
        if (previous === undefined) delete process.env.YOCO_SECRET_KEY;
        else process.env.YOCO_SECRET_KEY = previous;
    });
    approvedBooking = { ...monthlyBooking(), purchaseType: 'single', requestedPaymentMethod: 'online', termsAccepted: true };
    let payload;
    t.mock.method(globalThis, 'fetch', async (_url, options) => {
        payload = JSON.parse(options.body);
        return { ok: true, json: async () => ({ id: 'checkout', redirectUrl: 'https://example.test/checkout' }) };
    });
    const body = Buffer.from('--test\r\nContent-Disposition: form-data; name="booking"\r\n\r\n{"approvalToken":"test"}\r\n--test--\r\n');
    const req = Readable.from([body]);
    req.method = 'POST';
    req.headers = { 'content-type': 'multipart/form-data; boundary=test', 'content-length': String(body.length) };
    const res = response();
    await online(req, res);
    assert.equal(res.body.redirectUrl, 'https://example.test/checkout');
    assert.equal(Date.parse(payload.expiresAt), now + 5 * 86400000);
});

test('online monthly receipts include the issued code and retry if email delivery fails', async (t) => {
    const previous = process.env.YOCO_WEBHOOK_SECRET;
    const secret = Buffer.from('webhook-test-secret').toString('base64');
    process.env.YOCO_WEBHOOK_SECRET = secret;
    t.after(() => {
        if (previous === undefined) delete process.env.YOCO_WEBHOOK_SECRET;
        else process.env.YOCO_WEBHOOK_SECRET = previous;
    });
    for (const term of ['1-months', '3-months']) {
        reset();
        booking = { ...monthlyBooking(term), paymentMethod: 'online', status: 'pending' };
        const payload = JSON.stringify({ type: 'payment.succeeded', payload: { type: 'payment', status: 'succeeded', currency: 'ZAR', amount: 42000, metadata: { checkoutId: 'CHECKOUT' } } });
        const timestamp = String(Math.floor(Date.now() / 1000));
        const signature = crypto.createHmac('sha256', Buffer.from(secret, 'base64')).update(`event-${term}.${timestamp}.${payload}`).digest('base64');
        function signedRequest() {
            const req = Readable.from([Buffer.from(payload)]);
            req.method = 'POST';
            req.headers = { 'webhook-id': `event-${term}`, 'webhook-timestamp': timestamp, 'webhook-signature': `v1,${signature}` };
            return req;
        }
        receiptFailure = true;
        const failed = response();
        await webhook(signedRequest(), failed);
        assert.equal(failed.statusCode, 503);
        assert.equal(processed, false);
        receiptFailure = false;
        const retry = response();
        await webhook(signedRequest(), retry);
        assert.equal(retry.statusCode, 200);
        assert.equal(processed, true);
        assert.equal(receipts[1].monthlyCode, 'ATDM-TESTCODE');
        assert.equal(receipts[1].receiptIdempotencyKey, receipts[0].receiptIdempotencyKey);
    }
});
