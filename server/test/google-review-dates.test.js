import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { formatReviewAge, normaliseReviewPublicationDate } from '../api/_lib/review-date.js';

let queue;
mock.module('../api/_lib/store.js', { exports: {
    getGoogleReviewQueue: async () => structuredClone(queue),
    setGoogleReviewQueue: async (value) => { queue = structuredClone(value); },
} });
const [{ default: adminHandler }, { default: publicHandler }] = await Promise.all([
    import('../api/admin/google-reviews.js'),
    import('../api/google-reviews.js'),
]);

function response() {
    return {
        statusCode: 200,
        headers: {},
        setHeader(name, value) { this.headers[name] = value; return this; },
        status(code) { this.statusCode = code; return this; },
        json(body) { this.body = body; return this; },
    };
}

test('review ages use the original publication time when a page loads', (t) => {
    const now = Date.parse('2026-11-13T12:00:00Z');
    assert.equal(formatReviewAge('2026-11-10T12:00:00Z', now), '3 days ago');
    assert.equal(formatReviewAge('2026-11-13T11:00:00Z', now), '1 hour ago');
    assert.equal(formatReviewAge('', now), 'Google review');
    assert.equal(formatReviewAge('2026-11-14T12:00:00Z', now), 'Google review');
    assert.equal(normaliseReviewPublicationDate('not a date'), '');
    assert.equal(normaliseReviewPublicationDate('2026-11-10T14:00:00+02:00'), '2026-11-10T12:00:00.000Z');
});

test('Google sync updates approved publication timestamps without republishing review content', async (t) => {
    const envKeys = ['ADMIN_API_KEY', 'SERPAPI_API_KEY', 'GOOGLE_PLACE_ID'];
    const before = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
    t.after(() => envKeys.forEach((key) => {
        if (before[key] === undefined) delete process.env[key];
        else process.env[key] = before[key];
    }));
    process.env.ADMIN_API_KEY = 'test-admin-key';
    process.env.SERPAPI_API_KEY = 'test-api-key';
    process.env.GOOGLE_PLACE_ID = 'test-place';
    t.mock.method(Date, 'now', () => Date.parse('2026-11-13T12:00:00Z'));
    queue = {
        approved: [
            { id: 'existing', name: 'Customer', quote: 'Approved text', date: 'an hour ago', rating: 5 },
            { id: 'unknown', name: 'Another customer', quote: 'Approved too', date: 'an hour ago', rating: 5 },
        ],
        pending: [],
        dismissedIds: ['dismissed'],
    };
    let includeTimestamp = true;
    t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({
        reviews: [
            { review_id: 'existing', user: { name: 'Customer' }, snippet: 'Changed on Google', rating: 5,
                date: '3 days ago', iso_date: includeTimestamp ? '2026-11-10T12:00:00Z' : undefined,
                iso_date_of_last_edit: '2026-11-13T11:00:00Z' },
            { review_id: 'new', user: { name: 'New customer' }, snippet: 'New review', rating: 5,
                date: '2 days ago', iso_date: '2026-11-11T12:00:00Z' },
            { review_id: 'dismissed', user: { name: 'Dismissed' }, snippet: 'Not approved', rating: 5 },
        ],
        place_info: { rating: 5, reviews: 3 },
    }), { status: 200 }));

    async function sync() {
        const res = response();
        await adminHandler({ method: 'POST', headers: { 'x-admin-key': 'test-admin-key' }, body: { action: 'fetch' } }, res);
        assert.equal(res.statusCode, 200);
    }

    await sync();
    assert.equal(queue.approved[0].publishedAt, '2026-11-10T12:00:00.000Z');
    assert.equal(queue.approved[0].quote, 'Approved text');
    assert.deepEqual(queue.pending.map((review) => review.id), ['new']);
    includeTimestamp = false;
    await sync();
    assert.equal(queue.approved[0].publishedAt, '2026-11-10T12:00:00.000Z');

    const res = response();
    await publicHandler({ method: 'GET', headers: {}, query: {} }, res);
    assert.equal(res.headers['Cache-Control'], 'no-store');
    assert.equal(res.body.reviews[0].date, '3 days ago');
    assert.equal(res.body.reviews[1].date, 'Google review');
    assert.equal(res.body.reviews[0].publishedAt, '2026-11-10T12:00:00.000Z');
});
