import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRight, Building2, CarFront, Clock3, X } from 'lucide-react';
import { packageGroups, singleWashPrices, threeMonthPrepayPrices } from '../data/pricing';

const tabs = [
    { id: 'single', label: 'Single wash', shortLabel: 'Single', icon: CarFront },
    { id: 'private', label: 'Private packages', shortLabel: 'Private', icon: CarFront },
    { id: 'business', label: 'Business / fleet', shortLabel: 'Fleet', icon: Building2 },
    { id: 'prepay', label: '3-month prepay', shortLabel: 'Prepay', icon: Clock3 },
];

function MonthlyPackageCard({ groupLabel, pkg }) {
    const savingsBadges = [
        pkg.sixMonthNote ? { label: '6 month', value: pkg.sixMonthNote } : null,
        pkg.twelveMonthNote ? { label: '12 month', value: pkg.twelveMonthNote } : null,
    ].filter(Boolean);

    return (
        <article className='overflow-hidden rounded-[16px] border border-[#dfe9e1] bg-white shadow-[0_20px_60px_-35px_rgba(15,28,20,0.75)]'>
            <div className='border-b border-[#e7ede8] bg-gradient-to-br from-[#f9fbf9] to-[#f2f8f3] px-3.5 py-3 sm:px-4'>
                <div className='flex items-start justify-between gap-3'>
                    <div className='min-w-0'>
                        <p className='text-[8px] font-semibold uppercase tracking-[0.12em] text-[#6a806f] sm:text-[9px]'>{groupLabel} · {pkg.washes}</p>
                        <h4 className='mt-1 font-display text-[17px] font-semibold text-[#18231c] sm:text-[20px]'>{pkg.title}</h4>
                    </div>
                    <span className='rounded-full bg-[#eaf2eb] px-2.5 py-1 text-[8px] font-bold text-[#31553c] shadow-[inset_0_0_0_1px_rgba(49,85,60,0.08)] sm:text-[9px]'>{pkg.monthlyNote}</span>
                </div>

                {savingsBadges.length > 0 && (
                    <div className='mt-2.5 flex flex-wrap gap-1.5'>
                        {savingsBadges.map(({ label, value }) => (
                            <span key={label} className='rounded-full border border-[#d5e5d8] bg-[#f4faf4] px-2 py-1 text-[7.5px] font-semibold text-[#31553c] sm:text-[8px]'>
                                {label}: {value}
                            </span>
                        ))}
                    </div>
                )}
            </div>

            <div className='hidden sm:block'>
                <div className='grid grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(100px,0.8fr))] gap-3 border-b border-[#e7ede8] bg-[#f5f8f5] px-4 py-2.5 text-[8px] font-semibold uppercase tracking-[0.08em] text-[#64756a]'>
                    <span>Vehicle</span>
                    <span className='text-center'>Per month</span>
                    <span className='text-center'>6-month</span>
                    <span className='text-center'>12-month</span>
                </div>
                {pkg.monthlyPrices.map(([vehicle, monthlyPrice], index) => (
                    <div key={vehicle} className='grid grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(100px,0.8fr))] gap-3 border-b border-[#edf1ed] px-4 py-3 text-[12px] last:border-0'>
                        <span className='text-[#59655d]'>{vehicle}</span>
                        <span className='text-center font-semibold tabular-nums text-[#18231c]'>{monthlyPrice}</span>
                        <span className='text-center font-semibold tabular-nums text-[#18231c]'>{pkg.sixMonthPrices?.[index] ?? '—'}</span>
                        <span className='text-center font-semibold tabular-nums text-[#18231c]'>{pkg.twelveMonthPrices?.[index] ?? '—'}</span>
                    </div>
                ))}
            </div>

            <div className='sm:hidden'>
                {pkg.monthlyPrices.map(([vehicle, monthlyPrice], index) => (
                    <div key={vehicle} className='border-b border-[#edf1ed] px-3.5 py-3 last:border-0'>
                        <div className='flex items-center justify-between gap-3'>
                            <h5 className='text-[12px] font-semibold text-[#18231c]'>{vehicle}</h5>
                            <span className='rounded-full bg-[#eef4ef] px-2 py-0.5 text-[8px] font-semibold text-[#31553c]'>{monthlyPrice}</span>
                        </div>
                        <div className='mt-2 grid grid-cols-3 gap-1.5'>
                            {[
                                ['Per month', monthlyPrice],
                                ['6 mth', pkg.sixMonthPrices?.[index] ?? '—'],
                                ['12 mth', pkg.twelveMonthPrices?.[index] ?? '—'],
                            ].map(([label, price]) => (
                                <div key={label} className='rounded-[8px] bg-[#f4f7f4] px-2 py-1.5'>
                                    <p className='text-[7px] font-medium uppercase tracking-[0.08em] text-[#718076]'>{label}</p>
                                    <p className='mt-1 break-words text-[9px] font-semibold tabular-nums leading-tight text-[#18231c]'>{price}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </article>
    );
}

export default function PriceListModal({ open, onClose }) {
    const [activeTab, setActiveTab] = useState('single');
    const closeButtonRef = useRef(null);

    useEffect(() => {
        if (!open) return undefined;
        const previousOverflow = document.body.style.overflow;
        const previousFocus = document.activeElement;
        const closeOnEscape = (event) => {
            if (event.key === 'Escape') onClose();
        };
        document.body.style.overflow = 'hidden';
        document.addEventListener('keydown', closeOnEscape);
        window.requestAnimationFrame(() => closeButtonRef.current?.focus({ preventScroll: true }));
        return () => {
            document.body.style.overflow = previousOverflow;
            document.removeEventListener('keydown', closeOnEscape);
            previousFocus?.focus?.({ preventScroll: true });
        };
    }, [open, onClose]);

    if (!open) return null;

    const scrollToBooking = () => {
        onClose();
        window.requestAnimationFrame(() => document.getElementById('booking')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    };

    const activeGroup = activeTab === 'business' ? packageGroups.business : packageGroups.private;

    return createPortal(
        <div className='fixed inset-0 z-[140] h-[100dvh] w-screen overflow-hidden bg-[#f6f8f5]' role='presentation'>
            <section className='flex h-full w-full flex-col overflow-hidden bg-[#f6f8f5]' role='dialog' aria-modal='true' aria-labelledby='price-list-title'>
                <header className='relative shrink-0 bg-gradient-to-br from-[#132219] via-[#20382a] to-[#355941] px-4 py-3.5 text-white sm:px-7 sm:py-6'>
                    <button ref={closeButtonRef} type='button' onClick={onClose} className='absolute right-3 top-3 grid size-8 place-items-center rounded-[6px] border-0 bg-white/10 text-white transition hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:right-5 sm:top-5 sm:size-9' aria-label='Close price list'>
                        <X className='size-4' />
                    </button>
                    <p className='text-[9px] font-semibold uppercase tracking-[0.14em] text-[#c4d8c9] sm:text-[10px] sm:tracking-[0.16em]'>A10tion To Detail</p>
                    <h2 id='price-list-title' className='mt-0.5 max-w-[calc(100%-42px)] font-display text-[21px] font-semibold leading-tight sm:mt-1 sm:text-[34px]'>Wash price list</h2>
                    <p className='mt-1 max-w-2xl text-[11px] leading-[1.4] text-white/70 sm:mt-1.5 sm:text-[13px] sm:leading-[1.5]'>Compare once-off and monthly options by vehicle size.</p>
                </header>

                <nav className='shrink-0 border-b border-[#dfe7e0] bg-white/90 p-2 backdrop-blur-sm sm:px-5 sm:py-2.5' aria-label='Price list categories'>
                    <div className='grid grid-cols-2 gap-1.5 sm:grid-cols-4 sm:gap-2'>
                        {tabs.map(({ id, label, shortLabel, icon: Icon }) => (
                            <button key={id} type='button' onClick={() => setActiveTab(id)} aria-pressed={activeTab === id} className={`flex min-h-10 items-center justify-center gap-1.5 rounded-[9px] px-2 text-[9px] font-semibold leading-tight transition sm:min-h-11 sm:gap-2 sm:rounded-[10px] sm:px-2.5 sm:text-[10.5px] ${activeTab === id ? 'bg-[#1e3128] text-white shadow-[0_14px_28px_-18px_rgba(19,35,28,0.95)] ring-1 ring-[#274635]' : 'bg-[#f3f6f3] text-[#526158] hover:bg-[#eaf2eb]'}`}>
                                <Icon className={`size-3.5 shrink-0 ${activeTab === id ? 'text-[#a9c9b0]' : 'text-[#54705b]'}`} />
                                <span>{label}</span>
                            </button>
                        ))}
                    </div>
                </nav>

                <div className='min-h-0 flex-1 overflow-y-auto overscroll-contain bg-[radial-gradient(circle_at_top,_rgba(193,219,199,0.22),_transparent_40%)] p-3 sm:p-6' style={{ scrollbarWidth: 'thin' }}>
                    {activeTab === 'single' && (
                        <div className='mx-auto max-w-3xl'>
                            <div className='mb-3 sm:mb-4'>
                                <h3 className='font-display text-[18px] font-semibold text-[#18231c] sm:text-[24px]'>Single wash</h3>
                                <p className='mt-0.5 text-[11px] text-[#59655d] sm:mt-1 sm:text-[12px]'>Once-off service · no contract · payment in advance</p>
                            </div>
                            <div className='grid gap-2 sm:grid-cols-3 sm:gap-3'>
                                {singleWashPrices.map(([vehicle, price], index) => (
                                    <article key={vehicle} className='grid grid-cols-[auto_1fr_auto] items-center gap-2.5 rounded-[10px] border border-[#dce6de] bg-white px-3 py-2.5 sm:block sm:rounded-[14px] sm:p-5'>
                                        <span className='grid size-8 place-items-center rounded-[8px] bg-[#eaf2eb] text-[#31553c] sm:size-9 sm:rounded-[10px]'><CarFront className='size-4 sm:size-5' /></span>
                                        <div className='min-w-0 sm:mt-4'>
                                            <h4 className='hidden text-[13px] font-semibold text-[#526158] sm:block'>Vehicle size {String(index + 1).padStart(2, '0')}</h4>
                                            <p className='font-display text-[13px] font-semibold leading-tight text-[#18231c] sm:mt-1 sm:min-h-[38px] sm:text-[17px]'>{vehicle}</p>
                                        </div>
                                        <p className='font-display text-[17px] font-bold tabular-nums text-[#1e3128] sm:mt-4 sm:border-t sm:border-[#e7ede8] sm:pt-3 sm:text-[25px]'>{price}</p>
                                    </article>
                                ))}
                            </div>
                            <div className='mt-3 rounded-[10px] border border-[#dce6de] bg-white p-3 sm:mt-4 sm:rounded-[12px] sm:p-4'>
                                <p className='text-[11px] font-semibold text-[#1e3128] sm:text-[12px]'>Every wash includes</p>
                                <p className='mt-1 text-[11px] leading-[1.45] text-[#59655d] sm:text-[12px] sm:leading-[1.55]'>Full exterior hand wash, interior clean, wheel and tyre care, glass cleaning, vacuum, and the standard vehicle checks.</p>
                            </div>
                        </div>
                    )}

                    {(activeTab === 'private' || activeTab === 'business') && (
                        <div>
                            <div className='mb-4 flex flex-wrap items-end justify-between gap-2'>
                                <div>
                                    <h3 className='font-display text-[20px] font-semibold text-[#18231c] sm:text-[24px]'>{activeGroup.label}</h3>
                                    <p className='mt-1 text-[12px] text-[#59655d]'>Monthly rates and 6- or 12-month contract totals by vehicle.</p>
                                </div>
                                {activeTab === 'business' && <span className='rounded-full bg-[#eaf2eb] px-3 py-1.5 text-[10px] font-semibold text-[#31553c]'>Minimum 3 vehicles · same premises</span>}
                            </div>
                            <div className='mx-auto grid max-w-5xl items-start gap-3 sm:gap-4 xl:grid-cols-2'>
                                {activeGroup.packages.map((pkg) => <MonthlyPackageCard key={pkg.id} groupLabel={activeGroup.label} pkg={pkg} />)}
                            </div>
                            <p className='mt-4 text-center text-[11px] leading-[1.5] text-[#69766e] sm:text-left'>Monthly package pricing is shown per month. Confirm the vehicle mix and service address before booking.</p>
                        </div>
                    )}

                    {activeTab === 'prepay' && (
                        <div className='mx-auto max-w-3xl'>
                            <div className='mb-4'>
                                <h3 className='font-display text-[20px] font-semibold text-[#18231c] sm:text-[24px]'>3-month prepay</h3>
                                <p className='mt-1 text-[12px] leading-[1.5] text-[#59655d]'>Prepay three months of private-client washes in one payment.</p>
                            </div>
                            <div className='grid gap-2.5 sm:hidden'>
                                {threeMonthPrepayPrices.map(([vehicle, standard, premium]) => (
                                    <article key={vehicle} className='rounded-[11px] border border-[#dce6de] bg-white p-3.5'>
                                        <h4 className='text-[13px] font-semibold text-[#18231c]'>{vehicle}</h4>
                                        <div className='mt-2 grid grid-cols-2 gap-2'>
                                            <div className='rounded-lg bg-[#f2f7f3] px-2.5 py-2'>
                                                <p className='text-[9px] font-semibold uppercase text-[#54705b]'>Standard · 2/mo</p>
                                                <p className='mt-1 text-[15px] font-bold tabular-nums text-[#1e3128]'>{standard}</p>
                                            </div>
                                            <div className='rounded-lg bg-[#f2f7f3] px-2.5 py-2'>
                                                <p className='text-[9px] font-semibold uppercase text-[#54705b]'>Premium · 4/mo</p>
                                                <p className='mt-1 text-[15px] font-bold tabular-nums text-[#1e3128]'>{premium}</p>
                                            </div>
                                        </div>
                                    </article>
                                ))}
                            </div>
                            <div className='hidden overflow-hidden rounded-[14px] border border-[#dce6de] bg-white sm:block'>
                                <div className='grid grid-cols-[1fr_auto_auto] gap-3 border-b border-[#dce6de] bg-[#f2f7f3] px-5 py-3 text-[10px] font-semibold uppercase text-[#54705b]'>
                                    <span>Vehicle</span><span>Standard · 2 washes/mo</span><span>Premium · 4 washes/mo</span>
                                </div>
                                {threeMonthPrepayPrices.map(([vehicle, standard, premium]) => (
                                    <div key={vehicle} className='grid grid-cols-[1fr_auto_auto] gap-3 border-b border-[#edf1ed] px-5 py-3 text-[13px] last:border-0'>
                                        <span className='text-[#59655d]'>{vehicle}</span><span className='font-semibold tabular-nums text-[#18231c]'>{standard}</span><span className='font-semibold tabular-nums text-[#18231c]'>{premium}</span>
                                    </div>
                                ))}
                            </div>
                            <p className='mt-3 rounded-[10px] bg-[#edf3ee] px-3.5 py-3 text-[11px] leading-[1.5] text-[#526158]'>Business / fleet prepay rates are confirmed based on the number of vehicles and service requirements.</p>
                        </div>
                    )}
                </div>

                <footer className='flex shrink-0 flex-row gap-2 border-t border-[#dfe7e0] bg-white px-3 py-2.5 sm:justify-end sm:px-6 sm:py-4'>
                    <button type='button' onClick={onClose} className='min-h-10 flex-1 rounded-[9px] border border-[#d4dfd6] px-3 text-[11px] font-semibold text-[#405348] transition hover:bg-[#f3f7f3] sm:min-h-11 sm:flex-none sm:px-5 sm:text-[12px]'>Close</button>
                    <button type='button' onClick={scrollToBooking} className='group inline-flex min-h-10 flex-[1.4] items-center justify-center gap-2 rounded-[9px] bg-[#1e3128] px-3 text-[11px] font-semibold text-white transition hover:bg-[#2a4834] sm:min-h-11 sm:flex-none sm:rounded-[10px] sm:px-5 sm:text-[12px]'>Book a wash<ArrowRight className='size-4 transition-transform group-hover:translate-x-1' /></button>
                </footer>
            </section>
        </div>,
        document.body
    );
}
