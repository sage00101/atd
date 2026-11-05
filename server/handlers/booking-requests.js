import fs from 'node:fs/promises';
import { IncomingForm } from 'formidable';
import { applyCors } from '../api/_lib/cors.js';
import {
    createBookingRequest,
    BookingRequestError,
    getBookingRequestByContinuationToken,
    getBookingRequestByStatusToken,
    getPublicBookingRequest,
} from '../api/_lib/booking-approval.js';
import { sendBookingRequestReceivedEmails } from '../api/_lib/email.js';
import { sendBookingRequestSms } from '../api/_lib/sms.js';

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

function first(value) {
    return Array.isArray(value) ? value[0] : value;
}

function getPublicSiteUrl() {
    return process.env.SITE_URL || 'https://sage00101.github.io/atd/';
}

function getStatusUrl(token) {
    const url = new URL(getPublicSiteUrl());
    url.searchParams.set('booking-request', token);
    url.hash = '';
    return url.toString();
}

async function parseRequest(req) {
    if (String(req.headers['content-type'] || '').includes('application/json')) {
        return req.body || {};
    }
    const { fields, files } = await parseMultipart(req);
    let booking;
    try {
        booking = JSON.parse(first(fields.booking) || '{}');
    } catch {
        throw new BookingRequestError('Invalid booking request payload.');
    }
    const contractFiles = files.contract_files
        ? (Array.isArray(files.contract_files) ? files.contract_files : [files.contract_files])
        : [];
    if (contractFiles.length > 1) throw new BookingRequestError('Upload only one monthly contract document.');
    if (contractFiles.length === 1) {
        const [file] = contractFiles;
        const name = String(file.originalFilename || '').toLowerCase();
        const allowed = file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            || file.mimetype === 'application/pdf'
            || name.endsWith('.docx')
            || name.endsWith('.pdf');
        if (!allowed || file.size > 10 * 1024 * 1024) {
            throw new BookingRequestError('Upload a PDF or DOCX monthly contract no larger than 10 MB.');
        }
        booking.contractFileBase64 = (await fs.readFile(file.filepath)).toString('base64');
        booking.contractFileName = file.originalFilename;
    }
    return booking;
}

export default async function handler(req, res) {
    if (applyCors(req, res)) return;
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Referrer-Policy', 'no-referrer');

    if (req.method === 'GET') {
        const statusToken = String(req.query?.token || '').trim();
        const continuationToken = String(req.query?.continuationToken || '').trim();
        if (!statusToken && !continuationToken) {
            res.status(400).json({ message: 'A private booking status link is required.' });
            return;
        }
        try {
            const request = statusToken
                ? await getBookingRequestByStatusToken(statusToken)
                : await getBookingRequestByContinuationToken(continuationToken);
            if (!request) {
                res.status(404).json({ message: 'This booking status link is invalid or has expired.' });
                return;
            }
            const visible = getPublicBookingRequest(request, false);
            res.status(200).json({
                request: visible,
                continuationToken: ['approved', 'processing', 'awaiting_completion'].includes(request.status)
                    ? request.continuationToken || continuationToken || null
                    : null,
                continuationMethod: request.booking?.bookingType === 'monthly-entitlement'
                    ? 'monthly'
                    : request.booking?.requestedPaymentMethod || null,
                summary: {
                    bookingDate: request.booking?.bookingDate || '',
                    bookingTime: request.booking?.bookingTime || '',
                    address: request.booking?.address || request.booking?.customer?.address || '',
                    firstName: request.booking?.customer?.firstName || '',
                },
            });
        } catch (error) {
            console.error('[booking request status lookup failed]', error);
            res.status(500).json({ message: 'Could not load the booking request status.' });
        }
        return;
    }

    if (req.method !== 'POST') {
        res.status(405).json({ message: 'Method not allowed.' });
        return;
    }

    try {
        const booking = await parseRequest(req);
        const { request, statusToken } = await createBookingRequest(booking);
        const statusUrl = getStatusUrl(statusToken);
        const [emailStatus, smsResult] = await Promise.all([
            sendBookingRequestReceivedEmails(request, statusUrl),
            sendBookingRequestSms(request).catch((error) => {
                console.error('[booking request sms failed]', request.reference, error);
                return { failed: true, reason: error instanceof Error ? error.message : String(error) };
            }),
        ]);
        res.status(201).json({
            success: true,
            reference: request.reference,
            status: 'Pending Approval',
            statusUrl,
            emailStatus,
            smsStatus: { businessSent: Boolean(smsResult?.sent), skipped: Boolean(smsResult?.skipped), failed: Boolean(smsResult?.failed) },
            message: emailStatus.customerSent
                ? 'Your request was received. We will email you after it has been reviewed.'
                : 'Your request was received, but we could not confirm email delivery. Please save your status link.',
        });
    } catch (error) {
        console.error('[booking request submission failed]', error);
        res.status(error instanceof BookingRequestError ? 400 : 500).json({
            message: error instanceof Error ? error.message : 'Could not submit your booking request.',
        });
    }
}
