// Persistent storage backed by Upstash Redis (Vercel Marketplace). Replaces
// the earlier in-memory Maps, which reset unpredictably between serverless
// invocations. All functions here are async.
import { redis } from './redis.js';

const PENDING_BOOKING_TTL_SECONDS = 60 * 60 * 24 * 3; // 3 days — abandoned checkouts expire
const CONFIRMED_BOOKING_TTL_SECONDS = 60 * 60 * 24 * 365; // 1 year — keep the slot blocked long-term
const DATE_INDEX_TTL_SECONDS = 60 * 60 * 24 * 90; // 90 days — bookings are never made further out than this
const WEBHOOK_DEDUPE_TTL_SECONDS = 60 * 60 * 24 * 3; // 3 days — longer than Yoco's retry window

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

// ---------------------------------------------------------------------------
// Promo codes + vehicle lifetime history
// ---------------------------------------------------------------------------

const promoCodeKey = (code) => `promo:code:${code}`;
const vehicleHistoryKey = (reg) => `promo:vehicle:${reg}`;

export async function getPromoCode(code) {
    return redis.get(promoCodeKey(code));
}

/** True if this vehicle registration has ever been issued a promo code (used or not). */
export async function hasVehicleAlreadyRegistered(vehicleRegistration) {
    const reg = normaliseReg(vehicleRegistration);
    const history = await redis.get(vehicleHistoryKey(reg));
    return Boolean(history);
}

/** Call after approving a vehicle promo registration (admin action via /api/promos/issue). */
export async function issuePromoForRegistration({ vehicleRegistration, email }) {
    if (!looksLikeVehicleRegistration(vehicleRegistration)) {
        throw new Error('Invalid registration format');
    }
    const reg = normaliseReg(vehicleRegistration);

    const code = generatePromoCode();
    const record = {
        code,
        vehicleRegistration: reg,
        email: String(email || '').trim().toLowerCase(),
        usedAt: null,
        createdAt: new Date().toISOString(),
    };

    // Atomic "claim" — only succeeds if no history exists yet for this vehicle,
    // preventing a race between two simultaneous issue calls for the same reg.
    const claimed = await redis.set(vehicleHistoryKey(reg), { code, issuedAt: record.createdAt, usedAt: null }, { nx: true });
    if (!claimed) {
        throw new Error('This vehicle registration has already been issued a promo code and cannot be registered again.');
    }

    await redis.set(promoCodeKey(code), record);
    return record;
}

/** Marks a promo code (and its vehicle) as redeemed, so neither can be used again. */
export async function markPromoCodeUsed(code) {
    const record = await redis.get(promoCodeKey(code));
    if (!record || record.usedAt) return record;

    record.usedAt = new Date().toISOString();
    await redis.set(promoCodeKey(code), record);

    const historyKey = vehicleHistoryKey(record.vehicleRegistration);
    const history = await redis.get(historyKey);
    if (history) {
        history.usedAt = record.usedAt;
        await redis.set(historyKey, history);
    }
    return record;
}

// ---------------------------------------------------------------------------
// Bookings (pending checkout -> confirmed payment) + per-date slot index
// ---------------------------------------------------------------------------

const bookingKey = (checkoutId) => `booking:${checkoutId}`;
const dateIndexKey = (date) => `booking-index:${date}`;

export async function getBooking(checkoutId) {
    return redis.get(bookingKey(checkoutId));
}

/** Stores a booking right after Yoco checkout creation, and reserves its slot. */
export async function savePendingBooking(checkoutId, booking) {
    await redis.set(bookingKey(checkoutId), { ...booking, status: 'pending' }, { ex: PENDING_BOOKING_TTL_SECONDS });
    if (booking.bookingDate && booking.bookingTime) {
        const key = dateIndexKey(booking.bookingDate);
        await redis.sadd(key, booking.bookingTime);
        await redis.expire(key, DATE_INDEX_TTL_SECONDS);
    }
}

/** Marks a booking as paid once the webhook confirms it — keeps the slot blocked long-term. */
export async function markBookingConfirmed(checkoutId) {
    const booking = await redis.get(bookingKey(checkoutId));
    if (!booking) return null;
    const confirmed = { ...booking, status: 'paid', confirmedAt: new Date().toISOString() };
    await redis.set(bookingKey(checkoutId), confirmed, { ex: CONFIRMED_BOOKING_TTL_SECONDS });
    return confirmed;
}

/** Returns { [date]: [time, ...] } for every reserved slot (pending or paid) in the given date range. */
export async function getBookedSlotsInRange(fromDate, toDate) {
    const bookedSlots = {};
    if (!fromDate || !toDate) return bookedSlots;

    const dates = [];
    const cursor = new Date(`${fromDate}T00:00:00`);
    const end = new Date(`${toDate}T00:00:00`);
    while (cursor <= end) {
        const y = cursor.getFullYear();
        const m = String(cursor.getMonth() + 1).padStart(2, '0');
        const d = String(cursor.getDate()).padStart(2, '0');
        dates.push(`${y}-${m}-${d}`);
        cursor.setDate(cursor.getDate() + 1);
    }

    await Promise.all(dates.map(async (date) => {
        const times = await redis.smembers(dateIndexKey(date));
        if (times.length) bookedSlots[date] = times;
    }));

    return bookedSlots;
}

// ---------------------------------------------------------------------------
// Webhook delivery de-duplication
// ---------------------------------------------------------------------------

export async function hasProcessedWebhook(webhookId) {
    return Boolean(await redis.get(`webhook:processed:${webhookId}`));
}

export async function markWebhookProcessed(webhookId) {
    await redis.set(`webhook:processed:${webhookId}`, 1, { ex: WEBHOOK_DEDUPE_TTL_SECONDS });
}
