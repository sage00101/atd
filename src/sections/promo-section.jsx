import { useEffect, useState } from 'react';

import {
    Check,
    Copy,
    Film,
    Link2,
    LoaderCircle,
    LockKeyhole,
    Play,
    RotateCcw,
    ShieldCheck,
    Sparkles,
    Tag,
    X,
} from 'lucide-react';

import useReveal from '../hooks/use-reveal';
import VehiclePromoModal from '../components/vehicle-promo-modal';


const SITE_URL = import.meta.env.VITE_SITE_URL || 'https://a10tion.co.za';
const PROMO_VIDEO_URL = import.meta.env.VITE_PROMO_VIDEO_URL || '';
const PROMO_UNLOCK_ENDPOINT = '/api/promo/unlock';
const STORED_PROMO_KEY = 'a10tionPromoCode';

const QR_SRC =
    `https://api.qrserver.com/v1/create-qr-code/` +
    `?size=220x220&color=23-39-29&bgcolor=255-255-255` +
    `&margin=8&data=${encodeURIComponent(SITE_URL)}`;


async function copyText(value) {
    if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(value);
        return;
    }

    const textArea = document.createElement('textarea');
    textArea.value = value;
    textArea.setAttribute('readonly', '');
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    textArea.remove();
}


export default function PromoSection() {
    const sectionRef = useReveal();
    const [linkCopied, setLinkCopied] = useState(false);
    const [codeCopied, setCodeCopied] = useState(false);
    const [passphrase, setPassphrase] = useState('');
    const [promoCode, setPromoCode] = useState(() => {
        if (typeof window === 'undefined') {
            return '';
        }

        return window.sessionStorage.getItem(STORED_PROMO_KEY) || '';
    });
    const [unlockState, setUnlockState] = useState('idle');
    const [unlockMessage, setUnlockMessage] = useState('');
    const [activeMobilePanel, setActiveMobilePanel] = useState(null);
    const [vehiclePromoOpen, setVehiclePromoOpen] = useState(false);


    useEffect(() => {
        if (!activeMobilePanel) {
            return undefined;
        }

        const previousOverflow = document.body.style.overflow;
        const closeOnEscape = (event) => {
            if (event.key === 'Escape') {
                setActiveMobilePanel(null);
            }
        };

        document.body.style.overflow = 'hidden';
        window.addEventListener('keydown', closeOnEscape);

        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener('keydown', closeOnEscape);
        };
    }, [activeMobilePanel]);


    const showCopiedState = (setter) => {
        setter(true);
        window.setTimeout(() => setter(false), 1600);
    };


    const copyWebsiteLink = async () => {
        try {
            await copyText(SITE_URL);
            showCopiedState(setLinkCopied);
        } catch {
            setLinkCopied(false);
        }
    };


    const copyPromoCode = async () => {
        if (!promoCode) {
            return;
        }

        try {
            await copyText(promoCode);
            showCopiedState(setCodeCopied);
        } catch {
            setCodeCopied(false);
        }
    };


    const handleUnlock = async (event) => {
        event.preventDefault();

        const cleanPassphrase = passphrase.trim();

        if (!cleanPassphrase) {
            setUnlockState('error');
            setUnlockMessage('Enter the private passphrase first.');
            return;
        }

        setUnlockState('loading');
        setUnlockMessage('');

        try {
            const response = await fetch(PROMO_UNLOCK_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ passphrase: cleanPassphrase }),
            });

            if (response.status === 401 || response.status === 403) {
                setUnlockState('error');
                setUnlockMessage('That passphrase doesn’t match. Please try again.');
                return;
            }

            if (!response.ok) {
                throw new Error('Promo unlock request failed');
            }

            const result = await response.json();
            const unlockedCode = result?.promoCode?.toString().trim();

            if (!unlockedCode) {
                throw new Error('Promo code missing from response');
            }

            setPromoCode(unlockedCode);
            setPassphrase('');
            setUnlockState('success');
            window.sessionStorage.setItem(STORED_PROMO_KEY, unlockedCode);
        } catch {
            setUnlockState('error');
            setUnlockMessage(
                'The private offer could not be verified right now. Please try again shortly.'
            );
        }
    };


    const lockPromoAgain = () => {
        setPromoCode('');
        setPassphrase('');
        setUnlockState('idle');
        setUnlockMessage('');
        window.sessionStorage.removeItem(STORED_PROMO_KEY);
    };


    return (
        <section
            id='offers'
            className='px-3 pt-14 sm:px-4 sm:pt-16 md:px-8 lg:px-10 lg:pt-20'
        >
            <div
                ref={sectionRef}
                className='
                    reveal mx-auto max-w-5xl overflow-hidden rounded-[22px]
                    border border-[#d5e1d8] bg-gradient-to-br from-[#f7faf8]
                    via-white to-[#eaf2ec] p-2.5
                    shadow-[0_24px_70px_-48px_rgba(20,49,30,.42)]
                    sm:rounded-[28px] sm:p-4 lg:p-5
                '
            >
                <div className='grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-[0.82fr_1.2fr_0.82fr]'>
                    <div
                        className='
                            order-2 hidden min-w-0 flex-col items-center
                            justify-center rounded-[16px] border border-[#d8e3da]
                            bg-white px-2.5 py-3.5 text-center
                            sm:rounded-[21px] sm:px-4 sm:py-5
                            lg:order-1 lg:flex lg:px-5 lg:py-6
                        '
                    >
                        <p className='flex items-center gap-1.5 text-[7.5px] font-semibold uppercase tracking-[0.14em] text-sage sm:text-[9px]'>
                            <Link2 className='h-3 w-3' />
                            Share the site
                        </p>

                        <div className='mt-2.5 rounded-xl border border-[#d8e3da] bg-white p-1.5 shadow-[0_12px_30px_-22px_rgba(20,49,30,.35)] sm:mt-3 sm:p-2'>
                            <img
                                src={QR_SRC}
                                alt='QR code linking to the A10tion To Detail website'
                                className='h-[82px] w-[82px] object-contain sm:h-24 sm:w-24 lg:h-28 lg:w-28'
                                loading='lazy'
                                decoding='async'
                                sizes='(max-width: 768px) 100vw, 33vw'
                                draggable={false}
                            />
                        </div>

                        <p className='mt-2.5 text-[8px] leading-[1.45] text-body/65 sm:text-[9.5px]'>
                            Scan or copy the website link.
                        </p>

                        <button
                            type='button'
                            onClick={copyWebsiteLink}
                            className='
                                mt-2 inline-flex min-h-[31px] w-full items-center
                                justify-center gap-1.5 rounded-lg border
                                border-[#cfdcd2] bg-[#f4f8f5] px-2
                                text-[8px] font-semibold text-[#24402f]
                                transition hover:border-sage/50 hover:bg-[#edf4ef]
                                sm:min-h-[35px] sm:text-[9.5px]
                            '
                        >
                            {linkCopied ? (
                                <Check className='h-3 w-3' />
                            ) : (
                                <Copy className='h-3 w-3' />
                            )}
                            {linkCopied ? 'Link copied' : 'Copy website link'}
                        </button>
                    </div>


                    <div className='order-2 col-span-2 grid grid-cols-2 gap-2 lg:hidden'>
                        <button
                            type='button'
                            onClick={() => setActiveMobilePanel('qr')}
                            className='
                                flex min-h-[48px] min-w-0 items-center
                                justify-between gap-2 rounded-xl border
                                border-[#d3dfd6] bg-white px-3.5 text-left
                                text-[10.5px] font-semibold text-[#24402f]
                                shadow-[0_12px_28px_-24px_rgba(20,49,30,.35)]
                                transition active:scale-[0.98]
                            '
                        >
                            <span className='flex min-w-0 items-center gap-2'>
                                <span className='grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#edf4ef]'>
                                    <Link2 className='h-3.5 w-3.5' />
                                </span>
                                <span className='truncate'>Share website</span>
                            </span>
                            <span className='text-[15px] font-normal text-sage'>+</span>
                        </button>

                        <button
                            type='button'
                            onClick={() => setActiveMobilePanel('video')}
                            className='
                                flex min-h-[48px] min-w-0 items-center
                                justify-between gap-2 rounded-xl border
                                border-white/10 bg-[#1b2d22] px-3.5 text-left
                                text-[10.5px] font-semibold text-white
                                shadow-[0_12px_28px_-24px_rgba(20,49,30,.5)]
                                transition active:scale-[0.98]
                            '
                        >
                            <span className='flex min-w-0 items-center gap-2'>
                                <span className='grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/10 text-[#bdd4c2]'>
                                    <Play className='ml-px h-3.5 w-3.5 fill-current' />
                                </span>
                                <span className='truncate'>Watch reel</span>
                            </span>
                            <span className='text-[15px] font-normal text-white/55'>+</span>
                        </button>
                    </div>


                    <div
                        className='
                            order-1 col-span-2 overflow-hidden rounded-[17px]
                            bg-gradient-to-br from-[#17271d] via-[#21382a]
                            to-[#355840] px-4 py-4 text-center text-white
                            sm:rounded-[23px] sm:px-7 sm:py-7
                            lg:order-2 lg:col-span-1 lg:px-8 lg:py-8
                        '
                    >
                        <div className='relative'>
                            <span className='pointer-events-none absolute -right-14 -top-16 h-36 w-36 rounded-full bg-[#9fc4a7]/20 blur-2xl' />
                            <span className='pointer-events-none absolute -bottom-20 -left-14 h-36 w-36 rounded-full bg-[#d2a85c]/12 blur-2xl' />

                            <div className='relative'>
                                <p className='flex items-center justify-center gap-1.5 text-[8px] font-semibold uppercase tracking-[0.16em] text-[#bdd4c2] sm:text-[9.5px]'>
                                    <Sparkles className='h-3 w-3' />
                                    Private offer
                                </p>

                                <h2 className='mt-1.5 font-display text-[25px] font-medium leading-[1.08] tracking-[-0.025em] sm:text-[31px] lg:text-[34px]'>
                                    Discount Code
                                </h2>

                                <p className='mx-auto mt-2 max-w-md text-[9.5px] leading-[1.55] text-white/65 sm:text-[11px]'>
                                    Enter the passphrase you received and get a 10% discount on your next vehicle detail.
                                </p>

                                {promoCode ? (
                                    <div className='mt-4 rounded-[15px] border border-white/15 bg-white/[0.08] p-3 sm:mt-5 sm:p-4'>
                                        <div className='flex items-center justify-between gap-2 rounded-xl bg-white px-3 py-2.5 text-left shadow-sm'>
                                            <div className='min-w-0'>
                                                <p className='text-[7.5px] font-semibold uppercase tracking-[0.13em] text-body/55 sm:text-[8.5px]'>
                                                    Your unlocked code
                                                </p>
                                                <p className='mt-0.5 truncate font-display text-[20px] font-semibold tracking-[0.08em] text-[#1d3426] sm:text-[23px]'>
                                                    {promoCode}
                                                </p>
                                            </div>

                                            <button
                                                type='button'
                                                onClick={copyPromoCode}
                                                className='grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#eaf2ec] text-[#24402f] transition hover:bg-[#dce9df] sm:h-10 sm:w-10'
                                                aria-label='Copy unlocked promo code'
                                            >
                                                {codeCopied ? (
                                                    <Check className='h-3.5 w-3.5' />
                                                ) : (
                                                    <Copy className='h-3.5 w-3.5' />
                                                )}
                                            </button>
                                        </div>

                                        <div className='mt-2.5 flex items-center justify-between gap-3'>
                                            <p className='text-left text-[8px] leading-[1.4] text-white/55 sm:text-[9px]'>
                                                Saved for this browsing session.
                                            </p>
                                            <button
                                                type='button'
                                                onClick={lockPromoAgain}
                                                className='inline-flex shrink-0 items-center gap-1 text-[8px] font-medium text-white/60 transition hover:text-white sm:text-[9px]'
                                            >
                                                <RotateCcw className='h-3 w-3' />
                                                Lock again
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <form
                                        onSubmit={handleUnlock}
                                        className='mt-4 sm:mt-5'
                                    >
                                        <div className='flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.07] p-1.5'>
                                            <div className='flex min-w-0 flex-1 items-center gap-2 px-2'>
                                                <LockKeyhole className='h-3.5 w-3.5 shrink-0 text-[#bdd4c2]' />
                                                <label htmlFor='promo-passphrase' className='sr-only'>
                                                    Private offer passphrase
                                                </label>
                                                <input
                                                    id='promo-passphrase'
                                                    type='password'
                                                    value={passphrase}
                                                    onChange={(event) => {
                                                        setPassphrase(event.target.value);
                                                        if (unlockState === 'error') {
                                                            setUnlockState('idle');
                                                            setUnlockMessage('');
                                                        }
                                                    }}
                                                    autoComplete='off'
                                                    placeholder='Enter passphrase'
                                                    className='min-w-0 flex-1 bg-transparent py-2 text-[10px] text-white outline-none placeholder:text-white/40 sm:text-[11.5px]'
                                                />
                                            </div>

                                            <button
                                                type='submit'
                                                disabled={unlockState === 'loading'}
                                                className='
                                                    inline-flex min-h-[36px] shrink-0
                                                    items-center justify-center gap-1.5
                                                    rounded-lg bg-white px-3.5 text-[9px]
                                                    font-semibold text-[#1d3426] transition
                                                    hover:bg-[#edf4ef] disabled:cursor-wait
                                                    disabled:opacity-65 sm:min-h-[40px]
                                                    sm:px-4 sm:text-[10.5px]
                                                '
                                            >
                                                {unlockState === 'loading' ? (
                                                    <LoaderCircle className='h-3.5 w-3.5 animate-spin' />
                                                ) : (
                                                    <LockKeyhole className='h-3.5 w-3.5' />
                                                )}
                                                {unlockState === 'loading'
                                                    ? 'Checking'
                                                    : 'Unlock'}
                                            </button>
                                        </div>

                                        {unlockMessage && (
                                            <p
                                                className='mt-2 text-[8px] leading-[1.45] text-[#f0c6c6] sm:text-[9px]'
                                                role='alert'
                                            >
                                                {unlockMessage}
                                            </p>
                                        )}
                                    </form>
                                )}

                                <button
                                    type='button'
                                    onClick={() => setVehiclePromoOpen(true)}
                                    className='mt-3 inline-flex min-h-[34px] w-full items-center justify-center gap-1.5 rounded-lg border border-white/20 bg-white/10 px-3 text-[9px] font-semibold text-white transition hover:bg-white/15 sm:min-h-[36px] sm:text-[10px]'
                                >
                                    <Tag className='h-3 w-3' />
                                    Register
                                </button>

                                <p className='mt-3 hidden items-center justify-center gap-1.5 text-[8.5px] text-white/45 sm:flex'>
                                    <ShieldCheck className='h-3 w-3' />
                                    The code remains hidden until access is verified.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {activeMobilePanel && (
                <div
                    className='fixed inset-0 z-[90] flex items-end justify-center bg-[#0c1710]/60 p-2.5 backdrop-blur-[2px] lg:hidden'
                    onClick={() => setActiveMobilePanel(null)}
                    role='presentation'
                >
                    <div
                        className='w-full max-w-sm rounded-[22px] border border-[#d8e3da] bg-[#f8faf8] p-3.5 shadow-2xl'
                        onClick={(event) => event.stopPropagation()}
                        role='dialog'
                        aria-modal='true'
                        aria-label={
                            activeMobilePanel === 'qr'
                                ? 'Share the A10tion website'
                                : 'A10tion promotional video'
                        }
                    >
                        <div className='mx-auto mb-2.5 h-1 w-9 rounded-full bg-[#ccd9cf]' />

                        <div className='flex items-start justify-between gap-3'>
                            <div className='text-left'>
                                <p className='text-[8px] font-semibold uppercase tracking-[0.14em] text-sage'>
                                    {activeMobilePanel === 'qr'
                                        ? 'Share the site'
                                        : 'Brand reel'}
                                </p>
                                <h3 className='mt-0.5 font-display text-[21px] font-medium leading-tight text-ink'>
                                    {activeMobilePanel === 'qr'
                                        ? 'Scan or copy the link'
                                        : 'The finish, in motion'}
                                </h3>
                            </div>

                            <button
                                type='button'
                                onClick={() => setActiveMobilePanel(null)}
                                className='
                                    relative inline-flex !h-8 !w-8 !min-h-0
                                    !min-w-0 shrink-0 appearance-none items-center
                                    justify-center rounded-full border
                                    border-[#d4dfd6] bg-white !p-0 leading-none
                                    text-[#294532] shadow-none outline-none
                                    transition hover:border-sage/45 hover:bg-[#f2f7f3]
                                    focus-visible:ring-2 focus-visible:ring-sage/25
                                '
                                aria-label='Close'
                            >
                                <X
                                    className='pointer-events-none block h-3.5 w-3.5 shrink-0'
                                    strokeWidth={1.8}
                                    aria-hidden='true'
                                />
                            </button>
                        </div>

                        {activeMobilePanel === 'qr' ? (
                            <div className='mt-3 flex flex-col items-center rounded-[16px] border border-[#dce5de] bg-white p-3.5 text-center'>
                                <div className='rounded-xl border border-[#d8e3da] bg-white p-2'>
                                    <img
                                        src={QR_SRC}
                                        alt='QR code linking to the A10tion To Detail website'
                                        className='h-40 w-40 object-contain'
                                        draggable={false}
                                        loading='lazy'
                                        decoding='async'
                                    />
                                </div>

                                <p className='mt-2 text-[10px] text-body/65'>
                                    {SITE_URL.replace(/^https?:\/\//, '')}
                                </p>

                                <button
                                    type='button'
                                    onClick={copyWebsiteLink}
                                    className='mt-2.5 inline-flex min-h-[40px] w-full items-center justify-center gap-2 rounded-xl bg-[#17271d] px-4 text-[10.5px] font-semibold text-white'
                                >
                                    {linkCopied ? (
                                        <Check className='h-3.5 w-3.5' />
                                    ) : (
                                        <Copy className='h-3.5 w-3.5' />
                                    )}
                                    {linkCopied ? 'Website link copied' : 'Copy website link'}
                                </button>
                            </div>
                        ) : (
                            <div className='mt-3 overflow-hidden rounded-[16px] bg-[#1b2d22] text-white'>
                                {PROMO_VIDEO_URL ? (
                                    <video
                                        src={PROMO_VIDEO_URL}
                                        className='max-h-[62vh] w-full object-contain'
                                        controls
                                        autoPlay
                                        playsInline
                                        preload='metadata'
                                        aria-label='A10tion To Detail promotional video'
                                    />
                                ) : (
                                    <div className='flex min-h-[190px] flex-col items-center justify-center px-6 py-7 text-center'>
                                        <div className='grid h-11 w-11 place-items-center rounded-full border border-white/15 bg-white/10'>
                                            <Film className='h-4 w-4 text-[#bdd4c2]' />
                                        </div>
                                        <p className='mt-3 font-display text-[19px] font-medium'>
                                            Reel coming soon
                                        </p>
                                        <p className='mt-1 max-w-[230px] text-[10px] leading-[1.55] text-white/55'>
                                            This space is ready for a short before-and-after transformation video.
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            <VehiclePromoModal
                open={vehiclePromoOpen}
                onClose={() => setVehiclePromoOpen(false)}
            />
        </section>
    );
}