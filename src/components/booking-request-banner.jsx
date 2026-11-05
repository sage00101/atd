import { useCallback, useEffect, useState } from 'react';
import { ArrowRight, CheckCircle2, Clock3, LoaderCircle, RefreshCw, X, XCircle } from 'lucide-react';
import {
    TRACKER_EVENT,
    readTrackedRequest,
    writeTrackedRequest,
} from '../utils/booking-request-tracker';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
const STATUS_ENDPOINT = `${API_BASE_URL}/api/bookings/request-status`;
const POLL_MS = 20_000;
const FINAL_STATUSES = ['Confirmed', 'Declined', 'Expired or Cancelled'];

const STATUS_COPY = {
    'Pending Approval': {
        title: 'Request pending review',
        text: 'Our team is reviewing your booking request. This updates automatically.',
        Icon: Clock3,
        tone: 'text-amber-700 bg-amber-50',
    },
    'Approved – Awaiting Completion': {
        title: 'Request approved!',
        text: 'Continue to complete your booking.',
        Icon: CheckCircle2,
        tone: 'text-emerald-700 bg-emerald-50',
    },
    Confirmed: {
        title: 'Booking confirmed',
        text: 'Your booking is complete.',
        Icon: CheckCircle2,
        tone: 'text-emerald-700 bg-emerald-50',
    },
    Declined: {
        title: 'Request declined',
        text: 'We could not accommodate this request.',
        Icon: XCircle,
        tone: 'text-red-700 bg-red-50',
    },
    'Expired or Cancelled': {
        title: 'Request expired',
        text: 'This request has expired or was cancelled.',
        Icon: XCircle,
        tone: 'text-red-700 bg-red-50',
    },
};

export default function BookingRequestBanner() {
    const [tracked, setTracked] = useState(readTrackedRequest);
    const [state, setState] = useState(null);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState('');
    const [collapsed, setCollapsed] = useState(false);

    const statusToken = tracked?.statusToken || '';

    const load = useCallback(async (signal) => {
        if (!statusToken) return;
        setRefreshing(true);
        try {
            const url = new URL(STATUS_ENDPOINT, window.location.origin);
            url.searchParams.set('token', statusToken);
            const response = await fetch(url, { cache: 'no-store', signal });
            const result = await response.json().catch(() => ({}));
            if (response.status === 404) {
                writeTrackedRequest(null);
                setTracked(null);
                setState(null);
                return;
            }
            if (!response.ok) throw new Error(result.message || 'Could not refresh your request status.');
            setState({
                request: result.request,
                continuationToken: result.continuationToken || '',
            });
            setError('');
        } catch (loadError) {
            if (loadError.name !== 'AbortError') setError('Could not refresh right now. Please try again.');
        } finally {
            setRefreshing(false);
        }
    }, [statusToken]);

    useEffect(() => {
        const sync = () => {
            setTracked(readTrackedRequest());
            setState(null);
            setCollapsed(false);
        };
        window.addEventListener(TRACKER_EVENT, sync);
        return () => window.removeEventListener(TRACKER_EVENT, sync);
    }, []);

    useEffect(() => {
        if (!statusToken) return undefined;
        const controller = new AbortController();
        load(controller.signal);
        const timer = window.setInterval(() => {
            if (document.visibilityState === 'visible') load();
        }, POLL_MS);
        const onVisible = () => document.visibilityState === 'visible' && load();
        document.addEventListener('visibilitychange', onVisible);
        return () => {
            controller.abort();
            window.clearInterval(timer);
            document.removeEventListener('visibilitychange', onVisible);
        };
    }, [statusToken, load]);

    const status = state?.request?.publicStatus;
    const copy = STATUS_COPY[status];
    if (!tracked || !state || !copy || tracked.dismissedStatus === status) return null;

    const close = () => {
        if (FINAL_STATUSES.includes(status)) {
            writeTrackedRequest(null);
            setTracked(null);
            return;
        }
        const next = { ...tracked, dismissedStatus: status };
        writeTrackedRequest(next);
        setTracked(next);
    };

    const continueUrl = state.continuationToken
        ? `${window.location.pathname}?booking-continuation=${encodeURIComponent(state.continuationToken)}`
        : '';
    const { Icon } = copy;

    return (
        <aside
            className='fixed bottom-4 left-3 z-[90] w-[min(320px,calc(100vw-1.5rem))] rounded-2xl border border-[#dce6de] bg-white p-3.5 shadow-[0_18px_50px_-20px_rgba(20,40,27,.45)] sm:left-5'
            aria-label='Booking request status'
            role='status'
        >
            <div className='flex items-start gap-2.5'>
                <span className={`grid size-8 shrink-0 place-items-center rounded-full ${copy.tone}`}><Icon className='size-4' /></span>
                <div className='min-w-0 flex-1'>
                    <p className='text-[12px] font-bold text-[#1e3128]'>{copy.title}</p>
                    {!collapsed && (
                        <>
                            <p className='mt-0.5 text-[11px] leading-[1.5] text-[#5b6560]'>{copy.text}</p>
                            <p className='mt-1 text-[10.5px] text-[#68776e]'>Ref: <strong>{state.request.reference}</strong></p>
                            {state.request.declineReason && (
                                <p className='mt-1.5 rounded-lg bg-amber-50 px-2 py-1.5 text-[10.5px] text-amber-950'>{state.request.declineReason}</p>
                            )}
                            {error && <p className='mt-1.5 text-[10.5px] text-red-700' role='alert'>{error}</p>}
                            <div className='mt-2.5 flex flex-wrap items-center gap-2'>
                                {continueUrl && status === 'Approved – Awaiting Completion' && (
                                    <a href={continueUrl} className='inline-flex min-h-8 items-center gap-1 rounded-lg bg-[#1e3128] px-3 text-[11px] font-bold text-white'>
                                        Continue <ArrowRight className='size-3' />
                                    </a>
                                )}
                                <button
                                    type='button'
                                    onClick={() => load()}
                                    disabled={refreshing}
                                    className='inline-flex min-h-8 items-center gap-1 rounded-lg border border-[#dce6de] px-2.5 text-[11px] font-semibold text-[#31553c] disabled:opacity-60'
                                >
                                    {refreshing ? <LoaderCircle className='size-3 animate-spin' /> : <RefreshCw className='size-3' />} Refresh
                                </button>
                                <a
                                    href={`${window.location.pathname}?booking-request=${encodeURIComponent(statusToken)}`}
                                    className='text-[10.5px] font-semibold text-[#31553c] underline'
                                >
                                    Details
                                </a>
                            </div>
                        </>
                    )}
                </div>
                <div className='flex shrink-0 flex-col gap-1'>
                    <button type='button' onClick={close} aria-label='Close status banner' className='grid size-6 place-items-center rounded text-[#68776e] hover:bg-[#f0f3f0]'>
                        <X className='size-3.5' />
                    </button>
                    <button
                        type='button'
                        onClick={() => setCollapsed((value) => !value)}
                        aria-label={collapsed ? 'Expand status banner' : 'Collapse status banner'}
                        aria-expanded={!collapsed}
                        className='grid size-6 place-items-center rounded text-[12px] font-bold text-[#68776e] hover:bg-[#f0f3f0]'
                    >
                        {collapsed ? '+' : '–'}
                    </button>
                </div>
            </div>
        </aside>
    );
}
