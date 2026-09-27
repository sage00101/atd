import { Redis } from '@upstash/redis';

// Vercel's Upstash Marketplace integration injects either of these pairs
// depending on when the integration was connected — support both.
const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

if (!url || !token) {
    console.warn('[redis] KV_REST_API_URL/TOKEN (or UPSTASH_REDIS_REST_URL/TOKEN) not set — storage calls will fail.');
}

export const redis = new Redis({ url, token });
