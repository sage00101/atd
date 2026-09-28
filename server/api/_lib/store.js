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

export function normaliseEmail(value) {
    return String(value || '').trim().toLowerCase();
}

export function looksLikeEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normaliseEmail(value));
}

export function normaliseName(value) {
    return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

export function normalisePhone(value) {
    return String(value || '').replace(/\D/g, '');
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
// Promo codes + per-person lifetime history
//
// Eligibility is tied to (first name + surname + cell number), not email and
// not vehicle registration — we deliberately avoid persisting vehicle
// registration numbers as a tracked identifier in our own storage. Email is
// still collected purely so we have somewhere to deliver the code.
// ---------------------------------------------------------------------------

const promoCodeKey = (code) => `promo:code:${code}`;
const identityKey = (firstName, surname, mobile) => `promo:identity:${normaliseName(firstName)}|${normaliseName(surname)}|${normalisePhone(mobile)}`;

export async function getPromoCode(code) {
    return redis.get(promoCodeKey(code));
}

/** True if this name + surname + cell number combo has ever been issued a promo code (used or not). */
export async function hasPersonAlreadyRegistered({ firstName, surname, mobile }) {
    const history = await redis.get(identityKey(firstName, surname, mobile));
    return Boolean(history);
}

/** Call after approving a promo registration (admin action via /api/promos/issue). */
export async function issuePromoForRegistration({ firstName, surname, mobile, email }) {
    if (!String(firstName || '').trim() || !String(surname || '').trim()) {
        throw new Error('First name and surname are required.');
    }
    if (normalisePhone(mobile).length < 7) {
        throw new Error('Invalid cell number.');
    }
    if (!looksLikeEmail(email)) {
        throw new Error('Invalid email address.');
    }

    const key = identityKey(firstName, surname, mobile);
    const code = generatePromoCode();
    const record = {
        code,
        firstName: normaliseName(firstName),
        surname: normaliseName(surname),
        mobile: normalisePhone(mobile),
        email: normaliseEmail(email),
        usedAt: null,
        createdAt: new Date().toISOString(),
    };

    // Atomic "claim" — only succeeds if no history exists yet for this person,
    // preventing a race between two simultaneous issue calls for the same identity.
    const claimed = await redis.set(key, { code, issuedAt: record.createdAt, usedAt: null }, { nx: true });
    if (!claimed) {
        throw new Error('This name, surname and cell number combination has already been issued a promo code and cannot be registered again. Codes cannot be reissued if lost.');
    }

    await redis.set(promoCodeKey(code), record);
    return record;
}

/** Marks a promo code (and its identity) as redeemed, so neither can be used again. */
export async function markPromoCodeUsed(code) {
    const record = await redis.get(promoCodeKey(code));
    if (!record || record.usedAt) return record;

    record.usedAt = new Date().toISOString();
    await redis.set(promoCodeKey(code), record);

    const historyKey = identityKey(record.firstName, record.surname, record.mobile);
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
