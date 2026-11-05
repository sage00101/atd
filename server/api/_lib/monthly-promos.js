import crypto from 'node:crypto';
import { redis } from './redis.js';
import { looksLikeEmail, normaliseEmail, normaliseReg } from './store.js';
import { sendMonthlyAccessCodeEmail, sendMonthlyDistributionReport } from './email.js';

const ENTITLEMENT_INDEX_KEY = 'promo:monthly:entitlements';
const MONTHLY_RESERVATION_TTL_SECONDS = 60 * 60 * 24 * 3;
const CONFIRMED_BOOKING_TTL_SECONDS = 60 * 60 * 24 * 365;
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const EMAIL_HISTORY_LIMIT = 50;
const MONTHLY_EMAIL_BATCH_SIZE = 4;
const EMAIL_RECORD_TTL_SECONDS = 60 * 60 * 24 * 365;
const EMAIL_RUN_TTL_SECONDS = 60 * 60 * 24 * 180;

const digest = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');
const entitlementKey = (id) => `promo:monthly:entitlement:${id}`;
const customerKey = (email) => `promo:monthly:customer:${digest(normaliseEmail(email))}`;
const codeKey = (code) => `promo:monthly:code:${digest(String(code).trim().toUpperCase())}`;
const periodUsageKey = (id, period) => `promo:monthly:used:${id}:${period}`;
const periodReservationsKey = (id, period) => `promo:monthly:reservations:${id}:${period}`;
const allReservationsKey = (id) => `promo:monthly:reservations:${id}`;
const reservationKey = (id) => `promo:monthly:reservation:${id}`;
const historyKey = (id) => `promo:monthly:history:${id}`;
const confirmedBookingKey = (reference) => `promo:monthly:confirmed:${reference}`;
const purchaseKey = (reference) => `promo:monthly:purchase:${reference}`;
const pendingPurchaseKey = (reference) => `promo:monthly:purchase:pending:${reference}`;
const pendingPurchaseIndexKey = 'promo:monthly:purchase:pending';
const bookingKey = (reference) => `booking:${reference}`;
const bookingSlotKey = (date, time) => `booking-slot:${date}:${time}`;
const emailDispatchKey = (id) => `promo:monthly:email:dispatch:${id}`;
const emailDispatchIndexKey = (id) => `promo:monthly:email:client:${id}`;
const emailIdIndexKey = (id) => `promo:monthly:email:provider:${id}`;
const emailRunKey = (id) => `promo:monthly:email:run:${id}`;
const emailRunsIndexKey = 'promo:monthly:email:runs';
const emailRunLockKey = (id) => `promo:monthly:email:run-lock:${id}`;
const emailDedupeKey = (id) => `promo:monthly:email:dedupe:${digest(id)}`;
const emailEventKey = (id) => `promo:monthly:email:event:${digest(id)}`;

const CREATE_ENTITLEMENT_SCRIPT = `
if redis.call('EXISTS', KEYS[1]) == 1 then return 'ID_EXISTS' end
if redis.call('EXISTS', KEYS[3]) == 1 then return 'EMAIL_EXISTS' end
if redis.call('EXISTS', KEYS[4]) == 1 then return 'CODE_EXISTS' end
redis.call('SET', KEYS[1], ARGV[1])
redis.call('SADD', KEYS[2], ARGV[2])
redis.call('SET', KEYS[3], ARGV[2])
redis.call('SET', KEYS[4], ARGV[2])
return 'OK'
`;

const CREATE_PAID_ENTITLEMENT_SCRIPT = `
local existingPurchase = redis.call('GET', KEYS[5])
if existingPurchase then return {'PURCHASE_EXISTS', existingPurchase} end
local existingCustomer = redis.call('GET', KEYS[3])
if existingCustomer then
  local pending = cjson.decode(ARGV[3])
  pending.status = 'needs_manager'
  redis.call('SET', KEYS[5], 'pending:' .. pending.reference)
  redis.call('SET', KEYS[6], cjson.encode(pending))
  redis.call('LPUSH', KEYS[7], pending.reference)
  return {'EMAIL_EXISTS', existingCustomer}
end
if redis.call('EXISTS', KEYS[4]) == 1 then return {'CODE_EXISTS'} end
redis.call('SET', KEYS[1], ARGV[1])
redis.call('SADD', KEYS[2], ARGV[2])
redis.call('SET', KEYS[3], ARGV[2])
redis.call('SET', KEYS[4], ARGV[2])
redis.call('SET', KEYS[5], ARGV[2])
return {'OK'}
`;

const GENERATE_ENTITLEMENT_CODE_SCRIPT = `
local raw = redis.call('GET', KEYS[1])
if not raw then return {'NOT_FOUND'} end
local existing = cjson.decode(raw)
if existing.archived then return {'ARCHIVED'} end
if not existing.active then return {'INACTIVE'} end
if redis.call('EXISTS', KEYS[2]) == 1 then return {'CODE_EXISTS'} end
local entitlement = existing
local code = cjson.decode(ARGV[1])
entitlement.codes = entitlement.codes or {}
entitlement.codeDigests = entitlement.codeDigests or {}
if #entitlement.codeDigests == 0 and entitlement.currentCodeDigest then
  table.insert(entitlement.codeDigests, entitlement.currentCodeDigest)
  if entitlement.code then
    table.insert(entitlement.codes, {code = entitlement.code, digest = entitlement.currentCodeDigest, createdAt = entitlement.createdAt})
  end
end
table.insert(entitlement.codes, code)
table.insert(entitlement.codeDigests, code.digest)
entitlement.code = code.code
entitlement.currentCodeDigest = code.digest
entitlement.updatedAt = code.createdAt
entitlement.auditHistory = entitlement.auditHistory or {}
table.insert(entitlement.auditHistory, 1, {action = 'code_generated', createdAt = code.createdAt})
redis.call('SET', KEYS[1], cjson.encode(entitlement))
redis.call('SET', KEYS[2], ARGV[2])
return {'OK', cjson.encode(entitlement)}
`;

const UPDATE_ENTITLEMENT_SCRIPT = `
if redis.call('EXISTS', KEYS[1]) == 0 then return 'NOT_FOUND' end
local existing = cjson.decode(redis.call('GET', KEYS[1]))
local nextRecord = cjson.decode(ARGV[1])
local auditEntry = cjson.decode(ARGV[4])
if KEYS[2] ~= KEYS[3] then
  local owner = redis.call('GET', KEYS[3])
  if owner and owner ~= ARGV[2] then return 'EMAIL_EXISTS' end
end
if ARGV[3] == '1' then
  if redis.call('EXISTS', KEYS[4]) == 1 then return 'CODE_EXISTS' end
  redis.call('SET', KEYS[4], ARGV[2])
end
if ARGV[6] == '1' then
  for _, codeDigest in ipairs(existing.codeDigests or {}) do
    redis.call('DEL', 'promo:monthly:code:' .. codeDigest)
  end
  if existing.currentCodeDigest then
    redis.call('DEL', 'promo:monthly:code:' .. existing.currentCodeDigest)
  end
end
if KEYS[2] ~= KEYS[3] then
  redis.call('SET', KEYS[3], ARGV[2])
  if redis.call('GET', KEYS[2]) == ARGV[2] then redis.call('DEL', KEYS[2]) end
end
nextRecord.auditHistory = existing.auditHistory or {}
if auditEntry then table.insert(nextRecord.auditHistory, 1, auditEntry) end
nextRecord.emailHistory = existing.emailHistory or {}
nextRecord.codeHistory = existing.codeHistory or {}
if ARGV[3] == '1' then
  table.insert(nextRecord.codeHistory, 1, {code = ARGV[5], replacedAt = auditEntry.createdAt})
end
redis.call('SET', KEYS[1], cjson.encode(nextRecord))
return 'OK'
`;

const RECORD_MONTHLY_PAYMENT_SCRIPT = `
local raw = redis.call('GET', KEYS[1])
if not raw then return {'NOT_FOUND'} end
local entitlement = cjson.decode(raw)
if entitlement.updatedAt ~= ARGV[1] then return {'STALE'} end
if entitlement.archived then return {'ARCHIVED'} end
if not entitlement.active then return {'INACTIVE'} end
if redis.call('EXISTS', KEYS[5]) == 1 then return {'CODE_EXISTS'} end
local existingPurchase = redis.call('GET', KEYS[2])
if existingPurchase == entitlement.id then return {'DUPLICATE'} end
if existingPurchase and existingPurchase ~= 'pending:' .. ARGV[7] then return {'PURCHASE_EXISTS'} end
local pendingRaw = redis.call('GET', KEYS[3])
if existingPurchase and not pendingRaw then return {'PURCHASE_NOT_FOUND'} end
if pendingRaw then
  local pending = cjson.decode(pendingRaw)
  if pending.reference ~= ARGV[7] or pending.email ~= entitlement.email then return {'PURCHASE_MISMATCH'} end
  if pending.clientType ~= entitlement.clientType or pending.packageTier ~= entitlement.packageTier then return {'PACKAGE_MISMATCH'} end
end
local allowance = tonumber(entitlement.monthlyAllowance)
if not allowance or allowance < 1 then return {'INVALID_ALLOWANCE'} end
entitlement.creditsAvailable = tonumber(entitlement.creditsAvailable or 0) + allowance
entitlement.creditsGrantedTotal = tonumber(entitlement.creditsGrantedTotal or allowance) + allowance
entitlement.creditsUsedTotal = tonumber(entitlement.creditsUsedTotal or 0)
entitlement.creditsReserved = tonumber(entitlement.creditsReserved or 0)
entitlement.billingAnchor = ARGV[8]
entitlement.billingCyclesPaid = tonumber(ARGV[9])
entitlement.validUntil = ARGV[10]
entitlement.lastPaidAt = ARGV[4]
entitlement.updatedAt = ARGV[12]
entitlement.paymentHistory = entitlement.paymentHistory or {}
table.insert(entitlement.paymentHistory, 1, cjson.decode(ARGV[5]))
local code = cjson.decode(ARGV[11])
entitlement.codes = entitlement.codes or {}
entitlement.codeDigests = entitlement.codeDigests or {}
table.insert(entitlement.codes, code)
table.insert(entitlement.codeDigests, code.digest)
entitlement.code = code.code
entitlement.currentCodeDigest = code.digest
entitlement.auditHistory = entitlement.auditHistory or {}
table.insert(entitlement.auditHistory, 1, cjson.decode(ARGV[6]))
while #entitlement.auditHistory > 50 do table.remove(entitlement.auditHistory) end
redis.call('SET', KEYS[1], cjson.encode(entitlement))
redis.call('SET', KEYS[2], entitlement.id)
redis.call('SET', KEYS[5], entitlement.id)
if pendingRaw then
  redis.call('DEL', KEYS[3])
  redis.call('LREM', KEYS[4], 0, ARGV[7])
end
return {'OK', cjson.encode(entitlement)}
`;

const ENSURE_CREDIT_LEDGER_SCRIPT = `
local raw = redis.call('GET', KEYS[1])
if not raw then return {'NOT_FOUND'} end
local entitlement = cjson.decode(raw)
if entitlement.creditsAvailable ~= nil and entitlement.creditsReserved ~= nil then return {'OK', raw} end
local allowance = tonumber(entitlement.monthlyAllowance)
if not allowance or allowance < 1 then return {'INVALID_ALLOWANCE'} end
local used = redis.call('SCARD', KEYS[2])
local reserved = redis.call('ZCARD', KEYS[3])
entitlement.creditsAvailable = tonumber(entitlement.creditsAvailable or math.max(allowance - used - reserved, 0))
entitlement.creditsReserved = tonumber(entitlement.creditsReserved or reserved)
entitlement.creditsUsedTotal = tonumber(entitlement.creditsUsedTotal or used)
entitlement.creditsGrantedTotal = tonumber(entitlement.creditsGrantedTotal or math.max(allowance, used + reserved))
entitlement.billingAnchor = entitlement.billingAnchor or entitlement.validFrom or ARGV[1]
entitlement.billingCyclesPaid = tonumber(entitlement.billingCyclesPaid or 1)
entitlement.updatedAt = ARGV[2]
local encoded = cjson.encode(entitlement)
redis.call('SET', KEYS[1], encoded)
return {'OK', encoded}
`;

const CLEAN_EXPIRED_RESERVATIONS_SCRIPT = `
local raw = redis.call('GET', KEYS[1])
if not raw then return 0 end
local entitlement = cjson.decode(raw)
local expiredIds = redis.call('ZRANGEBYSCORE', KEYS[2], '-inf', ARGV[1])
local changed = false
for _, reservationId in ipairs(expiredIds) do
  local reservationKey = 'promo:monthly:reservation:' .. reservationId
  local reservationRaw = redis.call('GET', reservationKey)
  if reservationRaw then
    local reservation = cjson.decode(reservationRaw)
    if reservation.entitlementId == entitlement.id then
      redis.call('ZREM', 'promo:monthly:reservations:' .. entitlement.id .. ':' .. reservation.period, reservationId)
      redis.call('DEL', reservationKey)
    end
  end
  entitlement.creditsAvailable = tonumber(entitlement.creditsAvailable or 0) + 1
  entitlement.creditsReserved = math.max(tonumber(entitlement.creditsReserved or 0) - 1, 0)
  changed = true
  redis.call('ZREM', KEYS[2], reservationId)
end
if changed then
  entitlement.updatedAt = ARGV[2]
  redis.call('SET', KEYS[1], cjson.encode(entitlement))
end
return #expiredIds
`;

const CREATE_EMAIL_DISPATCH_SCRIPT = `
local existing = redis.call('GET', KEYS[3])
if existing then return {'DUPLICATE', existing} end
redis.call('SET', KEYS[3], ARGV[1], 'EX', ARGV[2], 'NX')
if redis.call('GET', KEYS[3]) ~= ARGV[1] then
  return {'DUPLICATE', redis.call('GET', KEYS[3])}
end
redis.call('SET', KEYS[1], ARGV[3], 'EX', ARGV[5])
redis.call('LPUSH', KEYS[2], ARGV[1])
redis.call('LTRIM', KEYS[2], 0, ARGV[4] - 1)
return {'CREATED', ARGV[1]}
`;

const SAVE_EMAIL_DELIVERY_SCRIPT = `
local raw = redis.call('GET', KEYS[1])
if not raw then return 'NOT_FOUND' end
local dispatch = cjson.decode(raw)
local incoming = cjson.decode(ARGV[1])
if dispatch.status == 'delivered' then return 'OK' end
if incoming.status == 'delivered' or incoming.status == 'failed' or dispatch.status == 'sending' then
  dispatch.status = incoming.status
end
if incoming.providerEmailId then dispatch.providerEmailId = incoming.providerEmailId end
if incoming.providerStatus then dispatch.providerStatus = incoming.providerStatus end
if incoming.updatedAt then dispatch.updatedAt = incoming.updatedAt end
if incoming.failureReason then dispatch.failureReason = incoming.failureReason end
dispatch.events = dispatch.events or {}
if incoming.event then table.insert(dispatch.events, 1, incoming.event) end
while #dispatch.events > 50 do table.remove(dispatch.events) end
redis.call('SET', KEYS[1], cjson.encode(dispatch), 'EX', ARGV[2])
if dispatch.providerEmailId then redis.call('SET', KEYS[2], dispatch.id) end
return 'OK'
`;

const APPLY_RESEND_EVENT_SCRIPT = `
if redis.call('EXISTS', KEYS[3]) == 1 then return 'DUPLICATE' end
redis.call('SET', KEYS[3], '1', 'EX', ARGV[1])
local raw = redis.call('GET', KEYS[1])
if not raw then return 'NOT_FOUND' end
local dispatch = cjson.decode(raw)
local event = cjson.decode(ARGV[2])
if event.status == 'delivered' or dispatch.status ~= 'delivered' then
  dispatch.status = event.status
end
dispatch.providerStatus = event.providerStatus
dispatch.updatedAt = event.occurredAt
dispatch.events = dispatch.events or {}
table.insert(dispatch.events, 1, event)
while #dispatch.events > 50 do table.remove(dispatch.events) end
redis.call('SET', KEYS[1], cjson.encode(dispatch), 'EX', ARGV[3])
return 'OK'
`;

const RESERVE_WASH_SCRIPT = `
local raw = redis.call('GET', KEYS[1])
if not raw then return {'NOT_FOUND'} end
local entitlement = cjson.decode(raw)
local codeValid = entitlement.currentCodeDigest == ARGV[1]
if entitlement.codeDigests then
  codeValid = false
  for _, codeDigest in ipairs(entitlement.codeDigests) do
    if codeDigest == ARGV[1] then codeValid = true; break end
  end
end
if not codeValid then return {'REPLACED'} end
if entitlement.archived then return {'ARCHIVED'} end
if not entitlement.active then return {'INACTIVE'} end
if entitlement.email ~= ARGV[2] then return {'EMAIL_MISMATCH'} end
if ARGV[10] ~= '' and entitlement.clientType ~= ARGV[10] then return {'CLIENT_TYPE_MISMATCH'} end
if ARGV[11] ~= '' and entitlement.packageTier ~= ARGV[11] then return {'PACKAGE_MISMATCH'} end
if entitlement.validFrom and entitlement.validFrom ~= cjson.null and ARGV[3] < entitlement.validFrom then return {'NOT_YET_VALID'} end
if entitlement.validUntil and entitlement.validUntil ~= cjson.null and ARGV[3] > entitlement.validUntil then return {'EXPIRED'} end
local allowance = tonumber(entitlement.monthlyAllowance)
if not allowance or allowance < 1 then return {'INVALID_ALLOWANCE'} end
if redis.call('SISMEMBER', KEYS[2], ARGV[4]) == 1 then return {'ALREADY_USED'} end
if redis.call('EXISTS', KEYS[4]) == 1 then return {'ALREADY_RESERVED'} end
local expiredReservations = redis.call('ZRANGEBYSCORE', KEYS[5], '-inf', ARGV[5])
for _, expiredId in ipairs(expiredReservations) do
  local expiredRaw = redis.call('GET', 'promo:monthly:reservation:' .. expiredId)
  if expiredRaw then
    local expired = cjson.decode(expiredRaw)
    if expired.entitlementId == entitlement.id then
      local oldPeriodKey = 'promo:monthly:reservations:' .. entitlement.id .. ':' .. expired.period
      redis.call('ZREM', oldPeriodKey, expiredId)
      redis.call('DEL', 'promo:monthly:reservation:' .. expiredId)
    end
  end
  entitlement.creditsAvailable = tonumber(entitlement.creditsAvailable or 0) + 1
  entitlement.creditsReserved = math.max(tonumber(entitlement.creditsReserved or 0) - 1, 0)
  redis.call('ZREM', KEYS[5], expiredId)
end
local existingReservations = redis.call('ZRANGE', KEYS[3], 0, -1, 'WITHSCORES')
for index = 1, #existingReservations, 2 do
  redis.call('ZADD', KEYS[5], existingReservations[index + 1], existingReservations[index])
end
entitlement.updatedAt = ARGV[12]
redis.call('SET', KEYS[1], cjson.encode(entitlement))
local used = redis.call('SCARD', KEYS[2])
local reserved = redis.call('ZCARD', KEYS[3])
if used + reserved >= allowance then return {'LIMIT_REACHED', tostring(allowance), tostring(used), tostring(reserved)} end
local creditsAvailable = tonumber(entitlement.creditsAvailable)
if not creditsAvailable then creditsAvailable = math.max(allowance - used - reserved, 0) end
if creditsAvailable < 1 then return {'CREDITS_EXHAUSTED', tostring(allowance), tostring(used), tostring(reserved)} end
entitlement.creditsAvailable = creditsAvailable - 1
entitlement.creditsReserved = tonumber(entitlement.creditsReserved or reserved) + 1
entitlement.creditsGrantedTotal = tonumber(entitlement.creditsGrantedTotal or allowance)
entitlement.creditsUsedTotal = tonumber(entitlement.creditsUsedTotal or used)
entitlement.billingAnchor = entitlement.billingAnchor or entitlement.validFrom or ARGV[3]
entitlement.updatedAt = ARGV[12]
redis.call('ZADD', KEYS[3], ARGV[6], ARGV[7])
redis.call('ZADD', KEYS[5], ARGV[6], ARGV[7])
redis.call('EXPIRE', KEYS[3], ARGV[9] + 86400)
redis.call('SET', KEYS[4], ARGV[8], 'EX', ARGV[9], 'NX')
redis.call('SET', KEYS[1], cjson.encode(entitlement))
return {'OK', tostring(allowance), tostring(used), tostring(reserved + 1), tostring(entitlement.creditsAvailable)}
`;

const RELEASE_WASH_SCRIPT = `
local raw = redis.call('GET', KEYS[1])
if not raw then return 0 end
local reservation = cjson.decode(raw)
if reservation.reservationId ~= ARGV[1] then return 0 end
redis.call('ZREM', KEYS[2], ARGV[1])
redis.call('ZREM', KEYS[3], ARGV[1])
redis.call('ZREM', KEYS[5], ARGV[1])
local entitlementRaw = redis.call('GET', KEYS[4])
if entitlementRaw then
  local entitlement = cjson.decode(entitlementRaw)
  local creditsReserved = tonumber(entitlement.creditsReserved)
  if creditsReserved and creditsReserved > 0 then
    entitlement.creditsReserved = creditsReserved - 1
    entitlement.creditsAvailable = tonumber(entitlement.creditsAvailable or 0) + 1
    entitlement.updatedAt = ARGV[2]
    redis.call('SET', KEYS[4], cjson.encode(entitlement))
  end
end
redis.call('DEL', KEYS[1])
return 1
`;

const CONFIRM_WASH_SCRIPT = `
if redis.call('EXISTS', KEYS[8]) == 1 then return 'DUPLICATE' end
if redis.call('SISMEMBER', KEYS[2], ARGV[2]) == 1 then return 'DUPLICATE' end
local entitlementRaw = redis.call('GET', KEYS[1])
if not entitlementRaw then return 'INACTIVE' end
local entitlement = cjson.decode(entitlementRaw)
local raw = redis.call('GET', KEYS[4])
if not raw then return 'RESERVATION_LOST' end
local reservation = cjson.decode(raw)
if reservation.reservationId ~= ARGV[1] then return 'RESERVATION_LOST' end
local codeValid = entitlement.currentCodeDigest == reservation.codeDigest
if entitlement.codeDigests then
  codeValid = false
  for _, codeDigest in ipairs(entitlement.codeDigests) do
    if codeDigest == reservation.codeDigest then codeValid = true; break end
  end
end
if not codeValid then return 'REPLACED' end
if entitlement.email ~= reservation.email then return 'EMAIL_MISMATCH' end
if entitlement.clientType ~= reservation.clientType then return 'CLIENT_TYPE_MISMATCH' end
if entitlement.packageTier ~= reservation.packageTier then return 'PACKAGE_MISMATCH' end
if entitlement.archived then return 'ARCHIVED' end
if not entitlement.active then return 'INACTIVE' end
if entitlement.validFrom and entitlement.validFrom ~= cjson.null and reservation.bookingDate < entitlement.validFrom then return 'NOT_YET_VALID' end
if entitlement.validUntil and entitlement.validUntil ~= cjson.null and reservation.bookingDate > entitlement.validUntil then return 'EXPIRED' end
local allowance = tonumber(entitlement.monthlyAllowance)
if not allowance or allowance < 1 then return 'INVALID_ALLOWANCE' end
local usedBefore = redis.call('SCARD', KEYS[2])
local reservedBefore = redis.call('ZCARD', KEYS[3])
if usedBefore >= allowance then return 'LIMIT_REACHED' end
local creditsAvailable = tonumber(entitlement.creditsAvailable)
if not creditsAvailable then creditsAvailable = math.max(allowance - usedBefore - reservedBefore, 0) end
local creditsReserved = tonumber(entitlement.creditsReserved)
if not creditsReserved then creditsReserved = reservedBefore end
if creditsReserved < 1 then return 'RESERVATION_LOST' end
redis.call('SADD', KEYS[2], ARGV[2])
local used = redis.call('SCARD', KEYS[2])
entitlement.creditsAvailable = creditsAvailable
entitlement.creditsReserved = creditsReserved - 1
entitlement.creditsUsedTotal = tonumber(entitlement.creditsUsedTotal or usedBefore) + 1
entitlement.creditsGrantedTotal = tonumber(entitlement.creditsGrantedTotal or allowance)
entitlement.updatedAt = ARGV[7]
local remaining = creditsAvailable
local confirmedBooking = cjson.decode(ARGV[4])
confirmedBooking.monthlyClientType = entitlement.clientType
confirmedBooking.monthlyPackageTier = entitlement.packageTier
confirmedBooking.monthlyAllowance = allowance
confirmedBooking.monthlyUsedAfter = used
confirmedBooking.monthlyRemainingAfter = remaining
confirmedBooking.monthlyCustomerName = entitlement.customerName
confirmedBooking.monthlyCustomerEmail = entitlement.email
confirmedBooking.monthlyCustomerPhone = entitlement.customerPhone or ''
confirmedBooking.monthlyBusinessName = entitlement.businessName or ''
confirmedBooking.monthlyCustomerTypeLabel = entitlement.clientType == 'business' and 'Business / Fleet / Family' or 'Private Client'
confirmedBooking.monthlyPackageLabel = entitlement.packageTier == 'premium' and 'Premium' or 'Standard'
confirmedBooking.packageName = 'Monthly Client Wash - ' .. confirmedBooking.monthlyPackageLabel .. ' Package'
confirmedBooking.promoCodeReference = string.upper(string.sub(entitlement.id, 1, 8))
confirmedBooking.appliedPromo = 'Monthly entitlement ' .. confirmedBooking.promoCodeReference
local historyRecord = cjson.decode(ARGV[3])
historyRecord.clientType = entitlement.clientType
historyRecord.businessName = entitlement.businessName or ''
historyRecord.customerPhone = entitlement.customerPhone or ''
historyRecord.customerTypeLabel = confirmedBooking.monthlyCustomerTypeLabel
historyRecord.packageTier = entitlement.packageTier
historyRecord.packageLabel = confirmedBooking.monthlyPackageLabel
historyRecord.monthlyAllowance = allowance
historyRecord.usedAfter = used
historyRecord.remainingAfter = remaining
historyRecord.promoCodeReference = confirmedBooking.promoCodeReference
historyRecord.creditsUsedTotal = entitlement.creditsUsedTotal
redis.call('SET', KEYS[1], cjson.encode(entitlement))
redis.call('ZREM', KEYS[3], ARGV[1])
redis.call('ZREM', KEYS[9], ARGV[1])
redis.call('DEL', KEYS[4])
redis.call('LPUSH', KEYS[5], cjson.encode(historyRecord))
redis.call('SET', KEYS[6], cjson.encode(confirmedBooking), 'EX', ARGV[5])
redis.call('EXPIRE', KEYS[7], ARGV[5])
redis.call('SET', KEYS[8], '1', 'EX', ARGV[5])
return 'OK'
`;

function getSouthAfricanDate(date = new Date()) {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Africa/Johannesburg',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(date);
    const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
    return `${values.year}-${values.month}-${values.day}`;
}

function addDays(date, amount) {
    const result = new Date(`${date}T00:00:00.000Z`);
    result.setUTCDate(result.getUTCDate() + amount);
    return result.toISOString().slice(0, 10);
}

function addMonthsClamped(date, amount) {
    const [year, month, day] = date.split('-').map(Number);
    const monthIndex = year * 12 + month - 1 + amount;
    const targetYear = Math.floor(monthIndex / 12);
    const targetMonth = monthIndex % 12;
    const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
    const targetDay = Math.min(day, lastDay);
    return `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-${String(targetDay).padStart(2, '0')}`;
}

function getBillingPeriod(bookingDate, billingAnchor) {
    if (!isValidDate(bookingDate)) throw new Error('Choose a valid booking date.');
    const anchor = isValidDate(billingAnchor) ? billingAnchor : bookingDate;
    if (bookingDate < anchor) {
        return { start: anchor, end: addDays(addMonthsClamped(anchor, 1), -1) };
    }
    const [anchorYear, anchorMonth] = anchor.split('-').map(Number);
    const [bookingYear, bookingMonth] = bookingDate.split('-').map(Number);
    let monthOffset = (bookingYear - anchorYear) * 12 + bookingMonth - anchorMonth;
    let start = addMonthsClamped(anchor, monthOffset);
    if (start > bookingDate) {
        monthOffset -= 1;
        start = addMonthsClamped(anchor, monthOffset);
    }
    return {
        start,
        end: addDays(addMonthsClamped(anchor, monthOffset + 1), -1),
    };
}

function getBillingCycleCount(billingAnchor, validUntil) {
    if (!isValidDate(billingAnchor) || !isValidDate(validUntil)) return null;
    for (let cycle = 1; cycle <= 1200; cycle += 1) {
        const cycleEnd = addDays(addMonthsClamped(billingAnchor, cycle), -1);
        if (cycleEnd === validUntil) return cycle;
        if (cycleEnd > validUntil) return null;
    }
    return null;
}

function formatSouthAfricanDateTime(date = new Date()) {
    return new Intl.DateTimeFormat('en-ZA', {
        timeZone: 'Africa/Johannesburg',
        dateStyle: 'medium',
        timeStyle: 'medium',
    }).format(date);
}

function isValidDate(value, allowEmpty = false) {
    if (allowEmpty && !value) return true;
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function newPromoCode() {
    const bytes = crypto.randomBytes(10);
    const suffix = Array.from(bytes, (byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join('');
    return `ATDM-${suffix}`;
}

async function createUniqueCode() {
    for (let attempt = 0; attempt < 5; attempt += 1) {
        const code = newPromoCode();
        if (!(await redis.exists(codeKey(code)))) return code;
    }
    throw new Error('Could not generate a unique monthly promo code. Please try again.');
}

function validateEntitlementInput(input) {
    const firstNameInput = String(input?.firstName || '').trim();
    const surnameInput = String(input?.surname || '').trim();
    const suppliedName = String(input?.customerName || '').trim();
    let firstName = firstNameInput;
    let surname = surnameInput;
    let customerName = suppliedName;
    const hasSeparateName = Boolean(firstNameInput || surnameInput);
    if (hasSeparateName) {
        if (!firstNameInput || !surnameInput) {
            throw new Error('Enter both the customer first name and surname.');
        }
        customerName = `${firstNameInput} ${surnameInput}`;
    } else if (suppliedName) {
        const [derivedFirstName, ...surnameParts] = suppliedName.split(/\s+/);
        firstName = derivedFirstName;
        surname = surnameParts.join(' ');
    }
    const email = normaliseEmail(input?.email);
    const customerPhone = String(input?.customerPhone || '').trim();
    const businessName = String(input?.businessName || '').trim();
    const clientType = String(input?.clientType || '');
    const packageTier = String(input?.packageTier || '');
    const validFrom = String(input?.validFrom || getSouthAfricanDate());
    const validUntil = String(input?.validUntil || '');

    if (!customerName || customerName.length > 120
        || (hasSeparateName && (!firstName || firstName.length > 60 || !surname || surname.length > 60))) {
        throw new Error('Enter a customer name no longer than 120 characters.');
    }
    if (!looksLikeEmail(email)) throw new Error('Enter a valid customer email address.');
    if (input?.requireSeparateName && (!firstNameInput || !surnameInput)) {
        throw new Error('Enter both the customer first name and surname.');
    }
    if (customerPhone.length > 40 || (input?.requireCustomerPhone !== false
        && customerPhone.replace(/\D/g, '').length < 7)
        || (customerPhone && customerPhone.replace(/\D/g, '').length < 7)) {
        throw new Error('Enter a valid customer contact number.');
    }
    if (businessName.length > 120) throw new Error('Business or family name must be 120 characters or fewer.');
    if (!['private', 'business'].includes(clientType)) {
        throw new Error('Choose Private Client or Business / Fleet / Family.');
    }
    if (!['standard', 'premium'].includes(packageTier)) {
        throw new Error('Choose the Standard or Premium package.');
    }
    if (!isValidDate(validFrom) || !isValidDate(validUntil, true)) {
        throw new Error('Enter valid start and end dates.');
    }
    if (validUntil && validUntil < validFrom) {
        throw new Error('The entitlement end date must be on or after its start date.');
    }

    return {
        customerName,
        firstName,
        surname,
        email,
        customerPhone,
        businessName,
        clientType,
        packageTier,
        monthlyAllowance: packageTier === 'premium' ? 4 : 2,
        validFrom,
        validUntil: validUntil || null,
    };
}

function getCalendarMonthsBetween(start, end) {
    const months = [];
    const [startYear, startMonth] = start.split('-').map(Number);
    const [endYear, endMonth] = end.split('-').map(Number);
    let year = startYear;
    let month = startMonth;
    while (year < endYear || (year === endYear && month <= endMonth)) {
        months.push(`${year}-${String(month).padStart(2, '0')}`);
        month += 1;
        if (month > 12) {
            month = 1;
            year += 1;
        }
    }
    return months;
}

async function migrateLegacyReservations(id, billingAnchor) {
    const markerKey = `promo:monthly:reservation-migration:${id}`;
    if (await redis.exists(markerKey)) return;
    const now = Date.now();
    const today = getSouthAfricanDate();
    const months = getCalendarMonthsBetween(today, addDays(today, 90));
    const reservationIds = new Set();
    for (const month of months) {
        const oldIds = await redis.zrange(periodReservationsKey(id, month), 0, -1);
        oldIds.forEach((reservationId) => reservationIds.add(String(reservationId)));
    }
    for (const reservationId of reservationIds) {
        const reservation = await redis.get(reservationKey(reservationId));
        if (!reservation || !isValidDate(reservation.bookingDate)) continue;
        const createdAt = new Date(reservation.createdAt || 0).getTime();
        const expiresAt = Number(reservation.expiresAt)
            || (Number.isFinite(createdAt) ? createdAt + MONTHLY_RESERVATION_TTL_SECONDS * 1000 : now);
        if (expiresAt <= now) continue;
        const period = getBillingPeriod(reservation.bookingDate, billingAnchor).start;
        if (reservation.period) await redis.zrem(periodReservationsKey(id, reservation.period), reservationId);
        reservation.period = period;
        reservation.expiresAt = expiresAt;
        await redis.set(reservationKey(reservationId), reservation, {
            ex: Math.max(1, Math.ceil((expiresAt - now) / 1000)),
        });
        await redis.zadd(periodReservationsKey(id, period), { score: expiresAt, member: reservationId });
        await redis.zadd(allReservationsKey(id), { score: expiresAt, member: reservationId });
    }
    await redis.set(markerKey, '1', { nx: true, ex: 60 * 60 * 24 * 365 * 5 });
}

async function migratePeriodHistory(id, period, billingAnchor = period.start) {
    await migrateLegacyReservations(id, billingAnchor);
    const markerKey = `promo:monthly:migration:${id}:${period.start}`;
    if (await redis.exists(markerKey)) return;

    const usageKey = periodUsageKey(id, period.start);
    const history = await redis.lrange(historyKey(id), 0, -1);
    const usedReferences = [];
    for (const entry of history) {
        const record = typeof entry === 'string' ? JSON.parse(entry) : entry;
        if (record?.reference && record.bookingDate >= period.start && record.bookingDate <= period.end) {
            usedReferences.push(record.reference);
        }
    }
    if (usedReferences.length) await redis.sadd(usageKey, ...usedReferences);

    await redis.set(markerKey, '1', { nx: true, ex: 60 * 60 * 24 * 365 * 5 });
}

async function ensureCreditLedger(record, period) {
    const result = await redis.eval(ENSURE_CREDIT_LEDGER_SCRIPT, [
        entitlementKey(record.id),
        periodUsageKey(record.id, period.start),
        allReservationsKey(record.id),
    ], [period.start, new Date().toISOString()]);
    if (!Array.isArray(result) || result[0] !== 'OK') {
        throw new Error('Could not initialize the monthly credit balance.');
    }
    return typeof result[1] === 'string' ? JSON.parse(result[1]) : result[1];
}

function getRedisStatus(result) {
    const [status, allowance, used, reserved] = result || [];
    return {
        status: String(status || 'ERROR'),
        allowance: Number(allowance || 0),
        used: Number(used || 0),
        reserved: Number(reserved || 0),
    };
}

export async function getMonthlyPromoForCode(code) {
    const normalisedCode = String(code || '').trim().toUpperCase();
    if (!normalisedCode) return null;
    const id = await redis.get(codeKey(normalisedCode));
    if (!id) return null;
    const entitlement = await redis.get(entitlementKey(id));
    if (!entitlement || !entitlement.active || entitlement.archived) return null;
    const codeDigest = digest(normalisedCode);
    const validCode = entitlement.codeDigests
        ? entitlement.codeDigests.includes(codeDigest)
        : entitlement.currentCodeDigest === codeDigest;
    return validCode ? entitlement : null;
}

export async function createMonthlyEntitlement(input) {
    const details = validateEntitlementInput({ ...input, requireSeparateName: true });
    const id = crypto.randomUUID();
    const code = await createUniqueCode();
    const now = new Date().toISOString();
    const entitlement = {
        id,
        ...details,
        code,
        currentCodeDigest: digest(code),
        codeDigests: [digest(code)],
        codes: [{ code, digest: digest(code), createdAt: now }],
        billingAnchor: details.validFrom,
        billingCyclesPaid: getBillingCycleCount(details.validFrom, details.validUntil) || 1,
        creditsAvailable: details.monthlyAllowance,
        creditsReserved: 0,
        creditsUsedTotal: 0,
        creditsGrantedTotal: details.monthlyAllowance,
        paymentHistory: [],
        active: true,
        archived: false,
        createdAt: now,
        updatedAt: now,
        codeHistory: [],
        auditHistory: [{ action: 'created', createdAt: now }],
    };
    const result = await redis.eval(CREATE_ENTITLEMENT_SCRIPT, [
        entitlementKey(id),
        ENTITLEMENT_INDEX_KEY,
        customerKey(details.email),
        codeKey(code),
    ], [JSON.stringify(entitlement), id]);
    if (result === 'EMAIL_EXISTS') {
        throw new Error('An entitlement already exists for this email. Edit or reactivate that customer record to preserve its history.');
    }
    if (result !== 'OK') throw new Error('Could not create the monthly entitlement.');
    return entitlement;
}

export async function generateMonthlyEntitlementCode(id) {
    const entitlementId = String(id || '').trim();
    if (!entitlementId) throw new Error('Monthly entitlement id is required.');
    const code = await createUniqueCode();
    const now = new Date().toISOString();
    const codeRecord = { code, digest: digest(code), createdAt: now };
    const result = await redis.eval(GENERATE_ENTITLEMENT_CODE_SCRIPT, [
        entitlementKey(entitlementId),
        codeKey(code),
    ], [JSON.stringify(codeRecord), entitlementId]);
    if (!Array.isArray(result) || result[0] === 'NOT_FOUND') {
        throw new Error('Monthly entitlement not found.');
    }
    if (result[0] === 'CODE_EXISTS') {
        throw new Error('Could not generate a unique monthly promo code. Please try again.');
    }
    if (result[0] === 'ARCHIVED' || result[0] === 'INACTIVE') {
        throw new Error('Reactivate this monthly account before generating an access code.');
    }
    if (result[0] !== 'OK') throw new Error('Could not generate a monthly promo code.');
    return typeof result[1] === 'string' ? JSON.parse(result[1]) : result[1];
}

export async function provisionMonthlyEntitlementFromPaidPurchase(booking) {
    if (booking?.purchaseType !== 'monthly') return { status: 'not_monthly' };
    const reference = String(booking.reference || '').trim();
    if (!/^[\w.:-]{3,120}$/.test(reference)) {
        throw new Error('A valid paid monthly-purchase reference is required.');
    }

    const customer = booking.customer || {};
    const packageId = String(booking.packageId || '');
    const [, clientType, packageTier] = packageId.match(/^(private|business)-(standard|premium)$/) || [];
    if (!clientType || !packageTier) throw new Error('The paid monthly package is not recognized.');
    const amountCents = Number(booking.amountCents);
    if (!Number.isSafeInteger(amountCents) || amountCents <= 0) {
        throw new Error('The paid monthly package amount is invalid.');
    }

    const paidAt = String(booking.paidAt || new Date().toISOString());
    const paidDate = getSouthAfricanDate(new Date(paidAt));
    const monthlyAllowance = packageTier === 'premium' ? 4 : 2;
    const customerName = `${customer.firstName || ''} ${customer.surname || ''}`.trim();
    const details = validateEntitlementInput({
        customerName,
        email: customer.email,
        customerPhone: customer.mobile,
        businessName: customer.businessName || '',
        clientType,
        packageTier,
        validFrom: paidDate,
    });
    const validUntil = addDays(addMonthsClamped(paidDate, 1), -1);
    const now = new Date().toISOString();
    const initialPayment = {
        type: 'initial',
        paidAt,
        amountCents,
        paymentMethod: booking.paymentMethod || 'online',
        reference,
        gatewayReference: booking.yocoCheckoutId || null,
        packageId,
        packageName: booking.packageName || '',
        vehicleType: booking.vehicleType || '',
        contractOption: booking.contractOption || null,
        creditsAdded: monthlyAllowance,
    };
    const pendingPurchase = {
        reference,
        status: 'needs_manager',
        paidAt,
        amountCents,
        paymentMethod: booking.paymentMethod || 'online',
        customerName: details.customerName,
        email: details.email,
        customerPhone: details.customerPhone,
        businessName: details.businessName,
        clientType,
        packageTier,
        packageId,
        packageName: booking.packageName || '',
        vehicleType: booking.vehicleType || '',
        contractOption: booking.contractOption || null,
    };
    const id = crypto.randomUUID();
    let code;
    let result;
    for (let attempt = 0; attempt < 5; attempt += 1) {
        code = await createUniqueCode();
        const entitlement = {
            id,
            ...details,
            validUntil,
            billingAnchor: paidDate,
            billingCyclesPaid: 1,
            creditsAvailable: monthlyAllowance,
            creditsReserved: 0,
            creditsUsedTotal: 0,
            creditsGrantedTotal: monthlyAllowance,
            code,
            currentCodeDigest: digest(code),
            codeDigests: [digest(code)],
            codes: [{ code, digest: digest(code), createdAt: now }],
            active: true,
            archived: false,
            createdAt: now,
            updatedAt: now,
            lastPaidAt: paidAt,
            packageId,
            packageName: booking.packageName || '',
            vehicleType: booking.vehicleType || '',
            contractOption: booking.contractOption || null,
            paymentHistory: [initialPayment],
            codeHistory: [],
            auditHistory: [{ action: 'paid_purchase_created', reference, createdAt: now }],
        };
        result = await redis.eval(CREATE_PAID_ENTITLEMENT_SCRIPT, [
            entitlementKey(id),
            ENTITLEMENT_INDEX_KEY,
            customerKey(details.email),
            codeKey(code),
            purchaseKey(reference),
            pendingPurchaseKey(reference),
            pendingPurchaseIndexKey,
        ], [JSON.stringify(entitlement), id, JSON.stringify(pendingPurchase)]);

        if (Array.isArray(result) && result[0] === 'CODE_EXISTS') continue;
        break;
    }

    if (!Array.isArray(result)) throw new Error('Could not provision the paid monthly entitlement.');
    if (result[0] === 'EMAIL_EXISTS') {
        return {
            status: 'needs_manager',
            reference,
            existingEntitlementId: String(result[1] || ''),
        };
    }
    if (result[0] === 'PURCHASE_EXISTS') {
        const owner = String(result[1] || '');
        if (owner.startsWith('pending:')) {
            return { status: 'needs_manager', reference };
        }
        const existingEntitlement = await redis.get(entitlementKey(owner));
        if (!existingEntitlement) throw new Error('The paid monthly purchase points to a missing entitlement.');
        try {
            const dispatch = await sendMonthlyCodeToClient({
                entitlementId: owner,
                idempotencyKey: `monthly-purchase-${digest(reference).slice(0, 24)}`,
            });
            return { status: 'already_provisioned', entitlement: existingEntitlement, emailStatus: dispatch.status };
        } catch (error) {
            console.error('[monthly purchase code email failed]', reference, error);
            return { status: 'already_provisioned', entitlement: existingEntitlement, emailError: error.message };
        }
    }
    if (result[0] !== 'OK') throw new Error('Could not provision the paid monthly entitlement.');

    const entitlement = await redis.get(entitlementKey(id));
    try {
        const dispatch = await sendMonthlyCodeToClient({
            entitlementId: id,
            idempotencyKey: `monthly-purchase-${digest(reference).slice(0, 24)}`,
        });
        return { status: 'created', entitlement, emailStatus: dispatch.status };
    } catch (error) {
        console.error('[monthly purchase code email failed]', reference, error);
        return { status: 'created', entitlement, emailError: error.message };
    }
}

export async function recordMonthlyEntitlementPayment({
    entitlementId,
    paymentReference,
    amountCents,
    paymentDate,
}) {
    const id = String(entitlementId || '').trim();
    const suppliedReference = String(paymentReference || '').trim();
    const amount = Number(amountCents);
    const enteredPaymentDate = String(paymentDate || '').trim();
    if (!id) throw new Error('Monthly entitlement id is required.');
    if (suppliedReference && !/^[\w.:-]{3,120}$/.test(suppliedReference)) {
        throw new Error('Enter a valid payment reference.');
    }
    if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error('Enter the amount paid in cents.');
    if (!isValidDate(enteredPaymentDate)) throw new Error('Choose a valid payment date.');

    let entitlement = await redis.get(entitlementKey(id));
    if (!entitlement) throw new Error('Monthly entitlement not found.');
    const now = new Date().toISOString();
    const today = getSouthAfricanDate();
    const currentPeriod = getBillingPeriod(today, entitlement.billingAnchor || entitlement.validFrom);
    await migratePeriodHistory(id, currentPeriod, entitlement.billingAnchor || entitlement.validFrom);
    entitlement = await ensureCreditLedger(entitlement, currentPeriod);

    const reference = suppliedReference || `manual-${crypto.randomUUID()}`;
    const pending = await redis.get(pendingPurchaseKey(reference));
    if (pending) {
        if (normaliseEmail(pending.email) !== normaliseEmail(entitlement.email)) {
            throw new Error('This paid purchase belongs to a different customer.');
        }
        if (Number(pending.amountCents) !== amount) {
            throw new Error('The entered amount does not match the recorded paid purchase.');
        }
        if (pending.clientType !== entitlement.clientType || pending.packageTier !== entitlement.packageTier) {
            throw new Error('Update the customer package to match this paid purchase before applying it.');
        }
    }

    const paidAt = pending?.paidAt || `${enteredPaymentDate}T12:00:00+02:00`;
    const effectivePaymentDate = getSouthAfricanDate(new Date(paidAt));
    const stillCurrent = entitlement.validUntil && entitlement.validUntil >= effectivePaymentDate;
    let billingAnchor = stillCurrent
        ? (entitlement.billingAnchor || entitlement.validFrom)
        : effectivePaymentDate;
    let billingCyclesPaid = stillCurrent
        ? getBillingCycleCount(billingAnchor, entitlement.validUntil)
        : 0;
    if (!billingCyclesPaid) {
        billingAnchor = stillCurrent ? addDays(entitlement.validUntil, 1) : effectivePaymentDate;
        billingCyclesPaid = 1;
    } else {
        billingCyclesPaid += 1;
    }
    const validUntil = addDays(addMonthsClamped(billingAnchor, billingCyclesPaid), -1);
    const payment = {
        type: pending ? 'renewal_purchase' : 'manual_renewal',
        paidAt,
        paymentDate: effectivePaymentDate,
        amountCents: amount,
        paymentMethod: pending?.paymentMethod || 'manual',
        reference,
        packageId: pending?.packageId || entitlement.packageId || '',
        packageName: pending?.packageName || entitlement.packageName || '',
        vehicleType: pending?.vehicleType || entitlement.vehicleType || '',
        contractOption: pending?.contractOption || entitlement.contractOption || null,
        creditsAdded: entitlement.monthlyAllowance,
    };
    const auditEntry = {
        action: 'monthly_payment_recorded',
        reference,
        creditsAdded: entitlement.monthlyAllowance,
        previousValidUntil: entitlement.validUntil || null,
        validUntil,
        performedBy: 'admin',
        createdAt: paidAt,
    };
    let result;
    for (let attempt = 0; attempt < 5; attempt += 1) {
        const code = await createUniqueCode();
        const codeRecord = { code, digest: digest(code), createdAt: now };
        result = await redis.eval(RECORD_MONTHLY_PAYMENT_SCRIPT, [
            entitlementKey(id),
            purchaseKey(reference),
            pendingPurchaseKey(reference),
            pendingPurchaseIndexKey,
            codeKey(code),
        ], [
            entitlement.updatedAt,
            '',
            '',
            paidAt,
            JSON.stringify(payment),
            JSON.stringify(auditEntry),
            reference,
            billingAnchor,
            String(billingCyclesPaid),
            validUntil,
            JSON.stringify(codeRecord),
            now,
        ]);
        if (result?.[0] !== 'CODE_EXISTS') break;
    }
    if (!Array.isArray(result) || result[0] === 'NOT_FOUND') throw new Error('Monthly entitlement not found.');
    if (result[0] === 'STALE') throw new Error('This monthly record changed during the payment update. Refresh and try again.');
    if (result[0] === 'ARCHIVED' || result[0] === 'INACTIVE') throw new Error('Reactivate this monthly entitlement before recording a payment.');
    if (result[0] === 'DUPLICATE') throw new Error('This payment reference has already been recorded.');
    if (result[0] === 'PURCHASE_EXISTS') throw new Error('This payment reference is already linked to another entitlement.');
    if (result[0] === 'PURCHASE_NOT_FOUND') throw new Error('The paid purchase could not be found.');
    if (result[0] === 'PURCHASE_MISMATCH') throw new Error('The paid purchase does not match this customer.');
    if (result[0] === 'PACKAGE_MISMATCH') throw new Error('Update the customer package to match this paid purchase before applying it.');
    if (result[0] === 'CODE_EXISTS') throw new Error('Could not generate a unique monthly promo code. Please try recording the payment again.');
    if (result[0] !== 'OK') throw new Error('Could not record the monthly payment.');
    const updated = typeof result[1] === 'string' ? JSON.parse(result[1]) : result[1];
    try {
        const dispatch = await sendMonthlyCodeToClient({
            entitlementId: id,
            idempotencyKey: `monthly-renewal-${digest(reference).slice(0, 24)}`,
        });
        return { ...updated, emailStatus: dispatch.status };
    } catch (error) {
        console.error('[monthly renewal code email failed]', reference, error);
        return {
            ...updated,
            emailError: error instanceof Error ? error.message : 'The monthly code email could not be sent.',
        };
    }
}

export async function getPendingMonthlyPurchasesForAdmin() {
    const references = await redis.lrange(pendingPurchaseIndexKey, 0, -1);
    const purchases = await Promise.all(references.map((reference) => redis.get(pendingPurchaseKey(reference))));
    return purchases.filter(Boolean);
}

export async function updateMonthlyEntitlement(id, input) {
    const existing = await redis.get(entitlementKey(id));
    if (!existing) throw new Error('Monthly entitlement not found.');

    const details = validateEntitlementInput({
        ...existing,
        ...input,
        requireCustomerPhone: Boolean(existing.customerPhone || input?.customerPhone !== undefined),
        email: input?.email === undefined ? existing.email : input.email,
        validFrom: input?.validFrom === undefined ? existing.validFrom : input.validFrom,
        validUntil: input?.validUntil === undefined ? existing.validUntil : input.validUntil,
    });
    if (input?.active !== undefined && typeof input.active !== 'boolean') {
        throw new Error('Entitlement active status must be true or false.');
    }
    if (input?.archived !== undefined && typeof input.archived !== 'boolean') {
        throw new Error('Entitlement archive status must be true or false.');
    }
    const active = input?.active === undefined ? existing.active : input.active;
    const archived = input?.archived === undefined ? existing.archived : input.archived;
    const deactivationReason = String(input?.deactivationReason || '').trim();
    const statusChanged = active !== existing.active || archived !== existing.archived;
    if (statusChanged && deactivationReason.length < 3) {
        throw new Error('Provide a reason of at least 3 characters when changing a monthly client status.');
    }
    if (deactivationReason.length > 500) throw new Error('The reason must be 500 characters or fewer.');
    const savedStatusReason = statusChanged
        ? deactivationReason
        : deactivationReason || existing.deactivationReason || '';
    const replaceCode = input?.replaceCode === true;
    const revokeCodes = existing.active && !active;
    const code = replaceCode ? await createUniqueCode() : existing.code;
    const now = new Date().toISOString();
    const changedFields = ['customerName', 'firstName', 'surname', 'email', 'customerPhone', 'businessName', 'clientType', 'packageTier', 'validFrom', 'validUntil']
        .filter((field) => details[field] !== existing[field]);
    if (active !== existing.active) changedFields.push('active');
    if (archived !== existing.archived) changedFields.push('archived');
    if (replaceCode) changedFields.push('code');
    const changes = Object.fromEntries(changedFields.map((field) => {
        if (field === 'code') return [field, { from: maskCode(existing.code), to: maskCode(code) }];
        const from = existing[field] ?? null;
        const to = field === 'active' ? active
            : field === 'archived' ? archived
                : details[field];
        return [field, { from, to: to ?? null }];
    }));
    const auditEntry = {
        action: archived !== existing.archived ? (archived ? 'archived' : 'unarchived')
            : active !== existing.active ? (active ? 'activated' : 'deactivated')
                : replaceCode ? 'code_replaced' : 'updated',
        changedFields,
        changes,
        performedBy: 'admin',
        reason: deactivationReason || undefined,
        createdAt: now,
    };
    const next = {
        ...existing,
        ...details,
        billingAnchor: details.validFrom !== existing.validFrom
            ? details.validFrom
            : existing.billingAnchor || details.validFrom,
        billingCyclesPaid: getBillingCycleCount(
            details.validFrom !== existing.validFrom ? details.validFrom : (existing.billingAnchor || details.validFrom),
            details.validUntil,
        ) || Number(existing.billingCyclesPaid || 1),
        creditsAvailable: Math.max(Number(existing.creditsAvailable ?? existing.monthlyAllowance) + details.monthlyAllowance - existing.monthlyAllowance, 0),
        creditsReserved: Number(existing.creditsReserved || 0),
        creditsUsedTotal: Number(existing.creditsUsedTotal || 0),
        creditsGrantedTotal: Math.max(Number(existing.creditsGrantedTotal ?? existing.monthlyAllowance) + details.monthlyAllowance - existing.monthlyAllowance, 0),
        code: revokeCodes ? null : code,
        currentCodeDigest: revokeCodes ? null : replaceCode ? digest(code) : existing.currentCodeDigest,
        codeDigests: revokeCodes
            ? []
            : replaceCode
            ? [digest(code)]
            : existing.codeDigests || (existing.currentCodeDigest ? [existing.currentCodeDigest] : []),
        codes: revokeCodes
            ? []
            : replaceCode
            ? [{ code, digest: digest(code), createdAt: now }]
            : existing.codes || (existing.code ? [{ code: existing.code, digest: existing.currentCodeDigest, createdAt: existing.createdAt }] : []),
        active,
        archived,
        deactivationReason: !active || archived ? savedStatusReason : null,
        updatedAt: now,
        auditHistory: [auditEntry, ...(existing.auditHistory || [])],
        codeHistory: revokeCodes
            ? [...(existing.codes || (existing.code ? [{ code: existing.code }] : []))
                .map(({ code: oldCode }) => ({ code: maskCode(oldCode), replacedAt: now })), ...(existing.codeHistory || [])]
            : replaceCode
            ? [{ code: maskCode(existing.code), replacedAt: now }, ...(existing.codeHistory || [])]
            : existing.codeHistory || [],
    };
    const result = await redis.eval(UPDATE_ENTITLEMENT_SCRIPT, [
        entitlementKey(id),
        customerKey(existing.email),
        customerKey(details.email),
        codeKey(code),
    ], [JSON.stringify(next), id, replaceCode ? '1' : '0', JSON.stringify(auditEntry), maskCode(existing.code), revokeCodes ? '1' : '0']);
    if (result === 'NOT_FOUND') throw new Error('Monthly entitlement not found.');
    if (result === 'EMAIL_EXISTS') throw new Error('Another customer already has an entitlement for that email.');
    if (result !== 'OK') throw new Error('Could not update the monthly entitlement.');
    return next;
}

export async function getMonthlyEntitlementsForAdmin() {
    const ids = await redis.smembers(ENTITLEMENT_INDEX_KEY);
    const today = getSouthAfricanDate();
    const now = new Date().toISOString();

    return Promise.all(ids.map(async (id) => {
        let record = await redis.get(entitlementKey(id));
        if (!record) return null;
        const period = getBillingPeriod(today, record.billingAnchor || record.validFrom);
        await migratePeriodHistory(id, period, record.billingAnchor || record.validFrom);
        record = await ensureCreditLedger(record, period);
        await redis.eval(CLEAN_EXPIRED_RESERVATIONS_SCRIPT, [
            entitlementKey(id),
            allReservationsKey(id),
        ], [String(Date.now()), now]);
        record = await redis.get(entitlementKey(id));
        record = await ensureCreditLedger(record, period);
        const usageKey = periodUsageKey(id, period.start);
        const reservationsKey = periodReservationsKey(id, period.start);
        const [used, reserved, history, dispatchIds] = await Promise.all([
            redis.scard(usageKey),
            redis.zcard(reservationsKey),
            redis.lrange(historyKey(id), 0, 49),
            redis.lrange(emailDispatchIndexKey(id), 0, EMAIL_HISTORY_LIMIT - 1),
        ]);
        const distributionHistory = (await Promise.all(dispatchIds.map((dispatchId) => redis.get(emailDispatchKey(dispatchId)))))
            .filter(Boolean);
        let status = 'Active';
        if (record.archived) status = 'Archived';
        else if (!record.active) status = 'Deactivated';
        else if (record.validUntil && record.validUntil < today) status = 'Expired';
        else if (record.validFrom > today) status = 'Scheduled';
        else if (Number(record.creditsAvailable) < 1) status = 'No credits';
        else if (Number(used) >= record.monthlyAllowance) status = 'Fully used';
        else if (Number(used) + Number(reserved) >= record.monthlyAllowance) status = 'Reserved';

        return {
            ...record,
            period: period.start,
            periodEnd: period.end,
            used: Number(used),
            reserved: Number(reserved),
            periodRemaining: Math.max(record.monthlyAllowance - Number(used) - Number(reserved), 0),
            remaining: Number(record.creditsAvailable),
            status,
            history,
            distributionHistory,
        };
    })).then((records) => records.filter(Boolean).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
}

function maskCode(code) {
    const value = String(code || '');
    return value.length > 4 ? `${value.slice(0, 5)}****${value.slice(-4)}` : '****';
}

function isValidPhone(value) {
    return String(value || '').replace(/\D/g, '').length >= 7;
}

function getEntitlementStatus(record, today) {
    if (record.archived) return 'Archived';
    if (!record.active) return 'Deactivated';
    if (record.validUntil && record.validUntil < today) return 'Expired';
    if (record.validFrom > today) return 'Scheduled';
    return 'Active';
}

export async function createMonthlyDistributionPreview(adminName = 'Business Manager admin', entitlementIds = null, runType = 'bulk') {
    const records = await getMonthlyEntitlementsForAdmin();
    const today = getSouthAfricanDate();
    const selectedIds = entitlementIds ? new Set(entitlementIds) : null;
    const considered = selectedIds ? records.filter((record) => selectedIds.has(record.id)) : records;
    const clients = [];
    const exclusions = [];
    for (const record of considered) {
        const reason = record.archived ? 'archived'
            : !record.active ? 'inactive'
                : record.validUntil && record.validUntil < today ? 'expired'
                    : record.validFrom > today ? 'not yet active'
                        : !looksLikeEmail(record.email) ? 'missing or invalid email'
                            : !isValidPhone(record.customerPhone) ? 'missing contact number'
                                : null;
        const clientTypeLabel = record.clientType === 'business' ? 'Business / Fleet / Family' : 'Private Client';
        const packageLabel = record.packageTier === 'premium' ? 'Premium' : 'Standard';
        if (reason) {
            exclusions.push({
                id: record.id,
                customerName: record.customerName,
                email: record.email,
                clientTypeLabel,
                packageLabel,
                reason,
            });
            continue;
        }
        clients.push({
            id: record.id,
            customerName: record.customerName,
            email: record.email,
            clientType: record.clientType,
            packageTier: record.packageTier,
            clientTypeLabel,
            packageLabel,
            code: record.code,
            codeDigest: record.currentCodeDigest,
            monthlyAllowance: record.monthlyAllowance,
        });
    }
    const createdAt = new Date();
    const run = {
        id: crypto.randomUUID(),
        status: 'preview',
        runType,
        createdAt: createdAt.toISOString(),
        initiatedAtSA: formatSouthAfricanDateTime(createdAt),
        distributionDate: getSouthAfricanDate(createdAt),
        adminName: String(adminName || 'Business Manager admin').trim().slice(0, 100),
        activeConsidered: considered.filter((record) => record.active && !record.archived
            && (!record.validUntil || record.validUntil >= today) && record.validFrom <= today).length,
        recipients: clients,
        exclusions,
        results: [],
        reportStatus: 'pending',
    };
    await redis.set(emailRunKey(run.id), run, { nx: true, ex: EMAIL_RUN_TTL_SECONDS });
    await redis.lpush(emailRunsIndexKey, run.id);
    await redis.ltrim(emailRunsIndexKey, 0, 49);
    return { runId: run.id, eligible: clients, excluded: exclusions, counts: { eligible: clients.length, excluded: exclusions.length } };
}

export async function getMonthlyDistributionRuns() {
    const ids = await redis.lrange(emailRunsIndexKey, 0, 19);
    const runs = (await Promise.all(ids.map((id) => redis.get(emailRunKey(id))))).filter(Boolean);
    return Promise.all(runs.map(async (run) => {
            const results = await Promise.all((run.results || []).map(async (result) => {
                if (!result.dispatchId) return result;
                const dispatch = await redis.get(emailDispatchKey(result.dispatchId));
                return dispatch ? {
                    ...result,
                    status: dispatch.status,
                    deliveryLabel: dispatch.status === 'accepted' ? 'Accepted by provider · delivery pending'
                        : dispatch.status === 'delivered' ? 'Delivered'
                            : dispatch.status === 'failed' ? 'Failed' : dispatch.status,
                    providerStatus: dispatch.providerStatus || null,
                    failureReason: dispatch.failureReason || result.failureReason || null,
                } : result;
            }));
            return { ...run, results, recipientCount: (run.recipients || []).length };
    }));
}

async function updateDispatch(dispatch, event, providerEmailId) {
    const current = await redis.get(emailDispatchKey(dispatch.id));
    if (!current) return false;
    const next = {
        ...current,
        ...event,
        providerEmailId: providerEmailId || current.providerEmailId,
        updatedAt: new Date().toISOString(),
        events: event.event ? [event.event, ...(current.events || [])].slice(0, 50) : (current.events || []),
    };
    await redis.eval(SAVE_EMAIL_DELIVERY_SCRIPT, [
        emailDispatchKey(dispatch.id),
        emailIdIndexKey(providerEmailId || current.providerEmailId || ''),
    ], [JSON.stringify(next), String(EMAIL_RECORD_TTL_SECONDS)]);
    return true;
}

async function sendMonthlyClientCode(entitlementId, idempotencyKey, distributionRunId = null, snapshot = null) {
    const entitlement = await redis.get(entitlementKey(entitlementId));
    if (!entitlement) throw new Error('Monthly entitlement not found.');
    const today = getSouthAfricanDate();
    const status = getEntitlementStatus(entitlement, today);
    if (status !== 'Active') throw new Error(`Cannot email a monthly code while the entitlement is ${status.toLowerCase()}.`);
    if (!looksLikeEmail(entitlement.email) || !isValidPhone(entitlement.customerPhone)) {
        throw new Error('The client needs a valid email address and contact number before a code can be sent.');
    }
    if (snapshot && (snapshot.codeDigest !== entitlement.currentCodeDigest
        || snapshot.email !== entitlement.email)) {
        throw new Error('The entitlement changed after the distribution preview. Create a new preview before sending.');
    }
    const dedupeId = `${entitlementId}:${idempotencyKey}`;
    const existingId = await redis.get(emailDedupeKey(dedupeId));
    if (existingId) {
        const existing = await redis.get(emailDispatchKey(existingId));
        if (existing) return existing;
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const dispatch = {
        id,
        entitlementId,
        recipient: entitlement.email,
        codeReference: maskCode(entitlement.code),
        sendType: distributionRunId ? 'bulk' : 'individual',
        distributionRunId,
        status: 'sending',
        createdAt: now,
        updatedAt: now,
        events: [],
    };
    const creation = await redis.eval(CREATE_EMAIL_DISPATCH_SCRIPT, [
        emailDispatchKey(id),
        emailDispatchIndexKey(entitlementId),
        emailDedupeKey(dedupeId),
    ], [id, String(EMAIL_RECORD_TTL_SECONDS), JSON.stringify(dispatch), String(EMAIL_HISTORY_LIMIT), String(EMAIL_RECORD_TTL_SECONDS)]);
    if (Array.isArray(creation) && creation[0] === 'DUPLICATE') {
        return await redis.get(emailDispatchKey(creation[1])) || dispatch;
    }

    let delivery;
    try {
        delivery = await sendMonthlyAccessCodeEmail({
            customerName: entitlement.customerName,
            customerEmail: entitlement.email,
            customerPhone: entitlement.customerPhone,
            businessName: entitlement.businessName,
            clientType: entitlement.clientType,
            packageTier: entitlement.packageTier,
            monthlyAllowance: entitlement.monthlyAllowance,
            creditsAvailable: entitlement.creditsAvailable,
            billingAnchor: entitlement.billingAnchor,
            validUntil: entitlement.validUntil,
            code: snapshot?.code || entitlement.code,
        }, `monthly-code-${distributionRunId || idempotencyKey}-${entitlementId}`);
    } catch (error) {
        await updateDispatch(dispatch, {
            status: 'failed',
            failureReason: error instanceof Error ? error.message : 'Email provider rejected the message.',
            event: { type: 'send_failed', occurredAt: new Date().toISOString() },
        });
        throw error;
    }
    if (delivery?.skipped) {
        await updateDispatch(dispatch, {
            status: 'failed',
            failureReason: 'Email service is not configured.',
            event: { type: 'send_skipped', occurredAt: new Date().toISOString() },
        });
        throw new Error('Email service is not configured; the monthly code was not sent.');
    }
    return updateDispatch(dispatch, {
        status: 'accepted',
        providerEmailId: delivery?.id,
        providerStatus: 'accepted',
        event: { type: 'accepted', occurredAt: new Date().toISOString() },
    }, delivery?.id).then(async () => redis.get(emailDispatchKey(id)));
}

export async function sendMonthlyCodeToClient({ entitlementId, idempotencyKey }) {
    if (!entitlementId) throw new Error('Monthly entitlement id is required.');
    if (!/^[\w:-]{8,160}$/.test(String(idempotencyKey || ''))) {
        throw new Error('A valid email-send idempotency key is required.');
    }
    return sendMonthlyClientCode(entitlementId, String(idempotencyKey));
}

export async function createMonthlyCodeDistributionForClient({ entitlementId, adminName }) {
    if (!entitlementId) throw new Error('Monthly entitlement id is required.');
    const preview = await createMonthlyDistributionPreview(adminName, [entitlementId], 'individual');
    if (!preview.eligible.length) {
        throw new Error(preview.excluded[0]?.reason
            ? `This client is excluded from distribution: ${preview.excluded[0].reason}.`
            : 'This client is not eligible for code distribution.');
    }
    return preview;
}

async function sendDistributionReport(run) {
    if (!run.completedAtSA || run.reportStatus === 'sent') return run;
    run.reportStatus = 'sending';
    await redis.set(emailRunKey(run.id), run, { ex: EMAIL_RUN_TTL_SECONDS });
    try {
        const result = await sendMonthlyDistributionReport(run);
        if (result?.skipped) throw new Error('Email service is not configured.');
        run.reportStatus = 'sent';
        run.reportProviderEmailId = result?.id || null;
        run.reportSentAt = new Date().toISOString();
    } catch (error) {
        run.reportStatus = 'failed';
        run.reportFailureReason = error instanceof Error ? error.message : 'Business report email failed.';
    }
    await redis.set(emailRunKey(run.id), run, { ex: EMAIL_RUN_TTL_SECONDS });
    return run;
}

export async function sendMonthlyCodesForRun(runId, retryFailures = false) {
    if (!/^[\w-]{30,40}$/.test(String(runId || ''))) throw new Error('A valid distribution run id is required.');
    const run = await redis.get(emailRunKey(runId));
    if (!run) throw new Error('Monthly email distribution preview not found.');
    if (!retryFailures && !['preview', 'sending', 'completed', 'completed_with_failures', 'needs_review'].includes(run.status)) return run;
    if (retryFailures && !['completed_with_failures', 'sending'].includes(run.status)) {
        throw new Error('Only completed distributions with failures can be retried.');
    }
    const lock = await redis.set(emailRunLockKey(runId), 'locked', { nx: true, ex: 600 });
    if (lock !== 'OK') return { ...run, status: 'sending' };
    try {
        run.status = 'sending';
        run.updatedAt = new Date().toISOString();
        await redis.set(emailRunKey(runId), run, { ex: EMAIL_RUN_TTL_SECONDS });
        const records = run.recipients || [];
        const actionable = records.filter((client) => {
            const previous = (run.results || []).find((result) => result.entitlementId === client.id);
            return retryFailures ? previous?.status === 'failed' : !previous;
        }).slice(0, MONTHLY_EMAIL_BATCH_SIZE);
        for (const client of actionable) {
            const previous = (run.results || []).find((result) => result.entitlementId === client.id);
            const attempt = (previous?.attempt || 0) + 1;
            try {
                const dispatch = await sendMonthlyClientCode(
                    client.id,
                    retryFailures ? `${runId}:${client.id}:retry:${attempt}` : `${runId}:${client.id}`,
                    runId,
                    client,
                );
                const result = {
                    entitlementId: client.id,
                    dispatchId: dispatch.id,
                    customerName: client.customerName,
                    customerTypeLabel: client.clientTypeLabel,
                    packageLabel: client.packageLabel,
                    email: client.email,
                    code: client.code,
                    status: dispatch.status,
                    deliveryLabel: dispatch.status === 'accepted' ? 'Accepted by provider · delivery pending' : dispatch.status,
                    attempt,
                };
                run.results = [...(run.results || []).filter((entry) => entry.entitlementId !== client.id), result];
            } catch (error) {
                const result = {
                    entitlementId: client.id,
                    customerName: client.customerName,
                    customerTypeLabel: client.clientTypeLabel,
                    packageLabel: client.packageLabel,
                    email: client.email,
                    code: client.code,
                    status: 'failed',
                    attempt,
                    failureReason: error instanceof Error ? error.message : 'Email could not be sent.',
                };
                run.results = [...(run.results || []).filter((entry) => entry.entitlementId !== client.id), result];
            }
            run.updatedAt = new Date().toISOString();
            await redis.set(emailRunKey(runId), run, { ex: EMAIL_RUN_TTL_SECONDS });
        }
        const stillPending = records.some((entitlementId) => {
            const previous = (run.results || []).find((result) => result.entitlementId === entitlementId.id);
            return retryFailures ? previous?.status === 'failed' : !previous;
        });
        const uncertain = run.results.some((result) => result.status === 'sending');
        run.status = stillPending ? 'sending'
            : uncertain ? 'needs_review'
                : run.results.some((result) => result.status === 'failed') ? 'completed_with_failures' : 'completed';
        if (!stillPending && !uncertain) {
            const completed = new Date();
            run.completedAt = completed.toISOString();
            run.completedAtSA = formatSouthAfricanDateTime(completed);
        }
        run.updatedAt = new Date().toISOString();
        await redis.set(emailRunKey(runId), run, { ex: EMAIL_RUN_TTL_SECONDS });
        if (run.completedAtSA) await sendDistributionReport(run);
        return run;
    } finally {
        await redis.del(emailRunLockKey(runId));
    }
}

export async function recordResendEmailEvent({ webhookId, providerEmailId, eventType, occurredAt }) {
    const dispatchId = await redis.get(emailIdIndexKey(providerEmailId));
    if (!dispatchId) return 'NOT_FOUND';
    const statusByType = {
        'email.delivered': 'delivered',
        'email.bounced': 'failed',
        'email.failed': 'failed',
        'email.complained': 'failed',
    };
    const status = statusByType[eventType];
    if (!status) return 'IGNORED';
    const event = {
        status,
        providerStatus: eventType,
        occurredAt: occurredAt || new Date().toISOString(),
        event: { type: eventType, occurredAt: occurredAt || new Date().toISOString() },
    };
    return redis.eval(APPLY_RESEND_EVENT_SCRIPT, [
        emailDispatchKey(dispatchId),
        emailIdIndexKey(providerEmailId),
        emailEventKey(webhookId),
    ], [String(60 * 60 * 24 * 90), JSON.stringify(event), String(EMAIL_RECORD_TTL_SECONDS)]);
}

export async function reserveMonthlyWash({
    promoCode,
    email,
    bookingDate,
    reservationId,
    reference,
    bookingDetails,
    expectedClientType,
    expectedPackageTier,
}) {
    const normalisedCode = String(promoCode || '').trim().toUpperCase();
    const normalisedEmail = normaliseEmail(email);
    const entitlement = await getMonthlyPromoForCode(normalisedCode);
    if (!entitlement) return { status: 'NOT_FOUND' };

    const billingAnchor = entitlement.billingAnchor || entitlement.validFrom;
    const billingPeriod = getBillingPeriod(bookingDate, billingAnchor);
    const currentPeriod = getBillingPeriod(getSouthAfricanDate(), billingAnchor);
    await migratePeriodHistory(entitlement.id, billingPeriod, billingAnchor);
    await migratePeriodHistory(entitlement.id, currentPeriod, billingAnchor);
    const currentEntitlement = await ensureCreditLedger(entitlement, currentPeriod);
    const period = billingPeriod.start;
    const expiresAt = Date.now() + MONTHLY_RESERVATION_TTL_SECONDS * 1000;
    const reservation = {
        ...bookingDetails,
        entitlementId: entitlement.id,
        reservationId,
        reference,
        period,
        bookingDate,
        expiresAt,
        email: normalisedEmail,
        codeDigest: digest(normalisedCode),
        clientType: expectedClientType || '',
        packageTier: expectedPackageTier || '',
        createdAt: new Date().toISOString(),
    };
    const result = await redis.eval(RESERVE_WASH_SCRIPT, [
        entitlementKey(entitlement.id),
        periodUsageKey(entitlement.id, period),
        periodReservationsKey(entitlement.id, period),
        reservationKey(reservationId),
        allReservationsKey(entitlement.id),
    ], [
        digest(normalisedCode),
        normalisedEmail,
        bookingDate,
        reference,
        String(Date.now()),
        String(expiresAt),
        reservationId,
        JSON.stringify(reservation),
        String(MONTHLY_RESERVATION_TTL_SECONDS),
        expectedClientType || '',
        expectedPackageTier || '',
        new Date().toISOString(),
    ]);

    return {
        ...getRedisStatus(result),
        entitlement: currentEntitlement,
        period,
        reservationId,
        expiresAt,
    };
}

export function getMonthlyReservationError(status) {
    const errors = {
        REPLACED: { statusCode: 410, message: 'This monthly promo code has been replaced. Ask the business for your current code.' },
        ARCHIVED: { statusCode: 410, message: 'This monthly wash entitlement is no longer available.' },
        INACTIVE: { statusCode: 410, message: 'This monthly wash entitlement is inactive. Please contact the business.' },
        EMAIL_MISMATCH: { statusCode: 403, message: 'Use the email address assigned to this monthly wash package.' },
        CLIENT_TYPE_MISMATCH: { statusCode: 403, message: 'The selected customer type does not match this monthly entitlement.' },
        PACKAGE_MISMATCH: { statusCode: 403, message: 'The selected Standard or Premium package does not match this monthly entitlement.' },
        NOT_YET_VALID: { statusCode: 403, message: 'This monthly wash package is not active for the selected booking date.' },
        EXPIRED: { statusCode: 410, message: 'This monthly wash package has expired.' },
        LIMIT_REACHED: { statusCode: 409, message: 'The booking limit for this monthly billing period is used or reserved. Choose a date in another billing period or book at the normal price.' },
        CREDITS_EXHAUSTED: { statusCode: 409, message: 'There are no prepaid washes left on this monthly package. Contact the business to record a renewal payment.' },
        ALREADY_USED: { statusCode: 409, message: 'This booking has already used a monthly wash.' },
        ALREADY_RESERVED: { statusCode: 409, message: 'This booking already has a monthly wash reservation.' },
        INVALID_ALLOWANCE: { statusCode: 500, message: 'The monthly wash package is not configured correctly.' },
        NOT_FOUND: { statusCode: 404, message: 'Monthly promo code not found.' },
    };
    return errors[status] || { statusCode: 409, message: 'Could not reserve a monthly wash. Please try again.' };
}

export async function checkMonthlyWashAvailability({
    promoCode,
    email,
    bookingDate,
    expectedClientType,
    expectedPackageTier,
}) {
    const normalisedCode = String(promoCode || '').trim().toUpperCase();
    const normalisedEmail = normaliseEmail(email);
    if (!normalisedCode) throw new Error('Enter your monthly access code.');
    if (!looksLikeEmail(normalisedEmail)) throw new Error('Enter the email address assigned to your monthly package.');
    if (!isValidDate(bookingDate)) throw new Error('Choose a valid booking date to check your monthly washes.');

    let entitlement = await getMonthlyPromoForCode(normalisedCode);
    if (!entitlement) return { status: 'NOT_FOUND' };
    const codeDigest = digest(normalisedCode);
    const validCode = entitlement.codeDigests
        ? entitlement.codeDigests.includes(codeDigest)
        : entitlement.currentCodeDigest === codeDigest;
    if (!validCode) return { status: 'REPLACED' };
    if (entitlement.archived) return { status: 'ARCHIVED' };
    if (!entitlement.active) return { status: 'INACTIVE' };
    if (normaliseEmail(entitlement.email) !== normalisedEmail) return { status: 'EMAIL_MISMATCH' };
    if (expectedClientType && entitlement.clientType !== expectedClientType) return { status: 'CLIENT_TYPE_MISMATCH' };
    if (expectedPackageTier && entitlement.packageTier !== expectedPackageTier) return { status: 'PACKAGE_MISMATCH' };
    if (entitlement.validFrom && bookingDate < entitlement.validFrom) return { status: 'NOT_YET_VALID' };
    if (entitlement.validUntil && bookingDate > entitlement.validUntil) return { status: 'EXPIRED' };

    const billingAnchor = entitlement.billingAnchor || entitlement.validFrom;
    const period = getBillingPeriod(bookingDate, billingAnchor);
    await migratePeriodHistory(entitlement.id, period, billingAnchor);
    entitlement = await ensureCreditLedger(entitlement, period);
    await redis.eval(CLEAN_EXPIRED_RESERVATIONS_SCRIPT, [
        entitlementKey(entitlement.id),
        allReservationsKey(entitlement.id),
    ], [String(Date.now()), new Date().toISOString()]);
    entitlement = await redis.get(entitlementKey(entitlement.id));
    entitlement = await ensureCreditLedger(entitlement, period);

    const [used, reserved] = await Promise.all([
        redis.scard(periodUsageKey(entitlement.id, period.start)),
        redis.zcard(periodReservationsKey(entitlement.id, period.start)),
    ]);
    const usedCount = Number(used);
    const reservedCount = Number(reserved);
    const creditsAvailable = Number(entitlement.creditsAvailable || 0);
    const periodRemaining = Math.max(Number(entitlement.monthlyAllowance) - usedCount - reservedCount, 0);
    const availableWashes = Math.min(creditsAvailable, periodRemaining);
    const status = usedCount + reservedCount >= Number(entitlement.monthlyAllowance)
        ? 'LIMIT_REACHED'
        : creditsAvailable < 1
            ? 'CREDITS_EXHAUSTED'
            : 'OK';

    return {
        status,
        allowance: Number(entitlement.monthlyAllowance),
        used: usedCount,
        reserved: reservedCount,
        creditsAvailable,
        periodRemaining,
        availableWashes,
        period: period.start,
    };
}

export async function releaseMonthlyWashReservation({ entitlementId, period, reservationId }) {
    const [reservation, entitlement] = await Promise.all([
        redis.get(reservationKey(reservationId)),
        redis.get(entitlementKey(entitlementId)),
    ]);
    const effectivePeriod = reservation?.bookingDate && entitlement
        ? getBillingPeriod(reservation.bookingDate, entitlement.billingAnchor || entitlement.validFrom).start
        : period;
    return Boolean(await redis.eval(RELEASE_WASH_SCRIPT, [
        reservationKey(reservationId),
        periodReservationsKey(entitlementId, period),
        allReservationsKey(entitlementId),
        entitlementKey(entitlementId),
        periodReservationsKey(entitlementId, effectivePeriod),
    ], [reservationId, new Date().toISOString()]));
}

export async function confirmMonthlyWashReservation({
    entitlementId,
    period,
    reservationId,
    reference,
    booking,
}) {
    const confirmedAt = new Date().toISOString();
    const confirmedBooking = {
        ...booking,
        status: 'confirmed',
        paymentMethod: 'monthly-entitlement',
        paymentStatus: 'covered',
        confirmedAt,
    };
    let effectivePeriod = period;
    const historyRecord = {
        status: 'used',
        reference,
        period,
        bookingDate: booking.bookingDate,
        bookingTime: booking.bookingTime,
        customerName: `${booking.customer?.firstName || ''} ${booking.customer?.surname || ''}`.trim(),
        email: normaliseEmail(booking.customer?.email),
        registration: normaliseReg(booking.customer?.registration),
        vehicleType: booking.vehicleType || '',
        packageName: booking.packageName || '',
        promoCode: booking.appliedPromo,
        confirmedAt,
    };
    const entitlement = await redis.get(entitlementKey(entitlementId));
    if (entitlement) {
        const periodDetails = getBillingPeriod(booking.bookingDate, entitlement.billingAnchor || entitlement.validFrom);
        effectivePeriod = periodDetails.start;
        historyRecord.period = effectivePeriod;
        await migratePeriodHistory(entitlementId, periodDetails, entitlement.billingAnchor || entitlement.validFrom);
        await ensureCreditLedger(entitlement, periodDetails);
        await redis.eval(CLEAN_EXPIRED_RESERVATIONS_SCRIPT, [
            entitlementKey(entitlementId),
            allReservationsKey(entitlementId),
        ], [String(Date.now()), confirmedAt]);
    }
    const result = await redis.eval(CONFIRM_WASH_SCRIPT, [
        entitlementKey(entitlementId),
        periodUsageKey(entitlementId, effectivePeriod),
        periodReservationsKey(entitlementId, effectivePeriod),
        reservationKey(reservationId),
        historyKey(entitlementId),
        bookingKey(reference),
        bookingSlotKey(booking.bookingDate, booking.bookingTime),
        confirmedBookingKey(reference),
        allReservationsKey(entitlementId),
    ], [
        reservationId,
        reference,
        JSON.stringify(historyRecord),
        JSON.stringify(confirmedBooking),
        String(CONFIRMED_BOOKING_TTL_SECONDS),
        String(Date.now()),
        confirmedAt,
    ]);
    return result;
}
