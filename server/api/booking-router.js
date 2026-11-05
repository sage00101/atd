import './_lib/load-env.js';
import availability from '../handlers/bookings-availability.js';
import cancelBooking from '../handlers/bookings-cancel.js';
import onsite from '../handlers/bookings-onsite.js';
import confirmOnsitePayment from '../handlers/onsite-confirm-payment.js';
import yocoCheckout from '../handlers/yoco-checkout.js';
import monthlyValidation from '../handlers/monthly-validation.js';
import bookingRequests from '../handlers/booking-requests.js';
import bookingRequestsAdmin from '../handlers/booking-requests-admin.js';

export const config = { api: { bodyParser: false } };

const handlers = {
    availability,
    cancel: cancelBooking,
    onsite,
    'confirm-onsite-payment': confirmOnsitePayment,
    'yoco-checkout': yocoCheckout,
    'monthly-validate': monthlyValidation,
    'booking-request': bookingRequests,
    'booking-request-admin': bookingRequestsAdmin,
};

function getRoute(req) {
    const queryRoute = req.query?.__route;
    if (typeof queryRoute === 'string') return queryRoute;
    if (Array.isArray(queryRoute)) return queryRoute[0];
    return new URL(req.url || '/', 'http://localhost').searchParams.get('__route');
}

function readJsonBody(req) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        req.on('data', (chunk) => chunks.push(chunk));
        req.on('end', () => {
            try {
                const rawBody = Buffer.concat(chunks).toString('utf8');
                resolve(rawBody ? JSON.parse(rawBody) : {});
            } catch (error) {
                reject(error);
            }
        });
        req.on('error', reject);
    });
}

export default async function handler(req, res) {
    const route = getRoute(req);
    const routeHandler = handlers[route];
    if (!routeHandler) {
        res.status(404).json({ message: 'API route not found.' });
        return;
    }

    if (String(req.headers['content-type'] || '').includes('application/json')
        && (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH')) {
        try {
            req.body = await readJsonBody(req);
        } catch {
            res.status(400).json({ message: 'Invalid JSON request body.' });
            return;
        }
    }

    await routeHandler(req, res);
}
