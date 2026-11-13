import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/admin/promo-codes.js';

function response() {
    return {
        statusCode: 200,
        setHeader() { return this; },
        status(code) { this.statusCode = code; return this; },
        json(body) { this.body = body; return this; },
    };
}

test('manager test SMS validates input and reports provider acceptance', async (t) => {
    const keys = ['ADMIN_API_KEY', 'CALENDAR_API_KEY', 'SMSMESSENGER_EMAIL', 'SMSMESSENGER_API_KEY', 'BUSINESS_SMS'];
    const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
    t.after(() => keys.forEach((key) => {
        if (previous[key] === undefined) delete process.env[key];
        else process.env[key] = previous[key];
    }));
    process.env.ADMIN_API_KEY = 'admin-test-key';
    process.env.SMSMESSENGER_EMAIL = 'sms-test@example.com';
    process.env.SMSMESSENGER_API_KEY = 'test-token';
    process.env.BUSINESS_SMS = '+27821234567';

    const body = {
        action: 'test-sms', firstName: 'Jane', surname: 'Doe', email: 'jane@example.com',
        address: '1 Main Road', message: 'Testing SMS',
    };
    const requests = [];
    let providerBody = JSON.stringify({ messageId: 'message-123', error: null });
    t.mock.method(globalThis, 'fetch', async (url, options) => {
        requests.push({ url, options });
        return new Response(providerBody, { status: 200 });
    });
    async function send(data, key = 'admin-test-key') {
        const res = response();
        await handler({ method: 'POST', headers: { 'x-admin-key': key }, body: data }, res);
        return res;
    }

    assert.equal((await send(body, 'wrong-key')).statusCode, 401);
    assert.equal((await send({ ...body, address: '  ' })).statusCode, 400);
    assert.equal((await send({ ...body, email: 'invalid' })).statusCode, 400);
    assert.equal((await send({ ...body, message: 'x'.repeat(612) })).statusCode, 400);
    assert.equal(requests.length, 0);

    const success = await send(body);
    assert.equal(success.statusCode, 200);
    assert.deepEqual(success.body, { sent: true, to: '27821234567' });
    assert.match(requests[0].url, /\/sms\/send\.json$/);
    const payload = JSON.parse(requests[0].options.body);
    assert.equal(payload.recipientNumber, '27821234567');
    for (const value of ['A10tion TEST', 'Jane Doe', body.email, body.address, body.message]) {
        assert.ok(payload.message.includes(value));
    }

    providerBody = JSON.stringify({ error: 'Insufficient credit' });
    const rejected = await send(body);
    assert.notEqual(rejected.statusCode, 200);
    assert.match(rejected.body.message, /Insufficient credit/);
    providerBody = '{}';
    const unconfirmed = await send(body);
    assert.notEqual(unconfirmed.statusCode, 200);
    assert.match(unconfirmed.body.message, /did not confirm acceptance/);
});
