import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { Readable } from 'node:stream';
import { hasMinimumBookingNotice } from '../api/_lib/booking-time.js';
import { MIN_LEAD_TIME_MS, slotDateTime } from '../../src/utils/booking-time.js';

const redis = Object.fromEntries(['get', 'set', 'del', 'lrange', 'smembers', 'exists', 'eval'].map((name) => [name, () => {
    throw new Error(`Unexpected Redis call: ${name}`);
}]));
mock.module('../api/_lib/redis.js', { exports: { redis } });
const [{ validateBookingRequest, listBookingRequests, cancelBookedSlotRecords }, { getBookedSlotsInRange, reserveBookingSlot },
    { default: cancelHandler }, { default: webhookHandler }] = await Promise.all([
    import('../api/_lib/booking-approval.js'),
    import('../api/_lib/store.js'),
    import('../handlers/bookings-cancel.js'),
    import('../api/payments/yoco/webhook.js'),
]);

function installRedisStub(t) {
    const values = new Map();
    const sets = new Map();
    const lists = new Map();
    const replace = (name, fn) => t.mock.method(redis, name, fn);
    replace('get', async (key) => values.get(key) ?? null);
    replace('set', async (key, value) => { values.set(key, structuredClone(value)); return 'OK'; });
    replace('del', async (...keys) => { keys.forEach((key) => values.delete(key)); return 1; });
    replace('lrange', async (key) => lists.get(key) || []);
    replace('smembers', async (key) => [...(sets.get(key) || [])]);
    replace('exists', async (key) => values.has(key) ? 1 : 0);
    replace('eval', async (script, keys, args) => {
        if (script.includes("local owner = redis.call('GET', KEYS[1])")) {
            const owner = values.get(keys[0]);
            if (owner && owner !== args[0]) return 0;
            values.set(keys[0], args[0]);
            if (!sets.has(keys[1])) sets.set(keys[1], new Set());
            sets.get(keys[1]).add(args[2]);
            return 1;
        }
        if (script.includes("booking.cancelledAt = ARGV[1]")) {
            const booking = values.get(keys[0]);
            if (!booking) return ['NOT_FOUND'];
            if (booking.status !== 'pending') return [booking.status, JSON.stringify(booking)];
            const cancelled = { ...booking, status: 'cancelled', cancelledAt: args[0] };
            values.set(keys[0], cancelled);
            if (values.get(keys[1]) === args[2]) {
                values.delete(keys[1]);
                sets.get(keys[2])?.delete(args[3]);
            }
            return ['CANCELLED', JSON.stringify(cancelled)];
        }
        if (script.includes("request.status = ARGV[2]")) {
            const request = values.get(keys[0]);
            if (!request) return ['NOT_FOUND'];
            if (request.status !== args[0]) return [request.status];
            const updated = { ...request, status: args[1], updatedAt: args[2] };
            if (args[1] === 'cancelled') updated.hiddenFromAdmin = false;
            values.set(keys[0], updated);
            return ['OK', JSON.stringify(updated)];
        }
        if (script.includes("redis.call('GET', KEYS[1]) ~= ARGV[1]")) {
            if (values.get(keys[0]) !== args[0]) return 0;
            values.delete(keys[0]);
            sets.get(keys[1])?.delete(args[1]);
            return 1;
        }
        if (script.includes("redis.call('EXISTS', KEYS[1]) == 1")) {
            if (values.has(keys[0])) return 0;
            return sets.get(keys[1])?.delete(args[0]) ? 1 : 0;
        }
        throw new Error('Unexpected Redis script');
    });
    return { values, sets, lists };
}

function response() {
    return {
        statusCode: 200,
        setHeader() { return this; },
        status(code) { this.statusCode = code; return this; },
        json(body) { this.body = body; return this; },
        send(body) { this.body = body; return this; },
    };
}

function seedBooking(db, status = 'pending') {
    const booking = { reference: 'REF1', bookingDate: '2026-11-10', bookingTime: '15:30', status };
    db.values.set('booking:checkout1', booking);
    db.values.set('booking-cancel-token:token1', 'checkout1');
    db.values.set('booking:request:req1', {
        id: 'req1', reference: 'REF1', status: 'awaiting_completion', hiddenFromAdmin: true,
        booking: { bookingDate: booking.bookingDate, bookingTime: booking.bookingTime },
    });
    db.lists.set('booking:requests:index', ['req1']);
    return booking;
}

test('one-hour threshold is identical on client and server in South African time', async (t) => {
    const slot = slotDateTime('2026-11-10', '15:30').getTime();
    assert.equal(MIN_LEAD_TIME_MS, 3600000);
    assert.equal(hasMinimumBookingNotice('2026-11-10', '15:30', slot - 3600000), true);
    assert.equal(hasMinimumBookingNotice('2026-11-10', '15:30', slot - 3599999), false);
    assert.equal(hasMinimumBookingNotice('invalid', '15:30', slot), false);
    const booking = {
        purchaseType: 'single', vehicleType: 'Sedan / Hatchback', bookingDate: '2026-11-10', bookingTime: '15:30',
        customer: { firstName: 'Test', surname: 'Customer', mobile: '123', email: 'test@example.com', registration: 'ABC123', address: 'Test address' },
        serviceLocation: { latitude: -33.978, longitude: 18.444 },
        serviceAreaAccepted: true, termsAccepted: true, requestedPaymentMethod: 'online',
    };
    t.mock.method(Date, 'now', () => slot - 3600000);
    await assert.doesNotReject(validateBookingRequest(booking));
    Date.now.mock.mockImplementation(() => slot - 3599999);
    await assert.rejects(validateBookingRequest(booking), /at least 1 hour/);
});

test('cancelled checkout releases the slot and appears in manager records, including on retry', async (t) => {
    const db = installRedisStub(t);
    seedBooking(db);
    assert.equal(await reserveBookingSlot('2026-11-10', '15:30', 'REF1'), true);
    assert.deepEqual(await getBookedSlotsInRange('2026-11-10', '2026-11-10'), { '2026-11-10': ['15:30'] });
    for (let attempt = 0; attempt < 2; attempt += 1) {
        const res = response();
        await cancelHandler({ method: 'POST', headers: {}, body: { cancellationToken: 'token1' } }, res);
        assert.equal(res.statusCode, 200);
        assert.equal(res.body.cancelled, true);
    }
    assert.deepEqual(await getBookedSlotsInRange('2026-11-10', '2026-11-10'), {});
    const requests = await listBookingRequests();
    assert.equal(requests.length, 1);
    assert.equal(requests[0].status, 'cancelled');
    assert.equal(requests[0].publicStatus, 'Expired or Cancelled');
});

test('cancellation never releases a different owner or a paid booking', async (t) => {
    const db = installRedisStub(t);
    seedBooking(db);
    await reserveBookingSlot('2026-11-10', '15:30', 'REF2');
    const res = response();
    await cancelHandler({ method: 'POST', headers: {}, body: { cancellationToken: 'token1' } }, res);
    assert.equal(res.body.cancelled, true);
    assert.equal(db.values.get('booking-slot:2026-11-10:15:30'), 'REF2');
    seedBooking(db, 'paid');
    const paidRes = response();
    await cancelHandler({ method: 'POST', headers: {}, body: { cancellationToken: 'token1' } }, paidRes);
    assert.equal(paidRes.body.cancelled, false);
    assert.equal(db.values.get('booking-slot:2026-11-10:15:30'), 'REF2');
});

test('manager can cancel a pending request and release its slot', async (t) => {
    const db = installRedisStub(t);
    seedBooking(db);
    const request = db.values.get('booking:request:req1');
    request.status = 'pending_approval';
    await reserveBookingSlot('2026-11-10', '15:30', 'REF1');
    await cancelBookedSlotRecords(request);
    assert.equal(db.values.get('booking:request:req1').status, 'cancelled');
    assert.deepEqual(await getBookedSlotsInRange('2026-11-10', '2026-11-10'), {});
});

test('failed payment webhook cancels the pending booking and manager record', async (t) => {
    const db = installRedisStub(t);
    seedBooking(db);
    await reserveBookingSlot('2026-11-10', '15:30', 'REF1');
    const secret = Buffer.from('test-webhook-secret').toString('base64');
    const previousSecret = process.env.YOCO_WEBHOOK_SECRET;
    process.env.YOCO_WEBHOOK_SECRET = `whsec_${secret}`;
    t.after(() => {
        if (previousSecret === undefined) delete process.env.YOCO_WEBHOOK_SECRET;
        else process.env.YOCO_WEBHOOK_SECRET = previousSecret;
    });
    const body = JSON.stringify({ type: 'payment.failed', payload: { metadata: { checkoutId: 'checkout1' } } });
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = crypto.createHmac('sha256', Buffer.from(secret, 'base64')).update(`event1.${timestamp}.${body}`).digest('base64');
    const req = Readable.from([Buffer.from(body)]);
    req.method = 'POST';
    req.headers = { 'webhook-id': 'event1', 'webhook-timestamp': timestamp, 'webhook-signature': `v1,${signature}` };
    const res = response();
    await webhookHandler(req, res);
    assert.equal(res.statusCode, 200);
    assert.equal(db.values.get('booking:checkout1').status, 'cancelled');
    assert.equal(db.values.get('booking:request:req1').status, 'cancelled');
    assert.deepEqual(await getBookedSlotsInRange('2026-11-10', '2026-11-10'), {});
});

test('failed webhook can match the slot owner when checkout ID is absent', async (t) => {
    const db = installRedisStub(t);
    seedBooking(db);
    db.values.get('booking:request:req1').checkoutId = 'checkout1';
    await reserveBookingSlot('2026-11-10', '15:30', 'REF1');
    const previousSecret = process.env.YOCO_WEBHOOK_SECRET;
    const secret = Buffer.from('test-webhook-secret').toString('base64');
    process.env.YOCO_WEBHOOK_SECRET = `whsec_${secret}`;
    t.after(() => {
        if (previousSecret === undefined) delete process.env.YOCO_WEBHOOK_SECRET;
        else process.env.YOCO_WEBHOOK_SECRET = previousSecret;
    });
    const body = JSON.stringify({ type: 'payment.failed', payload: { metadata: {
        reference: 'REF1', bookingDate: '2026-11-10', bookingTime: '15:30',
    } } });
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = crypto.createHmac('sha256', Buffer.from(secret, 'base64')).update(`event2.${timestamp}.${body}`).digest('base64');
    const req = Readable.from([Buffer.from(body)]);
    req.method = 'POST';
    req.headers = { 'webhook-id': 'event2', 'webhook-timestamp': timestamp, 'webhook-signature': `v1,${signature}` };
    const res = response();
    await webhookHandler(req, res);
    assert.equal(res.statusCode, 200);
    assert.equal(db.values.get('booking:checkout1').status, 'cancelled');
    assert.equal(db.values.get('booking:request:req1').status, 'cancelled');
    assert.deepEqual(await getBookedSlotsInRange('2026-11-10', '2026-11-10'), {});
});
