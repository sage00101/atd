import { useCallback, useEffect, useState } from 'react';
import { ArrowRight, CheckCircle2, Clock3, LoaderCircle, RefreshCw, ShieldCheck, XCircle } from 'lucide-react';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
const REQUEST_ENDPOINT = `${API_BASE_URL}/api/bookings/requests`;
const CHECKOUT_ENDPOINT = `${API_BASE_URL}/api/payments/yoco/checkout`;
const ONSITE_ENDPOINT = `${API_BASE_URL}/api/bookings/onsite`;

function formatExpiry(value) {
    return new Intl.DateTimeFormat('en-ZA', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'Africa/Johannesburg',
    }).format(new Date(value));
}

export default function BookingRequestPage() {
    const params = new URLSearchParams(window.location.search);
    const reference = params.get('booking-request') || '';
    const token = params.get('token') || '';
    const [request, setRequest] = useState(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    const loadStatus = useCallback(async () => {
        if (!reference || !token) {
            setError('This secure booking link is incomplete. Please use the link from your email.');
            setLoading(false);
            return;
        }
        try {
            const url = new URL(REQUEST_ENDPOINT, window.location.origin);
            url.searchParams.set('reference', reference);
            url.searchParams.set('token', token);
            const response = await fetch(url, { cache: 'no-store' });
            const result = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(result.message || 'Booking status could not be loaded.');
            setRequest(result);
            setError('');
        } catch (loadError) {
            setError(loadError.message || 'Booking status could not be loaded.');
        } finally {
            setLoading(false);
        }
    }, [reference, token]);

    useEffect(() => {
        loadStatus();
        const timer = window.setInterval(() => {
            if (request?.status === 'pending' || request?.status === 'checkout_starting' || request?.status === 'payment_pending') loadStatus();
        }, 15_000);
        return () => window.clearInterval(timer);
    }, [loadStatus, request?.status]);

    const refreshStatus = async () => {
        if (refreshing) return;
        setRefreshing(true);
        try {
            await loadStatus();
        } finally {
            setRefreshing(false);
        }
    };

    const continueBooking = async () => {
        setSubmitting(true);
        setError('');
        try {
            const body = new FormData();
            body.append('booking', JSON.stringify({
                approvalReference: reference,
                continuationToken: token,
            }));
            const endpoint = request.paymentMethod === 'onsite' ? ONSITE_ENDPOINT : CHECKOUT_ENDPOINT;
            const response = await fetch(endpoint, { method: 'POST', body });
            const result = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(result.message || 'The booking could not be continued.');
            if (result.redirectUrl) {
                window.location.assign(result.redirectUrl);
                return;
            }
            await loadStatus();
        } catch (submitError) {
            setError(submitError.message || 'The booking could not be continued.');
        } finally {
            setSubmitting(false);
        }
    };

    const isConfirmed = request?.status === 'confirmed';
    const isDeclined = request?.status === 'declined';
    const isExpired = request?.status === 'expired';
    const icon = loading
        ? <LoaderCircle className='size-8 animate-spin' />
        : isConfirmed ? <CheckCircle2 className='size-8' />
            : isDeclined || isExpired ? <XCircle className='size-8' />
                : <Clock3 className='size-8' />;
    const title = isConfirmed ? 'Your booking is confirmed'
        : isDeclined ? 'Request not approved'
            : isExpired ? 'Request link expired'
                : request?.status === 'approved' ? 'Your request is approved'
                    : request?.status === 'payment_pending' ? 'Complete your payment'
                        : 'Booking request status';

    return (
        <main className='grid min-h-screen place-items-center bg-[#f5f7f3] px-4 py-8 text-[#17241c]'>
            <section className='w-full max-w-xl rounded-3xl border border-[#dce6de] bg-white p-6 shadow-xl sm:p-10'>
                <div className={`grid size-14 place-items-center rounded-2xl ${isConfirmed ? 'bg-emerald-50 text-emerald-700' : isDeclined || isExpired ? 'bg-red-50 text-red-700' : 'bg-[#eaf0e9] text-[#31553c]'}`}>
                    {icon}
                </div>
                <p className='mt-6 text-xs font-bold uppercase tracking-[.16em] text-[#31553c]'>A10tion To Detail · Booking approval</p>
                <h1 className='mt-2 font-display text-3xl font-semibold tracking-tight text-[#1e3128]'>{title}</h1>
                <p className='mt-3 text-sm leading-6 text-[#5b6560]'>{error || request?.message || 'Checking the latest status of your request.'}</p>
                {request && (
                    <div className='mt-6 grid gap-3 rounded-2xl bg-[#f3f7f3] p-4 text-sm sm:grid-cols-2'>
                        <p><span className='text-[#68776e]'>Reference</span><br /><strong>{request.reference}</strong></p>
                        <p><span className='text-[#68776e]'>Customer</span><br /><strong>{request.customerName}</strong></p>
                        <p><span className='text-[#68776e]'>Appointment</span><br /><strong>{request.bookingDate} at {request.bookingTime}</strong></p>
                        <p><span className='text-[#68776e]'>Status</span><br /><strong className='capitalize'>{request.status.replaceAll('_', ' ')}</strong></p>
                    </div>
                )}
                {request?.expiresAt && !isConfirmed && (
                    <p className='mt-4 text-xs text-[#68776e]'>Secure link expires {formatExpiry(request.expiresAt)}.</p>
                )}
                {request?.canContinue && (
                    <button type='button' disabled={submitting} onClick={continueBooking} className='mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#1e4931] px-5 text-sm font-semibold text-white disabled:opacity-60'>
                        {submitting ? <LoaderCircle className='size-4 animate-spin' /> : <ShieldCheck className='size-4' />}
                        {submitting ? 'Preparing your booking…' : request.status === 'checkout_starting' ? 'Retry secure checkout' : request.paymentMethod === 'onsite' ? 'Confirm booking · pay on arrival' : 'Continue to secure checkout'}
                        {!submitting && <ArrowRight className='size-4' />}
                    </button>
                )}
                {request?.status === 'payment_pending' && request.checkoutUrl && (
                    <a href={request.checkoutUrl} className='mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#1e4931] px-5 text-sm font-semibold text-white'>
                        Continue secure payment <ArrowRight className='size-4' />
                    </a>
                )}
                {error && <button type='button' onClick={loadStatus} className='mt-4 text-sm font-semibold text-[#31553c] underline'>Try again</button>}
                <button type='button' disabled={refreshing || loading} onClick={refreshStatus} className='mt-5 inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[#dce6de] px-4 text-xs font-semibold text-[#31553c] disabled:cursor-wait disabled:opacity-60'>
                    <RefreshCw className={`size-3.5 ${refreshing ? 'animate-spin' : ''}`} /> {refreshing ? 'Refreshing status…' : 'Refresh status'}
                </button>
                <a href={import.meta.env.BASE_URL} className='mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[#52635a]'>
                    Return to website
                </a>
            </section>
        </main>
    );
}
