import { useEffect, useState } from 'react';
import { ArrowRight, CheckCircle2, Clock3, LoaderCircle, RefreshCw, ShieldCheck, X, XCircle } from 'lucide-react';

const STATUS_CONTENT = {
    pending: {
        title: 'Your request is under review',
        description: 'Your requested slot is held while the business reviews it. You cannot submit another request until this one is cancelled or decided.',
        label: 'Awaiting business decision',
    },
    approved: {
        title: 'Your booking is approved',
        description: 'Continue securely to complete this booking. The submitted appointment details are already saved; you do not need to submit the request again.',
        label: 'Approved · action required',
    },
    checkout_starting: {
        title: 'Checkout is being prepared',
        description: 'Your approved booking is still being processed. If it does not continue, refresh the status or try the secure link again in a moment.',
        label: 'Processing',
    },
    payment_pending: {
        title: 'Complete your payment',
        description: 'Your approved booking is waiting for payment. Continue securely to finish checkout.',
        label: 'Payment pending',
    },
};

export default function BookingRequestModal({ controller }) {
    const {
        request,
        statusError,
        isCancelling,
        isRefreshing,
        isPanelOpen,
        cancelRequest,
        refresh,
        openPanel,
        closePanel,
    } = controller;
    const [confirmCancel, setConfirmCancel] = useState(false);

    useEffect(() => setConfirmCancel(false), [request?.reference, request?.status]);

    if (!request) return null;
    const content = STATUS_CONTENT[request.status] || STATUS_CONTENT.pending;
    const isPending = request.status === 'pending';
    const canCancel = request.canCancel ?? isPending;

    return (
        <>
            <button
                type='button'
                onClick={openPanel}
                aria-label='Open booking request status'
                aria-expanded={isPanelOpen}
                className={`fixed right-0 top-1/2 z-[299] -translate-y-1/2 rounded-l-xl border border-r-0 border-[#d6ead7] bg-[#1e4931] px-2.5 py-4 text-[11px] font-bold text-white shadow-xl transition-all duration-300 hover:bg-[#294c37] sm:px-3 ${isPanelOpen ? 'translate-x-full opacity-0' : 'translate-x-0 opacity-100'}`}
                style={{ writingMode: 'vertical-rl' }}
            >
                Booking status
            </button>

            <aside
                role='dialog'
                aria-modal='false'
                aria-labelledby='booking-request-title'
                aria-hidden={!isPanelOpen}
                inert={!isPanelOpen}
                className={`fixed bottom-3 right-3 top-3 z-[300] flex w-[min(30rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-[24px] border border-[#d6ead7] bg-white shadow-[0_24px_80px_rgba(0,0,0,.28)] transition-transform duration-300 ease-out sm:bottom-5 sm:right-5 sm:top-5 ${isPanelOpen ? 'translate-x-0' : 'pointer-events-none translate-x-[calc(100%+2rem)]'}`}
            >
                <div className='relative shrink-0 overflow-hidden bg-gradient-to-br from-[#dff2d8] via-[#f2f8e9] to-[#fff3cb] px-5 pb-5 pt-5 sm:px-7 sm:pb-6 sm:pt-7'>
                    <span className='pointer-events-none absolute -right-12 -top-20 size-48 rounded-full bg-white/70 blur-2xl' />
                    <div className='relative flex items-start gap-3'>
                        <div className='grid size-12 shrink-0 place-items-center rounded-2xl border border-white/80 bg-white/90 text-[#31553c] shadow-sm'>
                            {isPending ? <Clock3 className='size-6' /> : request.status === 'approved' ? <CheckCircle2 className='size-6' /> : <ShieldCheck className='size-6' />}
                        </div>
                        <div className='min-w-0 flex-1 pt-0.5'>
                            <span className='inline-flex rounded-full border border-[#c8dfc7] bg-white/80 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[.13em] text-[#31553c]'>{content.label}</span>
                            <h2 id='booking-request-title' className='mt-2 font-display text-[22px] font-semibold leading-tight tracking-[-.02em] text-[#1e3128] sm:text-[27px]'>{content.title}</h2>
                        </div>
                        <button type='button' onClick={closePanel} aria-label='Close booking request panel' className='grid size-9 shrink-0 place-items-center rounded-full border border-[#31553c]/15 bg-white/75 text-[#31553c] transition hover:bg-white'>
                            <X className='size-4' />
                        </button>
                    </div>
                    <p className='relative mt-3 text-[12px] leading-5 text-[#425749] sm:text-[13px]'>{content.description}</p>
                </div>

                <div className='min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7 sm:py-6'>
                    {request.notificationSent === false && (
                        <p className='mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-xs leading-5 text-amber-900' role='status'>
                            Your request is saved, but we could not send its email notification. Keep this panel available or contact the business with your reference.
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
                            <p className='mt-1 text-xs leading-5 text-amber-900'>Your held time slot and monthly wash reservation, if applicable, will be released back to availability. A single-wash promo code is only redeemed after payment, so cancelling this pending request will not use it. You may then submit a new request.</p>
                            <div className='mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end'>
                                <button type='button' onClick={() => setConfirmCancel(false)} className='min-h-11 rounded-xl border border-amber-300 bg-white px-4 text-sm font-semibold text-amber-950'>Keep request</button>
                                <button type='button' disabled={isCancelling} onClick={cancelRequest} className='inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#9f3427] px-4 text-sm font-bold text-white disabled:opacity-60'>
                                    {isCancelling ? <LoaderCircle className='size-4 animate-spin' /> : null} {isCancelling ? 'Cancelling…' : 'Yes, cancel request'}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className='mt-5 flex flex-col gap-2 sm:flex-row'>
                            {canCancel ? (
                                <button type='button' onClick={() => setConfirmCancel(true)} className='inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-[#cbd9cf] bg-white px-4 text-sm font-bold text-[#36513f] transition hover:bg-[#f5f8f4]'>
                                    Cancel booking request
                                </button>
                            ) : request.status === 'approved' || request.canContinue ? (
                                <a href={request.continuationUrl} className='inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-[#1e4931] px-4 text-sm font-bold text-white transition hover:bg-[#294c37]'>
                                    Continue to checkout <ArrowRight className='size-4' />
                                </a>
                            ) : request.status === 'payment_pending' && request.checkoutUrl ? (
                                <a href={request.checkoutUrl} className='inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-[#1e4931] px-4 text-sm font-bold text-white transition hover:bg-[#294c37]'>
                                    Continue secure payment <ArrowRight className='size-4' />
                                </a>
                            ) : null}
                            <button type='button' disabled={isRefreshing} onClick={refresh} className='inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#edf4ee] px-4 text-sm font-bold text-[#31553c] transition hover:bg-[#e1eee3] disabled:cursor-wait disabled:opacity-65'>
                                <RefreshCw className={`size-4 ${isRefreshing ? 'animate-spin' : ''}`} /> {isRefreshing ? 'Refreshing…' : 'Refresh status'}
                            </button>
                        </div>
                    )}
                    <p className='mt-4 text-center text-[10px] leading-4 text-[#718078]'>Your request status is checked securely and saved on this device.</p>
                </div>
            </aside>
        </>
    );
}
