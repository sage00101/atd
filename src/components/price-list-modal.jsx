import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRight, Building2, CarFront, Check, Clock3, X } from 'lucide-react';
import { packageGroups, singleWashPrices, threeMonthPrepayPrices } from '../data/pricing';

const tabs = [
    { id: 'single', label: 'Single wash', icon: CarFront },
    { id: 'private', label: 'Private packages', icon: CarFront },
    { id: 'business', label: 'Business / fleet', icon: Building2 },
    { id: 'prepay', label: '3-month prepay', icon: Clock3 },
];

const vehicleColumns = ['Sedan / Hatchback', 'SUV / Bakkie', 'Minibus / Van'];

function formatZarFromCents(cents) {
    return `R${(cents / 100).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function QuoteButton({ children = 'Request a quote', onClick, className = '' }) {
    return (
        <button type="button" onClick={onClick} className={`inline-flex min-h-9 items-center justify-center gap-2 rounded-full bg-[#28583b] px-4 py-2 text-[11px] font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-[#1e452e] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#28583b] ${className}`}>
            {children}<ArrowRight className="size-3.5" />
        </button>
    );
}

function SectionIntro({ eyebrow, title, description, aside }) {
    return (
        <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-[#e4ece5] bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div className="min-w-0">
                <p className="text-[9px] font-bold uppercase tracking-[.17em] text-[#64816b]">{eyebrow}</p>
                <h3 className="mt-1 font-display text-[21px] font-semibold tracking-tight text-[#1c3022] sm:text-[25px]">{title}</h3>
                <p className="mt-1 max-w-2xl text-[11px] leading-relaxed text-[#68756b] sm:text-[12px]">{description}</p>
            </div>
            {aside && <div className="shrink-0 self-start sm:self-center">{aside}</div>}
        </div>
    );
}

function PriceCard({ children, className = '' }) {
    return <article className={`overflow-hidden rounded-2xl border border-[#e0e9e1] bg-white shadow-[0_10px_30px_-25px_rgba(20,49,29,.35)] ${className}`}>{children}</article>;
}

function MonthlyPackageCard({ groupLabel, pkg, onRequestQuote }) {
    const isPrivate = pkg.id.startsWith('private-');
    const missingThreeMonthPrice = isPrivate && pkg.monthlyPrices.some((_, index) => !pkg.threeMonthPrices?.[index]);

    return (
        <PriceCard>
            <div className="border-b border-[#e6eee7] bg-[#f1f7f2] px-4 py-4 sm:px-5">
                <p className="text-[9px] font-bold uppercase tracking-[.14em] text-[#64816b]">{groupLabel} · {pkg.washes}</p>
                <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                    <h4 className="font-display text-[19px] font-semibold tracking-tight text-[#1c3022] sm:text-[21px]">{pkg.title}</h4>
                    <span className="rounded-full border border-[#d6e5d8] bg-white px-3 py-1.5 text-[9px] font-semibold text-[#376246]">{pkg.monthlyNote}</span>
                </div>
            </div>

            {isPrivate ? (
                <>
                    <div className="hidden sm:block">
                        <div className="grid grid-cols-[minmax(0,1.2fr)_repeat(2,minmax(0,.9fr))] gap-3 bg-white px-5 py-3 text-[9px] font-bold uppercase tracking-wider text-[#738176]">
                            <span>Vehicle type</span><span className="text-center">Per month</span><span className="text-center">3-month total</span>
                        </div>
                        {pkg.monthlyPrices.map(([vehicle, monthlyPrice], index) => (
                            <div key={vehicle} className="grid grid-cols-[minmax(0,1.2fr)_repeat(2,minmax(0,.9fr))] items-center gap-3 border-t border-[#edf2ed] px-5 py-4 text-[12px] even:bg-[#fbfcfb]">
                                <span className="font-medium text-[#58665b]">{vehicle}</span>
                                <span className="text-center font-semibold tabular-nums text-[#203628]">{monthlyPrice}</span>
                                <span className="text-center font-semibold tabular-nums text-[#203628]">{pkg.threeMonthPrices?.[index] || <QuoteButton onClick={onRequestQuote} className="min-h-8 px-3 text-[9px]">Request quote</QuoteButton>}</span>
                            </div>
                        ))}
                    </div>
                    <div className="divide-y divide-[#edf2ed] sm:hidden">
                        {pkg.monthlyPrices.map(([vehicle, monthlyPrice], index) => (
                            <div key={vehicle} className="p-4">
                                <div className="flex items-center justify-between gap-3">
                                    <h5 className="text-[12px] font-semibold text-[#263a2c]">{vehicle}</h5>
                                    <span className="rounded-full bg-[#edf5ee] px-3 py-1.5 text-[10px] font-bold tabular-nums text-[#315d3e]">{monthlyPrice}</span>
                                </div>
                                <div className="mt-3 grid grid-cols-2 gap-2">
                                    <div className="rounded-xl bg-[#f5f8f5] p-3">
                                        <p className="text-[8px] font-bold uppercase tracking-wider text-[#7a887d]">Per month</p>
                                        <p className="mt-1 text-[12px] font-bold tabular-nums text-[#203628]">{monthlyPrice}</p>
                                    </div>
                                    <div className="rounded-xl bg-[#f5f8f5] p-3">
                                        <p className="text-[8px] font-bold uppercase tracking-wider text-[#7a887d]">3-month total</p>
                                        <p className="mt-1 text-[12px] font-bold tabular-nums text-[#203628]">{pkg.threeMonthPrices?.[index] || <QuoteButton onClick={onRequestQuote} className="min-h-7 px-2 text-[8px]">Request quote</QuoteButton>}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                    {missingThreeMonthPrice && <div className="border-t border-[#e8efe9] bg-[#f8faf8] px-4 py-3 text-center"><QuoteButton onClick={onRequestQuote}>Request a quote</QuoteButton></div>}
                </>
            ) : (
                <>
                    <div className="hidden sm:block">
                        <div className="grid grid-cols-4 gap-2 bg-white px-5 py-3 text-center text-[9px] font-bold uppercase tracking-wider text-[#738176]">
                            <span className="text-left">Fleet size</span>{vehicleColumns.map((vehicle) => <span key={vehicle}>{vehicle}</span>)}
                        </div>
                        {pkg.fleetRates.map((rate) => (
                            <div key={rate.tier} className="grid grid-cols-4 items-center gap-2 border-t border-[#edf2ed] px-5 py-4 text-center text-[12px] even:bg-[#fbfcfb]">
                                <span className="text-left font-medium text-[#58665b]">{rate.label} vehicles</span>
                                {vehicleColumns.map((vehicle) => <span key={vehicle} className="font-semibold tabular-nums text-[#203628]">{formatZarFromCents(rate.prices[vehicle])}</span>)}
                            </div>
                        ))}
                        <p className="border-t border-[#edf2ed] bg-[#f8faf8] px-5 py-3 text-center text-[10px] text-[#748176]">Rates are per vehicle, per month.</p>
                    </div>
                    <div className="grid gap-3 p-3 sm:hidden">
                        {pkg.fleetRates.map((rate) => (
                            <div key={rate.tier} className="rounded-xl border border-[#e6eee7] bg-[#f8faf8] p-3">
                                <h5 className="text-[11px] font-bold text-[#2c4332]">{rate.label} vehicles <span className="font-medium text-[#78867b]">· per vehicle / month</span></h5>
                                <div className="mt-3 grid grid-cols-3 gap-2">
                                    {vehicleColumns.map((vehicle) => (
                                        <div key={vehicle} className="min-w-0 rounded-lg bg-white px-1.5 py-2.5 text-center">
                                            <p className="min-h-7 text-[8px] leading-tight text-[#758278]">{vehicle}</p>
                                            <p className="mt-1 break-words text-[10px] font-bold tabular-nums text-[#203628]">{formatZarFromCents(rate.prices[vehicle])}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </PriceCard>
    );
}

export default function PriceListModal({ open, onClose }) {
    const [activeTab, setActiveTab] = useState('single');
    const closeButtonRef = useRef(null);

    useEffect(() => {
        if (!open) return undefined;
        const previousOverflow = document.body.style.overflow;
        const previousFocus = document.activeElement;
        const closeOnEscape = (event) => { if (event.key === 'Escape') onClose(); };

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
    const scrollToContact = () => {
        onClose();
        window.requestAnimationFrame(() => document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    };
    const activeGroup = activeTab === 'business' ? packageGroups.business : packageGroups.private;

    return createPortal(
        <div
            className="fixed inset-0 z-[140] flex h-[100dvh] w-screen items-center justify-center bg-[#102016]/65 p-0 backdrop-blur-sm sm:p-5 lg:p-7"
            role="presentation"
            onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
        >
            <section className="flex h-full w-full flex-col overflow-hidden bg-[#f7faf7] text-left text-[#203027] shadow-[0_30px_100px_-35px_rgba(0,0,0,.6)] sm:h-[min(900px,92dvh)] sm:max-w-[1180px] sm:rounded-[26px] sm:border sm:border-white/70" role="dialog" aria-modal="true" aria-labelledby="price-list-title">
                <header className="shrink-0 border-b border-[#e5ece6] bg-white px-4 pb-4 pt-5 sm:px-7 sm:pb-5 sm:pt-6">
                    <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                            <div className="flex items-center gap-2">
                                <span className="size-2 rounded-full bg-[#4f895d]" />
                                <p className="text-[9px] font-bold uppercase tracking-[.19em] text-[#5d7d64] sm:text-[10px]">A10tion To Detail</p>
                            </div>
                            <h2 id="price-list-title" className="mt-2 font-display text-[25px] font-semibold leading-tight tracking-tight text-[#1b3021] sm:text-[34px]">Our wash price list</h2>
                            <p className="mt-1.5 max-w-2xl text-[11px] leading-relaxed text-[#68756b] sm:text-[13px]">Clear pricing for individual washes, private packages and business fleets.</p>
                        </div>
                        <button ref={closeButtonRef} type="button" onClick={onClose} aria-label="Close price list" className="grid size-9 shrink-0 place-items-center rounded-full border border-[#e1e9e2] bg-white text-[#49624e] transition hover:border-[#b8cfbc] hover:bg-[#f1f7f2] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4f895d] sm:size-10">
                            <X className="size-4" />
                        </button>
                    </div>
                </header>

                <nav className="shrink-0 border-b border-[#dfe9e1] bg-white px-3 py-3 sm:px-6" aria-label="Price list categories">
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {tabs.map(({ id, label, icon: Icon }) => {
                            const selected = activeTab === id;
                            return (
                                <button key={id} type="button" onClick={() => setActiveTab(id)} aria-pressed={selected} className={`group flex min-h-[44px] items-center justify-center gap-2 rounded-xl border px-2.5 py-2 text-[10px] font-semibold transition duration-200 sm:min-h-[46px] sm:text-[11px] ${selected ? 'border-[#28583b] bg-[#28583b] text-white shadow-[0_7px_18px_-10px_rgba(31,82,49,.8)]' : 'border-[#e3ebe4] bg-[#f7faf7] text-[#56685a] hover:border-[#b9d0bd] hover:bg-[#edf5ee]'}`}>
                                    <Icon className={`size-4 shrink-0 ${selected ? 'text-[#c8e0cc]' : 'text-[#64816b]'}`} />
                                    <span>{label}</span>
                                </button>
                            );
                        })}
                    </div>
                </nav>

                <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-[#f7faf7] px-3 py-4 sm:px-6 sm:py-6" style={{ scrollbarWidth: 'thin' }}>
                    {activeTab === 'single' && (
                        <div className="mx-auto max-w-4xl">
                            <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-[#e4ece5] bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-5">
                                <div><p className="text-[9px] font-bold uppercase tracking-[.17em] text-[#64816b]">Once-off service</p><h3 className="mt-1 font-display text-[21px] font-semibold text-[#1c3022] sm:text-[25px]">Single wash</h3><p className="mt-1 text-[11px] text-[#68756b] sm:text-[12px]">A once-off wash with no monthly contract.</p></div>
                                <span className="self-start rounded-full bg-[#edf5ee] px-3 py-2 text-[9px] font-semibold text-[#376246] sm:self-center">Payment in advance</span>
                            </div>
                            <div className="grid gap-3 sm:grid-cols-3">
                                {singleWashPrices.map(([vehicle, price], index) => (
                                    <PriceCard key={vehicle} className="flex items-center gap-3 px-4 py-4 sm:block sm:px-5 sm:py-5">
                                        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#edf5ee] text-[#376246] sm:size-11"><CarFront className="size-5" /></span>
                                        <div className="min-w-0 flex-1 sm:mt-4"><p className="text-[8px] font-bold uppercase tracking-wider text-[#829087]">Vehicle {String(index + 1).padStart(2, '0')}</p><h4 className="mt-1 text-[12px] font-semibold text-[#314536] sm:min-h-10 sm:text-[14px]">{vehicle}</h4></div>
                                        <p className="font-display text-[20px] font-bold tabular-nums text-[#28583b] sm:mt-4 sm:border-t sm:border-[#e9efea] sm:pt-4 sm:text-[27px]">{price}</p>
                                    </PriceCard>
                                ))}
                            </div>
                            <div className="mt-4 rounded-2xl border border-[#e0e9e1] bg-white p-4 sm:p-5">
                                <div className="flex items-center gap-2"><span className="grid size-7 place-items-center rounded-lg bg-[#edf5ee] text-[#4b7655]"><Check className="size-4" /></span><h4 className="text-[12px] font-bold text-[#2b4231]">Every wash includes</h4></div>
                                <p className="mt-2 text-[11px] leading-relaxed text-[#68756b] sm:text-[12px]">Full exterior hand wash, interior clean, wheel and tyre care, glass cleaning, vacuum, and the standard vehicle checks.</p>
                            </div>
                        </div>
                    )}

                    {(activeTab === 'private' || activeTab === 'business') && (
                        <div className="mx-auto max-w-6xl">
                            <SectionIntro eyebrow="Monthly wash plans" title={activeGroup.label} description="Compare package rates by vehicle type and fleet size." aside={activeTab === 'business' ? <span className="inline-flex rounded-full border border-[#d6e5d8] bg-[#edf5ee] px-3 py-2 text-[9px] font-semibold text-[#376246]">Minimum 3 vehicles · same premises</span> : null} />
                            <div className={`grid items-start gap-4 sm:gap-5 ${activeTab === 'private' ? 'xl:grid-cols-2' : ''}`}>
                                {activeGroup.packages.map((pkg) => <MonthlyPackageCard key={pkg.id} groupLabel={activeGroup.label} pkg={pkg} onRequestQuote={scrollToContact} />)}
                            </div>
                            <p className="mt-4 rounded-xl border border-[#e2ebe3] bg-white px-4 py-3 text-[10px] leading-relaxed text-[#68756b] sm:text-[11px]">Online packages are available for 1 or 3 months. Monthly rates are per vehicle; please confirm your vehicle mix and service address before booking.</p>
                        </div>
                    )}

                    {activeTab === 'prepay' && (
                        <div className="mx-auto max-w-4xl">
                            <SectionIntro eyebrow="Private clients" title="3-month prepay" description="Prepay three months of private-client washes in one payment." />
                            <div className="grid gap-3 sm:hidden">
                                {threeMonthPrepayPrices.map(([vehicle, standard, premium]) => (
                                    <PriceCard key={vehicle} className="p-4">
                                        <h4 className="text-[12px] font-semibold text-[#2b4231]">{vehicle}</h4>
                                        <div className="mt-3 grid grid-cols-2 gap-2">
                                            <div className="rounded-xl bg-[#f2f7f3] p-3"><p className="text-[8px] font-bold uppercase tracking-wider text-[#65816b]">Standard · 2 / month</p><p className="mt-1.5 text-[16px] font-bold tabular-nums text-[#28583b]">{standard}</p></div>
                                            <div className="rounded-xl bg-[#f2f7f3] p-3"><p className="text-[8px] font-bold uppercase tracking-wider text-[#65816b]">Premium · 4 / month</p><p className="mt-1.5 text-[16px] font-bold tabular-nums text-[#28583b]">{premium}</p></div>
                                        </div>
                                    </PriceCard>
                                ))}
                            </div>
                            <PriceCard className="hidden sm:block">
                                <div className="grid grid-cols-[1fr_auto_auto] gap-4 bg-[#edf5ee] px-5 py-4 text-[9px] font-bold uppercase tracking-wider text-[#58725e]"><span>Vehicle</span><span>Standard · 2 washes / month</span><span>Premium · 4 washes / month</span></div>
                                {threeMonthPrepayPrices.map(([vehicle, standard, premium]) => <div key={vehicle} className="grid grid-cols-[1fr_auto_auto] gap-4 border-t border-[#edf2ed] px-5 py-4 text-[12px]"><span className="font-medium text-[#58665b]">{vehicle}</span><span className="font-bold tabular-nums text-[#203628]">{standard}</span><span className="font-bold tabular-nums text-[#203628]">{premium}</span></div>)}
                            </PriceCard>
                            <div className="mt-4 rounded-2xl border border-[#e0e9e1] bg-white p-4 sm:p-5">
                                <p className="text-[10px] leading-relaxed text-[#68756b] sm:max-w-xl sm:text-[11px]">Business and fleet prepay rates depend on the number of vehicles and service requirements.</p>
                            </div>
                        </div>
                    )}
                    {activeTab !== 'single' && (
                        <aside className={`mx-auto mt-4 flex flex-col gap-4 rounded-2xl border border-[#39734a] bg-[#28583b] p-4 text-left text-white shadow-[0_12px_30px_-18px_rgba(27,75,43,.7)] sm:flex-row sm:items-center sm:justify-between sm:p-5 ${activeTab === 'prepay' ? 'max-w-4xl' : 'max-w-6xl'}`}>
                            <p className="max-w-2xl text-[13px] font-semibold leading-relaxed sm:text-[14px]">6- and 12-month Business / Fleet / Family contracts are available by request. We’ll confirm the total for your vehicles.</p>
                            <button type="button" onClick={scrollToContact} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-5 text-[12px] font-bold text-[#1e452e] transition hover:bg-[#eaf4eb] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
                                Request fleet quote <ArrowRight className="size-4" />
                            </button>
                        </aside>
                    )}
                </main>

                <footer className="flex shrink-0 gap-2 border-t border-[#e1e9e2] bg-white px-3 py-3 sm:justify-end sm:px-6 sm:py-4">
                    <button type="button" onClick={onClose} className="min-h-11 flex-1 rounded-xl border border-[#dce6dd] px-4 text-[11px] font-semibold text-[#526558] transition hover:bg-[#f5f8f5] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4f895d] sm:flex-none sm:px-6">Close</button>
                    <button type="button" onClick={scrollToBooking} className="inline-flex min-h-11 flex-[1.35] items-center justify-center gap-2 rounded-xl bg-[#28583b] px-4 text-[11px] font-semibold text-white transition hover:bg-[#1e452e] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4f895d] sm:flex-none sm:px-6">Book a wash <ArrowRight className="size-4" /></button>
                </footer>
            </section>
        </div>,
        document.body
    );
}
