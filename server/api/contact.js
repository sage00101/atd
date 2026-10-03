import { applyCors } from './_lib/cors.js';
import { sendSupportRequestEmail } from './_lib/email.js';

const ALLOWED_ISSUE_TYPES = new Set([
    'Booking support',
    'Payment support',
    'Website support',
    'Other support',
]);

function readText(value, maxLength) {
    return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function isValidEmail(value) {
    return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

// POST /api/contact
export default async function handler(req, res) {
    if (applyCors(req, res)) return;
    if (req.method !== 'POST') {
        res.status(405).json({ success: false, message: 'Method not allowed.' });
        return;
    }

    const request = {
        name: readText(req.body?.name, 120),
        email: readText(req.body?.email, 254).toLowerCase(),
        issueType: readText(req.body?.issueType, 40),
        reference: readText(req.body?.reference, 120).replace(/[\r\n]/g, ' '),
        message: readText(req.body?.message, 4000),
    };

    if (request.name.length < 2) {
        res.status(400).json({ success: false, message: 'Enter your name.' });
        return;
    }
    if (!isValidEmail(request.email)) {
        res.status(400).json({ success: false, message: 'Enter a valid email address.' });
        return;
    }
    if (!ALLOWED_ISSUE_TYPES.has(request.issueType)) {
        res.status(400).json({ success: false, message: 'Choose a support category.' });
        return;
    }
    if (request.message.length < 5) {
        res.status(400).json({ success: false, message: 'Please include a little more detail in your message.' });
        return;
    }

    try {
        const result = await sendSupportRequestEmail(request);
        if (result?.skipped) {
            res.status(503).json({ success: false, message: 'Support email is temporarily unavailable. Please email support@a10tion.co.za directly.' });
            return;
        }
        res.status(200).json({ success: true });
    } catch (error) {
        console.error('[support request email failed]', error);
        res.status(502).json({ success: false, message: 'Your message could not be sent. Please try again or email support@a10tion.co.za directly.' });
    }
}