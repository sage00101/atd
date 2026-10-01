// Persistent storage backed by Upstash Redis.
import crypto from 'node:crypto';
import { redis } from './redis.js';
import { generateReferenceNumber } from './reference.js';

const PENDING_BOOKING_TTL_SECONDS = 60 * 60 * 24 * 3; // 3 days — abandoned checkouts expire
const CONFIRMED_BOOKING_TTL_SECONDS = 60 * 60 * 24 * 365; // 1 year — keep the slot blocked long-term
const DATE_INDEX_TTL_SECONDS = 60 * 60 * 24 * 90; // 90 days — bookings are never made further out than this
const WEBHOOK_DEDUPE_TTL_SECONDS = 60 * 60 * 24 * 3; // 3 days — longer than Yoco's retry window
const PROMO_BATCH_KEY = 'promo:shared:active-batch';
const PROMO_RESERVATION_TTL_SECONDS = 60 * 60;
const REFERENCE_TTL_SECONDS = 60 * 60 * 24 * 365; // 1 year — matches confirmed-booking retention

const referenceKey = (reference) => `booking-ref:${reference}`;

/** Generates a reference number and atomically claims it, retrying on the astronomically rare collision. */
export async function claimUniqueReferenceNumber() {
    for (let attempt = 0; attempt < 5; attempt += 1) {
        const candidate = generateReferenceNumber();
        const claimed = await redis.set(referenceKey(candidate), 1, { nx: true, ex: REFERENCE_TTL_SECONDS });
        if (claimed === 'OK') return candidate;
    }
    throw new Error('Could not generate a unique booking reference. Please try again.');
}

export const SINGLE_WASH_CENTS = {
    'Sedan / Hatchback': 65000,
    'SUV / Bakkie': 85000,
    'Minibus / Van': 110000,
};

// Mirrors the monthly rate cards in src/data/pricing.js — first-installment amount charged at booking.
export const MONTHLY_PACKAGE_CENTS = {
    'private-standard': {
        'Sedan / Hatchback': 115000,
        'SUV / Bakkie': 155000,
        'Minibus / Van': 205000,
    },
    'private-premium': {
        'Sedan / Hatchback': 230000,
        'SUV / Bakkie': 310000,
        'Minibus / Van': 410000,
    },
    'business-standard': {
        'Sedan / Hatchback': 330000,
        'SUV / Bakkie': 450000,
        'Minibus / Van': 570000,
    },
    'business-premium': {
        'Sedan / Hatchback': 660000,
        'SUV / Bakkie': 900000,
        'Minibus / Van': 1140000,
    },
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
//
// Each slot has its own key (`booking-slot:<date>:<time>`) with a TTL tied to
// its real lifecycle: short-lived while pending (so an abandoned checkout —
// one that never gets a webhook at all — self-releases automatically after
// PENDING_BOOKING_TTL_SECONDS) and long-lived once paid. The per-date SET is
// only a cheap candidate list; getBookedSlotsInRange cross-checks each
// candidate's slot key before reporting it as taken, so stale/expired
// candidates never block a real customer.
// ---------------------------------------------------------------------------

const bookingKey = (checkoutId) => `booking:${checkoutId}`;
const dateIndexKey = (date) => `booking-index:${date}`;
const slotKey = (date, time) => `booking-slot:${date}:${time}`;

export async function getBooking(checkoutId) {
    return redis.get(bookingKey(checkoutId));
}

/** Atomically claims a date/time slot. Returns false if it's already actively held by someone else. */
export async function reserveBookingSlot(bookingDate, bookingTime, token) {
    if (!bookingDate || !bookingTime) return true;
    const claimed = await redis.set(slotKey(bookingDate, bookingTime), token, {
        nx: true,
        ex: PENDING_BOOKING_TTL_SECONDS,
    });
    if (claimed !== 'OK') return false;
    const key = dateIndexKey(bookingDate);
    await redis.sadd(key, bookingTime);
    await redis.expire(key, DATE_INDEX_TTL_SECONDS);
    return true;
}

/** Stores the booking record once the slot is already claimed via reserveBookingSlot. */
export async function savePendingBooking(checkoutId, booking) {
    await redis.set(bookingKey(checkoutId), { ...booking, status: 'pending' }, { ex: PENDING_BOOKING_TTL_SECONDS });
}

/** Marks a booking as paid once the webhook confirms it — extends the slot hold long-term. */
export async function markBookingConfirmed(checkoutId) {
    const booking = await redis.get(bookingKey(checkoutId));
    if (!booking) return null;
    const confirmed = { ...booking, status: 'paid', confirmedAt: new Date().toISOString() };
    await redis.set(bookingKey(checkoutId), confirmed, { ex: CONFIRMED_BOOKING_TTL_SECONDS });
    if (booking.bookingDate && booking.bookingTime) {
        await redis.expire(slotKey(booking.bookingDate, booking.bookingTime), CONFIRMED_BOOKING_TTL_SECONDS);
    }
    return confirmed;
}

/** Frees a reserved slot after a failed/cancelled payment so it goes back up for booking immediately. */
export async function releaseBookingSlot(bookingDate, bookingTime) {
    if (!bookingDate || !bookingTime) return;
    await redis.del(slotKey(bookingDate, bookingTime));
    await redis.srem(dateIndexKey(bookingDate), bookingTime);
}

/** Returns { [date]: [time, ...] } for every slot still actively held (pending or paid) in the given date range. */
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
        const candidates = await redis.smembers(dateIndexKey(date));
        if (!candidates.length) return;

        const stillHeld = await Promise.all(candidates.map((time) => redis.exists(slotKey(date, time))));
        const times = candidates.filter((_, index) => stillHeld[index]);
        const stale = candidates.filter((_, index) => !stillHeld[index]);
        if (stale.length) await redis.srem(dateIndexKey(date), ...stale); // opportunistic cleanup
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
