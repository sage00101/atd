import { useState } from 'react';
import {
    ArrowRight,
    BadgeDollarSign,
    HelpCircle,
    Mail,
    MapPin,
} from 'lucide-react';
import heroLogo from '../assets/logos/hero-logo.svg';
import heroImageDesktop from '../assets/images/hero-desktop.jpg';
import heroImageMobile from '../assets/images/hero-mobile.jpg';
import PriceListModal from '../components/price-list-modal';

/* ============================================================
   ASSETS
   Point these at whatever paths your build serves them from.
============================================================ */
const HERO_LOGO = heroLogo;
const HERO_IMAGE_DESKTOP = heroImageDesktop;
const HERO_IMAGE_MOBILE = heroImageMobile;

/* Nudge the photo inside its frame without touching markup. */
const DESKTOP_IMAGE_POSITION = '48% 58%';
const MOBILE_IMAGE_POSITION = '64% 52%';

/* ============================================================
   PRIMARY BUTTON
   `compact` is used once, on desktop, to sit quietly under the
   bigger hero logo. Mobile/tablet always use the default size.
============================================================ */
function PrimaryButton({ href, onClick, children, compact = false }) {
    return (
        <a
            href={href}
            onClick={onClick}
            className={
                compact
                    ? `
                        group relative inline-flex min-h-[42px] items-center justify-center gap-1.5
                        overflow-hidden rounded-full border border-[#76a181]/45 bg-[#294735]
                        px-5 text-[13px] font-semibold text-white shadow-[0_10px_22px_-14px_rgba(0,0,0,.85)]
                        transition-all duration-300
                        hover:-translate-y-0.5 hover:border-[#a0c3aa]/65 hover:bg-[#355c43]
                        active:translate-y-0 active:scale-[0.98]
                        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5FE07A]/70
                    `
                    : `
                        group relative inline-flex min-h-[44px] items-center justify-center gap-1.5
                        overflow-hidden rounded-full border border-[#76a181]/45 bg-[#294735]
                        px-5 text-[13.5px] font-semibold text-white shadow-[0_10px_26px_-14px_rgba(0,0,0,.85)]
                        transition-all duration-300
                        hover:-translate-y-0.5 hover:border-[#a0c3aa]/65 hover:bg-[#355c43]
                        active:translate-y-0 active:scale-[0.98]
                        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5FE07A]/70
                        sm:min-h-[50px] sm:gap-2 sm:px-7 sm:text-[15px]
                    `
            }
        >
            <span className="pointer-events-none absolute -right-6 top-0 h-full w-16 skew-x-[-22deg] bg-gradient-to-r from-transparent via-[#79a184]/40 to-[#b3d6ba]/70 transition-all duration-500 group-hover:w-24" />
            <BadgeDollarSign className={compact ? 'relative z-10 h-3.5 w-3.5' : 'relative z-10 h-3.5 w-3.5 sm:h-4 sm:w-4'} strokeWidth={1.8} />
            <span className="relative z-10">{children}</span>
            <ArrowRight className={compact ? 'relative z-10 h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-1' : 'relative z-10 h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-1 sm:h-4 sm:w-4'} strokeWidth={1.8} />
        </a>
    );
}

/* ============================================================
   SECONDARY BUTTON
============================================================ */
function SecondaryButton({ href, onClick, icon: Icon, children, compact = false }) {
    const className = compact
        ? `
            group inline-flex min-h-[42px] items-center justify-center gap-1.5
            rounded-full border border-white/20 bg-white/[0.07] px-4 text-[12.5px]
            font-semibold text-white backdrop-blur-xl transition-all duration-300
            hover:-translate-y-0.5 hover:border-white/35 hover:bg-white/[0.13]
            active:translate-y-0 active:scale-[0.98]
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5FE07A]/70
        `
        : `
            group inline-flex min-h-[44px] items-center justify-center gap-1.5
            rounded-full border border-white/20 bg-white/[0.07] px-4 text-[13px]
            font-semibold text-white backdrop-blur-xl transition-all duration-300
            hover:-translate-y-0.5 hover:border-white/35 hover:bg-white/[0.13]
            active:translate-y-0 active:scale-[0.98]
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5FE07A]/70
            sm:min-h-[50px] sm:gap-2 sm:px-6 sm:text-[15px]
        `;
    const iconClassName = compact
        ? 'h-3.5 w-3.5 text-[#a7c5af] transition-transform duration-300 group-hover:rotate-[-6deg]'
        : 'h-3.5 w-3.5 text-[#a7c5af] transition-transform duration-300 group-hover:rotate-[-6deg] sm:h-4 sm:w-4';
    const content = <><Icon className={iconClassName} strokeWidth={1.7} />{children}</>;

    return href
        ? <a href={href} onClick={onClick} className={className}>{content}</a>
        : <button type='button' onClick={onClick} className={className}>{content}</button>;
}

/* ============================================================
   SEAM — the diagonal "wipe" line shared by the mobile and
   desktop clip-path shapes below. Drawn with an SVG so it lines
   up exactly with the clip-path, whatever the panel's aspect
   ratio ends up being.
============================================================ */
function Seam({ x1, y1, x2, y2 }) {
    return (
        <svg
            className="hero-seam pointer-events-none absolute inset-0 h-full w-full"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
        >
            <defs>
                <linearGradient id={`seam-${x1}-${y1}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#5FE07A" stopOpacity="0" />
                    <stop offset="50%" stopColor="#5FE07A" stopOpacity="0.9" />
                    <stop offset="100%" stopColor="#5FE07A" stopOpacity="0" />
                </linearGradient>
            </defs>
            <line
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={`url(#seam-${x1}-${y1})`}
                strokeWidth="2.5"
                vectorEffect="non-scaling-stroke"
            />
        </svg>
    );
}

/* ============================================================
   HERO
============================================================ */
export default function HeroSection() {
    const [priceListOpen, setPriceListOpen] = useState(false);

    const activateMonthlyPackages = () => {
        try {
            sessionStorage.setItem('a10tion-pricing-mode', 'monthly');
        } catch {
            // The pricing section still responds to the event if storage is unavailable.
        }
        window.dispatchEvent(new Event('a10tion-pricing-target'));
    };

    const activateSingleWash = () => {
        try {
            sessionStorage.setItem('a10tion-pricing-mode', 'single');
        } catch {
            // The pricing section still responds to the event if storage is unavailable.
        }
        window.dispatchEvent(new Event('a10tion-pricing-target'));
    };

    return (
        <section
            id="home"
            className="relative isolate overflow-hidden bg-[#05100a]"
        >
            {/* =====================================================
                MOBILE / TABLET  (< lg)
                Slant pushed down near the bottom edge now — just
                enough for the brand's diagonal accent without
                cropping the car.
            ===================================================== */}

            <div className="lg:hidden">
                <div className="relative h-[45svh] min-h-[320px] w-full overflow-hidden">
                    <picture>
                        <img
                            src={HERO_IMAGE_MOBILE}
                            alt="A10tion To Detail — freshly detailed hatchback on a coastal Cape Town road"
                            className="hero-wipe absolute inset-0 h-full w-full object-cover [clip-path:polygon(0_0,100%_0,100%_94%,0_100%)]"
                            style={{ objectPosition: MOBILE_IMAGE_POSITION }}
                            draggable={false}
                            loading="eager"
                            fetchPriority="high"
                            decoding="async"
                        />
                    </picture>

                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#05100a]/70 via-transparent to-transparent" />
                    <div className="pointer-events-none absolute inset-0 [clip-path:polygon(0_0,100%_0,100%_94%,0_100%)] bg-gradient-to-t from-[#05100a]/55 via-transparent to-transparent" />
                    <Seam x1="100" y1="94" x2="0" y2="100" />

                    <div className="absolute left-4 top-4 z-10 inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/25 px-3 py-1.5 text-[12px] font-medium text-white/85 backdrop-blur-md">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#5FE07A] shadow-[0_0_9px_rgba(95,224,122,.8)]" />
                        Mobile car care
                    </div>
                </div>

                <div className="hero-panel-enter relative bg-[#05100a] px-5 pb-6 pt-5 text-center">
                    <h1 className="font-display text-[clamp(1.5rem,6vw,1.9rem)] font-extrabold leading-[1.02] tracking-tight text-white">
                        Hello &amp;
                        <br />
                        welcome to
                    </h1>

                    <img
                        src={HERO_LOGO}
                        alt="A10tion To Detail — car wash and fleet care"
                        className="mx-auto mt-3 h-auto w-[clamp(12rem,68vw,17rem)] object-contain drop-shadow-[0_14px_28px_rgba(0,0,0,.6)]"
                        draggable={false}
                    />

                    <p className="mx-auto mt-3 max-w-[260px] text-[13px] font-semibold leading-snug text-[#a6c8af]">
                        Driven by passion. Finished with precision.
                    </p>

                    <div className="mt-4 flex flex-col items-stretch gap-2">
                        <PrimaryButton href="#pricing" onClick={activateMonthlyPackages}>View packages</PrimaryButton>
                        <div className="grid grid-cols-2 gap-2">
                            <SecondaryButton onClick={() => setPriceListOpen(true)} icon={HelpCircle}>
                                Pricelist
                            </SecondaryButton>
                            <SecondaryButton href="#booking" icon={Mail}>
                                Book a wash
                            </SecondaryButton>
                        </div>
                    </div>
                </div>
            </div>

            {/* =====================================================
                DESKTOP  (lg+)
                Logo is the focal point now — bigger, with the
                tagline and CTAs pushed further down and scaled
                back so they read as support, not competition.
            ===================================================== */}

            <div className="hidden h-[80svh] min-h-[560px] max-h-[760px] lg:flex">
                <div className="relative z-10 flex w-[42%] flex-col justify-center gap-0 bg-[#05100a] px-12 py-10 xl:w-[40%] xl:px-16">
                    <div className="pointer-events-none absolute -left-20 top-1/3 h-72 w-72 rounded-full bg-[#52755f]/10 blur-[100px]" />

                    <div className="hero-panel-enter relative">
                        <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-3.5 py-1.5 text-[13px] font-medium text-white/70">
                            <span className="h-1.5 w-1.5 rounded-full bg-[#5FE07A] shadow-[0_0_9px_rgba(95,224,122,.8)]" />
                            Mobile car care
                        </div>

                        <h1 className="mt-6 font-display text-[clamp(1.8rem,2.7vw,2.6rem)] font-extrabold leading-[0.98] tracking-tight text-white">
                            Hello &amp;
                            <br />
                            welcome to
                        </h1>

                        <img
                            src={HERO_LOGO}
                            alt="A10tion To Detail — car wash and fleet care"
                            className="mt-7 h-auto w-[clamp(18rem,25vw,24rem)] object-contain drop-shadow-[0_14px_28px_rgba(0,0,0,.45)]"
                            draggable={false}
                        />

                        <p className="mt-10 text-[14px] font-semibold text-[#a6c8af]">
                            Driven by passion. Finished with precision.
                        </p>

                        <div className="mt-6 flex flex-wrap items-center gap-2.5">
                            <PrimaryButton href="#pricing" onClick={activateSingleWash} compact>Book a single wash</PrimaryButton>
                            <SecondaryButton onClick={() => setPriceListOpen(true)} icon={HelpCircle} compact>
                                Pricelist
                            </SecondaryButton>
                            <SecondaryButton href="#pricing" onClick={activateMonthlyPackages} icon={Mail} compact>
                                View packages
                            </SecondaryButton>
                        </div>
                    </div>
                </div>

                <div className="relative w-[58%] overflow-hidden xl:w-[60%]">
                    <img
                        src={HERO_IMAGE_DESKTOP}
                        alt="A10tion To Detail — freshly detailed hatchback on a coastal Cape Town road"
                        className="hero-wipe absolute inset-0 h-full w-full object-cover [clip-path:polygon(9%_0,100%_0,100%_100%,0_100%)]"
                        style={{ objectPosition: DESKTOP_IMAGE_POSITION }}
                        draggable={false}
                        loading="lazy"
                        decoding="async"
                    />

                    <div className="pointer-events-none absolute inset-0 [clip-path:polygon(9%_0,100%_0,100%_100%,0_100%)] bg-gradient-to-t from-black/30 via-transparent to-black/10" />
                    <div className="pointer-events-none absolute inset-y-0 left-0 w-[22%] bg-gradient-to-r from-[#05100a]/50 to-transparent" />
                    <Seam x1="9" y1="0" x2="0" y2="100" />

                    <div className="absolute right-6 top-6 z-10 inline-flex items-center gap-1.5 rounded-full bg-black/25 px-3 py-1.5 text-[12px] font-medium text-white/75 backdrop-blur-md">
                        <MapPin className="h-3.5 w-3.5 text-[#b1c9b7]" strokeWidth={1.7} />
                        Cape Town
                    </div>
                </div>
            </div>

            {/* =====================================================
                MOTION
                One entrance moment: the photo wipes open along the
                seam, the content settles in just after. Respect
                reduced-motion.
            ===================================================== */}

            <PriceListModal open={priceListOpen} onClose={() => setPriceListOpen(false)} />

            <style>{`
                @keyframes heroWipeReveal {
                    from { opacity: 0; transform: scale(1.04); }
                    to   { opacity: 1; transform: scale(1); }
                }

                @keyframes heroPanelEnter {
                    from { opacity: 0; transform: translateY(14px); }
                    to   { opacity: 1; transform: translateY(0); }
                }

                @keyframes heroSeamDraw {
                    from { stroke-dasharray: 0 140; }
                    to   { stroke-dasharray: 140 140; }
                }

                .hero-wipe {
                    animation: heroWipeReveal 1.1s cubic-bezier(.22,1,.36,1) both;
                }

                .hero-panel-enter {
                    animation: heroPanelEnter .8s .35s cubic-bezier(.22,1,.36,1) both;
                }

                .hero-seam line {
                    animation: heroSeamDraw 1.1s cubic-bezier(.22,1,.36,1) both;
                }

                @media (prefers-reduced-motion: reduce) {
                    .hero-wipe,
                    .hero-panel-enter,
                    .hero-seam line {
                        animation: none;
                    }
                }
            `}</style>
        </section>
    );
}