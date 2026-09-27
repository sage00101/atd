// Shared CORS handling for all API routes. Only the configured GitHub Pages
// origin (or localhost during development) may call this API.
const DEFAULT_ALLOWED_ORIGINS = [
    'https://sage00101.github.io',
    'http://localhost:5173',
];

function getAllowedOrigins() {
    const configured = (process.env.ALLOWED_ORIGIN || '')
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean);
    return configured.length ? configured : DEFAULT_ALLOWED_ORIGINS;
}

/** Returns true if the request was a handled OPTIONS preflight (caller should stop). */
export function applyCors(req, res) {
    const allowedOrigins = getAllowedOrigins();
    const origin = req.headers.origin;
    if (origin && allowedOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.status(204).end();
        return true;
    }
    return false;
}
