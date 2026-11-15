import test, { mock } from 'node:test';
import assert from 'node:assert/strict';

const values = new Map();
const redis = {
    async get(key) {
        return values.has(key) ? structuredClone(values.get(key)) : null;
    },
    async exists(key) {
        return values.has(key) ? 1 : 0;
    },
    async eval(script, keys, args) {
        if (script.includes("local existingPurchase = redis.call('GET', KEYS[5])")) {
            const entitlement = JSON.parse(args[0]);
            values.set(keys[0], entitlement);
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

const { provisionMonthlyEntitlementFromPaidPurchase } = await import('../api/_lib/monthly-promos.js');

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
            if (entitlement.creditsAvailable > 0) assert.equal(result.emailStatus, 'accepted');
        }
    }
});
