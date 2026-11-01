import crypto from 'node:crypto';
import { redis } from './redis.js';
import { sendBookingApprovalEmail, sendBookingRequestSms } from './email.js';
import {
    confirmMonthlyWashReservation,
    getMonthlyReservationError,
    releaseMonthlyWashReservation,
    reserveMonthlyWash,
} from './monthly-promos.js';
import {
    BOOKING_SLOT_TIMES,
    claimUniqueReferenceNumber,
    looksLikeEmail,
    looksLikeVehicleRegistration,
    MONTHLY_PACKAGE_CENTS,
    normaliseEmail,
    normaliseReg,
    releaseBookingSlotIfOwned,
    reserveBookingSlot,
    SINGLE_WASH_CENTS,
} from './store.js';
import { getServiceAreaError } from './service-area.js';

const REQUEST_TTL_MS = 3 * 24 * 60 * 60 * 1000;
const REQUEST_INDEX_KEY = 'booking:approval:index';
const requestKey = (reference) => `booking:approval:${reference}`;
const tokenDigest = (token) => crypto.createHash('sha256').update(String(token)).digest('hex');
function encryptContinuationToken(token) {
    const secret = process.env.BOOKING_TOKEN_ENCRYPTION_KEY
        || process.env.ADMIN_API_KEY
        || process.env.CALENDAR_API_KEY;
    if (!secret) throw new Error('Booking continuation encryption is not configured.');
    const iv = crypto.randomBytes(12);
    const key = crypto.createHash('sha256').update(secret).digest();
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const ciphertext = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
    return [iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), ciphertext.toString('base64url')].join('.');
}
function decryptContinuationToken(value) {
    const secret = process.env.BOOKING_TOKEN_ENCRYPTION_KEY
        || process.env.ADMIN_API_KEY
        || process.env.CALENDAR_API_KEY;
    if (!secret) throw new Error('Booking continuation encryption is not configured.');
    const [iv, authTag, ciphertext] = String(value || '').split('.');
    const decipher = crypto.createDecipheriv(
        'aes-256-gcm',
        crypto.createHash('sha256').update(secret).digest(),
        Buffer.from(iv, 'base64url'),
    );
    decipher.setAuthTag(Buffer.from(authTag, 'base64url'));
    return Buffer.concat([
        decipher.update(Buffer.from(ciphertext, 'base64url')),
        decipher.final(),
    ]).toString('utf8');
}
const REQUEST_CREATE_SCRIPT = `
if redis.call('EXISTS', KEYS[1]) == 1 then return 'EXISTS' end
redis.call('SET', KEYS[1], ARGV[1])
redis.call('LPUSH', KEYS[2], ARGV[2])
return 'OK'
`;
const REQUEST_TRANSITION_SCRIPT = `
local raw = redis.call('GET', KEYS[1])
if not raw then return {'NOT_FOUND'} end
local request = cjson.decode(raw)
if request.status ~= ARGV[1] then return {'STATUS', request.status, raw} end
if tonumber(request.expiresAt) <= tonumber(ARGV[3]) then
  request.status = 'expired'
  request.updatedAt = ARGV[4]
  request.tokenHash = nil
  request.tokenCiphertext = nil
  if request.booking then
    request.booking.contractFileBase64 = nil
    request.booking.contractFileName = nil
    request.booking.promoCode = nil
  end
  request.events = request.events or {}
  table.insert(request.events, 1, {status = 'expired', at = ARGV[4]})
  redis.call('SET', KEYS[1], cjson.encode(request))
  return {'EXPIRED', cjson.encode(request)}
end
request.status = ARGV[2]
request.updatedAt = ARGV[4]
request.events = request.events or {}
table.insert(request.events, 1, {status = ARGV[2], at = ARGV[4], reason = ARGV[5]})
if ARGV[2] == 'declined' then
  request.tokenCiphertext = nil
  if request.booking then
    request.booking.contractFileBase64 = nil
    request.booking.contractFileName = nil
    request.booking.promoCode = nil
  end
end
if ARGV[6] ~= '' then request.checkoutUrl = ARGV[6] end
redis.call('SET', KEYS[1], cjson.encode(request))
return {'OK', cjson.encode(request)}
`;
const REQUEST_CHECKOUT_SAVE_SCRIPT = `
local raw = redis.call('GET', KEYS[1])
if not raw then return 'NOT_FOUND' end
local request = cjson.decode(raw)
if request.status ~= 'checkout_starting' then return request.status end
request.status = 'payment_pending'
request.checkoutUrl = ARGV[1]
request.yocoCheckoutId = ARGV[2]
request.updatedAt = ARGV[3]
request.events = request.events or {}
table.insert(request.events, 1, {status = 'payment_pending', at = ARGV[3]})
redis.call('SET', KEYS[1], cjson.encode(request))
return 'OK'
`;

function isValidDateAndTime(booking) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(booking.bookingDate || ''))
        || !BOOKING_SLOT_TIMES.includes(booking.bookingTime)) return false;
    const date = new Date(`${booking.bookingDate}T${booking.bookingTime}:00+02:00`);
    const now = Date.now();
    return Number.isFinite(date.getTime())
        && date.getTime() - now >= 3 * 60 * 60 * 1000
        && date.getTime() - now <= 90 * 24 * 60 * 60 * 1000
        && date.getDay() !== 0
        && date.getDay() !== 6;
}

function getPublicSiteUrl(reference, token) {
    const url = new URL(process.env.SITE_URL || 'https://sage00101.github.io/atd/');
    url.hash = '';
    url.searchParams.delete('monthly-checkout');
    url.searchParams.delete('clientType');
    url.searchParams.delete('packageTier');
    url.searchParams.delete('payment');
    url.searchParams.delete('ref');
    url.searchParams.set('booking-request', reference);
    url.searchParams.set('token', token);
    return url.toString();
}

function safeRequestForAdmin(request) {
    const { tokenHash, tokenCiphertext, booking, ...details } = request;
    return {
        ...details,
        customer: {
            firstName: booking.customer?.firstName || '',
            surname: booking.customer?.surname || '',
            email: booking.customer?.email || '',
            mobile: booking.customer?.mobile || '',
            registration: normaliseReg(booking.customer?.registration),
        },
        customerType: booking.monthlyClientType === 'business' ? 'Business / Fleet / Family'
            : booking.monthlyClientType === 'private' ? 'Private Client' : null,
        monthlyPackageTier: booking.monthlyPackageTier || null,
        monthlyAllowance: request.monthlyReservation?.monthlyAllowance || null,
        packageName: booking.packageName || '',
        vehicleType: booking.vehicleType || '',
        bookingDate: booking.bookingDate,
        bookingTime: booking.bookingTime,
    };
}

async function saveRequest(request) {
    const result = await redis.eval(REQUEST_CREATE_SCRIPT, [
        requestKey(request.reference),
        REQUEST_INDEX_KEY,
    ], [JSON.stringify(request), request.reference]);
    if (result !== 'OK') throw new Error('Could not save the booking request.');
}

async function releaseRequestReservations(request) {
    await releaseBookingSlotIfOwned(request.booking.bookingDate, request.booking.bookingTime, request.reference);
    if (request.monthlyReservation) {
        await releaseMonthlyWashReservation(request.monthlyReservation);
    }
}

async function expireRequestIfNeeded(request) {
    if (['pending', 'approved', 'checkout_starting', 'payment_pending'].includes(request.status)
        && Number(request.expiresAt) <= Date.now()) {
        const result = await redis.eval(REQUEST_TRANSITION_SCRIPT, [requestKey(request.reference)], [
            request.status,
            'expired',
            String(Date.now()),
            new Date().toISOString(),
            '',
            '',
            '',
            '',
        ]);
        if (result?.[0] === 'OK' || result?.[0] === 'EXPIRED') {
            await releaseRequestReservations(request);
            return { ...request, status: 'expired' };
        }
        return result?.[2] ? JSON.parse(result[2]) : request;
    }
    return request;
}

async function getValidRequest(reference, token) {
    if (!/^[A-Za-z0-9-]{6,80}$/.test(String(reference || '')) || !token) return null;
    const request = await redis.get(requestKey(reference));
    if (!request) return null;
    const expected = Buffer.from(request.tokenHash || '', 'hex');
    const supplied = Buffer.from(tokenDigest(token), 'hex');
    if (expected.length !== supplied.length || !crypto.timingSafeEqual(expected, supplied)) return null;
    const currentRequest = await expireRequestIfNeeded(request);
    return Number(currentRequest.expiresAt) > Date.now() ? currentRequest : null;
}

export async function createBookingApprovalRequest(bookingInput, contractFile = null) {
    const booking = {
        ...bookingInput,
        customer: {
            ...bookingInput.customer,
            email: normaliseEmail(bookingInput.customer?.email),
            registration: normaliseReg(bookingInput.customer?.registration),
        },
    };
    if (!booking.serviceAreaAccepted || !booking.termsAccepted) {
        throw new Error('Required booking confirmations are missing.');
    }
    if (!looksLikeEmail(booking.customer.email)
        || !String(booking.customer.firstName || '').trim()
        || !String(booking.customer.surname || '').trim()
        || !String(booking.customer.mobile || '').trim()
        || !looksLikeVehicleRegistration(booking.customer.registration)) {
        throw new Error('Enter your name, valid contact details and vehicle registration.');
    }
    if (!isValidDateAndTime(booking)) {
        throw new Error('Choose an available weekday slot at least 3 hours ahead and within the next 90 days.');
    }
    const areaError = getServiceAreaError(booking.serviceLocation, booking.customer.address);
    if (areaError) throw new Error(areaError);
    if (!['single', 'monthly'].includes(booking.purchaseType)) {
        throw new Error('Choose a valid booking package.');
    }
    if (booking.bookingType && booking.bookingType !== 'monthly-entitlement') {
        throw new Error('Unknown booking type.');
    }
    if (booking.bookingType === 'monthly-entitlement'
        && (!['private', 'business'].includes(booking.monthlyClientType)
            || !['standard', 'premium'].includes(booking.monthlyPackageTier)
            || !String(booking.promoCode || '').trim())) {
        throw new Error('Select your monthly package and enter its assigned monthly code.');
    }
    if (booking.bookingType === 'monthly-entitlement' && booking.purchaseType !== 'single') {
        throw new Error('Monthly entitlement bookings must use the single-wash service option.');
    }
    if (booking.purchaseType === 'monthly') {
        if (!MONTHLY_PACKAGE_CENTS[booking.packageId]?.[booking.vehicleType]) {
            throw new Error('Choose a valid monthly package and vehicle category.');
        }
    } else if (!SINGLE_WASH_CENTS[booking.vehicleType]) {
        throw new Error('Choose a valid single-wash vehicle category.');
    }
    if (booking.paymentMethod && !['online', 'onsite'].includes(booking.paymentMethod)) {
        throw new Error('Choose a valid payment method.');
    }
    if (booking.purchaseType === 'monthly') {
        if (!booking.contractAccepted || !contractFile) {
            throw new Error('Attach the completed monthly contract before requesting approval.');
        }
        booking.contractFileBase64 = contractFile.base64;
        booking.contractFileName = contractFile.name;
    }

    const reference = await claimUniqueReferenceNumber();
    const continuationToken = crypto.randomBytes(32).toString('base64url');
    const expiresAt = Date.now() + REQUEST_TTL_MS;
    const slotReserved = await reserveBookingSlot(booking.bookingDate, booking.bookingTime, reference);
    if (!slotReserved) throw new Error('That time slot was just booked by someone else. Please choose another.');

    let reservedMonthly = null;
    try {
        if (booking.bookingType === 'monthly-entitlement') {
            const result = await reserveMonthlyWash({
                promoCode: booking.promoCode,
                email: booking.customer.email,
                bookingDate: booking.bookingDate,
                reservationId: reference,
                reference,
                expectedClientType: booking.monthlyClientType,
                expectedPackageTier: booking.monthlyPackageTier,
                bookingDetails: {
                    customerName: `${booking.customer.firstName} ${booking.customer.surname}`.trim(),
                    vehicleType: booking.vehicleType,
                },
            });
            if (result.status !== 'OK') {
                const reservationError = getMonthlyReservationError(result.status);
                const error = new Error(reservationError.message);
                error.statusCode = reservationError.statusCode;
                throw error;
            }
            reservedMonthly = {
                entitlementId: result.entitlement.id,
                period: result.period,
                reservationId: reference,
                clientType: result.entitlement.clientType,
                packageTier: result.entitlement.packageTier,
                monthlyAllowance: result.entitlement.monthlyAllowance,
            };
            booking.monthlyEntitlementId = result.entitlement.id;
            booking.monthlyUsagePeriod = result.period;
            booking.monthlyAllowance = result.entitlement.monthlyAllowance;
            booking.promoCodeReference = result.entitlement.id.slice(0, 8).toUpperCase();
            booking.promoCode = null;
        }
        const createdAt = new Date().toISOString();
        const request = {
            reference,
            tokenHash: tokenDigest(continuationToken),
            tokenCiphertext: encryptContinuationToken(continuationToken),
            status: 'pending',
            createdAt,
            updatedAt: createdAt,
            expiresAt,
            booking,
            monthlyReservation: reservedMonthly,
            paymentMethod: booking.paymentMethod === 'onsite' ? 'onsite' : 'online',
            events: [{ status: 'pending', at: createdAt }],
        };
        await saveRequest(request);
        const continuationUrl = getPublicSiteUrl(reference, continuationToken);
        let notificationError = null;
        let smsNotificationError = null;
        let notificationResult = null;
        try {
            notificationResult = await sendBookingApprovalEmail(request, continuationUrl, 'pending');
            if (notificationResult.failed) notificationError = 'Some booking request emails could not be sent.';
        } catch (error) {
            notificationError = error instanceof Error ? error.message : 'Booking request email could not be sent.';
            console.error('[booking request notification failed]', reference, error);
        }
        try {
            await sendBookingRequestSms(request);
        } catch (error) {
            smsNotificationError = 'Business SMS notification failed.';
            console.error('[booking request SMS failed]', reference, error);
        }
        return {
            reference,
            status: 'pending',
            expiresAt,
            continuationUrl,
            notificationSent: !notificationError,
            notificationError,
            smsNotificationError,
        };
    } catch (error) {
        if (reservedMonthly) await releaseMonthlyWashReservation(reservedMonthly);
        await releaseBookingSlotIfOwned(booking.bookingDate, booking.bookingTime, reference);
        throw error;
    }
}

export async function getBookingRequestStatus(reference, token) {
    const request = await getValidRequest(reference, token);
    if (!request) return null;
    return {
        reference: request.reference,
        status: request.status,
        expiresAt: request.expiresAt,
        paymentMethod: request.paymentMethod,
        bookingType: request.booking.bookingType || 'single',
        customerName: `${request.booking.customer.firstName} ${request.booking.customer.surname}`.trim(),
        bookingDate: request.booking.bookingDate,
        bookingTime: request.booking.bookingTime,
        checkoutUrl: request.status === 'payment_pending' ? request.checkoutUrl : null,
        message: request.status === 'pending' ? 'Your request is waiting for business approval.'
            : request.status === 'approved' ? 'Your request is approved. Continue to complete the booking.'
                : request.status === 'checkout_starting' ? 'Your secure checkout is being prepared.'
                : request.status === 'payment_pending' ? 'Your approved booking is waiting for payment.'
                    : request.status === 'confirmed' ? 'Your booking is confirmed.'
                        : request.status === 'declined' ? 'This booking request was declined.'
                            : 'This booking request has expired.',
    };
}

export async function authorizeBookingContinuation(reference, token) {
    const request = await getValidRequest(reference, token);
    if (!request) return { error: 'This booking link is invalid or has expired.' };
    if (request.status !== 'approved') return { error: 'This booking request is not approved or has already been processed.' };
    return { request };
}

export async function startBookingRequestCheckout(reference, token) {
    const authorization = await authorizeBookingContinuation(reference, token);
    if (authorization.error) throw new Error(authorization.error);
    const transition = await redis.eval(REQUEST_TRANSITION_SCRIPT, [requestKey(reference)], [
        'approved',
        'checkout_starting',
        String(Date.now()),
        new Date().toISOString(),
        '',
        '',
        '',
    ]);
    if (transition?.[0] === 'OK') return JSON.parse(transition[1]);
    throw new Error('This approved booking is already being processed. Refresh this page in a moment.');
}

export async function saveBookingRequestCheckout(reference, checkoutUrl, checkoutId) {
    const result = await redis.eval(REQUEST_CHECKOUT_SAVE_SCRIPT, [requestKey(reference)], [
        checkoutUrl,
        checkoutId,
        new Date().toISOString(),
    ]);
    if (result !== 'OK') throw new Error('Could not link the secure payment session to this booking request.');
}

export async function resetBookingRequestCheckout(reference) {
    const result = await redis.eval(REQUEST_TRANSITION_SCRIPT, [requestKey(reference)], [
        'checkout_starting',
        'approved',
        String(Date.now()),
        new Date().toISOString(),
        '',
        '',
        '',
    ]);
    return result?.[0] === 'OK';
}

export async function markBookingRequestConfirmed(reference) {
    const request = await redis.get(requestKey(reference));
    if (!request || ['confirmed', 'declined', 'expired'].includes(request.status)) return request;
    const updated = {
        ...request,
        status: 'confirmed',
        tokenCiphertext: null,
        booking: {
            ...request.booking,
            contractFileBase64: null,
            contractFileName: null,
            promoCode: null,
        },
        updatedAt: new Date().toISOString(),
        events: [{ status: 'confirmed', at: new Date().toISOString() }, ...(request.events || [])],
    };
    await redis.set(requestKey(reference), updated);
    return updated;
}

export async function markBookingRequestPaymentFailed(reference) {
    const request = await redis.get(requestKey(reference));
    if (!request || request.status !== 'payment_pending') return false;
    const updated = {
        ...request,
        status: 'approved',
        checkoutUrl: null,
        updatedAt: new Date().toISOString(),
        events: [{ status: 'payment_failed', at: new Date().toISOString() }, ...(request.events || [])],
    };
    await redis.set(requestKey(reference), updated);
    return true;
}

export async function getBookingRequestsForAdmin() {
    const references = await redis.lrange(REQUEST_INDEX_KEY, 0, 199);
    const requests = await Promise.all(references.map((reference) => redis.get(requestKey(reference))));
    const current = [];
    for (const request of requests.filter(Boolean)) {
        current.push(await expireRequestIfNeeded(request));
    }
    return current.map(safeRequestForAdmin);
}

export async function transitionBookingRequest(reference, action, reason = '') {
    if (!['approve', 'decline'].includes(action)) throw new Error('Unknown booking request action.');
    const request = await redis.get(requestKey(reference));
    if (!request) throw new Error('Booking request not found.');
    const now = new Date();
    const nextStatus = action === 'approve' ? 'approved' : 'declined';
    const transition = await redis.eval(REQUEST_TRANSITION_SCRIPT, [requestKey(reference)], [
        'pending',
        nextStatus,
        String(now.getTime()),
        now.toISOString(),
        String(reason || '').trim().slice(0, 500),
        '',
    ]);
    if (transition?.[0] === 'EXPIRED') {
        await releaseRequestReservations(request);
        throw new Error('This request has expired and its temporary reservations were released.');
    }
    if (transition?.[0] !== 'OK') {
        const status = transition?.[1] || request.status;
        throw new Error(`This request is no longer pending approval (${status}).`);
    }
    const updated = JSON.parse(transition[1]);
    if (action === 'decline') await releaseRequestReservations(request);
    try {
        const continuationUrl = action === 'approve'
            ? getPublicSiteUrl(reference, decryptContinuationToken(request.tokenCiphertext))
            : null;
        const delivery = await sendBookingApprovalEmail(updated, continuationUrl, nextStatus);
        updated.notificationError = delivery.failed ? 'Some decision emails could not be sent.' : null;
    } catch (error) {
        console.error('[booking request decision email failed]', reference, error);
        updated.notificationError = error instanceof Error ? error.message : 'Decision email could not be sent.';
        await redis.set(requestKey(reference), updated);
    }
    return safeRequestForAdmin(updated);
}

export async function getStoredBookingRequest(reference) {
    return redis.get(requestKey(reference));
}

export async function completeMonthlyBookingRequest(request, booking) {
    const reservation = request.monthlyReservation;
    if (!reservation) throw new Error('The approved monthly booking has no active wash reservation.');
    const result = await confirmMonthlyWashReservation({
        ...reservation,
        reference: request.reference,
        booking,
    });
    if (result !== 'OK' && result !== 'DUPLICATE') {
        const error = getMonthlyReservationError(result);
        throw new Error(error.message);
    }
    await markBookingRequestConfirmed(request.reference);
    return result;
}
