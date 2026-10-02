import { useState } from 'react';
import { Cookie, ShieldCheck, X } from 'lucide-react';
import useCookieConsent from '../hooks/use-cookie-consent';

const TERMS_URL = `${import.meta.env.BASE_URL}terms.html`;

function Toggle({ checked, onChange, disabled, label }) {
    return (
        <button
            type='button'
            role='switch'
            aria-checked={checked}
            aria-label={label}
            disabled={disabled}
            onClick={() => !disabled && onChange(!checked)}
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 ${
                checked ? 'bg-sage' : 'bg-[#d7e1d9]'
            } ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
        >
            <span
                className={`inline-block size-4 transform rounded-full bg-white shadow transition-transform duration-200 ${
                    checked ? 'translate-x-[22px]' : 'translate-x-1'
                }`}
            />
        </button>
    );
}

function PreferencesPanel({ analyticsEnabled, onAnalyticsChange, onSave, onBack }) {
    return (
        <div className='p-4 sm:p-5'>
            <p className='text-[10px] leading-[1.55] text-body sm:text-[11px]'>
                Choose which cookies you're comfortable with. You can change this anytime from the
                "Cookie settings" link in the footer.
            </p>

            <div className='mt-3 space-y-2.5'>
                <div className='flex items-start justify-between gap-3 rounded-xl border border-line bg-[#f8faf8] px-3.5 py-3'>
                    <div className='min-w-0'>
                        <p className='text-[10.5px] font-semibold text-ink sm:text-[11.5px]'>Necessary</p>
                        <p className='mt-0.5 text-[9px] leading-[1.5] text-body sm:text-[10px]'>
                            Required for core site features like booking, checkout and promo codes. Always active.
                        </p>
                    </div>
                    <Toggle checked disabled label='Necessary cookies (always on)' onChange={() => {}} />
                </div>

                <div className='flex items-start justify-between gap-3 rounded-xl border border-line bg-white px-3.5 py-3'>
                    <div className='min-w-0'>
                        <p className='text-[10.5px] font-semibold text-ink sm:text-[11.5px]'>Analytics</p>
                        <p className='mt-0.5 text-[9px] leading-[1.5] text-body sm:text-[10px]'>
                            Helps us understand how visitors use the site, so we can improve it. No data is sold.
                        </p>
                    </div>
                    <Toggle checked={analyticsEnabled} onChange={onAnalyticsChange} label='Analytics cookies' />
                </div>
            </div>

            <div className='mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end'>
                <button
                    type='button'
                    onClick={onBack}
                    className='min-h-[38px] rounded-full border border-line bg-white px-4 text-[10.5px] font-semibold text-body transition hover:border-sage/40 hover:text-ink sm:text-[11px]'
                >
                    Back
                </button>
                <button
                    type='button'
                    onClick={onSave}
                    className='min-h-[38px] rounded-full bg-ink px-5 text-[10.5px] font-semibold text-white transition hover:-translate-y-px hover:bg-[#18231d] sm:text-[11px]'
                >
                    Save preferences
                </button>
            </div>
        </div>
    );
}

export default function CookieConsent() {
    const {
        consent,
        bannerOpen,
        settingsOpen,
        closeSettings,
        acceptAll,
        rejectNonEssential,
        saveConsent,
    } = useCookieConsent();
    const [managing, setManaging] = useState(false);
    const [draftAnalytics, setDraftAnalytics] = useState(Boolean(consent?.analytics));

    const visible = bannerOpen || settingsOpen;
    if (!visible) return null;

    const showPreferences = managing || settingsOpen;

    const openPreferences = () => {
        setDraftAnalytics(Boolean(consent?.analytics));
        setManaging(true);
    };

    const handleClose = () => {
        setManaging(false);
        closeSettings();
    };

    return (
        <div
            className='fixed inset-x-0 bottom-0 z-[200] flex justify-center px-3 pb-3 sm:px-5 sm:pb-5'
            role='dialog'
            aria-modal='false'
            aria-label='Cookie preferences'
        >
            <div className='pointer-events-auto w-full max-w-xl overflow-hidden rounded-[20px] border border-[#d7e1d9] bg-white shadow-[0_28px_70px_-30px_rgba(10,20,14,.45)]'>
                <div className='flex items-start gap-3 border-b border-line bg-gradient-to-br from-[#17271d] via-[#21382a] to-[#2e5039] px-4 py-3.5 text-white sm:px-5 sm:py-4'>
                    <span className='grid size-8 shrink-0 place-items-center rounded-full bg-white/10'>
                        <Cookie className='size-4' />
                    </span>
                    <div className='min-w-0 flex-1'>
                        <p className='text-[8px] font-semibold uppercase tracking-[0.14em] text-[#bcd3c1] sm:text-[9px]'>Your privacy</p>
                        <h2 className='mt-0.5 font-display text-[16px] font-medium leading-tight sm:text-[18px]'>We use cookies</h2>
                    </div>
                    {settingsOpen && (
                        <button
                            type='button'
                            onClick={handleClose}
                            aria-label='Close cookie settings'
                            className='grid size-7 shrink-0 place-items-center rounded-full border border-white/20 bg-white/5 transition hover:bg-white/15'
                        >
                            <X className='size-3.5' />
                        </button>
                    )}
                </div>

                {showPreferences ? (
                    <PreferencesPanel
                        analyticsEnabled={draftAnalytics}
                        onAnalyticsChange={setDraftAnalytics}
                        onSave={() => {
                            saveConsent({ analytics: draftAnalytics });
                            setManaging(false);
                        }}
                        onBack={() => (settingsOpen ? handleClose() : setManaging(false))}
                    />
                ) : (
                    <div className='p-4 sm:p-5'>
                        <p className='text-[10px] leading-[1.6] text-body sm:text-[11px]'>
                            We use essential cookies to make bookings and promo codes work, and optional
                            analytics cookies to understand site usage. Read our{' '}
                            <a href={`${TERMS_URL}#confidentiality`} target='_blank' rel='noreferrer' className='font-semibold text-sagedeep underline underline-offset-2'>
                                privacy policy
                            </a>{' '}
                            for details.
                        </p>

                        <div className='mt-3.5 flex items-center gap-1.5 rounded-lg bg-sagelight/60 px-2.5 py-2'>
                            <ShieldCheck className='size-3.5 shrink-0 text-sage' />
                            <p className='text-[8.5px] leading-[1.4] text-body sm:text-[9.5px]'>
                                Necessary cookies are always on so core site features keep working.
                            </p>
                        </div>

                        <div className='mt-4 flex flex-col gap-2 sm:flex-row'>
                            <button
                                type='button'
                                onClick={openPreferences}
                                className='min-h-[40px] rounded-full border border-line bg-white px-4 text-[10.5px] font-semibold text-body transition hover:border-sage/40 hover:text-ink sm:order-1 sm:text-[11px]'
                            >
                                Manage preferences
                            </button>
                            <button
                                type='button'
                                onClick={rejectNonEssential}
                                className='min-h-[40px] rounded-full border border-line bg-white px-4 text-[10.5px] font-semibold text-body transition hover:border-sage/40 hover:text-ink sm:order-2 sm:text-[11px]'
                            >
                                Reject non-essential
                            </button>
                            <button
                                type='button'
                                onClick={acceptAll}
                                className='group flex min-h-[40px] items-center justify-center gap-1.5 rounded-full bg-ink px-5 text-[10.5px] font-semibold text-white transition hover:-translate-y-px hover:bg-[#18231d] sm:order-3 sm:text-[11px]'
                            >
                                Accept all
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
