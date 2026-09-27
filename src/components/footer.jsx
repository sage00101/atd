import {
    ArrowUpRight,
    BadgeCheck,
    Facebook,
    Instagram,
    Mail,
    MapPin,
    Music2,
    Phone,
    ShieldCheck,
} from 'lucide-react';
import footerLogo from '../assets/logos/footer-logo.svg';


const SUPPORT_EMAIL = 'A10tiontodetailmobiledetailing@gmail.com';
const SUPPORT_PHONE = '083 445 3888';
const BUSINESS_ADDRESS = '2 Pinnacle Crescent, Strandfontein, Cape Town, 7798';
const TERMS_URL = `${import.meta.env.BASE_URL}terms.html`;

const navLinks = [
    { label: 'Home', href: '#home' },
    { label: 'Packages', href: '#pricing' },
    { label: 'Gallery', href: '#gallery' },
    { label: 'Booking', href: '#booking' },
    { label: 'Reviews', href: '#reviews' },
    { label: 'FAQ', href: '#faq' },
    { label: 'Promo', href: '#offers' },
    { label: 'Contact', href: '#contact' },
    { label: 'Vacancies', href: '#vacancy'},
];

const policyLinks = [
    { label: 'Privacy', href: `${TERMS_URL}#confidentiality` },
    { label: 'Terms', href: TERMS_URL },
    { label: 'Cancellation', href: `${TERMS_URL}#cancellation` },
    { label: 'No-show', href: `${TERMS_URL}#cancellation` },
];

const socialLinks = [
    {
        label: 'Instagram',
        href: import.meta.env.VITE_INSTAGRAM_URL || 'https://www.instagram.com/a10tiontodetail?igsi=MWc0bWFuNmw4ODV4dA%3D%3D&utm_source=qr',
        icon: Instagram,
    },
    {
        label: 'Facebook',
        href: import.meta.env.VITE_FACEBOOK_URL || 'https://www.facebook.com/',
        icon: Facebook,
    },
    {
        label: 'TikTok',
        href: import.meta.env.VITE_TIKTOK_URL || 'https://www.tiktok.com/',
        icon: Music2,
    },
];


export default function Footer({ onOpenVacancies }) {
    const currentYear = new Date().getFullYear();

    return (
        <footer
            className='
                relative mt-16 w-full overflow-hidden border-t
                border-[#d7e1d9] bg-gradient-to-br from-white
                via-[#f7f9f7] to-[#eaf2ec] text-ink
                sm:mt-20
            '
        >
            <span className='pointer-events-none absolute -right-24 -top-28 h-72 w-72 rounded-full bg-[#b8cfbd]/24 blur-3xl' />
            <span className='pointer-events-none absolute -bottom-36 left-[8%] h-72 w-72 rounded-full bg-[#dfe9e1]/50 blur-3xl' />
            <span className='pointer-events-none absolute left-[38%] top-0 h-px w-1/4 bg-gradient-to-r from-transparent via-sage/35 to-transparent' />

            <div className='relative mx-auto max-w-7xl px-3.5 py-4 sm:px-6 sm:py-6 md:px-8 lg:px-10 lg:py-7'>
                <div className='grid items-center gap-4 lg:grid-cols-[0.9fr_1.85fr_auto] lg:gap-7'>
                    <div className='min-w-0'>
                        <div className='flex items-center justify-between gap-3 lg:block'>
                            <a
                                href='#home'
                                className='inline-flex shrink-0 items-center'
                                aria-label='A10tion To Detail home'
                            >
                                <img
                                    src={footerLogo}
                                    alt='A10tion To Detail'
                                    className='h-9 w-auto object-contain sm:h-10'
                                    draggable={false}
                                    loading='lazy'
                                    decoding='async'
                                />
                            </a>

                            <a
                                href='#booking'
                                className='
                                    inline-flex min-h-[38px] shrink-0 items-center
                                    justify-center gap-1.5 rounded-full bg-gradient-to-r
                                    from-[#1d3426] to-[#365a42]
                                    px-4 text-[9.5px] font-semibold text-white
                                    shadow-[0_12px_26px_-18px_rgba(20,49,30,.58)]
                                    transition hover:-translate-y-0.5
                                    hover:from-[#294532] hover:to-[#78977f]
                                    lg:hidden
                                '
                            >
                                Book now
                                <ArrowUpRight className='h-3 w-3' />
                            </a>
                        </div>

                        <p className='mt-2 max-w-[305px] text-left text-[10.5px] leading-[1.55] text-[#1d251f]/80 sm:text-[11.5px]'>
                            Premium mobile car wash across Cape Town.
                            Hand-washed, carefully finished.
                        </p>
                    </div>


                    <nav aria-label='Footer navigation'>
                        <p className='mb-2 text-left text-[8px] font-semibold uppercase tracking-[0.16em] text-[#31553c] sm:text-[9px]'>
                            Explore
                        </p>
                        <div className='grid grid-cols-4 gap-1.5 sm:gap-2 lg:flex lg:flex-wrap lg:gap-x-2 lg:gap-y-2'>
                            {navLinks.map((link) => (
                                <a
                                    key={link.href}
                                    href={link.href}
                                    className='
                                        flex min-h-[32px] min-w-0 items-center
                                        justify-center rounded-lg border
                                        border-[#d9e3dc] bg-gradient-to-r
                                        from-white/80 to-white/80 px-1.5
                                        text-center text-[9px] font-semibold
                                        text-[#172019] transition duration-200
                                        hover:border-transparent hover:from-[#1d3426]
                                        hover:to-[#78977f] hover:text-white
                                        sm:text-[10.5px] lg:min-h-[34px] lg:px-3
                                    '
                                >
                                    <span className='truncate'>{link.label}</span>
                                </a>
                            ))}
                        </div>
                    </nav>


                    <a
                        href='#booking'
                        className='
                            hidden min-h-[42px] items-center justify-center
                            gap-2 rounded-full bg-gradient-to-r from-[#1d3426]
                            to-[#365a42] px-5 text-[11px]
                            font-semibold text-white
                            shadow-[0_14px_30px_-20px_rgba(20,49,30,.62)]
                            transition hover:-translate-y-0.5
                            hover:from-[#294532] hover:to-[#78977f]
                            lg:inline-flex
                        '
                    >
                        Book a detail
                        <ArrowUpRight className='h-3.5 w-3.5' />
                    </a>
                </div>


                <div className='mt-4 grid grid-cols-2 gap-2 border-t border-[#d9e3dc] pt-4 sm:grid-cols-4 lg:mt-5 lg:grid-cols-[auto_minmax(220px,1fr)_minmax(280px,1.15fr)_auto] lg:items-center lg:gap-3 lg:pt-4'>
                    <p className='col-span-2 flex min-w-0 items-center gap-2 rounded-xl border border-[#dce5de] bg-white/65 px-2.5 py-2 text-[9.5px] font-medium text-[#202a23] sm:text-[10.5px] lg:col-span-1 lg:border-0 lg:bg-transparent lg:px-0 lg:py-0'>
                        <Phone className='h-3.5 w-3.5 shrink-0 text-sage' />
                        <span className='whitespace-nowrap'>{SUPPORT_PHONE}</span>
                    </p>

                    <p className='col-span-2 flex min-w-0 items-center gap-2 rounded-xl border border-[#dce5de] bg-white/65 px-2.5 py-2 text-[9.5px] font-medium text-[#202a23] sm:col-span-4 sm:text-[10.5px] lg:col-span-1 lg:border-0 lg:bg-transparent lg:px-0 lg:py-0'>
                        <Mail className='h-3.5 w-3.5 shrink-0 text-sage' />
                        <span className='min-w-0 break-words leading-[1.35]'>
                            {SUPPORT_EMAIL}
                        </span>
                    </p>

                    <p className='col-span-2 flex min-w-0 items-center gap-2 rounded-xl border border-[#dce5de] bg-white/65 px-2.5 py-2 text-[9.5px] font-medium text-[#202a23] sm:text-[10.5px] lg:col-span-1 lg:border-0 lg:bg-transparent lg:px-0 lg:py-0'>
                        <MapPin className='h-3.5 w-3.5 shrink-0 text-sage' />
                        <span className='min-w-0 leading-[1.35]'>
                            {BUSINESS_ADDRESS}
                        </span>
                    </p>

                    <p className='col-span-2 flex min-w-0 flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-xl border border-[#dce5de] bg-white/65 px-2.5 py-2 text-[9.5px] font-medium text-[#202a23] sm:col-span-4 sm:text-[10.5px] lg:col-span-1 lg:justify-start lg:border-0 lg:bg-transparent lg:px-0 lg:py-0'>
                        <span className='inline-flex items-center gap-1.5 whitespace-nowrap'>
                            <ShieldCheck className='h-3.5 w-3.5 shrink-0 text-sage' />
                            Hand-wash only
                        </span>
                        <span className='text-sage/45'>•</span>
                    </p>
                </div>
            </div>


            <div className='relative border-t border-[#dbe4dd] bg-[#eef3ef]/72'>
                <div className='mx-auto flex max-w-7xl flex-col gap-2.5 px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-6 md:px-8 lg:px-10'>
                    <div className='flex flex-wrap items-center justify-center gap-x-3 gap-y-1 sm:justify-start'>
                        {policyLinks.map((link) => (
                            <a
                                key={link.href}
                                href={link.href}
                                className='text-[8.5px] font-medium text-[#29332c]/70 transition hover:text-[#1d3426] sm:text-[9.5px]'
                            >
                                {link.label}
                            </a>
                        ))}
                    </div>

                    <div className='flex items-center justify-between gap-3 sm:justify-end'>
                        <div className='min-w-0 text-left sm:text-right'>
                            <p className='text-[8.5px] font-medium text-[#29332c]/70 sm:text-[9.5px]'>
                                Copyright © A10tion To Detail. All Rights Reserved.
                            </p>
                        </div>

                        <div className='flex items-center gap-1.5'>
                            {socialLinks.map(({ label, href, icon: Icon }) => (
                                <a
                                    key={label}
                                    href={href}
                                    target='_blank'
                                    rel='noopener noreferrer'
                                    aria-label={label}
                                    className='
                                        box-border inline-flex !h-8 !w-8 !min-h-0
                                        !min-w-0 flex-none appearance-none items-center
                                        justify-center rounded-full border border-[#cedbd1]
                                        bg-gradient-to-br from-white to-[#f3f7f4]
                                        !p-0 leading-none text-sage transition duration-200
                                        hover:border-transparent hover:from-[#1d3426]
                                        hover:to-[#78977f] hover:text-white
                                    '
                                >
                                    <span className='pointer-events-none inline-flex h-full w-full items-center justify-center'>
                                        <Icon className='block h-3.5 w-3.5 shrink-0' />
                                    </span>
                                </a>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </footer>
    );
}