import { applyCors } from '../_lib/cors.js';
import { getCachedGoogleReviews, setCachedGoogleReviews } from '../_lib/store.js';

const SERPAPI_ENDPOINT = 'https://serpapi.com/search';

function mapReview(review) {
    return {
        id: review.review_id || `${review.user?.name || 'google'}-${review.position}`,
        name: review.user?.name || 'Google customer',
        rating: Math.round(Number(review.rating) || 5),
        quote: review.snippet || review.extracted_snippet?.original || '',
        date: review.date || '',
        photo: review.user?.thumbnail || '',
    };
}

// GET /api/google-reviews?limit=12
// Fetches and caches real Google reviews via SerpApi's Google Maps Reviews API.
export default async function handler(req, res) {
    if (applyCors(req, res)) return;
    if (req.method !== 'GET') {
        res.status(405).json({ message: 'Method not allowed.' });
        return;
    }

    const limit = Math.min(Number(req.query?.limit) || 12, 20);

    const cached = await getCachedGoogleReviews();
    if (cached) {
        res.status(200).json({ ...cached, reviews: cached.reviews.slice(0, limit) });
        return;
    }

    const apiKey = process.env.SERPAPI_API_KEY;
    const placeId = process.env.GOOGLE_PLACE_ID;
    if (!apiKey || !placeId) {
        res.status(503).json({ message: 'Google reviews are not configured yet.' });
        return;
    }

    try {
        const endpoint = new URL(SERPAPI_ENDPOINT);
        endpoint.searchParams.set('engine', 'google_maps_reviews');
        endpoint.searchParams.set('place_id', placeId);
        endpoint.searchParams.set('sort_by', 'newestFirst');
        endpoint.searchParams.set('api_key', apiKey);

        const response = await fetch(endpoint);
        const body = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(body?.error || 'SerpApi request failed.');
        }

        const reviews = (body.reviews || []).map(mapReview).filter((review) => review.quote.trim());
        const averageRating = Number(body.place_info?.rating) || 5;
        const totalReviewCount = Number(body.place_info?.reviews) || reviews.length;

        const payload = { reviews, averageRating, totalReviewCount };
        await setCachedGoogleReviews(payload);

        res.status(200).json({ ...payload, reviews: payload.reviews.slice(0, limit) });
    } catch (err) {
        console.error('[google-reviews] fetch failed', err);
        res.status(502).json({ message: 'Could not load Google reviews.' });
    }
}
