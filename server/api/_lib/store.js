// Persistent storage backed by Upstash Redis.
import crypto from 'node:crypto';
import { redis } from './redis.js';

const PENDING_BOOKING_TTL_SECONDS = 60 * 60 * 24 * 3; // 3 days — abandoned checkouts expire
const CONFIRMED_BOOKING_TTL_SECONDS = 60 * 60 * 24 * 365; // 1 year — keep the slot blocked long-term
const DATE_INDEX_TTL_SECONDS = 60 * 60 * 24 * 90; // 90 days — bookings are never made further out than this
const WEBHOOK_DEDUPE_TTL_SECONDS = 60 * 60 * 24 * 3; // 3 days — longer than Yoco's retry window
const PROMO_BATCH_KEY = 'promo:shared:active-batch';
const PROMO_RESERVATION_TTL_SECONDS = 60 * 60;

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

export function normaliseEmail(value) {
    return String(value || '').trim().toLowerCase();
}

export function looksLikeEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normaliseEmail(value));
}

// ---------------------------------------------------------------------------
// Single-wash promo eligibility — the customer's own vehicle registration
// number doubles as their promo code, so there's no separate code to
// generate, deliver, or lose. One-time use per vehicle, forever.
// ---------------------------------------------------------------------------

const vehiclePromoKey = (reg) => `promo:vehicle:${reg}`;

export async function getVehiclePromo(vehicleRegistration) {
    return redis.get(vehiclePromoKey(normaliseReg(vehicleRegistration)));
}

/** Call after approving a vehicle for the promo (admin action via /api/promos/issue). */
export async function approveVehicleForPromo({ vehicleRegistration, email }) {
    if (!looksLikeVehicleRegistration(vehicleRegistration)) {
        throw new Error('Invalid vehicle registration format.');
    }
    const reg = normaliseReg(vehicleRegistration);
    const record = {
        vehicleRegistration: reg,
        email: email ? normaliseEmail(email) : null,
        usedAt: null,
        approvedAt: new Date().toISOString(),
    };

    // Atomic "claim" — only succeeds if this vehicle hasn't been approved before,
    // preventing a race between two simultaneous approval calls for the same reg.
    const claimed = await redis.set(vehiclePromoKey(reg), record, { nx: true });
    if (!claimed) {
        throw new Error('This vehicle registration has already been approved for the promo and cannot be registered again.');
    }
    return record;
}

/** Marks a vehicle's promo as redeemed, so it can never be discounted again. */
export async function markVehiclePromoUsed(vehicleRegistration) {
    const reg = normaliseReg(vehicleRegistration);
    const record = await redis.get(vehiclePromoKey(reg));
    if (!record || record.usedAt) return record;

    record.usedAt = new Date().toISOString();
    await redis.set(vehiclePromoKey(reg), record);
    return record;
}

// ---------------------------------------------------------------------------
// Admin-managed password/code batches and one-time shared code redemption
// ---------------------------------------------------------------------------

const promoCodeDigest = (code) => crypto.createHash('sha256').update(String(code).trim().toUpperCase()).digest('hex');
const promoUsedKey = (code) => `promo:shared:used:${promoCodeDigest(code)}`;
const promoReservationKey = (code) => `promo:shared:reservation:${promoCodeDigest(code)}`;

export async function getSharedPromoBatch() {
    return redis.get(PROMO_BATCH_KEY);
}

export async function getSharedPromoBatchForAdmin() {
    const batch = await getSharedPromoBatch();
    if (!batch) return { batchId: null, updatedAt: null, pairs: [] };

    const pairs = await Promise.all(batch.pairs.map(async (pair) => ({
        ...pair,
        used: Boolean(await redis.get(promoUsedKey(pair.promoCode))),
    })));
    return { ...batch, pairs };
}

export async function saveSharedPromoBatch(inputPairs) {
    if (!Array.isArray(inputPairs) || inputPairs.length < 1 || inputPairs.length > 50) {
        throw new Error('A batch must contain between 1 and 50 password/code pairs.');
    }

    const passwords = new Set();
    const pairs = inputPairs.map((pair, index) => {
        const password = String(pair?.password || '').trim();
        const promoCode = String(pair?.promoCode || '').trim();
        if (!password || !promoCode) {
            throw new Error(`Row ${index + 1} needs both a password and a promo code.`);
        }
        if (passwords.has(password)) {
            throw new Error(`Password on row ${index + 1} is duplicated.`);
        }
        passwords.add(password);
        return { password, promoCode };
    });

    const promoCodes = [...new Set(pairs.map((pair) => pair.promoCode.toUpperCase()))];
    for (const promoCode of promoCodes) {
        if (await redis.get(promoUsedKey(promoCode))) {
            throw new Error(`Promo code ${promoCode} has already been redeemed and cannot be reused.`);
        }
    }

    const batch = {
        batchId: crypto.randomUUID(),
        updatedAt: new Date().toISOString(),
        pairs,
    };
    await redis.set(PROMO_BATCH_KEY, batch);
    return batch;
}

export async function findSharedPromoForPassword(password) {
    const batch = await getSharedPromoBatch();
    if (!batch) return { status: 'unconfigured' };

    const submitted = crypto.createHash('sha256').update(String(password).trim()).digest();
    let promoCode = null;
    for (const pair of batch.pairs) {
        const candidate = crypto.createHash('sha256').update(pair.password).digest();
        if (crypto.timingSafeEqual(submitted, candidate)) promoCode = pair.promoCode;
    }
    if (!promoCode) return { status: 'invalid' };
    if (await redis.get(promoUsedKey(promoCode))) return { status: 'used' };
    if (await redis.get(promoReservationKey(promoCode))) return { status: 'reserved' };
    return { status: 'available', promoCode };
}

export async function getSharedPromoCodeStatus(promoCode) {
    const batch = await getSharedPromoBatch();
    if (!batch || !batch.pairs.some((pair) => pair.promoCode.toUpperCase() === String(promoCode).trim().toUpperCase())) {
        return { status: 'invalid' };
    }
    if (await redis.get(promoUsedKey(promoCode))) return { status: 'used' };
    if (await redis.get(promoReservationKey(promoCode))) return { status: 'reserved' };
    return { status: 'available', promoCode: String(promoCode).trim().toUpperCase() };
}

export async function reserveSharedPromoCode(promoCode, reservationId) {
    const result = await redis.set(promoReservationKey(promoCode), reservationId, {
        nx: true,
        ex: PROMO_RESERVATION_TTL_SECONDS,
    });
    return result === 'OK';
}

export async function releaseSharedPromoCode(promoCode, reservationId) {
    const key = promoReservationKey(promoCode);
    if (await redis.get(key) === reservationId) await redis.del(key);
}

export async function markSharedPromoCodeUsed(promoCode, reservationId) {
    const usedKey = promoUsedKey(promoCode);
    if (await redis.get(usedKey)) return true;

    const reservationKey = promoReservationKey(promoCode);
    const reservedBy = await redis.get(reservationKey);
    if (reservedBy && reservedBy !== reservationId) return false;

    await redis.set(usedKey, { usedAt: new Date().toISOString(), reservationId }, { nx: true });
    if (reservedBy === reservationId) await redis.del(reservationKey);
    return true;
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

// ---------------------------------------------------------------------------
// Google reviews cache (avoids burning SerpApi search credits on every page load)
// ---------------------------------------------------------------------------

const GOOGLE_REVIEWS_CACHE_KEY = 'google-reviews:cache';
const GOOGLE_REVIEWS_CACHE_TTL_SECONDS = 60 * 60 * 6; // 6 hours

export async function getCachedGoogleReviews() {
    return redis.get(GOOGLE_REVIEWS_CACHE_KEY);
}

export async function setCachedGoogleReviews(payload) {
    await redis.set(GOOGLE_REVIEWS_CACHE_KEY, payload, { ex: GOOGLE_REVIEWS_CACHE_TTL_SECONDS });
}
