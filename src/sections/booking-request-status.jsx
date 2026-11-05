import { useEffect, useState } from 'react';
import { ArrowRight, LoaderCircle, ShieldCheck } from 'lucide-react';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
const STATUS_ENDPOINT = `${API_BASE_URL}/api/bookings/request-status`;
const YOCO_ENDPOINT = `${API_BASE_URL}/api/payments/yoco/checkout`;
const ONSITE_ENDPOINT = `${API_BASE_URL}/api/bookings/onsite`;

function getTokens() {
    const params = new URLSearchParams(window.location.search);
    return {
        statusToken: params.get('booking-request') || '',
        continuationToken: params.get('booking-continuation') || '',
    };
}

async function loadStatus(tokens, signal) {
    const url = new URL(STATUS_ENDPOINT, window.location.origin);
    if (tokens.statusToken) url.searchParams.set('token', tokens.statusToken);
    else url.searchParams.set('continuationToken', tokens.continuationToken);
    const response = await fetch(url, { cache: 'no-store', signal });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.message || 'Could not load this booking request.');
    return result;
}

export default function BookingRequestStatusPage() {
    const [tokens] = useState(getTokens);
    const [request, setRequest] = useState(null);
    const [continuationToken, setContinuationToken] = useState('');
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    const refresh = async (signal) => {
        const result = await loadStatus(tokens, signal);
        setRequest({ ...result.request, continuationMethod: result.continuationMethod });
        setContinuationToken(result.continuationToken || '');
    };

    useEffect(() => {
        const controller = new AbortController();
        refresh(controller.signal)
            .catch((loadError) => {
                if (loadError.name !== 'AbortError') setError(loadError.message);
            })
            .finally(() => setLoading(false));
        return () => controller.abort();
    }, [tokens]);

    useEffect(() => {
        if (loading || !request) return undefined;
        const timer = window.setInterval(async () => {
            try {
                await refresh();
                setError('');
            } catch (loadError) {
                setError(loadError.message || 'Could not refresh the booking request status.');
            }
        }, 20_000);
        return () => window.clearInterval(timer);
    }, [loading, request?.status, tokens]);

    const continueBooking = async () => {
        if (!continuationToken || submitting) return;
        setSubmitting(true);
        setError('');
        try {
            const body = new FormData();
            body.append('booking', JSON.stringify({ approvalToken: continuationToken }));
            const endpoint = request.continuationMethod === 'onsite' ? ONSITE_ENDPOINT : YOCO_ENDPOINT;
            const response = await fetch(endpoint, { method: 'POST', body });
            const result = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(result.message || 'Could not continue this booking.');
            if (result.redirectUrl) {
                window.location.assign(result.redirectUrl);
                return;
            }
            await refresh();
        } catch (continueError) {
            setError(continueError instanceof Error ? continueError.message : 'Could not continue this booking.');
            try {
                await refresh();
            } catch {
                // Keep the original continuation error visible.
            }
        } finally {
            setSubmitting(false);
        }
    };

    const status = request?.publicStatus;
    const description = status === 'Pending Approval'
        ? 'Your request is with our team for review. We will email you when there is an update.'
        : status === 'Approved – Awaiting Completion'
            ? request.continuationMethod === 'onsite'
                ? 'Your request has been approved. Continue to confirm your booking; you selected payment on site.'
                : request.continuationMethod === 'monthly'
                    ? 'Your request has been approved. Continue to verify your active monthly entitlement and complete the booking without another wash charge.'
                    : 'Your request has been approved. Continue to complete the booking through secure Yoco checkout.'
            : status === 'Confirmed'
                ? 'Your booking has been completed and confirmed.'
                : status === 'Declined'
                    ? 'We could not accommodate this request. The reason is included below.'
                    : status === 'Expired or Cancelled'
                        ? 'This booking request or its continuation link has expired or been cancelled.'
                        : '';

    return (
        <main className='grid min-h-screen place-items-center bg-[#f5f7f3] px-4 py-10 text-[#17241c]'>
            <section className='w-full max-w-xl rounded-3xl border border-[#dce6de] bg-white p-6 text-center shadow-xl sm:p-10'>
                <ShieldCheck className='mx-auto size-10 text-[#31553c]' />
                <p className='mt-4 text-[10px] font-bold uppercase tracking-[.16em] text-[#31553c]'>A10tion To Detail</p>
                <h1 className='mt-2 font-display text-2xl font-semibold text-[#1e3128]'>Booking request status</h1>
                {loading ? (
                    <p className='mt-5 inline-flex items-center gap-2 text-sm text-[#68776e]'><LoaderCircle className='size-4 animate-spin' /> Loading the latest status…</p>
                ) : error && !request ? (
                    <p className='mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800' role='alert'>{error}</p>
                ) : request ? (
                    <>
                        <p className='mt-4 inline-flex rounded-full bg-[#edf4ee] px-4 py-2 text-xs font-bold text-[#31553c]' role='status'>{status}</p>
                        <p className='mt-4 text-sm leading-6 text-[#5b6560]'>{description}</p>
                        <p className='mt-3 text-sm text-[#35483b]'>Reference: <strong>{request.reference}</strong></p>
                        {request.declineReason && <p className='mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-950'><strong>Reason:</strong> {request.declineReason}</p>}
                        {status === 'Pending Approval' && request.requestExpiresAt && (
                            <p className='mt-3 text-xs text-[#68776e]'>This request will expire if it is not reviewed by {new Date(Number(request.requestExpiresAt)).toLocaleString('en-ZA')}.</p>
                        )}
                        {status === 'Approved – Awaiting Completion' && continuationToken && (
                            <button type='button' onClick={continueBooking} disabled={submitting} className='mt-6 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#1e3128] px-5 text-sm font-bold text-white disabled:opacity-60'>
                                {submitting ? <><LoaderCircle className='size-4 animate-spin' /> Continuing…</> : <>Continue With My Booking <ArrowRight className='size-4' /></>}
                            </button>
                        )}
                    </>
                ) : null}
                {error && request && <p className='mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800' role='alert'>{error}</p>}
                <a href={window.location.pathname} className='mt-6 inline-block text-xs font-semibold text-[#31553c] underline'>Return to the website</a>
            </section>
        </main>
    );
}
