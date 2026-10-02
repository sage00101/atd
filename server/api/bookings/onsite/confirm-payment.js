import crypto from 'node:crypto';
import { applyCors } from '../../_lib/cors.js';
import { sendReceiptEmail } from '../../_lib/email.js';
import {
    getBooking,
    markOnsiteBookingPaid,
    markSharedPromoCodeUsed,
} from '../../_lib/store.js';

function safeEqual(left, right) {
    const leftDigest = crypto.createHash('sha256').update(String(left)).digest();
    const rightDigest = crypto.createHash('sha256').update(String(right)).digest();
    return crypto.timingSafeEqual(leftDigest, rightDigest);
}

export default async function handler(req, res) {
    if (applyCors(req, res)) return;
    if (req.method !== 'POST') {
        res.status(405).json({ message: 'Method not allowed.' });
        return;
    }

    const expectedKey = process.env.ADMIN_API_KEY;
    const suppliedKey = req.headers['x-admin-key'];
    if (!expectedKey || !suppliedKey || !safeEqual(suppliedKey, expectedKey)) {
        res.status(401).json({ message: 'Admin key is missing or invalid.' });
        return;
    }

    const reference = String(req.body?.reference || '').trim();
    if (!reference) {
        res.status(400).json({ message: 'Booking reference is required.' });
        return;
    }

    try {
        const booking = await getBooking(reference);
        if (!booking || booking.paymentMethod !== 'onsite') {
            res.status(404).json({ message: 'Onsite booking not found.' });
            return;
        }
        if (booking.status === 'paid') {
            res.status(200).json({ paid: true, alreadyConfirmed: true, receiptSent: false });
            return;
        }

        if (booking.appliedPromo && booking.promoReservationId) {
            const redeemed = await markSharedPromoCodeUsed(booking.appliedPromo, booking.promoReservationId);
            if (!redeemed) {
                res.status(409).json({ message: 'The promo reservation is no longer valid. Resolve the booking before confirming payment.' });
                return;
            }
        }

        const paidBooking = await markOnsiteBookingPaid(reference);
        if (!paidBooking) {
            res.status(409).json({ message: 'Could not mark the onsite booking as paid.' });
            return;
        }

        const customer = booking.customer || {};
        const amountCents = Number(booking.amountCents || 0);
        const originalAmountCents = Number(booking.originalAmountCents || amountCents);
        const discountCents = Number(booking.discountCents || 0);
        const formatZar = (cents) => `R${(cents / 100).toFixed(2)}`;
        const receipt = {
            reference,
            bookingDate: booking.bookingDate,
            bookingTime: booking.bookingTime,
            packageName: booking.packageName,
            vehicleType: booking.vehicleType,
            registration: customer.registration,
            customerName: `${customer.firstName || ''} ${customer.surname || ''}`.trim(),
            customerEmail: customer.email,
            customerMobile: customer.mobile,
            address: customer.address,
            originalAmountZar: formatZar(originalAmountCents),
            discountZar: discountCents > 0 ? formatZar(discountCents) : null,
            amountZar: formatZar(amountCents),
            promoCode: booking.appliedPromo || null,
            promoApplied: Boolean(booking.appliedPromo && discountCents > 0),
            paymentMethod: 'onsite',
            paymentStatus: 'paid',
        };

        let receiptSent = false;
        try {
            const result = await sendReceiptEmail(receipt);
            receiptSent = !result?.skipped;
        } catch (error) {
            console.error('[onsite paid receipt email failed]', reference, error);
        }

        res.status(200).json({ paid: true, reference, receiptSent });
    } catch (error) {
        console.error('[onsite payment confirmation failed]', reference, error);
        res.status(500).json({ message: 'Could not confirm the onsite payment.' });
    }
}
