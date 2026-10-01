import { Redis } from '@upstash/redis';

// Support both legacy KV and standard Upstash Redis environment variable names.
const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

if (!url || !token) {
    console.warn('[redis] KV_REST_API_URL/TOKEN (or UPSTASH_REDIS_REST_URL/TOKEN) not set — storage calls will fail.');
}

export const redis = new Redis({ url, token });
