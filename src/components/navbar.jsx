import { useEffect, useState } from 'react';

import {
    Menu,
    X,
    ArrowUpRight,
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
            }
        };

        window.addEventListener('keydown', handleEscape);

        return () => {
            window.removeEventListener('keydown', handleEscape);
        };
    }, []);


    const closeMenu = () => {
        setIsOpen(false);
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
        </>
    );
}