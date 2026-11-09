import crypto from 'node:crypto';
import '../_lib/load-env.js';
import { applyCors } from '../_lib/cors.js';
import { getGoogleReviewQueue, setGoogleReviewQueue } from '../_lib/store.js';

const SERPAPI_ENDPOINT = 'https://serpapi.com/search';
const DEFAULT_QUEUE = {
    pending: [],
    approved: [],
    dismissedIds: [],
    averageRating: 0,
    totalReviewCount: 0,
    fetchedAt: null,
};

function safeEqual(left, right) {
    const leftDigest = crypto.createHash('sha256').update(String(left)).digest();
    const rightDigest = crypto.createHash('sha256').update(String(right)).digest();
    return crypto.timingSafeEqual(leftDigest, rightDigest);
}

function hasAdminKey(suppliedKey) {
    const expectedKeys = [process.env.ADMIN_API_KEY, process.env.CALENDAR_API_KEY].filter(Boolean);
    return Boolean(suppliedKey && expectedKeys.some((expectedKey) => safeEqual(suppliedKey, expectedKey)));
}

function normaliseQueue(queue) {
    if (!queue || typeof queue !== 'object') return { ...DEFAULT_QUEUE };
    return {
        ...DEFAULT_QUEUE,
        ...queue,
        pending: Array.isArray(queue.pending) ? queue.pending : [],
        approved: Array.isArray(queue.approved) ? queue.approved : [],
        dismissedIds: Array.isArray(queue.dismissedIds) ? queue.dismissedIds : [],
    };
}

function safeImageUrl(value) {
    try {
        const url = new URL(String(value || ''));
        return url.protocol === 'https:' ? url.href : '';
    } catch {
        return '';
    }
}

function mapReview(review) {
    const name = String(review.user?.name || 'Google customer').slice(0, 120);
    const quote = String(review.snippet || review.extracted_snippet?.original || '').slice(0, 5000);
    const date = String(review.date || '').slice(0, 120);
    const id = String(review.review_id || crypto.createHash('sha256').update(`${name}|${date}|${quote}`).digest('hex')).slice(0, 200);
    const images = (Array.isArray(review.images) ? review.images : [])
        .map((image) => safeImageUrl(typeof image === 'string' ? image : image.image || image.thumbnail || image.url))
        .filter(Boolean)
        .slice(0, 5);

    return {
        id,
        name,
        rating: Math.max(1, Math.min(5, Math.round(Number(review.rating) || 5))),
        quote,
        date,
        photo: safeImageUrl(review.user?.thumbnail),
        images,
    };
}

async function fetchGoogleReviews() {
    const apiKey = process.env.SERPAPI_API_KEY;
    const placeId = process.env.GOOGLE_PLACE_ID;
    if (!apiKey || !placeId) {
        const error = new Error('Google reviews are not configured on the server.');
        error.statusCode = 503;
        throw error;
    }

    const endpoint = new URL(SERPAPI_ENDPOINT);
    endpoint.searchParams.set('engine', 'google_maps_reviews');
    endpoint.searchParams.set('place_id', placeId);
    endpoint.searchParams.set('sort_by', 'newestFirst');
    endpoint.searchParams.set('api_key', apiKey);

    const response = await fetch(endpoint);
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body?.error || 'Google reviews could not be fetched.');

    return {
        reviews: (body.reviews || []).map(mapReview).filter((review) => review.quote.trim()),
        averageRating: Number(body.place_info?.rating) || 0,
        totalReviewCount: Number(body.place_info?.reviews) || (body.reviews || []).length,
    };
}

export default async function handler(req, res) {
    if (applyCors(req, res)) return;
    if (!['GET', 'POST'].includes(req.method)) {
        res.status(405).json({ message: 'Method not allowed.' });
        return;
    }
    if (!hasAdminKey(req.headers['x-admin-key'])) {
        res.status(401).json({ message: 'Admin key is missing or invalid.' });
        return;
    }

    try {
        const queue = normaliseQueue(await getGoogleReviewQueue());
        if (req.method === 'GET') {
            res.status(200).json(queue);
            return;
        }

        const action = String(req.body?.action || '');
        if (action === 'fetch') {
            const result = await fetchGoogleReviews();
            const approvedIds = new Set(queue.approved.map((review) => review.id));
            const dismissedIds = new Set(queue.dismissedIds);
            const currentPending = new Map(queue.pending.map((review) => [review.id, review]));
            const refreshedPending = result.reviews
                .filter((review) => !approvedIds.has(review.id) && !dismissedIds.has(review.id))
                .map((review) => ({ ...currentPending.get(review.id), ...review }));
            const refreshedIds = new Set(refreshedPending.map((review) => review.id));
            queue.pending = [
                ...refreshedPending,
                ...queue.pending.filter((review) => !refreshedIds.has(review.id)
                    && !approvedIds.has(review.id) && !dismissedIds.has(review.id)),
            ];
            queue.averageRating = result.averageRating;
            queue.totalReviewCount = result.totalReviewCount;
            queue.fetchedAt = new Date().toISOString();
        } else if (action === 'approve' || action === 'dismiss') {
            const reviewId = String(req.body?.reviewId || '');
            const review = queue.pending.find((item) => item.id === reviewId);
            if (!review) {
                res.status(404).json({ message: 'That review is no longer pending.' });
                return;
            }
            queue.pending = queue.pending.filter((item) => item.id !== reviewId);
            if (action === 'approve') {
                queue.approved = [review, ...queue.approved.filter((item) => item.id !== reviewId)];
            } else {
                queue.dismissedIds = [...new Set([...queue.dismissedIds, reviewId])];
            }
        } else {
            res.status(400).json({ message: 'Unknown review action.' });
            return;
        }

        await setGoogleReviewQueue(queue);
        res.status(200).json(queue);
    } catch (error) {
        console.error('[admin/google-reviews] request failed', error);
        res.status(error.statusCode || 502).json({ message: error.message || 'Could not manage Google reviews.' });
    }
}