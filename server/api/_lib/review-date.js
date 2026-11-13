export function normaliseReviewPublicationDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(value)) return '';
    const timestamp = Date.parse(value);
    return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : '';
}

export function formatReviewAge(publishedAt, now = Date.now()) {
    const timestamp = Date.parse(publishedAt);
    if (!Number.isFinite(timestamp) || timestamp > now) return 'Google review';

    const seconds = Math.floor((now - timestamp) / 1000);
    if (seconds < 60) return 'just now';
    const units = [
        ['year', 365 * 86400],
        ['month', 30 * 86400],
        ['week', 7 * 86400],
        ['day', 86400],
        ['hour', 3600],
        ['minute', 60],
    ];
    const [unit, size] = units.find(([, duration]) => seconds >= duration);
    return new Intl.RelativeTimeFormat('en', { numeric: 'always' }).format(-Math.floor(seconds / size), unit);
}
