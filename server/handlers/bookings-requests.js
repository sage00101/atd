import fs from 'node:fs/promises';
import { IncomingForm } from 'formidable';
import '../api/_lib/load-env.js';
import { applyCors } from '../api/_lib/cors.js';
import {
    createBookingApprovalRequest,
    getBookingRequestStatus,
} from '../api/_lib/booking-requests.js';

export const config = { api: { bodyParser: false } };

function parseMultipart(req) {
    return new Promise((resolve, reject) => {
        const form = new IncomingForm({ multiples: true, maxFileSize: 10 * 1024 * 1024 });
        form.parse(req, (error, fields, files) => {
            if (error) reject(error);
            else resolve({ fields, files });
        });
    });
}

function sendError(res, error) {
    const message = error instanceof Error ? error.message : 'Booking request could not be submitted.';
    const status = error?.statusCode || (message.includes('Monthly promo code not found') ? 404
        : message.includes('already used or reserved') ? 409
            : message.includes('mismatch') || message.includes('does not match') || message.includes('Use the email') ? 403
                : 400);
    res.status(status).json({ message });
}

export default async function handler(req, res) {
    if (applyCors(req, res)) return;
    if (req.method === 'GET') {
        try {
            const result = await getBookingRequestStatus(req.query?.reference, req.query?.token);
            if (!result) {
                res.status(404).json({ message: 'This booking continuation link is invalid or has expired.' });
                return;
            }
            res.status(200).json(result);
        } catch (error) {
            console.error('[booking request status failed]', error);
            res.status(500).json({ message: 'Booking request status could not be loaded.' });
        }
        return;
    }
    if (req.method !== 'POST') {
        res.status(405).json({ message: 'Method not allowed.' });
        return;
    }

    try {
        let fields = {};
        let files = {};
        if (String(req.headers['content-type'] || '').includes('multipart/form-data')) {
            ({ fields, files } = await parseMultipart(req));
        } else {
            fields = req.body || {};
        }
        const rawBooking = Array.isArray(fields.booking) ? fields.booking[0] : fields.booking;
        const booking = typeof rawBooking === 'string' ? JSON.parse(rawBooking) : rawBooking;
        if (!booking || typeof booking !== 'object' || Array.isArray(booking)) {
            res.status(400).json({ message: 'Invalid booking payload.' });
            return;
        }

        let contractFile = null;
        if (files.contract_files) {
            const uploads = Array.isArray(files.contract_files) ? files.contract_files : [files.contract_files];
            const [file] = uploads;
            const fileName = String(file?.originalFilename || '').toLowerCase();
            const allowedType = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'].includes(file?.mimetype)
                || fileName.endsWith('.pdf') || fileName.endsWith('.doc') || fileName.endsWith('.docx');
            const allowed = uploads.length === 1 && file && file.size <= 10 * 1024 * 1024 && allowedType;
            if (!allowed) {
                res.status(400).json({ message: 'Attach one Word document or PDF no larger than 10 MB.' });
                return;
            }
            const contents = await fs.readFile(file.filepath);
            contractFile = { base64: contents.toString('base64'), name: file.originalFilename };
        }

        const result = await createBookingApprovalRequest(booking, contractFile);
        res.status(201).json(result);
    } catch (error) {
        sendError(res, error);
    }
}
