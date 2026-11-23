import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

const values = new Map();
let beforeUpdate;
const redis = {
    async get(key) {
        return values.has(key) ? structuredClone(values.get(key)) : null;
    },
    async exists(key) {
        return values.has(key) ? 1 : 0;
    },
    async set(key, value) {
        values.set(key, value);
    },
    async zrange() {
        return [];
    },
    async lrange() {
        return [];
    },
    async keys(pattern) {
        const prefix = pattern.slice(0, -1);
        return [...values.keys()].filter((key) => key.startsWith(prefix));
    },
    async srem() {},
    async del(...keys) {
        keys.forEach((key) => values.delete(key));
    },
    async eval(script, keys, args) {
        if (script.includes("entitlement.creditsAvailable ~= nil and entitlement.creditsReserved ~= nil")) {
            return ['OK', values.get(keys[0])];
        }
        if (script.includes("local nextRecord = cjson.decode(ARGV[1])")) {
            if (beforeUpdate) {
                beforeUpdate();
                beforeUpdate = null;
            }
            const existing = values.get(keys[0]);
            if ((existing.updatedAt || '') !== args[6]) return 'STALE';
            if (args[5] === '1') {
                for (const digest of [...(existing.codeDigests || []), existing.currentCodeDigest].filter(Boolean)) {
                    values.delete(`promo:monthly:code:${digest}`);
                }
            }
            values.set(keys[0], JSON.parse(args[0]));
            return 'OK';
        }
        if (script.includes("local nextRecord = cjson.decode(ARGV[2])")) {
            const next = JSON.parse(args[1]);
            next.creditsAvailable = Number(args[3]);
            next.creditsReserved = 0;
            values.set(keys[0], next);
            return ['OK', next];
        }
        if (script.includes("local existingPurchase = redis.call('GET', KEYS[5])")) {
            const purchase = values.get(keys[4]);
            if (purchase) return ['PURCHASE_EXISTS', purchase];
            const customer = values.get(keys[2]);
            if (customer) {
                const pending = JSON.parse(args[2]);
                values.set(keys[4], `pending:${pending.reference}`);
                values.set(keys[5], pending);
                return ['EMAIL_EXISTS', customer];
            }
            const entitlement = JSON.parse(args[0]);
            values.set(keys[0], entitlement);
            values.set(keys[2], args[1]);
            values.set(keys[3], args[1]);
            values.set(keys[4], args[1]);
            return ['OK'];
        }
        if (script.includes("local existing = redis.call('GET', KEYS[3])")) {
            const dispatch = JSON.parse(args[2]);
            values.set(keys[0], dispatch);
            values.set(keys[2], args[0]);
            return ['CREATED', args[0]];
        }
        if (script.includes('local incoming = cjson.decode(ARGV[1])')) {
            const incoming = JSON.parse(args[0]);
            values.set(keys[0], {
                ...values.get(keys[0]),
                ...incoming,
                events: incoming.events,
            });
            if (incoming.providerEmailId) values.set(keys[1], incoming.id);
            return 'OK';
        }
        throw new Error('Unexpected Redis script.');
    },
};

mock.module('../api/_lib/redis.js', { exports: { redis } });
mock.module('../api/_lib/email.js', {
    exports: {
        sendMonthlyAccessCodeEmail: async () => ({ id: 'local-test-email', status: 'accepted' }),
        sendMonthlyDistributionReport: async () => ({ id: 'local-test-report', status: 'accepted' }),
    },
});

const {
    provisionMonthlyEntitlementFromPaidPurchase,
    createMonthlyEntitlement,
    updateMonthlyEntitlement,
    changeMonthlyEntitlementPackage,
    recordMonthlyEntitlementPayment,
    lookupMonthlyCodeProfile,
    checkMonthlyWashAvailability,
    reserveMonthlyWash,
    deleteMonthlyEntitlementPermanently,
} = await import('../api/_lib/monthly-promos.js');

test('deactivation revokes every code and prevents using retained credits; deletion removes the account', async () => {
    values.clear();
    const created = await provisionMonthlyEntitlementFromPaidPurchase({
        purchaseType: 'monthly', reference: 'DEACTIVATE-1', amountCents: 42000,
        paidAt: new Date().toISOString(), contractOption: '3-months',
        packageId: 'private-standard', vehicleType: 'Sedan / Hatchback',
        bookingDate: '2026-11-23', bookingTime: '14:30', paymentMethod: 'online',
        customer: { firstName: 'Test', surname: 'Client', email: 'client@example.test', mobile: '0712345678' },
    });
    const { entitlement } = created;
    const code = entitlement.code;
    const secondCode = 'ATDM-SECOND';
    const secondDigest = crypto.createHash('sha256').update(secondCode).digest('hex');
    values.set(`promo:monthly:entitlement:${entitlement.id}`, {
        ...entitlement,
        codeDigests: [...entitlement.codeDigests, secondDigest],
        codes: [...entitlement.codes, { code: secondCode, digest: secondDigest }],
    });
    values.set(`promo:monthly:code:${secondDigest}`, entitlement.id);
    assert.equal((await lookupMonthlyCodeProfile({ promoCode: code })).status, 'OK');
    assert.equal((await lookupMonthlyCodeProfile({ promoCode: secondCode })).status, 'OK');
    const archived = await updateMonthlyEntitlement(entitlement.id, {
        active: false, archived: true, deactivationReason: 'Deactivated by admin',
    });
    assert.equal(archived.creditsAvailable, 5);
    assert.equal(archived.code, null);
    assert.equal((await lookupMonthlyCodeProfile({ promoCode: code })).status, 'NOT_FOUND');
    assert.equal((await lookupMonthlyCodeProfile({ promoCode: secondCode })).status, 'NOT_FOUND');
    assert.equal((await checkMonthlyWashAvailability({ promoCode: code, email: entitlement.email, bookingDate: '2026-12-01' })).status, 'NOT_FOUND');
    assert.equal((await reserveMonthlyWash({ promoCode: code, email: entitlement.email, bookingDate: '2026-12-01' })).status, 'NOT_FOUND');
    const restored = await updateMonthlyEntitlement(entitlement.id, {
        active: true, archived: false, deactivationReason: 'Restored by admin',
    });
    assert.equal(restored.creditsAvailable, 5);
    assert.equal((await lookupMonthlyCodeProfile({ promoCode: code })).status, 'NOT_FOUND');
    await assert.rejects(deleteMonthlyEntitlementPermanently(entitlement.id), /Deactivate this account first/);
    await updateMonthlyEntitlement(entitlement.id, {
        active: false, archived: true, deactivationReason: 'Deactivated by admin',
    });
    await deleteMonthlyEntitlementPermanently(entitlement.id);
    assert.equal(await redis.get(`promo:monthly:entitlement:${entitlement.id}`), null);
    assert.equal(await redis.get('promo:monthly:purchase:DEACTIVATE-1'), entitlement.id);
});

test('a concurrent account change cannot be overwritten by a stale deactivation', async () => {
    values.clear();
    const created = await provisionMonthlyEntitlementFromPaidPurchase({
        purchaseType: 'monthly', reference: 'STALE-1', amountCents: 42000,
        paidAt: new Date().toISOString(), contractOption: '1-months',
        packageId: 'private-standard', vehicleType: 'Sedan / Hatchback',
        bookingDate: '2026-11-23', customer: {
            firstName: 'Test', surname: 'Client', email: 'client@example.test', mobile: '0712345678',
        },
    });
    const key = `promo:monthly:entitlement:${created.entitlement.id}`;
    beforeUpdate = () => values.set(key, { ...values.get(key), updatedAt: 'changed', creditsAvailable: 0 });
    await assert.rejects(updateMonthlyEntitlement(created.entitlement.id, {
        active: false, archived: true, deactivationReason: 'Deactivated by admin',
    }), /changed while being updated/);
    assert.equal((await redis.get(key)).creditsAvailable, 0);
    assert.equal((await redis.get(key)).active, true);
});

test('permanent deletion fails without removing the account when cleanup lookup fails', async (t) => {
    values.clear();
    const key = 'promo:monthly:entitlement:archived';
    values.set(key, { id: 'archived', email: 'client@example.test', active: false, archived: true });
    t.mock.method(redis, 'keys', async () => { throw new Error('Redis lookup failed'); });
    await assert.rejects(deleteMonthlyEntitlementPermanently('archived'), /Redis lookup failed/);
    assert.ok(await redis.get(key));
});

test('paid package provisioning grants term credits minus the initial website wash', async () => {
    const dateParts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
        timeZone: 'Africa/Johannesburg',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(new Date()).map(({ type, value }) => [type, value]));
    const paidDate = `${dateParts.year}-${dateParts.month}-${dateParts.day}`;
    const packages = [
        { packageId: 'private-standard', clientType: 'private', packageTier: 'standard', allowance: 2, terms: [1, 3] },
        { packageId: 'private-premium', clientType: 'private', packageTier: 'premium', allowance: 4, terms: [1, 3] },
        { packageId: 'business-standard', clientType: 'business', packageTier: 'standard', allowance: 1, terms: [1, 3, 6, 12] },
    ];

    for (const pkg of packages) {
        for (const months of pkg.terms) {
            values.clear();
            const result = await provisionMonthlyEntitlementFromPaidPurchase({
                purchaseType: 'monthly',
                reference: `TEST-${pkg.packageId}-${months}`,
                amountCents: 42000,
                paidAt: new Date().toISOString(),
                contractOption: `${months}-months`,
                packageId: pkg.packageId,
                packageName: pkg.packageId,
                vehicleType: 'Sedan / Hatchback',
                bookingDate: paidDate,
                bookingTime: '14:30',
                paymentMethod: 'online',
                checkoutId: `CHECKOUT-${pkg.packageId}-${months}`,
                customer: {
                    firstName: 'Test',
                    surname: 'Customer',
                    email: 'monthly-test@example.test',
                    mobile: '0712345678',
                    registration: 'ABC123',
                },
            });

            const entitlement = result.entitlement;
            assert.equal(result.status, 'created');
            assert.equal(entitlement.monthlyAllowance, pkg.allowance);
            assert.equal(entitlement.creditsGrantedTotal, pkg.allowance * months);
            assert.equal(entitlement.creditsAvailable, pkg.allowance * months - 1);
            assert.equal(entitlement.creditsUsedTotal, 1);
            assert.equal(entitlement.history[0].reference, `TEST-${pkg.packageId}-${months}`);
            assert.equal(entitlement.history[0].period, `${paidDate.slice(0, 7)}-01`);
            assert.equal(entitlement.paymentHistory[0].initialWashCreditUsed, 1);
            assert.equal(entitlement.contractOption, `${months}-months`);
            assert.ok(entitlement.code);
            assert.equal(result.monthlyCode, entitlement.code);
            assert.equal(entitlement.firstName, 'Test');
            assert.equal(entitlement.surname, 'Customer');
            assert.equal(entitlement.customerPhone, '0712345678');
            assert.equal(entitlement.vehicleType, 'Sedan / Hatchback');
            assert.equal(result.emailStatus, 'accepted');
        }
    }
});

test('repeat paid purchases remain pending and retain only an active existing code on retries', async () => {
    values.clear();
    const booking = {
        purchaseType: 'monthly', reference: 'INITIAL-1', amountCents: 42000,
        paidAt: new Date().toISOString(), contractOption: '1-months',
        packageId: 'private-standard', packageName: 'Standard', vehicleType: 'Sedan / Hatchback',
        bookingDate: '2026-11-23', bookingTime: '14:30', paymentMethod: 'online',
        customer: { firstName: 'Mary Jane', surname: 'Smith', email: 'monthly-test@example.test', mobile: '0712345678', registration: 'ABC123' },
    };
    const first = await provisionMonthlyEntitlementFromPaidPurchase(booking);
    assert.equal(first.entitlement.firstName, 'Mary Jane');
    assert.equal(first.entitlement.surname, 'Smith');
    const repeatBooking = { ...booking, reference: 'RENEWAL-1', contractOption: '3-months' };
    const repeat = await provisionMonthlyEntitlementFromPaidPurchase(repeatBooking);
    const retry = await provisionMonthlyEntitlementFromPaidPurchase(repeatBooking);
    assert.equal(repeat.status, 'needs_manager');
    assert.equal(retry.status, 'needs_manager');
    assert.equal(repeat.monthlyCode, first.monthlyCode);
    assert.equal(retry.monthlyCode, first.monthlyCode);
    assert.equal((await redis.get(`promo:monthly:entitlement:${first.entitlement.id}`)).creditsAvailable, 1);
    values.set(`promo:monthly:entitlement:${first.entitlement.id}`, { ...first.entitlement, active: false });
    assert.equal((await provisionMonthlyEntitlementFromPaidPurchase(repeatBooking)).monthlyCode, '');
});

test('new manual business packages and payments reject legacy terms while existing records remain editable', async () => {
    const existing = {
        id: 'existing-client',
        customerName: 'Test Customer',
        firstName: 'Test',
        surname: 'Customer',
        email: 'monthly-test@example.test',
        customerPhone: '0712345678',
        clientType: 'business',
        packageTier: 'standard',
        packageId: 'business-standard',
        vehicleType: 'Sedan / Hatchback',
        contractOption: '6-months',
        monthlyAllowance: 1,
        validFrom: '2025-01-01',
        validUntil: '2025-06-30',
        creditsAvailable: 0,
        creditsReserved: 0,
        active: true,
        archived: false,
        code: 'ATDM-TESTCODE',
    };
    values.clear();
    values.set(`promo:monthly:entitlement:${existing.id}`, existing);

    const updated = await updateMonthlyEntitlement(existing.id, { businessName: 'Updated business' });
    assert.equal(updated.contractOption, '6-months');
    assert.equal(updated.businessName, 'Updated business');

    for (const contractOption of ['6-months', '12-months']) {
        await assert.rejects(createMonthlyEntitlement({ ...existing, contractOption }), /1 or 3 months/);
        await assert.rejects(changeMonthlyEntitlementPackage({
            entitlementId: existing.id,
            clientType: 'business',
            packageTier: 'standard',
            vehicleType: existing.vehicleType,
            contractOption,
            amountCents: 50000,
            paymentDate: '2025-01-01',
        }), /1 or 3 months/);
        await assert.rejects(recordMonthlyEntitlementPayment({
            entitlementId: existing.id,
            contractOption,
            amountCents: 50000,
            paymentDate: '2025-01-01',
        }), /1 or 3 months/);
    }

    await assert.rejects(updateMonthlyEntitlement(existing.id, { contractOption: '12-months' }), /1 or 3 months/);

    for (const months of [1, 3]) {
        values.set(`promo:monthly:entitlement:${existing.id}`, existing);
        const changed = await changeMonthlyEntitlementPackage({
            entitlementId: existing.id,
            clientType: 'business',
            packageTier: 'standard',
            vehicleType: existing.vehicleType,
            contractOption: `${months}-months`,
            amountCents: 50000,
            paymentDate: '2025-01-01',
        });
        assert.equal(changed.creditsAvailable, months);
        assert.equal(changed.contractOption, `${months}-months`);
    }
});
