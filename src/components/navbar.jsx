import { useEffect, useState } from 'react';

import {
    Menu,
    X,
    ArrowUpRight,
    BookOpen,
    CalendarDays,
    CheckCircle2,
    Clock3,
    CreditCard,
    FileCheck2,
    ShieldCheck,
} from 'lucide-react';
import navLogo from '../assets/logos/hero-logo.png';
import navLogoClose from '../assets/logos/nav-logo-close.svg';


const links = [
    { name: 'Gallery', href: '#gallery' },
    { name: 'Packages', href: '#pricing' },
    { name: 'Booking', href: '#booking' },
    { name: 'Reviews', href: '#reviews' },
    { name: 'FAQ', href: '#faq' },
    { name: 'Promo', href: '#offers' },
    { name: 'Contact', href: '#contact' },
];


export default function Navbar({ onOpenVacancies }) {
    const [isOpen, setIsOpen] = useState(false);
    const [isMonthlyGuideOpen, setIsMonthlyGuideOpen] = useState(false);
    const [isScrolled, setIsScrolled] = useState(false);


    /* =========================================
        DESKTOP SCROLL STATE
    ========================================= */
    useEffect(() => {
        const updateNavbar = () => {
            setIsScrolled(window.scrollY > 10);
        };

        updateNavbar();
        window.addEventListener('scroll', updateNavbar, { passive: true });

        return () => {
            window.removeEventListener('scroll', updateNavbar);
        };
    }, []);


    /* =========================================
        LOCK PAGE WHILE MOBILE MENU IS OPEN
    ========================================= */
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }

        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);


    /* =========================================
        ESCAPE KEY CLOSE
    ========================================= */
    useEffect(() => {
        const handleEscape = (event) => {
            if (event.key === 'Escape') {
                setIsOpen(false);
                setIsMonthlyGuideOpen(false);
            }
        };

        window.addEventListener('keydown', handleEscape);

        return () => {
            window.removeEventListener('keydown', handleEscape);
        };
    }, []);



    /* =========================================
        LOCK PAGE WHILE MONTHLY GUIDE IS OPEN
    ========================================= */
    useEffect(() => {
        if (isMonthlyGuideOpen) {
            document.body.style.overflow = 'hidden';
        }

        return () => {
            document.body.style.overflow = '';
        };
    }, [isMonthlyGuideOpen]);


    const closeMenu = () => {
        setIsOpen(false);
    };

    const openMonthlyGuide = () => {
        setIsOpen(false);
        setIsMonthlyGuideOpen(true);
    };


    return (
        <>
            <header className='fixed inset-x-0 top-0 z-50'>
                {/* =====================================================
                    MAIN NAVBAR
                ===================================================== */}
                <div
                    className={`
                        border-b border-white/15 bg-[#07110b]/45 text-white backdrop-blur-xl
                        transition-[background-color,border-color,box-shadow,backdrop-filter]
                        duration-300 ease-out

                        ${
                            isScrolled
                                ? `
                                    lg:border-white/20
                                    lg:bg-[#07110b]/65
                                    lg:shadow-[0_10px_30px_-24px_rgba(24,34,28,.42)]
                                    lg:backdrop-blur-xl
                                `
                                : `
                                    lg:bg-[#07110b]/45
                                    lg:shadow-none
                                    lg:backdrop-blur-none
                                `
                        }
                    `}
                >

                    <div
                        className='
                            mx-auto
                            flex
                            max-w-7xl
                            items-center
                            justify-between
                            px-4
                            py-3

                            sm:px-6
                            sm:py-3.5

                            md:px-10
                        '
                    >

                        {/* Logo */}
                        <a
                            href='#home'
                            onClick={closeMenu}
                                    className='flex shrink-0 items-center'
                        >
                            <img
                                src={navLogo}
                                alt='A10tion To Detail'
                                className='h-10 w-auto sm:h-11 md:h-12'
                            />
                        </a>


                        {/* =================================================
                            DESKTOP NAVIGATION
                        ================================================= */}
                        <nav className='hidden items-center gap-7 text-[12px] font-medium text-white/80 lg:flex xl:gap-9'>

                            {links.map((link) => (
                                <a
                                    key={link.name}
                                    href={link.href}
                                    className='group relative py-2 transition-colors duration-200 hover:text-white'
                                >
                                    {link.name}

                                    <span className='absolute bottom-0 left-1/2 h-px w-0 -translate-x-1/2 bg-sage transition-all duration-300 group-hover:w-full' />
                                </a>
                            ))}

                            <button
                                type='button'
                                onClick={openMonthlyGuide}
                                className='group relative inline-flex items-center gap-1.5 py-2 text-white transition-colors duration-200 hover:text-white'
                            >
                                Monthly Guide
                                <span className='absolute bottom-0 left-1/2 h-px w-0 -translate-x-1/2 bg-sage transition-all duration-300 group-hover:w-full' />
                            </button>

                            <button
                                type='button'
                                onClick={onOpenVacancies}
                                className='group relative py-2 transition-colors duration-200 hover:text-white'
                            >
                                Vacancies
                                <span className='absolute bottom-0 left-1/2 h-px w-0 -translate-x-1/2 bg-sage transition-all duration-300 group-hover:w-full' />
                            </button>

                        </nav>


                        {/* =================================================
                            NAV ACTIONS
                        ================================================= */}
                        <div className='flex shrink-0 items-center gap-3'>

                            {/* Desktop Book Now */}
                            <a
                                href='#booking'
                                className='
                                    hidden
                                    rounded-full
                                    bg-sage
                                    px-5
                                    py-2.5
                                    text-[12px]
                                    font-semibold
                                    text-white
                                    shadow-[0_8px_25px_-12px_rgba(76,103,82,.7)]
                                    transition-all
                                    duration-200

                                    hover:-translate-y-0.5
                                    hover:bg-sagedeep

                                    lg:inline-flex
                                '
                            >
                                Book Now
                            </a>


                            {/* =================================================
                                MOBILE HAMBURGER

                                Intentionally NOT circular.
                            ================================================= */}
                            <button
                                type='button'
                                onClick={() => setIsOpen(true)}
                                aria-label='Open navigation menu'
                                aria-expanded={isOpen}
                                style={{
                                    WebkitTapHighlightColor: 'transparent',
                                    WebkitAppearance: 'none',
                                    appearance: 'none',
                                    outline: 'none',
                                }}
                                className='
                                    inline-flex
                                    !size-11
                                    !min-h-0
                                    !min-w-0
                                    touch-manipulation
                                    items-center
                                    justify-center
                                    !rounded-none
                                    !border-0
                                    !bg-transparent
                                    !p-0
                                    text-white
                                    !shadow-none
                                    outline-none
                                    transition-transform
                                    duration-150

                                    hover:text-white

                                    focus:outline-none

                                    focus-visible:outline
                                    focus-visible:outline-2
                                    focus-visible:outline-offset-2
                                    focus-visible:outline-[#6c8272]/45

                                    active:scale-[0.94]
                                    active:text-white

                                    lg:hidden
                                '
                            >
                                <Menu
                                    className='block size-[27px] shrink-0'
                                    strokeWidth={2.35}
                                />
                            </button>

                        </div>
                    </div>
                </div>


                {/* =====================================================
                    ANIMATIONS
                ===================================================== */}
                <style>{`

                    @keyframes mobileMenuEnter {
                        from {
                            opacity: 0;
                            transform: translateY(-8px);
                        }

                        to {
                            opacity: 1;
                            transform: translateY(0);
                        }
                    }


                    @keyframes mobileLinkEnter {
                        from {
                            opacity: 0;
                            transform: translateY(10px);
                        }

                        to {
                            opacity: 1;
                            transform: translateY(0);
                        }
                    }


                    @keyframes menuGlow {
                        0%,
                        100% {
                            opacity: .22;
                            transform: scale(.92);
                        }

                        50% {
                            opacity: .4;
                            transform: scale(1.08);
                        }
                    }


                `}</style>

            </header>


            {/* =========================================================
                FULL-SCREEN MOBILE MENU
            ========================================================= */}
            {isOpen && (
                <div
                    className='
                        fixed
                        inset-0
                        z-[999]
                        overflow-hidden
                        bg-[#fdfefd]
                        text-ink

                        lg:hidden
                    '
                    style={{
                        animation:
                            'mobileMenuEnter .25s ease-out both',
                    }}
                >

                    {/* =================================================
                        SUBTLE BACKGROUND EFFECTS
                    ================================================= */}

                    {/* Top-right pale green glow */}
                    <div
                        className='
                            pointer-events-none
                            absolute
                            -right-32
                            -top-32
                            size-[300px]
                            rounded-full
                            bg-[#afc6b5]/20
                            blur-[85px]
                        '
                        style={{
                            animation:
                                'menuGlow 5s ease-in-out infinite',
                        }}
                    />


                    {/* Neutral bottom glow */}
                    <div
                        className='
                            pointer-events-none
                            absolute
                            -bottom-40
                            -left-28
                            size-[340px]
                            rounded-full
                            bg-[#dfe6e1]/35
                            blur-[90px]
                        '
                    />


                    {/* Very faint green slash */}
                    <div
                        className='
                            pointer-events-none
                            absolute
                            -right-36
                            top-[30%]
                            h-[105px]
                            w-[310px]
                            rotate-[-18deg]
                            bg-gradient-to-r
                            from-transparent
                            via-[#75947f]/[0.04]
                            to-[#92ad99]/[0.09]
                        '
                    />


                    {/* Tiny dots */}
                    <span className='absolute left-[12%] top-[20%] size-1 rounded-full bg-sage/20' />
                    <span className='absolute right-[15%] top-[37%] size-1 rounded-full bg-black/10' />
                    <span className='absolute bottom-[18%] left-[18%] size-1 rounded-full bg-sage/15' />


                    {/* =================================================
                        MOBILE MENU HEADER
                    ================================================= */}
                    <div
                        className='
                            relative
                            z-10
                            flex
                            h-[68px]
                            items-center
                            justify-between
                            border-b
                            border-[#e7e9e7]
                            bg-white/75
                            px-4
                            backdrop-blur-lg

                            min-[390px]:px-5

                            sm:px-6
                        '
                    >

                        {/* Logo */}
                        <a
                            href='#home'
                            onClick={closeMenu}
                            className='flex items-center'
                        >
                            <img
                                src={navLogoClose}
                                alt='A10tion To Detail'
                                className='h-auto w-[105px] object-contain min-[390px]:w-[115px]'
                            />
                        </a>


                        {/* Close button */}
                        <button
                            type='button'
                            onClick={closeMenu}
                            aria-label='Close navigation menu'
                            style={{
                                WebkitTapHighlightColor: 'transparent',
                                WebkitAppearance: 'none',
                                appearance: 'none',
                                outline: 'none',
                            }}
                            className='
                                flex
                                size-10
                                touch-manipulation
                                items-center
                                justify-center
                                rounded-[10px]
                                border
                                border-[#dedfdd]
                                bg-white
                                text-[#171d19]
                                shadow-none
                                outline-none
                                transition-all
                                duration-150

                                hover:border-[#c9cbc9]
                                hover:bg-[#f6f7f6]

                                focus:outline-none

                                focus-visible:border-[#aeb2af]
                                focus-visible:ring-2
                                focus-visible:ring-black/[0.06]

                                active:scale-[0.94]
                                active:bg-[#f0f1f0]
                            '
                        >
                            <X
                                className='size-[18px]'
                                strokeWidth={1.8}
                            />
                        </button>

                    </div>


                    {/* =================================================
                        MENU BODY
                    ================================================= */}
                    <div
                        className='
                            relative
                            z-10
                            flex
                            h-[calc(100dvh-68px)]
                            flex-col
                            px-4
                            pb-5
                            pt-6

                            min-[390px]:px-5
                            min-[390px]:pt-7

                            sm:px-6
                            sm:pt-8
                        '
                    >

                        {/* Intro */}
                        <div>

                            <p
                                className='
                                    text-[9px]
                                    font-semibold
                                    uppercase
                                    tracking-[0.18em]
                                    text-sage

                                    sm:text-[10px]
                                '
                            >
                                Explore
                            </p>


                            <h2
                                className='
                                    mt-2
                                    max-w-[260px]
                                    font-display
                                    text-[25px]
                                    font-medium
                                    leading-[1.08]
                                    tracking-[-0.025em]
                                    text-ink

                                    min-[390px]:text-[27px]

                                    sm:text-[30px]
                                '
                            >
                                Where would you
                                <span className='text-sage'>
                                    {' '}like to go?
                                </span>
                            </h2>

                        </div>


                        {/* =================================================
                            LINKS
                        ================================================= */}
                        <nav className='mt-6 flex flex-col min-[390px]:mt-7 sm:mt-8'>

                            {links.map((link, index) => (
                                <a
                                    key={link.name}
                                    href={link.href}
                                    onClick={closeMenu}
                                    style={{
                                        animation:
                                            'mobileLinkEnter .35s ease-out both',
                                        animationDelay: `${
                                            50 + index * 45
                                        }ms`,
                                        WebkitTapHighlightColor:
                                            'transparent',
                                    }}
                                    className='
                                        group
                                        flex
                                        min-h-[49px]
                                        touch-manipulation
                                        items-center
                                        justify-between
                                        border-b
                                        border-[#e8eae8]
                                        px-1
                                        text-[14px]
                                        font-medium
                                        text-[#4a514d]
                                        outline-none
                                        transition-all
                                        duration-200

                                        hover:pl-2
                                        hover:text-ink

                                        active:bg-black/[0.015]
                                        active:text-ink

                                        min-[390px]:min-h-[52px]
                                        min-[390px]:text-[14.5px]

                                        sm:min-h-[55px]
                                        sm:text-[15.5px]
                                    '
                                >

                                    <span>
                                        {link.name}
                                    </span>


                                    <span
                                        className='
                                            flex
                                            size-7
                                            items-center
                                            justify-center
                                            rounded-[9px]
                                            border
                                            border-[#e0e3e0]
                                            bg-white
                                            text-[#728078]
                                            transition-all
                                            duration-250

                                            group-hover:translate-x-1
                                            group-hover:border-[#cdd5cf]
                                            group-hover:bg-[#f7f9f7]
                                            group-hover:text-sagedeep
                                        '
                                    >
                                        <ArrowUpRight className='size-3' />
                                    </span>

                                </a>
                            ))}

                            <button
                                type='button'
                                onClick={openMonthlyGuide}
                                className='group flex min-h-[49px] touch-manipulation items-center justify-between border-b border-[#e8eae8] px-1 text-left text-[14px] font-semibold text-[#496b53] outline-none transition-all duration-200 hover:pl-2 hover:text-ink min-[390px]:min-h-[52px] min-[390px]:text-[14.5px] sm:min-h-[55px] sm:text-[15.5px]'
                            >
                                <span className='flex items-center gap-2'>
                                    <BookOpen className='size-4' />
                                    Monthly Packages Guide
                                </span>
                                <span className='flex size-7 items-center justify-center rounded-[9px] border border-[#d7e2d9] bg-white text-[#58745f] transition-all duration-250 group-hover:translate-x-1 group-hover:bg-[#f7f9f7]'>
                                    <ArrowUpRight className='size-3' />
                                </span>
                            </button>

                            <button
                                type='button'
                                onClick={() => {
                                    closeMenu();
                                    onOpenVacancies();
                                }}
                                className='group flex min-h-[49px] touch-manipulation items-center justify-between border-b border-[#e8eae8] px-1 text-left text-[14px] font-medium text-[#4a514d] outline-none transition-all duration-200 hover:pl-2 hover:text-ink active:bg-black/[0.015] active:text-ink min-[390px]:min-h-[52px] min-[390px]:text-[14.5px] sm:min-h-[55px] sm:text-[15.5px]'
                            >
                                <span>Vacancies</span>
                                <span className='flex size-7 items-center justify-center rounded-[9px] border border-[#e0e3e0] bg-white text-[#728078] transition-all duration-250 group-hover:translate-x-1 group-hover:border-[#cdd5cf] group-hover:bg-[#f7f9f7] group-hover:text-sagedeep'>
                                    <ArrowUpRight className='size-3' />
                                </span>
                            </button>

                        </nav>


                        {/* =================================================
                            BOTTOM CTA
                        ================================================= */}
                        <div className='mt-auto'>

                            <button
                                type='button'
                                onClick={() => {
                                    closeMenu();
                                    window.dispatchEvent(new Event('a10tion-open-cookie-settings'));
                                }}
                                className='mb-2 inline-flex min-h-9 items-center justify-center gap-2 rounded-[9px] border border-[#d9e3dc] bg-white/80 px-3 text-[10px] font-semibold text-[#405348] transition hover:bg-white'
                            >
                                Cookie settings
                            </button>

                            <a
                                href='#booking'
                                onClick={closeMenu}
                                style={{
                                    WebkitTapHighlightColor:
                                        'transparent',
                                }}
                                className='
                                    group
                                    relative
                                    flex
                                    min-h-[45px]
                                    w-full
                                    touch-manipulation
                                    items-center
                                    justify-center
                                    overflow-hidden
                                    rounded-[13px]
                                    border
                                    border-[#799181]/30
                                    bg-[#18241d]
                                    px-5
                                    text-[11.5px]
                                    font-semibold
                                    text-white
                                    shadow-[0_12px_30px_-22px_rgba(20,35,26,.55)]
                                    transition-all
                                    duration-300

                                    active:scale-[0.99]

                                    min-[390px]:min-h-[47px]
                                    min-[390px]:text-[12px]
                                '
                            >

                                {/* Green accent */}
                                <span
                                    className='
                                        pointer-events-none
                                        absolute
                                        -right-8
                                        top-0
                                        h-full
                                        w-[90px]
                                        skew-x-[-23deg]
                                        bg-gradient-to-r
                                        from-transparent
                                        via-[#638a70]/65
                                        to-[#9ebea5]/90
                                        transition-all
                                        duration-300

                                        group-hover:w-[120px]
                                    '
                                />


                                <span className='relative z-10 flex items-center gap-2'>
                                    Book Now

                                    <ArrowUpRight className='size-3.5' />
                                </span>

                            </a>


                            <p
                                className='
                                    mt-3
                                    text-center
                                    text-[8px]
                                    uppercase
                                    tracking-[0.12em]
                                    text-body/45
                                '
                            >
                                Driven by passion · Finished with precision
                            </p>

                        </div>
                    </div>
                </div>
            )}

            {/* =========================================================
                MONTHLY PACKAGES CUSTOMER GUIDE
            ========================================================= */}
            {isMonthlyGuideOpen && (
                <div
                    className='fixed inset-0 z-[1100] flex items-center justify-center bg-[#07110b]/70 p-2 backdrop-blur-md sm:p-4 md:p-0'
                    role='presentation'
                    onMouseDown={(event) => {
                        if (event.target === event.currentTarget) {
                            setIsMonthlyGuideOpen(false);
                        }
                    }}
                >
                    <section
                        role='dialog'
                        aria-modal='true'
                        aria-labelledby='monthly-guide-title'
                        className='relative flex h-[min(640px,calc(100dvh-24px))] max-h-[calc(100dvh-24px)] w-full max-w-[420px] flex-col overflow-hidden rounded-[18px] border border-white/70 bg-[#fbfcfb] text-left text-[#202922] shadow-[0_30px_100px_-35px_rgba(0,0,0,.65)] sm:h-[min(760px,calc(100dvh-32px))] sm:max-h-[calc(100dvh-32px)] sm:max-w-[600px] sm:rounded-[24px] md:h-dvh md:max-h-none md:max-w-none md:rounded-none md:border-0'
                        style={{ animation: 'monthlyGuideEnter .24s ease-out both' }}
                    >
                        <div className='relative shrink-0 overflow-hidden bg-[#14251a] px-4 py-4 text-white sm:px-6 sm:py-5 md:px-12 md:py-7'>
                            <div className='pointer-events-none absolute -right-16 -top-24 size-64 rounded-full bg-[#8eae96]/20 blur-3xl' />
                            <div className='relative flex items-start justify-between gap-4'>
                                <div className='max-w-3xl text-left'>
                                    <p className='mb-1.5 text-[8px] font-bold uppercase tracking-[.18em] text-[#a9c6ae] sm:text-[9px] md:text-[10px]'>
                                        A10tion To Detail · Customer guide
                                    </p>
                                    <h2 id='monthly-guide-title' className='font-display text-[21px] font-medium leading-tight tracking-[-.03em] sm:text-[27px] md:text-[36px]'>
                                        Your monthly package, step by step.
                                    </h2>
                                    <p className='mt-2 max-w-2xl text-[10px] leading-5 text-white/70 sm:text-[11px] md:text-[13px]'>
                                        Choose a package, pay once, then use your included washes when you need them.
                                    </p>
                                </div>
                                <button
                                    type='button'
                                    onClick={() => setIsMonthlyGuideOpen(false)}
                                    aria-label='Close monthly packages guide'
                                    className='flex size-8 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white transition hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:size-9 md:size-10'
                                >
                                    <X className='size-4' />
                                </button>
                            </div>
                            <div className='relative mt-3 flex flex-wrap gap-1.5 md:mt-5 md:gap-2'>
                                <span className='rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[10px] font-medium text-white/85'>Pay upfront</span>
                                <span className='rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[10px] font-medium text-white/85'>Book when ready</span>
                                <span className='rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[10px] font-medium text-white/85'>Unused credits roll over</span>
                            </div>
                        </div>

                        <div className='min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3.5 sm:px-5 sm:py-5 md:px-10 md:py-8'>
                            <div className='mx-auto grid w-full max-w-7xl gap-2.5 sm:gap-3 md:grid-cols-2 xl:grid-cols-3'>
                                <article className='rounded-2xl border border-[#e3e9e4] bg-white p-4 text-left sm:p-5'>
                                    <div className='mb-3 flex size-9 items-center justify-center rounded-xl bg-[#edf3ee] text-[#52735b]'>
                                        <ShieldCheck className='size-[18px]' />
                                    </div>
                                    <h3 className='text-[13px] font-bold text-[#25352a]'>1. Choose your package</h3>
                                    <p className='mt-2 text-[11.5px] leading-5 text-[#657168]'>
                                        Private Standard includes 2 washes per calendar month. Private Premium includes 4. Business, Fleet and Family Standard includes 1 wash per vehicle per calendar month.
                                    </p>
                                    <p className='mt-2 text-[11px] leading-5 text-[#657168]'>
                                        Choose a 1- or 3-month package online. For a different business term, contact us for a quote.
                                    </p>
                                </article>

                                <article className='rounded-2xl border border-[#e3e9e4] bg-white p-4 text-left sm:p-5'>
                                    <div className='mb-3 flex size-9 items-center justify-center rounded-xl bg-[#edf3ee] text-[#52735b]'>
                                        <CreditCard className='size-[18px]' />
                                    </div>
                                    <h3 className='text-[13px] font-bold text-[#25352a]'>2. Pay once for the full term</h3>
                                    <p className='mt-2 text-[11.5px] leading-5 text-[#657168]'>
                                        The full package amount is paid upfront at checkout. Monthly packages do not automatically debit your bank card every month.
                                    </p>
                                    <p className='mt-2 text-[11px] leading-5 text-[#657168]'>
                                        Successful Yoco payments activate automatically. If you choose to pay on arrival, your package is activated once our team has confirmed the payment.
                                    </p>
                                </article>

                                <article className='rounded-2xl border border-[#e3e9e4] bg-white p-4 text-left sm:p-5'>
                                    <div className='mb-3 flex size-9 items-center justify-center rounded-xl bg-[#edf3ee] text-[#52735b]'>
                                        <FileCheck2 className='size-[18px]' />
                                    </div>
                                    <h3 className='text-[13px] font-bold text-[#25352a]'>3. Complete the paperwork</h3>
                                    <p className='mt-2 text-[11.5px] leading-5 text-[#657168]'>
                                        For a 1-month package, no PDF download or signed contract is needed. You must still accept the website Terms & Conditions at checkout.
                                    </p>
                                    <p className='mt-2 text-[11px] leading-5 text-[#657168]'>
                                        For a 3-month package, download both PDFs and upload your completed, signed Supplier Contract. Accept the website Terms & Conditions before checkout.
                                    </p>
                                </article>

                                <article className='rounded-2xl border border-[#e3e9e4] bg-white p-4 text-left sm:p-5'>
                                    <div className='mb-3 flex size-9 items-center justify-center rounded-xl bg-[#edf3ee] text-[#52735b]'>
                                        <CheckCircle2 className='size-[18px]' />
                                    </div>
                                    <h3 className='text-[13px] font-bold text-[#25352a]'>4. Save your access code</h3>
                                    <p className='mt-2 text-[11.5px] leading-5 text-[#657168]'>
                                        After payment is confirmed, your customer profile is created or updated.
                                    </p>
                                    <p className='mt-2 text-[11px] leading-5 text-[#657168]'>
                                        Your receipt email includes a unique access code. Keep it safe; you will need it to book future washes. The first wash booked with your purchase uses one credit.
                                    </p>
                                </article>
                            </div>

                            <div className='mx-auto my-3 w-full max-w-7xl rounded-2xl border border-[#dce7de] bg-[#f1f6f2] p-3 text-left sm:my-4 sm:p-4 md:my-6 md:p-5'>
                                <div className='flex items-start gap-3'>
                                    <div className='flex size-9 shrink-0 items-center justify-center rounded-xl bg-white text-[#52735b] shadow-sm'>
                                        <CalendarDays className='size-[18px]' />
                                    </div>
                                    <div>
                                        <h3 className='text-[14px] font-bold text-[#25352a]'>5. Book another wash</h3>
                                        <p className='mt-1 text-[11.5px] leading-5 text-[#657168]'>
                                            Open the Booking section and enter your access code and email:
                                        </p>
                                    </div>
                                </div>
                                <ol className='mt-4 grid gap-3 sm:grid-cols-3'>
                                    <li className='rounded-xl bg-white p-3'>
                                        <span className='mb-2 flex size-6 items-center justify-center rounded-full bg-[#e7f0e9] text-[10px] font-bold text-[#52735b]'>1</span>
                                        <p className='text-[11px] font-semibold text-[#304035]'>Return to Booking</p>
                                        <p className='mt-1 text-[10.5px] leading-5 text-[#718077]'>Enter the same email address used for your package.</p>
                                    </li>
                                    <li className='rounded-xl bg-white p-3'>
                                        <span className='mb-2 flex size-6 items-center justify-center rounded-full bg-[#e7f0e9] text-[10px] font-bold text-[#52735b]'>2</span>
                                        <p className='text-[11px] font-semibold text-[#304035]'>Choose a slot</p>
                                        <p className='mt-1 text-[10.5px] leading-5 text-[#718077]'>Select an available date and time. The calendar shows the current and following month.</p>
                                    </li>
                                    <li className='rounded-xl bg-white p-3'>
                                        <span className='mb-2 flex size-6 items-center justify-center rounded-full bg-[#e7f0e9] text-[10px] font-bold text-[#52735b]'>3</span>
                                        <p className='text-[11px] font-semibold text-[#304035]'>Confirm your booking</p>
                                        <p className='mt-1 text-[10.5px] leading-5 text-[#718077]'>Choose an available time at least 1 hour ahead. Eligible washes use your package credits; you do not pay again.</p>
                                    </li>
                                </ol>
                            </div>

                            <div className='mx-auto grid w-full max-w-7xl gap-2.5 sm:gap-3 sm:grid-cols-2'>
                                <article className='rounded-2xl border border-[#e3e9e4] bg-white p-4 text-left sm:p-5'>
                                    <div className='mb-3 flex size-9 items-center justify-center rounded-xl bg-[#edf3ee] text-[#52735b]'>
                                        <Clock3 className='size-[18px]' />
                                    </div>
                                    <h3 className='text-[13px] font-bold text-[#25352a]'>6. Keep your credits</h3>
                                    <ul className='mt-2 space-y-2 text-[11px] leading-5 text-[#657168]'>
                                        <li>• Your booking limit resets on the 1st: 2 washes for Standard, 4 for Premium, or 1 per Business vehicle.</li>
                                        <li>• Unused credits roll over and do not expire, even after your paid term ends.</li>
                                        <li>• Rollover credits do not raise your monthly booking limit. Cancelled or expired bookings restore the reserved credit.</li>
                                    </ul>
                                </article>

                                <article className='rounded-2xl border border-[#e3e9e4] bg-white p-4 text-left sm:p-5'>
                                    <div className='mb-3 flex size-9 items-center justify-center rounded-xl bg-[#edf3ee] text-[#52735b]'>
                                        <CheckCircle2 className='size-[18px]' />
                                    </div>
                                    <h3 className='text-[13px] font-bold text-[#25352a]'>Renew or change your package</h3>
                                    <ul className='mt-2 space-y-2 text-[11px] leading-5 text-[#657168]'>
                                        <li>• Renewals are arranged with our team; they are not automatic.</li>
                                        <li>• To change packages, use all available credits and wait until all reserved credits are cleared.</li>
                                    </ul>
                                </article>
                            </div>

                        </div>
                        <footer className='flex shrink-0 gap-2 border-t border-[#e3e9e4] bg-white px-3 py-2.5 sm:justify-end sm:px-5 sm:py-3 md:px-10'>
                            <a href='#pricing' onClick={() => setIsMonthlyGuideOpen(false)} className='inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-full border border-[#d7e2d9] px-3 text-[10px] font-semibold text-[#304035] transition hover:bg-[#f1f6f2] sm:flex-none sm:px-5 sm:text-[11px]'>
                                View packages <ArrowUpRight className='size-3.5' />
                            </a>
                            <a href='#booking' onClick={() => setIsMonthlyGuideOpen(false)} className='inline-flex min-h-9 flex-[1.2] items-center justify-center gap-1.5 rounded-full bg-[#1e3128] px-3 text-[10px] font-semibold text-white transition hover:bg-[#2a4834] sm:flex-none sm:px-5 sm:text-[11px]'>
                                Book a wash <ArrowUpRight className='size-3.5' />
                            </a>
                        </footer>
                    </section>
                </div>
            )}

            <style>{`
                @keyframes monthlyGuideEnter {
                    from { opacity: 0; transform: translateY(12px) scale(.985); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }
            `}</style>
        </>
    );
}