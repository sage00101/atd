import { useEffect, useState } from 'react';
import { ArrowRight, CheckCircle2, Clock3, LoaderCircle, RefreshCw, ShieldCheck, XCircle } from 'lucide-react';

const STATUS_CONTENT = {
    pending: {
        title: 'Your request is under review',
        description: 'We have received your booking request. It will remain reserved while the business reviews it. You cannot submit another request until this one is cancelled or decided.',
        label: 'Awaiting business decision',
    },
    approved: {
        title: 'Your booking is approved',
        description: 'Continue using your secure booking link to complete the booking. You cannot cancel or submit another request after approval.',
        label: 'Approved · action required',
    },
    checkout_starting: {
        title: 'Preparing your secure checkout',
        description: 'Your approved booking is being processed. Continue from your secure booking link if needed.',
        label: 'Processing',
    },
    payment_pending: {
        title: 'Complete your booking',
        description: 'Your approved booking is waiting for payment. Continue from the secure link to finish.',
        label: 'Payment pending',
    },
};

export default function BookingRequestModal({ controller }) {
    const { request, statusError, isCancelling, isRefreshing, cancelRequest, refresh } = controller;
    const [confirmCancel, setConfirmCancel] = useState(false);

    useEffect(() => setConfirmCancel(false), [request?.reference, request?.status]);

    const isOpen = Boolean(request);

    useEffect(() => {
        if (!isOpen) return undefined;
        const previousOverflow = document.body.style.overflow;
        const handleEscape = (event) => {
            if (event.key === 'Escape') event.preventDefault();
        };
        document.body.style.overflow = 'hidden';
        document.addEventListener('keydown', handleEscape);
        return () => {
            document.body.style.overflow = previousOverflow;
            document.removeEventListener('keydown', handleEscape);
        };
    }, [isOpen]);

    if (!request) return null;
    const content = STATUS_CONTENT[request.status] || STATUS_CONTENT.pending;
    const isPending = request.status === 'pending';

    return (
        <div className='fixed inset-0 z-[300] flex items-center justify-center overflow-y-auto bg-[#10251a]/75 px-3 py-5 backdrop-blur-sm sm:px-6' role='presentation'>
            <section
                role='dialog'
                aria-modal='true'
                aria-labelledby='booking-request-title'
                className='my-auto w-full max-w-xl overflow-hidden rounded-[24px] border border-[#d6ead7] bg-white shadow-[0_30px_100px_rgba(0,0,0,.32)]'
            >
                <div className='relative overflow-hidden bg-gradient-to-br from-[#dff2d8] via-[#f2f8e9] to-[#fff3cb] px-5 pb-5 pt-6 sm:px-8 sm:pb-7 sm:pt-8'>
                    <span className='pointer-events-none absolute -right-12 -top-20 size-48 rounded-full bg-white/70 blur-2xl' />
                    <div className='relative flex items-start gap-4'>
                        <div className='grid size-14 shrink-0 place-items-center rounded-2xl border border-white/80 bg-white/90 text-[#31553c] shadow-sm sm:size-16'>
                            {isPending ? <Clock3 className='size-8' /> : request.status === 'approved' ? <CheckCircle2 className='size-8' /> : <ShieldCheck className='size-8' />}
                        </div>
                        <div className='min-w-0 pt-1'>
                            <span className='inline-flex rounded-full border border-[#c8dfc7] bg-white/80 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[.13em] text-[#31553c] sm:text-[10px]'>{content.label}</span>
                            <h2 id='booking-request-title' className='mt-2 font-display text-[22px] font-semibold leading-tight tracking-[-.02em] text-[#1e3128] sm:text-[30px]'>{content.title}</h2>
                        </div>
                    </div>
                    <p className='relative mt-4 max-w-lg text-[13px] leading-6 text-[#425749] sm:text-sm'>{content.description}</p>
                </div>

                <div className='px-5 py-5 sm:px-8 sm:py-7'>
                    {request.notificationSent === false && (
                        <p className='mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-xs leading-5 text-amber-900' role='status'>
                            The request is saved, but we could not send the confirmation email. Keep this page open or contact the business with your reference.
                        </p>
                    )}
                    <div className='grid grid-cols-2 gap-3 rounded-2xl border border-[#e1e9e2] bg-[#f8faf7] p-4'>
                        <div className='min-w-0'>
                            <p className='text-[9px] font-bold uppercase tracking-[.12em] text-[#7a877d]'>Request reference</p>
                            <p className='mt-1 break-all text-xs font-bold text-[#1e3128]'>{request.reference}</p>
                        </div>
                        <div>
                            <p className='text-[9px] font-bold uppercase tracking-[.12em] text-[#7a877d]'>Booking slot</p>
                            <p className='mt-1 text-xs font-bold text-[#1e3128]'>{request.bookingDate || 'Requested'}{request.bookingTime ? ` · ${request.bookingTime}` : ''}</p>
                        </div>
                    </div>

                    {statusError && (
                        <div className='mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-xs leading-5 text-amber-900' role='alert'>
                            <XCircle className='mt-0.5 size-4 shrink-0' /> <span className='min-w-0 flex-1'>{statusError}</span>
                            <button type='button' disabled={isRefreshing} onClick={refresh} className='shrink-0 font-bold underline underline-offset-2 disabled:opacity-60'>{isRefreshing ? 'Checking…' : 'Retry'}</button>
                        </div>
                    )}

                    {confirmCancel ? (
                        <div className='mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4'>
                            <p className='text-sm font-bold text-amber-950'>Cancel this booking request?</p>
                            <p className='mt-1 text-xs leading-5 text-amber-900'>Your reserved time slot and monthly wash, if applicable, will be released. You may then submit a new request.</p>
                            <div className='mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end'>
                                <button type='button' onClick={() => setConfirmCancel(false)} className='min-h-11 rounded-xl border border-amber-300 bg-white px-4 text-sm font-semibold text-amber-950'>Keep request</button>
                                <button type='button' disabled={isCancelling} onClick={cancelRequest} className='inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#9f3427] px-4 text-sm font-bold text-white disabled:opacity-60'>
                                    {isCancelling ? <LoaderCircle className='size-4 animate-spin' /> : null} {isCancelling ? 'Cancelling…' : 'Yes, cancel request'}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className='mt-5 flex flex-col gap-2 sm:flex-row'>
                            {isPending ? (
                                <button type='button' onClick={() => setConfirmCancel(true)} className='inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-[#cbd9cf] bg-white px-4 text-sm font-bold text-[#36513f] transition hover:bg-[#f5f8f4]'>
                                    Cancel booking request
                                </button>
                            ) : (
                                <a href={request.continuationUrl} className='inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-[#1e4931] px-4 text-sm font-bold text-white transition hover:bg-[#294c37]'>
                                    Continue securely <ArrowRight className='size-4' />
                                </a>
                            )}
                            <button type='button' disabled={isRefreshing} onClick={refresh} className='inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#edf4ee] px-4 text-sm font-bold text-[#31553c] transition hover:bg-[#e1eee3] disabled:cursor-wait disabled:opacity-65'>
                                <RefreshCw className={`size-4 ${isRefreshing ? 'animate-spin' : ''}`} /> {isRefreshing ? 'Refreshing…' : 'Refresh status'}
                            </button>
                        </div>
                    )}
                    <p className='mt-4 flex items-center justify-center gap-1.5 text-center text-[10px] leading-4 text-[#718078]'><ShieldCheck className='size-3.5 shrink-0' /> This status is checked securely and will remain available on this device.</p>
                </div>
            </section>
        </div>
    );
}
