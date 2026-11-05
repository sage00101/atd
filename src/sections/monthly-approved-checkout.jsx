import { useEffect, useState } from 'react';
import { ArrowRight, CheckCircle2, LoaderCircle, ShieldCheck } from 'lucide-react';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
const STATUS_ENDPOINT = `${API_BASE_URL}/api/bookings/request-status`;
const CHECKOUT_ENDPOINT = `${API_BASE_URL}/api/payments/yoco/checkout`;

export default function MonthlyApprovedCheckout({ approvalToken }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [done, setDone] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        const controller = new AbortController();
        const url = new URL(STATUS_ENDPOINT, window.location.origin);
        url.searchParams.set('continuationToken', approvalToken);
        fetch(url, { cache: 'no-store', signal: controller.signal })
            .then(async (response) => {
                const result = await response.json().catch(() => ({}));
                if (!response.ok) throw new Error(result.message || 'This approval link is invalid or has expired.');
                setData(result);
            })
            .catch((loadError) => {
                if (loadError.name !== 'AbortError') setError(loadError.message);
            })
            .finally(() => setLoading(false));
        return () => controller.abort();
    }, [approvalToken]);

    const confirm = async () => {
        if (submitting) return;
        setSubmitting(true);
        setError('');
        try {
            const body = new FormData();
            body.append('booking', JSON.stringify({ approvalToken }));
            const response = await fetch(CHECKOUT_ENDPOINT, { method: 'POST', body });
            const result = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(result.message || 'Could not confirm this booking.');
            setDone(true);
        } catch (confirmError) {
            setError(confirmError instanceof Error ? confirmError.message : 'Could not confirm this booking.');
        } finally {
            setSubmitting(false);
        }
    };

    const summary = data?.summary || {};
    const approved = data?.request?.publicStatus === 'Approved – Awaiting Completion';

    return (
        <main className='grid min-h-screen place-items-center bg-[#f5f7f3] px-4 py-10 text-[#17241c]'>
            <section className='w-full max-w-xl rounded-3xl border border-[#dce6de] bg-white p-6 text-center shadow-xl sm:p-10'>
                {done ? <CheckCircle2 className='mx-auto size-10 text-[#31553c]' /> : <ShieldCheck className='mx-auto size-10 text-[#31553c]' />}
                <p className='mt-4 text-[10px] font-bold uppercase tracking-[.16em] text-[#31553c]'>A10tion To Detail · Monthly client</p>
                <h1 className='mt-2 font-display text-2xl font-semibold text-[#1e3128]'>
                    {done ? 'Monthly wash confirmed' : 'Complete your monthly booking'}
                </h1>
                {loading && <p className='mt-5 inline-flex items-center gap-2 text-sm text-[#68776e]'><LoaderCircle className='size-4 animate-spin' /> Loading your approved booking…</p>}
                {!loading && data && !done && (
                    <>
                        <p className='mt-4 text-sm leading-6 text-[#5b6560]'>
                            Hi {summary.firstName || 'there'}, your request is approved. Confirming uses one wash from your monthly package; there is no extra charge.
                        </p>
                        <dl className='mx-auto mt-5 max-w-sm space-y-1.5 rounded-2xl bg-[#f5f7f3] p-4 text-left text-sm'>
                            <div className='flex justify-between gap-3'><dt className='text-[#68776e]'>Reference</dt><dd className='font-semibold'>{data.request.reference}</dd></div>
                            <div className='flex justify-between gap-3'><dt className='text-[#68776e]'>Date</dt><dd className='font-semibold'>{summary.bookingDate}</dd></div>
                            <div className='flex justify-between gap-3'><dt className='text-[#68776e]'>Time</dt><dd className='font-semibold'>{summary.bookingTime}</dd></div>
                            {summary.address && <div className='flex justify-between gap-3'><dt className='text-[#68776e]'>Address</dt><dd className='text-right font-semibold'>{summary.address}</dd></div>}
                        </dl>
                        {approved ? (
                            <button type='button' onClick={confirm} disabled={submitting} className='mt-6 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#1e3128] px-5 text-sm font-bold text-white disabled:opacity-60'>
                                {submitting ? <><LoaderCircle className='size-4 animate-spin' /> Confirming…</> : <>Confirm my monthly wash <ArrowRight className='size-4' /></>}
                            </button>
                        ) : (
                            <p className='mt-5 text-sm text-[#68776e]'>Status: {data.request.publicStatus}</p>
                        )}
                    </>
                )}
                {done && <p className='mt-4 text-sm leading-6 text-[#5b6560]'>Your booking is confirmed and your monthly wash has been recorded. A confirmation email is on its way.</p>}
                {error && <p className='mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800' role='alert'>{error}</p>}
                <a href={window.location.pathname} className='mt-6 inline-block text-xs font-semibold text-[#31553c] underline'>Return to the website</a>
            </section>
        </main>
    );
}
