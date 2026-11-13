import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { Readable } from 'node:stream';
import { hasMinimumBookingNotice } from '../api/_lib/booking-time.js';
import {
    buildCustomerBookingConfirmationSmsText,
    buildCustomerBookingRequestSmsText,
    buildBookingRequestSmsText,
    buildBusinessBookingSmsText,
    isSmsConfigured,
    sendCustomerBookingConfirmationSms,
    sendCustomerBookingRequestSms,
} from '../api/_lib/sms.js';
import { MIN_LEAD_TIME_MS, slotDateTime } from '../../src/utils/booking-time.js';
import {
    getBookingTimesForDate,
    isBookableBookingTime,
} from '../../shared/booking-schedule.js';

const redis = Object.fromEntries(['get', 'mget', 'set', 'del', 'lrange', 'smembers', 'exists', 'eval'].map((name) => [name, () => {
    throw new Error(`Unexpected Redis call: ${name}`);
}]));
mock.module('../api/_lib/redis.js', { exports: { redis } });
const [{ validateBookingRequest, listBookingRequests, cancelBookedSlotRecords }, { getBookedSlotsInRange, reserveBookingSlot, getMonthlyPackagePriceCents, getMonthlyPackageTotalCents },
    { default: cancelHandler }, { default: webhookHandler }, { default: calendarHandler }, { default: availabilityHandler }] = await Promise.all([
    import('../api/_lib/booking-approval.js'),
    import('../api/_lib/store.js'),
    import('../handlers/bookings-cancel.js'),
    import('../api/payments/yoco/webhook.js'),
    import('../api/admin/calendar.js'),
    import('../handlers/bookings-availability.js'),
]);

function installRedisStub(t) {
    const values = new Map();
    const sets = new Map();
    const lists = new Map();
    const replace = (name, fn) => t.mock.method(redis, name, fn);
    replace('get', async (key) => values.get(key) ?? null);
    replace('mget', async (...keys) => keys.map((key) => values.get(key) ?? null));
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
        headers: {},
        setHeader(name, value) { this.headers[name] = value; return this; },
        status(code) { this.statusCode = code; return this; },
        json(body) { this.body = body; return this; },
        send(body) { this.body = body; return this; },
    };
}

test('calendar emails follow the current slot owner and stay out of public availability', async (t) => {
    const db = installRedisStub(t);
    const previousKey = process.env.CALENDAR_API_KEY;
    process.env.CALENDAR_API_KEY = 'calendar-test-key';
    t.after(() => {
        if (previousKey === undefined) delete process.env.CALENDAR_API_KEY;
        else process.env.CALENDAR_API_KEY = previousKey;
    });
    const date = '2026-11-20';
    db.sets.set(`booking-index:${date}`, new Set(['09:00', '10:00', '11:00', '12:00']));
    db.values.set(`booking-slot:${date}:09:00`, 'REF1');
    db.values.set(`booking-slot:${date}:10:00`, 'REF2');
    db.values.set(`booking-slot:${date}:11:00`, 'REF3');
    db.values.set(`booking-slot:${date}:12:00`, 'REF4');
    db.lists.set('booking:requests:index', ['old', 'hidden', 'wrong-date']);
    db.values.set('booking:request:old', {
        reference: 'OLD', booking: { bookingDate: date, bookingTime: '09:00', customer: { email: 'old@example.com' } },
    });
    db.values.set('booking:request:hidden', {
        reference: 'REF1', hiddenFromAdmin: true,
        booking: { bookingDate: date, bookingTime: '09:00', customer: { email: 'customer@example.com' } },
    });
    db.values.set('booking:request:wrong-date', {
        reference: 'REF3', booking: { bookingDate: '2026-11-21', bookingTime: '11:00', customer: { email: 'wrong@example.com' } },
    });
    db.values.set('booking:REF2', {
        reference: 'REF2', bookingDate: date, bookingTime: '10:00', customer: { email: 'onsite@example.com' },
    });
    db.values.set('booking:REF4', {
        reference: 'REF4', bookingDate: '2026-11-21', bookingTime: '12:00', customer: { email: 'wrong-fallback@example.com' },
    });
    const query = { from: date, to: date };

    const denied = response();
    await calendarHandler({ method: 'GET', headers: { 'x-calendar-key': 'wrong-key' }, query }, denied);
    assert.equal(denied.statusCode, 401);
    assert.equal(denied.body.bookedSlotEmails, undefined);

    const calendar = response();
    await calendarHandler({ method: 'GET', headers: { 'x-calendar-key': 'calendar-test-key' }, query }, calendar);
    assert.equal(calendar.statusCode, 200);
    assert.equal(calendar.headers['Cache-Control'], 'no-store');
    assert.deepEqual(calendar.body.bookedSlotEmails, {
        [date]: { '09:00': 'customer@example.com', '10:00': 'onsite@example.com' },
    });

    const saved = response();
    await calendarHandler({ method: 'PUT', headers: { 'x-calendar-key': 'calendar-test-key' }, query, body: { blocks: {} } }, saved);
    assert.deepEqual(saved.body.bookedSlotEmails, calendar.body.bookedSlotEmails);

    const publicResponse = response();
    await availabilityHandler({ method: 'GET', headers: {}, query }, publicResponse);
    assert.deepEqual(publicResponse.body.bookedSlots[date], ['09:00', '10:00', '11:00', '12:00']);
    assert.equal(JSON.stringify(publicResponse.body).includes('@example.com'), false);
});

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
    const slot = slotDateTime('2026-11-10', '14:30').getTime();
    assert.equal(MIN_LEAD_TIME_MS, 3600000);
    assert.equal(hasMinimumBookingNotice('2026-11-10', '14:30', slot - 3600000), true);
    assert.equal(hasMinimumBookingNotice('2026-11-10', '14:30', slot - 3599999), false);
    assert.equal(hasMinimumBookingNotice('invalid', '14:30', slot), false);
    const booking = {
        purchaseType: 'single', vehicleType: 'Sedan / Hatchback', bookingDate: '2026-11-10', bookingTime: '14:30',
        customer: { firstName: 'Test', surname: 'Customer', mobile: '123', email: 'test@example.com', registration: 'ABC123', address: 'Test address' },
        serviceLocation: { latitude: -33.978, longitude: 18.444 },
        serviceAreaAccepted: true, termsAccepted: true, requestedPaymentMethod: 'online',
    };
    t.mock.method(Date, 'now', () => slot - 3600000);
    await assert.doesNotReject(validateBookingRequest(booking));
    Date.now.mock.mockImplementation(() => slot - 3599999);
    await assert.rejects(validateBookingRequest(booking), /at least 1 hour/);
});

test('business package uses the selected fleet tier and requires that tier', async (t) => {
    assert.equal(getMonthlyPackagePriceCents('business-standard', 'Sedan / Hatchback', '3-5', 5), 25000);
    assert.equal(getMonthlyPackagePriceCents('business-standard', 'Sedan / Hatchback', '6-8', 6), 22000);
    assert.equal(getMonthlyPackagePriceCents('business-standard', 'SUV / Bakkie', '6-8', 8), 32000);
    assert.equal(getMonthlyPackagePriceCents('business-standard', 'Minibus / Van', '9+', 9), 39000);
    assert.equal(getMonthlyPackagePriceCents('business-standard', 'Sedan / Hatchback', '9+', 25), 19000);
    assert.equal(getMonthlyPackagePriceCents('business-standard', 'Sedan / Hatchback', '3-5', 7), undefined);
    assert.equal(getMonthlyPackageTotalCents('business-standard', 'Sedan / Hatchback', '6-8', 7), 154000);
    assert.equal(getMonthlyPackagePriceCents('private-standard', 'Sedan / Hatchback'), 42000);

    const slot = slotDateTime('2026-11-10', '14:30').getTime();
    t.mock.method(Date, 'now', () => slot - 3600000);
    const booking = {
        purchaseType: 'monthly', packageId: 'business-standard', vehicleType: 'Sedan / Hatchback',
        fleetSizeTier: '6-8', fleetVehicleCount: 7,
        bookingDate: '2026-11-10', bookingTime: '14:30', contractAccepted: true, contractFileBase64: 'ZmlsZQ==',
        customer: { firstName: 'Test', surname: 'Customer', mobile: '123', email: 'test@example.com', registration: 'ABC123', address: 'Test address' },
        serviceLocation: { latitude: -33.978, longitude: 18.444 },
        serviceAreaAccepted: true, termsAccepted: true, requestedPaymentMethod: 'online',
    };
    await assert.doesNotReject(validateBookingRequest(booking));
    await assert.rejects(validateBookingRequest({ ...booking, fleetSizeTier: '3-5' }), /valid monthly package and vehicle category/);
    await assert.rejects(validateBookingRequest({ ...booking, fleetVehicleCount: 9 }), /valid monthly package and vehicle category/);
});

test('weekday and Saturday booking slots are accepted, while Sunday and mismatched times are rejected', async (t) => {
    assert.deepEqual(getBookingTimesForDate('2026-11-10'), ['09:30', '12:00', '14:30', '16:00', '18:30']);
    assert.deepEqual(getBookingTimesForDate('2026-11-14'), ['09:00', '11:30', '13:30']);
    assert.deepEqual(getBookingTimesForDate('2026-11-15'), []);
    assert.equal(isBookableBookingTime('2026-11-14', '09:00'), true);
    assert.equal(isBookableBookingTime('2026-11-14', '09:30'), false);

    const saturdaySlot = slotDateTime('2026-11-14', '09:00').getTime();
    t.mock.method(Date, 'now', () => saturdaySlot - 3600000);
    const booking = {
        purchaseType: 'single',
        vehicleType: 'Sedan / Hatchback',
        bookingDate: '2026-11-14',
        bookingTime: '09:00',
        customer: { firstName: 'Test', surname: 'Customer', mobile: '123', email: 'test@example.com', registration: 'ABC123', address: 'Test address' },
        serviceLocation: { latitude: -33.978, longitude: 18.444 },
        serviceAreaAccepted: true,
        termsAccepted: true,
        requestedPaymentMethod: 'online',
    };

    await assert.doesNotReject(validateBookingRequest(booking));
    await assert.rejects(validateBookingRequest({ ...booking, bookingTime: '09:30' }), /valid booking date and time/);
    await assert.rejects(validateBookingRequest({ ...booking, bookingDate: '2026-11-15' }), /valid booking date and time/);
});

test('booking requests accept manual and distant addresses without coverage confirmation', async (t) => {
    const slot = slotDateTime('2026-11-10', '14:30').getTime();
    t.mock.method(Date, 'now', () => slot - 3600000);
    const booking = {
        purchaseType: 'single', vehicleType: 'Sedan / Hatchback', bookingDate: '2026-11-10', bookingTime: '14:30',
        customer: { firstName: 'Test', surname: 'Customer', mobile: '123', email: 'test@example.com', registration: 'ABC123', address: 'A manually entered address' },
        termsAccepted: true, requestedPaymentMethod: 'online',
    };
    await assert.doesNotReject(validateBookingRequest(booking));
    await assert.doesNotReject(validateBookingRequest({ ...booking, serviceLocation: { latitude: -26.2, longitude: 28.0 } }));
    await assert.rejects(validateBookingRequest({ ...booking, customer: { ...booking.customer, address: '   ' } }), /service address/);
    await assert.rejects(validateBookingRequest({ ...booking, termsAccepted: false }), /booking terms/);
});

test('customer booking SMS targets the supplied mobile and includes request tracking details', async (t) => {
    const envKeys = ['SMSMESSENGER_EMAIL', 'SMSMESSENGER_API_KEY'];
    const previousEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
    t.after(() => envKeys.forEach((key) => {
        if (previousEnv[key] === undefined) delete process.env[key];
        else process.env[key] = previousEnv[key];
    }));
    process.env.SMSMESSENGER_EMAIL = 'sms-test@example.com';
    process.env.SMSMESSENGER_API_KEY = 'test-token';

    const calls = [];
    t.mock.method(globalThis, 'fetch', async (url, options) => {
        calls.push({ url, options });
        return new Response(JSON.stringify({ messageId: 'test-message' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    });

    const request = {
        reference: 'REQ123',
        booking: {
            bookingDate: '2026-11-20',
            bookingTime: '10:30',
            customer: { firstName: 'Test', mobile: '082 123 4567' },
        },
    };
    const statusUrl = 'https://example.com/booking-request?token=private-test-token';
    assert.equal(isSmsConfigured(), true);
    assert.match(buildCustomerBookingRequestSmsText(request, statusUrl), /REQ123/);
    assert.match(buildCustomerBookingRequestSmsText(request, statusUrl), new RegExp(statusUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    const result = await sendCustomerBookingRequestSms(request, statusUrl);

    assert.equal(result.sent, true);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].options.headers.email, 'sms-test@example.com');
    assert.equal(JSON.parse(calls[0].options.body).recipientNumber, '27821234567');
    assert.match(JSON.parse(calls[0].options.body).message, /Your request is pending review/);

    const receipt = {
        customerMobile: '+27 82 123 4567',
        customerName: 'Test Customer',
        reference: 'CONF456',
        bookingDate: '2026-11-20',
        bookingTime: '10:30',
        registration: 'ABC123',
        amountZar: 'R220,00',
    };
    assert.match(buildCustomerBookingConfirmationSmsText(receipt), /Your booking is confirmed/);
    assert.equal((await sendCustomerBookingConfirmationSms(receipt)).sent, true);
    assert.equal(calls.length, 2);
    assert.equal(JSON.parse(calls[1].options.body).recipientNumber, '27821234567');
    assert.match(JSON.parse(calls[1].options.body).message, /CONF456/);
});

test('business booking SMS includes requested details in one GSM-safe segment', () => {
    const request = {
        booking: {
            packageName: 'Business / Fleet / Family - Standard Package',
            customer: {
                firstName: 'Jane',
                surname: 'Doe',
                email: 'jane.doe@example.com',
                address: '12 Main Road, Cape Town',
            },
        },
    };
    const requestText = buildBookingRequestSmsText(request);
    const confirmationText = buildBusinessBookingSmsText({
        name: 'Jane Doe',
        email: 'jane.doe@example.com',
        address: '12 Main Road, Cape Town',
        packageName: 'Business / Fleet / Family - Standard Package',
    });

    for (const message of [requestText, confirmationText]) {
        assert.ok(message.length <= 160);
        assert.match(message, /N:Jane Doe/);
        assert.match(message, /E:jane\.doe@example\.com/);
        assert.match(message, /A:12 Main Road, Cape Town/);
        assert.match(message, /P:Business \/ Fleet \/ Family - Standard Package/);
        assert.doesNotMatch(message, /[^\x20-\x7E]/);
    }

    const longAddress = buildBusinessBookingSmsText({
        name: 'Jane Doe',
        email: 'jane.doe@example.com',
        address: '123 Very Long Street Name, A Large Suburb, Cape Town, Western Cape, South Africa',
        packageName: 'Business / Fleet / Family - Standard Package',
    });
    assert.ok(longAddress.length <= 160);
    assert.match(longAddress, /P:Business \/ Fleet \/ Family - Standard Package$/);
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
