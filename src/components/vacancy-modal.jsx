import { useEffect, useRef, useState } from 'react';

import {
    BriefcaseBusiness,
    CheckCircle2,
    LoaderCircle,
    X,
} from 'lucide-react';


const normalizeFormSubmitUrl = (url) => {
    if (!url) {
        return '';
    }

    if (url.includes('formsubmit.co/ajax/')) {
        return url;
    }

    if (url.includes('formsubmit.co')) {
        return url.replace('https://formsubmit.co/', 'https://formsubmit.co/ajax/');
    }

    return url;
};

const VACANCY_FORM_URL = normalizeFormSubmitUrl(import.meta.env.VITE_FORMSUBMIT_VACANCIES_URL || '');

const fieldClassName = `
    h-11
    w-full
    rounded-[10px]
    border
    border-[#dfe6e1]
    bg-white
    px-3
    text-[11px]
    text-[#18211b]
    outline-none
    transition-all
    placeholder:text-[#869189]
    focus:border-[#6f8f79]
    focus:ring-2
    focus:ring-[#6f8f79]/10
    sm:h-12
    sm:text-[12px]
`;


export default function VacancyModal({ open, onClose }) {
    const [status, setStatus] = useState('idle');
    const [message, setMessage] = useState('');
    const firstInputRef = useRef(null);

    useEffect(() => {
        if (!open) {
            return undefined;
        }

        const previousOverflow = document.body.style.overflow;
        const closeOnEscape = (event) => {
            if (event.key === 'Escape' && status !== 'loading') {
                onClose();
            }
        };

        document.body.style.overflow = 'hidden';
        document.addEventListener('keydown', closeOnEscape);
        const focusTimer = window.setTimeout(() => {
            firstInputRef.current?.focus({ preventScroll: true });
        }, 120);

        return () => {
            document.body.style.overflow = previousOverflow;
            document.removeEventListener('keydown', closeOnEscape);
            window.clearTimeout(focusTimer);
        };
    }, [open, onClose, status]);

    if (!open) {
        return null;
    }

    const submitApplication = async (event) => {
        event.preventDefault();
        setStatus('loading');
        setMessage('');

        if (!VACANCY_FORM_URL) {
            setStatus('error');
            setMessage('Applications are not connected yet.');
            return;
        }

        const form = event.currentTarget;
        const data = new FormData(form);
        data.set('_subject', 'New A10tion To Detail vacancy application');
        data.set('_replyto', data.get('email')?.toString() || '');
        data.set('_captcha', 'false');
        data.set('_template', 'table');
        data.set('source', 'Website vacancy application');
        data.set('application_status', 'New application');

        try {
            const response = await fetch(VACANCY_FORM_URL, {
                method: 'POST',
                body: data,
                headers: {
                    Accept: 'application/json',
                },
            });

            const contentType = response.headers.get('content-type') || '';
            const isJson = contentType.includes('application/json');
            const result = isJson ? await response.json().catch(() => null) : null;

            if (!response.ok) {
                const apiMessage = result?.errors
                    ?.map((error) => error.message)
                    .join(' ');

                const isFileUploadPlanError = apiMessage
                    ?.toLowerCase()
                    .includes('file uploads not permitted');

                throw new Error(
                    isFileUploadPlanError
                        ? 'CV uploads are not enabled for this application form yet. Please ask the site owner to enable file uploads in FormSubmit before applying.'
                        : apiMessage ||
                        'Your application could not be submitted. Please check the form and try again.'
                );
            }

            form.reset();
            setStatus('success');
            setMessage('Application submitted successfully. Thank you for your interest in joining A10tion To Detail.');
        } catch (error) {
            setStatus('error');
            setMessage(
                error instanceof Error
                    ? error.message
                    : 'Your application could not be submitted. Please try again.'
            );
        }
    };

    return (
        <div
            className='fixed inset-0 z-[999] h-[100dvh] w-screen overflow-hidden bg-[#f6f7f3]'
            role='dialog'
            aria-modal='true'
            aria-labelledby='vacancy-title'
        >
            <div className='grid h-full w-full grid-rows-[auto_minmax(0,1fr)] lg:grid-cols-[34%_66%] lg:grid-rows-1'>
                <aside className='relative overflow-hidden bg-gradient-to-br from-[#0e1d14] via-[#172c1f] to-[#2e5039] px-5 py-6 text-white sm:px-8 sm:py-8 lg:flex lg:flex-col lg:justify-between lg:px-10 lg:py-10'>
                    <span className='pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-[#a8cbb0]/15 blur-[80px]' />
                    <span className='pointer-events-none absolute -bottom-28 -left-24 h-72 w-72 rounded-full bg-black/20 blur-[90px]' />

                    <div className='relative z-10'>
                        <div className='inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.06] px-2.5 py-1.5 text-[8px] font-semibold uppercase tracking-[0.16em] text-[#c4d8c9]'>
                            <BriefcaseBusiness className='h-3 w-3' strokeWidth={1.8} />
                            Work with us
                        </div>
                        <h2 id='vacancy-title' className='mt-3 max-w-xl font-display text-[28px] font-semibold leading-[1.02] tracking-[-0.035em] text-white sm:text-[36px] lg:mt-6 lg:max-w-md lg:text-[44px]'>
                            Vacancies
                        </h2>
                        <p className='mt-2 max-w-2xl text-[10px] leading-[1.6] text-white/65 sm:text-[11px] lg:mt-4 lg:max-w-md lg:text-[12px]'>
                            We are always interested in people who care about the details, enjoy working with their hands, and leave every vehicle better than they found it.
                        </p>
                    </div>

                    <div className='relative z-10 mt-4 hidden space-y-3 lg:block'>
                        {[
                            'Choose the role that fits your strengths.',
                            'Tell us how you work and what you have learned.',
                            'We will review your application and get back to you.',
                        ].map((step, index) => (
                            <div key={step} className='flex items-start gap-3'>
                                <span className='grid h-7 w-7 shrink-0 place-items-center rounded-full border border-white/15 bg-white/[0.06] text-[8px] font-semibold text-[#c9ddce]'>0{index + 1}</span>
                                <p className='pt-1 text-[9.5px] leading-[1.55] text-white/55'>{step}</p>
                            </div>
                        ))}
                    </div>
                </aside>

                <main className='relative min-h-0 bg-[#f7f8f5]'>
                    <button type='button' onClick={onClose} disabled={status === 'loading'} aria-label='Close vacancy application' className='absolute right-3 top-3 z-30 grid h-9 w-9 place-items-center rounded-full border border-[#dbe3dd] bg-white/95 text-[#34443b] shadow-sm transition hover:border-[#a7baac] hover:bg-white disabled:opacity-40 sm:right-5 sm:top-5 lg:right-7 lg:top-7'>
                        <X className='h-4 w-4' strokeWidth={1.8} />
                    </button>

                    <div className='h-full overflow-y-auto px-4 pb-6 pt-5 sm:px-8 sm:pb-8 sm:pt-7 lg:px-12 lg:py-10 [&::-webkit-scrollbar]:hidden' style={{ scrollbarWidth: 'none' }}>
                        <form onSubmit={submitApplication} className='mx-auto flex min-h-full w-full max-w-3xl flex-col justify-center pr-0 lg:pr-8'>
                            <div className='mb-5 pr-12 sm:mb-6'>
                                <p className='text-[8px] font-semibold uppercase tracking-[0.16em] text-[#6e8275] sm:text-[9px]'>Open application</p>
                                <h3 className='mt-1 font-display text-[24px] font-semibold leading-tight tracking-[-0.025em] text-[#172019] sm:text-[30px]'>Tell us about you.</h3>
                            </div>

                            <div className='grid grid-cols-2 gap-3 sm:gap-4'>
                                <label className='block min-w-0'><span className='mb-1 block text-[9px] font-semibold text-[#28352e] sm:text-[10px]'>Full Name</span><input ref={firstInputRef} className={fieldClassName} name='first_name' autoComplete='given-name' required /></label>
                                <label className='block min-w-0'><span className='mb-1 block text-[9px] font-semibold text-[#28352e] sm:text-[10px]'>Cell number</span><input className={fieldClassName} type='tel' name='cell' autoComplete='tel' required /></label>
                                <label className='col-span-2 block min-w-0'><span className='mb-1 block text-[9px] font-semibold text-[#28352e] sm:text-[10px]'>Email address</span><input className={fieldClassName} type='email' name='email' autoComplete='email' required /></label>
                            </div>

                            <div className='mt-3 grid gap-3 sm:grid-cols-2 sm:gap-4'>
                                <label className='block min-w-0'><span className='mb-1 block text-[9px] font-semibold text-[#28352e] sm:text-[10px]'>Role of interest</span><input className={fieldClassName} type='text' name='role' placeholder='' required /></label>
                                <label className='block min-w-0'><span className='mb-1 block text-[9px] font-semibold text-[#28352e] sm:text-[10px]'>Availability</span><select className={fieldClassName} name='availability' defaultValue='' required><option value='' disabled>When can you start?</option><option>Immediately</option><option>Within 2 weeks</option><option>Within 1 month</option><option>Just exploring</option></select></label>
                            </div>

                            <label className='mt-3 block sm:mt-4'><span className='mb-1 block text-[9px] font-semibold text-[#28352e] sm:text-[10px]'>Why would you be a great fit?</span><textarea className='min-h-[100px] w-full resize-y rounded-[10px] border border-[#dfe6e1] bg-white px-3 py-3 text-[11px] text-[#18211b] outline-none transition placeholder:text-[#869189] focus:border-[#6f8f79] focus:ring-2 focus:ring-[#6f8f79]/10 sm:text-[12px]' name='motivation' placeholder='Tell us about your experience, your eye for detail, or what you would bring to the team.' required /></label>

                            <label className='mt-3 flex items-start gap-2 rounded-[11px] border border-[#dfe6e1] bg-white px-3 py-2.5 sm:mt-4'><input type='checkbox' name='consent' value='yes' className='mt-0.5 shrink-0 accent-[#365943]' required /><span className='text-[9px] leading-[1.45] text-[#5e6962] sm:text-[10px]'>I consent to A10tion To Detail using these details to review my application.</span></label>

                            {message && <div className={`mt-3 rounded-[11px] border px-3 py-2.5 text-[9px] leading-[1.45] sm:text-[10px] ${status === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-700'}`} role='status' aria-live='polite'><div className='flex items-start gap-2'>{status === 'success' && <CheckCircle2 className='mt-0.5 h-3.5 w-3.5 shrink-0' strokeWidth={1.8} />}<span>{message}</span></div></div>}

                            <div className='mt-4 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:mt-5'><p className='text-center text-[8px] leading-[1.4] text-[#849087] sm:max-w-[55%] sm:text-left'>Applications are kept private and reviewed by the A10tion team.</p><button type='submit' disabled={status === 'loading'} className='inline-flex min-h-[44px] shrink-0 items-center justify-center gap-2 rounded-full bg-[#18241d] px-6 text-[10px] font-semibold text-white shadow-[0_12px_28px_-18px_rgba(24,36,29,.65)] transition hover:-translate-y-0.5 hover:bg-[#24362a] disabled:cursor-wait disabled:opacity-60 sm:min-w-[165px] sm:text-[11px]'>{status === 'loading' && <LoaderCircle className='h-3.5 w-3.5 animate-spin' strokeWidth={1.8} />}{status === 'loading' ? 'Sending application' : 'Submit application'}</button></div>
                        </form>
                    </div>
                </main>
            </div>
        </div>
    );
}
