// In-memory data for the sandbox/demo backend. Serverless functions are not
// guaranteed to reuse the same process between invocations, so this state can
// reset unexpectedly. Replace with a real database (Postgres, Vercel KV, etc.)
// before relying on this in production.

/** @type {Map<string, { code: string, vehicleRegistration: string, email: string, usedAt: string|null, createdAt: string }>} */
export const promoCodes = globalThis.__atdPromoCodes || (globalThis.__atdPromoCodes = new Map());

/** @type {Map<string, object>} keyed by Yoco checkout id */
export const pendingBookings = globalThis.__atdPendingBookings || (globalThis.__atdPendingBookings = new Map());

/** @type {Set<string>} webhook-id values already processed, to ignore Yoco retries */
export const processedWebhookIds = globalThis.__atdProcessedWebhookIds || (globalThis.__atdProcessedWebhookIds = new Set());

export const SINGLE_WASH_CENTS = {
    'Sedan / Hatchback': 65000,
    'SUV / Bakkie': 85000,
    'Minibus / Van': 110000,
};

export const PROMO_DISCOUNT_RATE = 0.1; // 10%

export function normaliseReg(value) {
    return String(value || '').trim().toUpperCase().replace(/[\s-]/g, '');
}

export function looksLikeVehicleRegistration(value) {
    const cleaned = normaliseReg(value);
    if (cleaned.length < 5 || cleaned.length > 12) return false;
    if (!/^[A-Z0-9]+$/.test(cleaned)) return false;
    if (!/[A-Z]/.test(cleaned) || !/[0-9]/.test(cleaned)) return false;
    return true;
}

/** Generate a human-friendly one-time code: A10-XXXXXXXX */
export function generatePromoCode() {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let body = '';
    for (let i = 0; i < 8; i += 1) {
        body += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    return `A10-${body}`;
}

/** Call after approving a vehicle promo registration (admin action, not exposed as an API route yet). */
export function issuePromoForRegistration({ vehicleRegistration, email }) {
    if (!looksLikeVehicleRegistration(vehicleRegistration)) {
        throw new Error('Invalid registration format');
    }
    const code = generatePromoCode();
    const record = {
        code,
        vehicleRegistration: normaliseReg(vehicleRegistration),
        email: String(email || '').trim().toLowerCase(),
        usedAt: null,
        createdAt: new Date().toISOString(),
    };
    promoCodes.set(code, record);
    return record;
}
