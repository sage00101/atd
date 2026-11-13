import { applyCors } from './_lib/cors.js';
import { getGoogleReviewQueue } from './_lib/store.js';
import { formatReviewAge } from './_lib/review-date.js';

// GET /api/google-reviews?limit=12
// Serves only reviews explicitly approved in the business manager.
export default async function handler(req, res) {
    if (applyCors(req, res)) return;
    if (req.method !== 'GET') {
        res.status(405).json({ message: 'Method not allowed.' });
        return;
    }

    const limit = Math.min(Number(req.query?.limit) || 12, 20);
    try {
        const queue = await getGoogleReviewQueue();
        const reviews = Array.isArray(queue?.approved) ? queue.approved : [];
        const averageRating = Number(queue?.averageRating)
            || (reviews.length ? reviews.reduce((sum, review) => sum + Number(review.rating || 0), 0) / reviews.length : 0);
        res.setHeader('Cache-Control', 'no-store');
        res.status(200).json({
            reviews: reviews.slice(0, limit).map((review) => ({
                ...review,
                date: formatReviewAge(review.publishedAt),
            })),
            averageRating,
            totalReviewCount: Number(queue?.totalReviewCount) || reviews.length,
        });
    } catch (err) {
        console.error('[google-reviews] approved reviews failed to load', err);
        res.status(502).json({ message: 'Could not load Google reviews.' });
    }
}
