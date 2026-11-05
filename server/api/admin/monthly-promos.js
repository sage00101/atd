import crypto from 'node:crypto';
import '../_lib/load-env.js';
import { applyCors } from '../_lib/cors.js';
import {
    createMonthlyEntitlement,
    createMonthlyCodeDistributionForClient,
    createMonthlyDistributionPreview,
    getMonthlyEntitlementsForAdmin,
    getMonthlyDistributionRuns,
    getPendingMonthlyPurchasesForAdmin,
    generateMonthlyEntitlementCode,
    recordMonthlyEntitlementPayment,
    sendMonthlyCodesForRun,
    updateMonthlyEntitlement,
} from '../_lib/monthly-promos.js';

function safeEqual(left, right) {
    const leftDigest = crypto.createHash('sha256').update(String(left)).digest();
    const rightDigest = crypto.createHash('sha256').update(String(right)).digest();
    return crypto.timingSafeEqual(leftDigest, rightDigest);
}

function hasAdminKey(suppliedKey) {
    const expectedKeys = [process.env.ADMIN_API_KEY, process.env.CALENDAR_API_KEY].filter(Boolean);
    return Boolean(suppliedKey && expectedKeys.some((expectedKey) => safeEqual(suppliedKey, expectedKey)));
}

export default async function handler(req, res) {
    if (applyCors(req, res)) return;
    if (!['GET', 'POST', 'PUT', 'DELETE'].includes(req.method)) {
        res.status(405).json({ message: 'Method not allowed.' });
        return;
    }

    if (!hasAdminKey(req.headers['x-admin-key'])) {
        res.status(401).json({ message: 'Admin key is missing or invalid.' });
        return;
    }

    try {
        if (req.method === 'GET') {
            const [entitlements, distributionRuns, pendingPurchases] = await Promise.all([
                getMonthlyEntitlementsForAdmin(),
                getMonthlyDistributionRuns(),
                getPendingMonthlyPurchasesForAdmin(),
            ]);
            res.status(200).json({ entitlements, distributionRuns, pendingPurchases });
            return;
        }

        if (req.method === 'POST' && req.body?.action === 'record-payment') {
            const entitlement = await recordMonthlyEntitlementPayment({
                entitlementId: String(req.body?.id || '').trim(),
                paymentReference: String(req.body?.paymentReference || '').trim(),
                amountCents: req.body?.amountCents,
            });
            res.status(200).json({ entitlement });
            return;
        }

        if (req.method === 'POST' && req.body?.action === 'generate-code') {
            const entitlement = await generateMonthlyEntitlementCode(String(req.body?.id || '').trim());
            res.status(200).json({ entitlement });
            return;
        }

        if (req.method === 'POST' && req.body?.action === 'preview-bulk') {
            res.status(200).json(await createMonthlyDistributionPreview(req.body?.adminName));
            return;
        }
        if (req.method === 'POST' && req.body?.action === 'send-one') {
            const preview = await createMonthlyCodeDistributionForClient({
                entitlementId: String(req.body?.id || '').trim(),
                adminName: req.body?.adminName,
            });
            const run = await sendMonthlyCodesForRun(preview.runId);
            res.status(200).json({ run });
            return;
        }
        if (req.method === 'POST' && ['send-bulk', 'retry-bulk'].includes(req.body?.action)) {
            const run = await sendMonthlyCodesForRun(
                String(req.body?.runId || ''),
                req.body.action === 'retry-bulk',
            );
            res.status(200).json({ run });
            return;
        }

        const id = String(req.body?.id || req.query?.id || '').trim();
        if (req.method === 'POST') {
            const entitlement = await createMonthlyEntitlement(req.body);
            res.status(201).json({ entitlement });
            return;
        }
        if (!id) {
            res.status(400).json({ message: 'Monthly entitlement id is required.' });
            return;
        }

        const update = req.method === 'DELETE'
            ? { active: false, archived: true, deactivationReason: req.body?.deactivationReason }
            : req.body || {};
        const entitlement = await updateMonthlyEntitlement(id, update);
        res.status(200).json({ entitlement });
    } catch (error) {
        const status = error?.message === 'Monthly entitlement not found.' ? 404 : 400;
        res.status(status).json({
            message: error instanceof Error ? error.message : 'Could not update monthly entitlements.',
        });
    }
}
