import crypto from 'node:crypto';
import { getServiceAreaError } from './service-area.js';
import { redis } from './redis.js';
import {
    BOOKING_SLOT_TIMES,
    MONTHLY_PACKAGE_CENTS,
    SINGLE_WASH_CENTS,
    claimUniqueReferenceNumber,
    getBookingSlotOwner,
    markStoredBookingCancelled,
    looksLikeEmail,
    looksLikeVehicleRegistration,
    normaliseEmail,
    normaliseReg,
    releaseBookingSlotIfOwned,
    reserveBookingSlot,
} from './store.js';
import { checkMonthlyWashAvailability } from './monthly-promos.js';

const REQUEST_TTL_SECONDS = 60 * 60 * 24 * 365;
const REQUEST_SLOT_TTL_SECONDS = 60 * 60 * 24 * 3;
const APPROVAL_TTL_SECONDS = 60 * 60 * 24 * 3;
const CONTINUATION_LOCK_SECONDS = 60 * 5;
const REQUEST_INDEX_KEY = 'booking:requests:index';

const requestKey = (id) => `booking:request:${id}`;
const statusTokenKey = (tokenDigest) => `booking:request-status:${tokenDigest}`;
const continuationTokenKey = (tokenDigest) => `booking:request-continuation:${tokenDigest}`;
const continuationLockKey = (id) => `booking:request-continuation-lock:${id}`;

export class BookingRequestError extends Error {
    constructor(message) {
        super(message);
        this.name = 'BookingRequestError';
        this.statusCode = 400;
    }
}

const digestToken = (token) => crypto.createHash('sha256').update(String(token)).digest('hex');
const createToken = () => crypto.randomBytes(32).toString('base64url');

const ACCEPT_REQUEST_SCRIPT = `
local raw = redis.call('GET', KEYS[1])
if not raw then return {'NOT_FOUND'} end
local request = cjson.decode(raw)
if request.status ~= 'pending_approval' then return {request.status} end
if tonumber(request.requestExpiresAt) <= tonumber(ARGV[1]) then
  request.status = 'expired'
  request.updatedAt = ARGV[1]
  redis.call('SET', KEYS[1], cjson.encode(request), 'EX', ARGV[4])
  return {'EXPIRED'}
end
request.status = 'approved'
request.approvedAt = ARGV[1]
request.approvedBy = ARGV[2]
request.approvalExpiresAt = ARGV[3]
request.continuationTokenDigest = ARGV[5]
request.continuationToken = ARGV[7]
request.updatedAt = ARGV[1]
redis.call('SET', KEYS[1], cjson.encode(request), 'EX', ARGV[4])
redis.call('SET', KEYS[2], request.id, 'EX', ARGV[6])
return {'OK', cjson.encode(request)}
`;

const DECLINE_REQUEST_SCRIPT = `
local raw = redis.call('GET', KEYS[1])
if not raw then return {'NOT_FOUND'} end
local request = cjson.decode(raw)
if request.status ~= 'pending_approval' then return {request.status} end
if tonumber(request.requestExpiresAt) <= tonumber(ARGV[1]) then
  request.status = 'expired'
  request.updatedAt = ARGV[1]
  redis.call('SET', KEYS[1], cjson.encode(request), 'EX', ARGV[4])
  return {'EXPIRED'}
end
request.status = 'declined'
request.declinedAt = ARGV[1]
request.declinedBy = ARGV[2]
request.declineReason = ARGV[3]
request.updatedAt = ARGV[1]
request.continuationTokenDigest = cjson.null
redis.call('SET', KEYS[1], cjson.encode(request), 'EX', ARGV[4])
redis.call('DEL', KEYS[2])
return {'OK', cjson.encode(request)}
`;

const UPDATE_REQUEST_STATUS_SCRIPT = `
local raw = redis.call('GET', KEYS[1])
if not raw then return {'NOT_FOUND'} end
local request = cjson.decode(raw)
if request.status ~= ARGV[1] then return {request.status} end
request.status = ARGV[2]
request.updatedAt = ARGV[3]
if ARGV[4] ~= '' then request.checkoutId = ARGV[4] end
if ARGV[5] ~= '' then request.checkoutUrl = ARGV[5] end
if ARGV[6] ~= '' then request.completedAt = ARGV[6] end
if ARGV[2] == 'awaiting_completion' then
  local serverTime = redis.call('TIME')
  request.approvalExpiresAt = tonumber(serverTime[1]) * 1000 + tonumber(ARGV[8]) * 1000
  redis.call('EXPIRE', KEYS[3], ARGV[8])
elseif ARGV[2] == 'confirmed' or ARGV[2] == 'cancelled' or ARGV[2] == 'expired' or ARGV[2] == 'declined' then
  request.continuationTokenDigest = cjson.null
  request.continuationToken = cjson.null
  redis.call('DEL', KEYS[3])
end
redis.call('SET', KEYS[1], cjson.encode(request), 'EX', ARGV[7])
return {'OK', cjson.encode(request)}
`;

const CLAIM_CONTINUATION_SCRIPT = `
local raw = redis.call('GET', KEYS[1])
if not raw then return {'NOT_FOUND'} end
local request = cjson.decode(raw)
if request.status == 'awaiting_completion' and request.checkoutUrl then
  return {'EXISTING_CHECKOUT', cjson.encode(request)}
end
if request.status ~= 'approved' then return {request.status, cjson.encode(request)} end
if tonumber(request.approvalExpiresAt) <= tonumber(ARGV[1]) then
  request.status = 'expired'
  request.updatedAt = ARGV[1]
  redis.call('SET', KEYS[1], cjson.encode(request), 'EX', ARGV[3])
  return {'EXPIRED', cjson.encode(request)}
end
local locked = redis.call('SET', KEYS[2], ARGV[1], 'NX', 'EX', ARGV[2])
if not locked then return {'PROCESSING'} end
return {'OK', cjson.encode(request)}
`;

const RESET_CONTINUATION_SCRIPT = `
local raw = redis.call('GET', KEYS[1])
if not raw then return 0 end
redis.call('DEL', KEYS[2])
return 1
`;

function isValidDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function bookingKind(booking) {
    return booking.bookingType === 'monthly-entitlement'
        ? 'monthly-client-wash'
        : booking.purchaseType === 'monthly'
            ? 'monthly-package-purchase'
            : 'single-wash';
}

function publicStatus(status) {
    return ({
        pending_approval: 'Pending Approval',
        approved: 'Approved – Awaiting Completion',
        processing: 'Approved – Awaiting Completion',
        awaiting_completion: 'Approved – Awaiting Completion',
        confirmed: 'Confirmed',
        declined: 'Declined',
        expired: 'Expired or Cancelled',
        cancelled: 'Expired or Cancelled',
    })[status] || 'Expired or Cancelled';
}

function publicRequest(request, includeBooking = true) {
    const {
        statusTokenDigest,
        continuationTokenDigest,
        continuationToken,
        ...visible
    } = request;
    if (visible.booking?.contractFileBase64) {
        visible.booking = { ...visible.booking, contractFileBase64: undefined };
    }
    return {
        ...visible,
        publicStatus: publicStatus(request.status),
        ...(includeBooking ? {} : { booking: undefined }),
    };
}

function requestExpiry(request, now = Date.now()) {
    return request.status === 'pending_approval'
        ? Number(request.requestExpiresAt)
        : ['approved', 'processing', 'awaiting_completion'].includes(request.status)
            ? Number(request.approvalExpiresAt)
            : 0;
}

async function expireRequestIfNeeded(request) {
    if (!request || !['pending_approval', 'approved', 'processing', 'awaiting_completion'].includes(request.status)) {
        return request;
    }
    if (requestExpiry(request) > Date.now()) return request;
    const changed = await redis.eval(UPDATE_REQUEST_STATUS_SCRIPT, [
        requestKey(request.id),
        continuationLockKey(request.id),
        request.continuationTokenDigest
            ? continuationTokenKey(request.continuationTokenDigest)
            : 'booking:request-continuation:none',
    ], [
        request.status,
        'expired',
        String(Date.now()),
        '',
        '',
        '',
        String(REQUEST_TTL_SECONDS),
        '0',
    ]);
    if (changed?.[0] === 'OK') {
        await releaseBookingSlotIfOwned(request.booking.bookingDate, request.booking.bookingTime, request.reference);
        if (request.continuationTokenDigest) await redis.del(continuationTokenKey(request.continuationTokenDigest));
        return parseScriptRecord(changed[1]);
    }
    return await redis.get(requestKey(request.id)) || request;
}

function getRequestError(status) {
    const messages = {
        NOT_FOUND: 'Booking request not found.',
        EXPIRED: 'This booking request or approval link has expired.',
        pending_approval: 'This booking request has not been approved yet.',
        declined: 'This booking request was declined.',
        expired: 'This booking request or approval link has expired.',
        cancelled: 'This booking request was cancelled.',
        confirmed: 'This booking request has already been completed.',
        processing: 'This booking request is already being processed. Please wait a moment and check its status.',
        awaiting_completion: 'This booking request is already awaiting payment or completion.',
    };
    return messages[status] || 'This booking request is no longer available.';
}

export async function validateBookingRequest(booking) {
    const customer = booking?.customer || {};
    const bookingDate = String(booking?.bookingDate || '');
    const bookingTime = String(booking?.bookingTime || '');
    if (!['single', 'monthly'].includes(booking?.purchaseType)) throw new BookingRequestError('Choose a valid wash package.');
    if (booking.bookingType && booking.bookingType !== 'monthly-entitlement') throw new BookingRequestError('Unknown booking type.');
    if (booking.bookingType === 'monthly-entitlement' && booking.purchaseType !== 'single') {
        throw new BookingRequestError('Monthly entitlement washes must be submitted as single washes.');
    }
    if (!isValidDate(bookingDate) || !BOOKING_SLOT_TIMES.includes(bookingTime)) {
        throw new BookingRequestError('Choose a valid booking date and time.');
    }
    const day = new Date(`${bookingDate}T00:00:00.000Z`).getUTCDay();
    if (day === 0 || day === 6) throw new BookingRequestError('Bookings are available on weekdays only.');
    if (new Date(`${bookingDate}T${bookingTime}:00+02:00`).getTime() - Date.now() < 3 * 60 * 60 * 1000) {
        throw new BookingRequestError('Bookings require at least 3 hours notice. Please choose a later time.');
    }
    if (!SINGLE_WASH_CENTS[booking.vehicleType]) throw new BookingRequestError('Choose a valid vehicle category.');
    if (!looksLikeEmail(customer.email)
        || !String(customer.firstName || '').trim()
        || !String(customer.surname || '').trim()
        || !String(customer.mobile || '').trim()
        || !looksLikeVehicleRegistration(customer.registration)) {
        throw new BookingRequestError('Enter your name, mobile number, email address and a valid vehicle registration.');
    }
    if (!booking.serviceAreaAccepted || !booking.termsAccepted) throw new BookingRequestError('Confirm the service details and booking terms.');
    const serviceAreaError = getServiceAreaError(booking.serviceLocation, customer.address);
    if (serviceAreaError) throw new BookingRequestError(serviceAreaError);

    if (booking.purchaseType === 'monthly' && !MONTHLY_PACKAGE_CENTS[booking.packageId]?.[booking.vehicleType]) {
        throw new BookingRequestError('Choose a valid monthly package and vehicle category.');
    }
    if (booking.purchaseType === 'monthly' && (!booking.contractAccepted || !booking.contractFileBase64)) {
        throw new BookingRequestError('Attach the completed monthly contract and accept the contract terms.');
    }

    if (booking.bookingType === 'monthly-entitlement') {
        if (!['private', 'business'].includes(booking.monthlyClientType)
            || !['standard', 'premium'].includes(booking.monthlyPackageTier)) {
            throw new BookingRequestError('Select the customer type and package level assigned to your monthly account.');
        }
        const eligibility = await checkMonthlyWashAvailability({
            promoCode: booking.promoCode,
            email: customer.email,
            bookingDate,
            expectedClientType: booking.monthlyClientType,
            expectedPackageTier: booking.monthlyPackageTier,
            expectedVehicleType: booking.vehicleType,
        });
        if (eligibility.status !== 'OK') {
            throw new BookingRequestError(eligibility.status === 'CREDITS_EXHAUSTED'
                ? 'You have run out of prepaid washes on this monthly package.'
                : eligibility.status === 'LIMIT_REACHED'
                    ? 'You have reached the booking limit for this monthly billing period.'
                    : `Monthly account check failed: ${eligibility.status}.`);
        }
    }

    if (booking.bookingType !== 'monthly-entitlement'
        && !['online', 'onsite'].includes(booking.requestedPaymentMethod)) {
        throw new BookingRequestError('Choose a valid payment method.');
    }
    return {
        ...booking,
        customer: {
            ...customer,
            firstName: String(customer.firstName).trim(),
            surname: String(customer.surname).trim(),
            mobile: String(customer.mobile).trim(),
            email: normaliseEmail(customer.email),
            registration: normaliseReg(customer.registration),
            address: String(customer.address || '').trim(),
            notes: String(customer.notes || '').trim(),
        },
        promoCode: String(booking.promoCode || '').trim().toUpperCase() || null,
        requestedPaymentMethod: booking.bookingType === 'monthly-entitlement' ? 'monthly' : booking.requestedPaymentMethod,
    };
}

export async function createBookingRequest(booking) {
    const validatedBooking = await validateBookingRequest(booking);
    const reference = await claimUniqueReferenceNumber();
    const id = crypto.randomUUID();
    const now = Date.now();
    const statusToken = createToken();
    const expiresAt = now + REQUEST_SLOT_TTL_SECONDS * 1000;
    const slotClaimed = await reserveBookingSlot(
        validatedBooking.bookingDate,
        validatedBooking.bookingTime,
        reference,
        REQUEST_SLOT_TTL_SECONDS,
    );
    if (!slotClaimed) {
        throw new BookingRequestError('That time slot was just requested by someone else. Please choose another.');
    }

    const request = {
        id,
        reference,
        status: 'pending_approval',
        kind: bookingKind(validatedBooking),
        booking: validatedBooking,
        submittedAt: new Date(now).toISOString(),
        requestExpiresAt: expiresAt,
        statusTokenDigest: digestToken(statusToken),
        updatedAt: new Date(now).toISOString(),
    };
    try {
        await redis.set(requestKey(id), request, { ex: REQUEST_TTL_SECONDS });
        await redis.set(statusTokenKey(request.statusTokenDigest), id, { ex: REQUEST_TTL_SECONDS });
        await redis.lpush(REQUEST_INDEX_KEY, id);
        await redis.ltrim(REQUEST_INDEX_KEY, 0, 999);
        await redis.expire(REQUEST_INDEX_KEY, REQUEST_TTL_SECONDS);
    } catch (error) {
        await redis.del(requestKey(id), statusTokenKey(request.statusTokenDigest));
        await redis.lrem(REQUEST_INDEX_KEY, 0, id);
        await releaseBookingSlotIfOwned(validatedBooking.bookingDate, validatedBooking.bookingTime, reference);
        throw error;
    }
    return { request, statusToken };
}

export async function getBookingRequestByStatusToken(token) {
    const id = await redis.get(statusTokenKey(digestToken(token)));
    if (!id) return null;
    const request = await expireRequestIfNeeded(await redis.get(requestKey(id)));
    if (!request) return null;
    if (request.continuationTokenDigest) {
        request.continuationToken = await redis.get(continuationTokenKey(request.continuationTokenDigest))
            ? request.continuationToken
            : null;
    }
    return request;
}

export async function getBookingRequestByContinuationToken(token) {
    const tokenDigest = digestToken(token);
    const id = await redis.get(continuationTokenKey(tokenDigest));
    if (!id) return null;
    const request = await expireRequestIfNeeded(await redis.get(requestKey(id)));
    if (!request || request.continuationTokenDigest !== tokenDigest) return null;
    return request;
}

export async function listBookingRequests() {
    const ids = await redis.lrange(REQUEST_INDEX_KEY, 0, 999);
    const records = await Promise.all(ids.map(async (id) => {
        const request = await expireRequestIfNeeded(await redis.get(requestKey(id)));
        return request && !request.hiddenFromAdmin ? publicRequest(request) : null;
    }));
    return records.filter(Boolean);
}

/**
 * Removes a request from the manager. Finished requests are deleted outright; live or confirmed ones are
 * only hidden so the held slot and the customer's email stay available for later cancellation.
 */
export async function deleteBookingRequestFromAdmin(id) {
    const requestId = String(id || '').trim();
    const request = requestId ? await redis.get(requestKey(requestId)) : null;
    if (!request) throw new Error('Booking request not found.');
    if (['pending_approval', 'processing'].includes(request.status)) {
        throw new Error('This request is still active and cannot be deleted. Accept or decline it first.');
    }
    if (['declined', 'expired', 'cancelled'].includes(request.status)) {
        await redis.del(
            requestKey(requestId),
            request.statusTokenDigest ? statusTokenKey(request.statusTokenDigest) : 'booking:request-status:none',
            request.continuationTokenDigest ? continuationTokenKey(request.continuationTokenDigest) : 'booking:request-continuation:none',
        );
        await redis.lrem(REQUEST_INDEX_KEY, 0, requestId);
        return { id: requestId, removed: 'deleted' };
    }
    await redis.set(requestKey(requestId), { ...request, hiddenFromAdmin: true }, { keepTtl: true });
    return { id: requestId, removed: 'hidden' };
}

export async function getBookingRequestForAdmin(id) {
    const requestId = String(id || '').trim();
    if (!requestId) return null;
    return await expireRequestIfNeeded(await redis.get(requestKey(requestId)));
}

export async function acceptBookingRequest(id, adminName) {
    const requestId = String(id || '').trim();
    const name = String(adminName || '').trim();
    if (!requestId) throw new Error('Booking request id is required.');
    if (!name) throw new Error('Enter the administrator name before approving a request.');
    const request = await redis.get(requestKey(requestId));
    if (!request) throw new Error(getRequestError('NOT_FOUND'));
    const slotClaimed = await reserveBookingSlot(
        request.booking.bookingDate,
        request.booking.bookingTime,
        request.reference,
        APPROVAL_TTL_SECONDS,
    );
    if (!slotClaimed) throw new Error('The requested time slot is no longer available.');
    const continuationToken = createToken();
    const now = Date.now();
    const approvalExpiresAt = now + APPROVAL_TTL_SECONDS * 1000;
    const result = await redis.eval(ACCEPT_REQUEST_SCRIPT, [
        requestKey(requestId),
        continuationTokenKey(digestToken(continuationToken)),
    ], [
        String(now),
        name,
        String(approvalExpiresAt),
        String(REQUEST_TTL_SECONDS),
        digestToken(continuationToken),
        String(APPROVAL_TTL_SECONDS),
        continuationToken,
    ]);
    if (!Array.isArray(result) || result[0] !== 'OK') {
        if (result?.[0] === 'EXPIRED') {
            await releaseBookingSlotIfOwned(request.booking.bookingDate, request.booking.bookingTime, request.reference);
        }
        throw new Error(getRequestError(result?.[0] || 'ERROR'));
    }
    return { request: await loadSavedRecord(result[1], requestId), continuationToken };
}

function parseScriptRecord(value) {
    return typeof value === 'string' ? JSON.parse(value) : value;
}

async function loadSavedRecord(value, id) {
    if (value && typeof value === 'object') return value;
    try {
        const parsed = typeof value === 'string' ? JSON.parse(value) : null;
        if (parsed && typeof parsed === 'object') return parsed;
    } catch {
        // fall back to the stored record below
    }
    return await redis.get(requestKey(id));
}

export async function declineBookingRequest(id, adminName, reason) {
    const requestId = String(id || '').trim();
    const name = String(adminName || '').trim();
    const declineReason = String(reason || '').trim();
    if (!requestId) throw new Error('Booking request id is required.');
    if (!name) throw new Error('Enter the administrator name before declining a request.');
    if (!declineReason) throw new Error('A reason is required to decline a booking request.');
    const request = await redis.get(requestKey(requestId));
    if (!request) throw new Error(getRequestError('NOT_FOUND'));
    const result = await redis.eval(DECLINE_REQUEST_SCRIPT, [
        requestKey(requestId),
        request.continuationTokenDigest ? continuationTokenKey(request.continuationTokenDigest) : 'booking:request-continuation:none',
    ], [
        String(Date.now()),
        name,
        declineReason,
        String(REQUEST_TTL_SECONDS),
    ]);
    if (!Array.isArray(result) || result[0] !== 'OK') {
        if (result?.[0] === 'EXPIRED') {
            await releaseBookingSlotIfOwned(request.booking.bookingDate, request.booking.bookingTime, request.reference);
        }
        throw new Error(getRequestError(result?.[0] || 'ERROR'));
    }
    await releaseBookingSlotIfOwned(request.booking.bookingDate, request.booking.bookingTime, request.reference);
    return parseScriptRecord(result[1]);
}

export async function beginBookingContinuation(token) {
    const request = await getBookingRequestByContinuationToken(token);
    if (!request) throw new Error(getRequestError('NOT_FOUND'));
    const result = await redis.eval(CLAIM_CONTINUATION_SCRIPT, [
        requestKey(request.id),
        continuationLockKey(request.id),
    ], [
        String(Date.now()),
        String(CONTINUATION_LOCK_SECONDS),
        String(REQUEST_TTL_SECONDS),
    ]);
    if (result?.[0] === 'EXISTING_CHECKOUT') {
        return { status: result[0], request: parseScriptRecord(result[1]) };
    }
    if (result?.[0] !== 'OK') {
        if (result?.[0] === 'EXPIRED') {
            await releaseBookingSlotIfOwned(request.booking.bookingDate, request.booking.bookingTime, request.reference);
            if (request.continuationTokenDigest) {
                await redis.del(continuationTokenKey(request.continuationTokenDigest));
            }
        }
        throw new Error(getRequestError(result?.[0] || 'ERROR'));
    }
    return { status: 'OK', request: parseScriptRecord(result[1]) };
}

export async function completeBookingContinuation(id, { status, checkoutId = '', checkoutUrl = '' }) {
    const current = await redis.get(requestKey(id));
    if (!current || current.status !== 'approved') return false;
    const updated = await redis.eval(UPDATE_REQUEST_STATUS_SCRIPT, [
        requestKey(id),
        continuationLockKey(id),
        current.continuationTokenDigest
            ? continuationTokenKey(current.continuationTokenDigest)
            : 'booking:request-continuation:none',
    ], [
        'approved',
        status,
        new Date().toISOString(),
        checkoutId,
        checkoutUrl,
        status === 'confirmed' ? new Date().toISOString() : '',
        String(REQUEST_TTL_SECONDS),
        String(APPROVAL_TTL_SECONDS),
    ]);
    return updated?.[0] === 'OK';
}

export async function resetBookingContinuation(id) {
    return Boolean(await redis.eval(RESET_CONTINUATION_SCRIPT, [
        requestKey(id),
        continuationLockKey(id),
    ], [new Date().toISOString(), String(REQUEST_TTL_SECONDS)]));
}

export async function markBookingRequestConfirmed(reference) {
    const ids = await redis.lrange(REQUEST_INDEX_KEY, 0, 999);
    for (const id of ids) {
        const request = await redis.get(requestKey(id));
        if (request?.reference === reference && request.status === 'awaiting_completion') {
            const result = await redis.eval(UPDATE_REQUEST_STATUS_SCRIPT, [
                requestKey(id),
                continuationLockKey(id),
                request.continuationTokenDigest
                    ? continuationTokenKey(request.continuationTokenDigest)
                    : 'booking:request-continuation:none',
            ], [
                'awaiting_completion',
                'confirmed',
                new Date().toISOString(),
                '',
                '',
                new Date().toISOString(),
                String(REQUEST_TTL_SECONDS),
                '0',
            ]);
            return result?.[0] === 'OK' ? parseScriptRecord(result[1]) : null;
        }
    }
    return null;
}

export async function markBookingRequestCancelled(reference) {
    const ids = await redis.lrange(REQUEST_INDEX_KEY, 0, 999);
    for (const id of ids) {
        const request = await redis.get(requestKey(id));
        if (request?.reference !== reference || !['approved', 'awaiting_completion'].includes(request.status)) continue;
        const result = await redis.eval(UPDATE_REQUEST_STATUS_SCRIPT, [
            requestKey(id),
            continuationLockKey(id),
            request.continuationTokenDigest
                ? continuationTokenKey(request.continuationTokenDigest)
                : 'booking:request-continuation:none',
        ], [
            request.status,
            'cancelled',
            new Date().toISOString(),
            '',
            '',
            '',
            String(REQUEST_TTL_SECONDS),
            '0',
        ]);
        if (result?.[0] !== 'OK') return null;
        if (request.continuationTokenDigest) {
            await redis.del(continuationTokenKey(request.continuationTokenDigest));
        }
        await releaseBookingSlotIfOwned(request.booking.bookingDate, request.booking.bookingTime, request.reference);
        return parseScriptRecord(result[1]);
    }
    return null;
}

export function getBookingRequestError(status) {
    return getRequestError(status);
}

export function getPublicBookingRequest(request, includeBooking = true) {
    return publicRequest(request, includeBooking);
}

const CANCELLABLE_BOOKED_STATUSES = ['approved', 'processing', 'awaiting_completion', 'confirmed'];

/** Finds the customer request that currently owns a booked date/time slot. */
export async function findBookingRequestBySlot(bookingDate, bookingTime) {
    const owner = await getBookingSlotOwner(bookingDate, bookingTime);
    if (!owner) return { owner: null, request: null };
    const ids = await redis.lrange(REQUEST_INDEX_KEY, 0, 999);
    for (const id of ids) {
        const request = await redis.get(requestKey(id));
        if (request?.reference === owner
            && request.booking?.bookingDate === bookingDate
            && request.booking?.bookingTime === bookingTime) {
            return { owner, request };
        }
    }
    return { owner, request: null };
}

/** Cancels the booked slot's records and frees the slot. Call only after the customer was emailed. */
export async function cancelBookedSlotRecords(request) {
    const current = await redis.get(requestKey(request.id));
    if (!current || !CANCELLABLE_BOOKED_STATUSES.includes(current.status)) {
        throw new Error('This booking has already changed. Refresh the calendar and try again.');
    }
    const result = await redis.eval(UPDATE_REQUEST_STATUS_SCRIPT, [
        requestKey(current.id),
        continuationLockKey(current.id),
        current.continuationTokenDigest
            ? continuationTokenKey(current.continuationTokenDigest)
            : 'booking:request-continuation:none',
    ], [
        current.status,
        'cancelled',
        new Date().toISOString(),
        '',
        '',
        '',
        String(REQUEST_TTL_SECONDS),
        '0',
    ]);
    if (result?.[0] !== 'OK') {
        throw new Error('This booking has already changed. Refresh the calendar and try again.');
    }
    const { bookingDate, bookingTime } = current.booking;
    await releaseBookingSlotIfOwned(bookingDate, bookingTime, current.reference);
    await Promise.all([
        markStoredBookingCancelled(current.reference),
        markStoredBookingCancelled(current.checkoutId),
    ]);
    return await loadSavedRecord(result[1], current.id);
}