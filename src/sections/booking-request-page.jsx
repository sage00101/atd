import { useCallback, useEffect, useState } from 'react';
import { ArrowRight, CheckCircle2, Clock3, CreditCard, LoaderCircle, RefreshCw, ShieldCheck, Smartphone, X, XCircle } from 'lucide-react';

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
    const [cancelling, setCancelling] = useState(false);
    const [confirmCancel, setConfirmCancel] = useState(false);

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
            return result;
        } catch (loadError) {
            setError(loadError.message || 'Booking status could not be loaded.');
            return null;
        } finally {
            setLoading(false);
        }
    }, [reference, token]);

    useEffect(() => {
        loadStatus();
    }, [loadStatus]);

    useEffect(() => {
        const timer = window.setInterval(() => {
            if (request?.status === 'pending' || request?.status === 'checkout_starting' || request?.status === 'payment_pending') loadStatus();
        }, request?.status === 'checkout_starting' ? 5_000 : 15_000);
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

    const continueBooking = async (paymentMethod) => {
        setSubmitting(true);
        setError('');
        try {
            const body = new FormData();
            body.append('booking', JSON.stringify({
                approvalReference: reference,
                continuationToken: token,
                paymentMethod,
            }));
            const endpoint = paymentMethod === 'onsite' ? ONSITE_ENDPOINT : CHECKOUT_ENDPOINT;
            const response = await fetch(endpoint, { method: 'POST', body });
            const result = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(result.message || 'The booking could not be continued.');
            if (result.redirectUrl) {
                window.location.assign(result.redirectUrl);
                return;
            }
            const updatedRequest = await loadStatus();
            if (updatedRequest?.status === 'checkout_starting') {
                setError('Checkout is still starting. Refresh the status in a few seconds or retry when the option becomes available.');
            }
        } catch (submitError) {
            const message = submitError.message || 'The booking could not be continued.';
            await loadStatus();
            setError(message);
        } finally {
            setSubmitting(false);
        }
    };

    const cancelBooking = async () => {
        if (!request?.canCancel || cancelling) return;
        setCancelling(true);
        setError('');
        try {
            const response = await fetch(REQUEST_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'cancel', reference, token }),
            });
            const result = await response.json().catch(() => ({}));
            if (!response.ok) {
                if (response.status === 409) {
                    const latest = await loadStatus();
                    if (!latest && ['approved', 'declined', 'confirmed', 'checkout_starting', 'payment_pending'].includes(result.status)) {
                        setRequest((current) => current && current.status === 'pending' ? {
                            ...current,
                            status: result.status,
                            canContinue: result.status === 'approved',
                            message: result.message || 'The business has already responded to this request.',
                        } : current);
                    }
                }
                throw new Error(result.message || 'Your booking request could not be cancelled.');
            }
            if (result.status !== 'cancelled') {
                throw new Error('The booking request was not cancelled. Please refresh its status and try again.');
            }
            setRequest((current) => current ? {
                ...current,
                status: 'cancelled',
                canContinue: false,
                canCancel: false,
                checkoutUrl: null,
                message: 'Your request was cancelled. Any reserved monthly wash has been returned to your allowance.',
            } : current);
            setConfirmCancel(false);
        } catch (cancelError) {
            setError(cancelError instanceof TypeError
                ? 'We could not reach the booking service. Your request is unchanged; please try cancelling again shortly.'
                : cancelError.message || 'Your booking request could not be cancelled.');
        } finally {
            setCancelling(false);
        }
    };

    const isConfirmed = request?.status === 'confirmed';
    const isDeclined = request?.status === 'declined';
    const isExpired = request?.status === 'expired';
    const isCancelled = request?.status === 'cancelled';
    const isCheckoutStarting = request?.status === 'checkout_starting';
    const isMonthlyCoveredWash = request?.bookingType === 'monthly-entitlement';
    const canChoosePayment = request?.status === 'approved';
    const icon = loading
        ? <LoaderCircle className='size-8 animate-spin' />
        : isCheckoutStarting ? <LoaderCircle className='size-8 animate-spin' />
        : isConfirmed ? <CheckCircle2 className='size-8' />
            : isDeclined || isExpired || isCancelled ? <XCircle className='size-8' />
                : <Clock3 className='size-8' />;
    const title = isConfirmed ? 'Your booking is confirmed'
        : isDeclined ? 'Request not approved'
            : isCancelled ? 'Your request was cancelled'
            : isExpired ? 'Request link expired'
                : request?.status === 'approved' ? 'Your request is approved'
                    : isCheckoutStarting ? 'Checkout is being prepared'
                    : request?.status === 'payment_pending' ? 'Complete your payment'
                        : 'Booking request status';

    return (
        <main className='min-h-screen bg-[#f5f7f3] px-4 py-6 text-[#17241c] sm:grid sm:place-items-center sm:py-8'>
            <section className='mx-auto w-full max-w-xl rounded-3xl border border-[#dce6de] bg-white p-5 shadow-xl sm:p-10'>
                <div className='mb-5 flex items-center justify-between gap-3'>
                    <p className='text-[10px] font-bold uppercase tracking-[.14em] text-[#31553c]'>Booking status</p>
                    <a
                        href={`${import.meta.env.BASE_URL}#booking`}
                        aria-label='Close booking status and return to the website'
                        className='inline-flex min-h-10 shrink-0 items-center justify-center rounded-full border border-[#d2ddd4] px-4 text-xs font-semibold text-[#31553c] transition hover:bg-[#f3f7f3]'
                    >
                        <X className='mr-1.5 size-3.5' /> Close · Return to website
                    </a>
                </div>
                <div className={`grid size-14 place-items-center rounded-2xl ${isConfirmed ? 'bg-emerald-50 text-emerald-700' : isDeclined || isExpired || isCancelled ? 'bg-red-50 text-red-700' : 'bg-[#eaf0e9] text-[#31553c]'}`}>
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
                        {request.declineReason && <p className='sm:col-span-2'><span className='text-[#68776e]'>Reason</span><br /><strong>{request.declineReason}</strong></p>}
                    </div>
                )}
                {request?.expiresAt && !isConfirmed && (
                    <p className='mt-4 text-xs text-[#68776e]'>Secure link expires {formatExpiry(request.expiresAt)}.</p>
                )}
                {request?.canContinue && (canChoosePayment && !isMonthlyCoveredWash ? (
                    <div className='mt-6 grid gap-3 sm:grid-cols-2'>
                        <button type='button' disabled={submitting} onClick={() => continueBooking('online')} className='inline-flex min-h-14 items-center justify-center gap-2 rounded-xl bg-[#1e4931] px-4 text-sm font-semibold text-white disabled:opacity-60'>
                            {submitting ? <LoaderCircle className='size-4 animate-spin' /> : <CreditCard className='size-4' />}
                            {submitting ? 'Preparing…' : 'Pay securely with Yoco'}
                            {!submitting && <ArrowRight className='size-4' />}
                        </button>
                        <button type='button' disabled={submitting} onClick={() => continueBooking('onsite')} className='inline-flex min-h-14 items-center justify-center gap-2 rounded-xl border border-[#cbd9cf] bg-white px-4 text-sm font-semibold text-[#31553c] disabled:opacity-60'>
                            {submitting ? <LoaderCircle className='size-4 animate-spin' /> : <Smartphone className='size-4' />}
                            {submitting ? 'Preparing…' : 'Pay by card machine on-site'}
                        </button>
                    </div>
                ) : (
                    <button type='button' disabled={submitting} onClick={() => continueBooking(request.paymentMethod || 'online')} className='mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#1e4931] px-5 text-sm font-semibold text-white disabled:opacity-60'>
                        {submitting ? <LoaderCircle className='size-4 animate-spin' /> : <ShieldCheck className='size-4' />}
                        {submitting ? 'Preparing your booking…' : isMonthlyCoveredWash ? 'Confirm your covered monthly wash' : 'Retry secure checkout'}
                        {!submitting && <ArrowRight className='size-4' />}
                    </button>
                ))}
                {request?.status === 'payment_pending' && request.checkoutUrl && (
                    <a href={request.checkoutUrl} className='mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#1e4931] px-5 text-sm font-semibold text-white'>
                        Continue secure payment <ArrowRight className='size-4' />
                    </a>
                )}
                {request?.canCancel && (
                    <div className='mt-5'>
                        {confirmCancel ? (
                            <div className='rounded-2xl border border-amber-200 bg-amber-50 p-4'>
                                <p className='text-sm font-bold text-amber-950'>Cancel this booking request?</p>
                                <p className='mt-1 text-xs leading-5 text-amber-900'>
                                    Your held time slot and monthly wash reservation, if applicable, will be released. The monthly wash returns to your available allowance.
                                    A single-wash promo code is only redeemed after payment, so cancelling this request will not use it.
                                </p>
                                <div className='mt-4 flex flex-col-reverse gap-2 sm:flex-row'>
                                    <button type='button' disabled={cancelling} onClick={() => setConfirmCancel(false)} className='min-h-11 rounded-xl border border-amber-300 bg-white px-4 text-sm font-semibold text-amber-950 disabled:opacity-60'>
                                        Keep request
                                    </button>
                                    <button type='button' disabled={cancelling} onClick={cancelBooking} className='inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#9f3427] px-4 text-sm font-bold text-white disabled:opacity-60'>
                                        {cancelling ? <LoaderCircle className='size-4 animate-spin' /> : null}
                                        {cancelling ? 'Cancelling…' : 'Yes, cancel booking'}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <button type='button' onClick={() => setConfirmCancel(true)} className='inline-flex min-h-11 items-center justify-center rounded-xl border border-[#d6b7b2] px-4 text-sm font-semibold text-[#9f3427] transition hover:bg-red-50'>
                                Cancel booking
                            </button>
                        )}
                    </div>
                )}
                {error && <button type='button' onClick={loadStatus} className='mt-4 text-sm font-semibold text-[#31553c] underline'>Try again</button>}
                <button type='button' disabled={refreshing || loading} onClick={refreshStatus} className='mt-5 inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[#dce6de] px-4 text-xs font-semibold text-[#31553c] disabled:cursor-wait disabled:opacity-60'>
                    <RefreshCw className={`size-3.5 ${refreshing ? 'animate-spin' : ''}`} /> {refreshing ? 'Refreshing status…' : 'Refresh status'}
                </button>
                <p className='mt-5 text-xs leading-5 text-[#718078]'>You can close this status page and return to the website at any time. Your request remains saved securely.</p>
            </section>
        </main>
    );
}
