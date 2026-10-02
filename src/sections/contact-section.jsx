import { useState } from 'react';

import {
    ArrowUpRight,
    CalendarDays,
    ChevronDown,
    ChevronUp,
    CreditCard,
    Mail,
    MessageCircle,
    MonitorSmartphone,
    Send,
    ShieldCheck,
} from 'lucide-react';

import useReveal from '../hooks/use-reveal';


const SUPPORT_EMAIL = 'info@a10tion.co.za';
const SUPPORT_PHONE = '0733069217';
// wa.me requires international format with no leading 0 (South Africa = +27).
const SUPPORT_WHATSAPP_NUMBER = `27${SUPPORT_PHONE.replace(/^0/, '')}`;

const issueTypes = [
    { value: 'Booking support', label: 'Booking support', icon: CalendarDays },
    { value: 'Payment support', label: 'Payment support', icon: CreditCard },
    { value: 'Website support', label: 'Website support', icon: MonitorSmartphone },
];

const inputClassName = `
    mt-1.5 w-full rounded-xl border border-[#d7e1d9]
    bg-[#f8faf8] px-3 py-2.5 text-[12px] text-ink outline-none
    transition placeholder:text-body/45 hover:border-sage/55
    focus:border-sage focus:bg-white focus:ring-2 focus:ring-sage/10
    sm:px-3.5 sm:text-[13px]
`;


export default function ContactSection() {
    const sectionRef = useReveal();
    const [issueType, setIssueType] = useState('');
    const [mobileFormOpen, setMobileFormOpen] = useState(false);


    const chooseSupportType = (type) => {
        setIssueType(type);
        setMobileFormOpen(true);
    };

    const handleSubmit = (event) => {
        event.preventDefault();

        const formData = new FormData(event.currentTarget);
        const name = formData.get('name')?.toString().trim() || '';
        const email = formData.get('email')?.toString().trim() || '';
        const reference =
            formData.get('reference')?.toString().trim() || 'Not provided';
        const message = formData.get('message')?.toString().trim() || '';

        const subject = encodeURIComponent(
            `[Website support] ${issueType || 'General support'}${
                reference !== 'Not provided' ? ` - ${reference}` : ''
            }`
        );
        const body = encodeURIComponent(
            [
                `Support category: ${issueType || 'General support'}`,
                `Name: ${name}`,
                `Email: ${email}`,
                `Booking / payment reference: ${reference}`,
                '',
                'Issue:',
                message,
            ].join('\n')
        );

        window.location.href =
            `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;
    };


    return (
        <section
            id='contact'
            className='px-3 pt-14 sm:px-4 sm:pt-16 md:px-8 lg:px-10 lg:pt-20'
        >
            <div
                ref={sectionRef}
                className='
                    reveal mx-auto max-w-5xl overflow-hidden rounded-[22px]
                    border border-[#d4e0d7] bg-gradient-to-br from-[#f7faf8]
                    via-white to-[#eaf2ec] p-2.5
                    shadow-[0_24px_70px_-48px_rgba(20,49,30,.42)]
                    sm:rounded-[28px] sm:p-4 lg:p-5
                '
            >
                <div className='grid gap-2.5 sm:gap-4 lg:grid-cols-[0.8fr_1.2fr]'>
                    <aside
                        className='
                            relative overflow-hidden rounded-[17px]
                            bg-gradient-to-br from-[#17271d] via-[#21382a]
                            to-[#34563f] px-4 py-5 text-center text-white
                            sm:rounded-[22px] sm:px-6 sm:py-7
                            lg:flex lg:flex-col lg:justify-between
                            lg:px-7 lg:py-8 lg:text-left
                        '
                    >
                        <span className='pointer-events-none absolute -right-12 -top-14 h-36 w-36 rounded-full bg-[#9fc4a7]/20 blur-2xl' />
                        <span className='pointer-events-none absolute -bottom-16 -left-14 h-36 w-36 rounded-full bg-[#d2a85c]/10 blur-2xl' />

                        <div className='relative'>
                            <p className='flex items-center justify-center gap-2 text-[8.5px] font-semibold uppercase tracking-[0.17em] text-[#bcd3c1] sm:text-[9.5px] lg:justify-start'>
                                <span className='h-px w-5 bg-[#bcd3c1]/75' />
                                Website support
                            </p>

                            <h2 className='mt-2 font-display text-[25px] font-medium leading-[1.08] tracking-[-0.025em] sm:text-[31px] lg:max-w-xs lg:text-[34px]'>
                                Something not working quite right?
                            </h2>

                            <p className='mx-auto mt-2.5 max-w-md text-[10.5px] leading-[1.65] text-white/70 sm:mt-3 sm:text-[12px] lg:mx-0'>
                                Tell us what happened and we’ll help with booking,
                                payment or website-related problems.
                            </p>

                            <div className='mt-4 grid grid-cols-3 gap-1.5 sm:mt-5 sm:gap-2 lg:grid-cols-1'>
                                {issueTypes.map(({ label, icon: Icon }) => (
                                    <button
                                        key={label}
                                        type='button'
                                        onClick={() => chooseSupportType(label)}
                                        className={`
                                            flex min-w-0 flex-col items-center
                                            justify-center gap-1.5 rounded-xl border
                                            px-1.5 py-2.5 text-[8px] font-medium
                                            leading-tight transition sm:text-[9.5px]
                                            lg:flex-row lg:justify-start lg:gap-2.5
                                            lg:px-3 lg:py-2.5 lg:text-[10.5px]
                                            ${
                                                issueType === label
                                                    ? 'border-white/35 bg-white text-[#1d3426] shadow-sm'
                                                    : 'border-white/12 bg-white/[0.06] text-white/80 hover:bg-white/10'
                                            }
                                        `}
                                        aria-pressed={issueType === label}
                                        aria-controls='support-request-form'
                                    >
                                        <Icon className='h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4' />
                                        <span>{label}</span>
                                    </button>
                                ))}
                            </div>

                            <p
                                className={`
                                    mt-2.5 items-center justify-center gap-1
                                    text-[8.5px] text-white/50 lg:hidden
                                    ${mobileFormOpen ? 'hidden' : 'flex'}
                                `}
                            >
                                Choose an issue to open the form
                                <ChevronDown className='h-3 w-3' />
                            </p>
                        </div>

                        <div className='relative mt-4 grid grid-cols-2 gap-2 border-t border-white/12 pt-4 sm:mt-5 sm:pt-5 lg:grid-cols-1'>
                            <a
                                href={`mailto:${SUPPORT_EMAIL}`}
                                target='_blank'
                                rel='noreferrer'
                                className='flex min-w-0 items-center justify-center gap-2 rounded-xl bg-white/[0.07] px-2.5 py-2.5 text-[8.5px] text-white/80 transition hover:bg-white/12 hover:text-white sm:text-[10px] lg:justify-start'
                            >
                                <Mail className='h-3.5 w-3.5 shrink-0 text-[#bcd3c1]' />
                                <span className='truncate'>Email support</span>
                            </a>

                            <a
                                href={`https://wa.me/${SUPPORT_WHATSAPP_NUMBER}`}
                                target='_blank'
                                rel='noreferrer'
                                className='flex min-w-0 items-center justify-center gap-2 rounded-xl bg-white/[0.07] px-2.5 py-2.5 text-[8.5px] text-white/80 transition hover:bg-white/12 hover:text-white sm:text-[10px] lg:justify-start'
                            >
                                <MessageCircle className='h-3.5 w-3.5 shrink-0 text-[#bcd3c1]' />
                                <span className='truncate'>WhatsApp support</span>
                                <ArrowUpRight className='hidden h-3 w-3 shrink-0 sm:block' />
                            </a>
                        </div>
                    </aside>

                    <div
                        id='support-request-form'
                        className={`
                            rounded-[17px] border border-[#dce5de]
                            bg-white/90 px-3.5 py-4 sm:rounded-[22px]
                            sm:px-6 sm:py-6 lg:block lg:px-7 lg:py-7
                            ${mobileFormOpen ? 'block' : 'hidden'}
                        `}
                    >
                        <div className='mb-3 flex items-center justify-between gap-3 lg:hidden'>
                            <div className='min-w-0 text-left'>
                                <p className='text-[8px] font-semibold uppercase tracking-[0.14em] text-sage'>
                                    Support request
                                </p>
                                <h3 className='mt-0.5 truncate font-display text-[19px] font-medium text-ink'>
                                    {issueType}
                                </h3>
                            </div>

                            <button
                                type='button'
                                onClick={() => {
                                    setMobileFormOpen(false);
                                    setIssueType('');
                                }}
                                className='
                                    inline-flex min-h-[32px] shrink-0 items-center
                                    justify-center gap-1 rounded-full border
                                    border-[#d8e3da] bg-[#f4f8f5] px-3
                                    text-[9px] font-semibold text-[#294532]
                                '
                                aria-label='Collapse support form'
                            >
                                Collapse
                                <ChevronUp className='h-3 w-3' />
                            </button>
                        </div>

                        <div className='hidden text-left lg:block'>
                            <p className='text-[8.5px] font-semibold uppercase tracking-[0.15em] text-sage sm:text-[9.5px]'>
                                Support request
                            </p>
                            <h3 className='mt-1 font-display text-[21px] font-medium tracking-[-0.02em] text-ink sm:text-[26px]'>
                                Tell us what went wrong
                            </h3>
                            <p className='mx-auto mt-1 max-w-lg text-[9.5px] leading-[1.55] text-body/70 sm:mx-0 sm:text-[11px]'>
                                Include your booking or payment reference when you
                                have one. It helps us trace the issue faster.
                            </p>
                        </div>

                        <form
                            className='mt-4 grid grid-cols-2 gap-2.5 sm:mt-5 sm:gap-3.5'
                            onSubmit={handleSubmit}
                        >
                            <label className='block min-w-0 text-left'>
                                <span className='text-[9.5px] font-medium text-body sm:text-[10.5px]'>
                                    Full name
                                </span>
                                <input
                                    name='name'
                                    type='text'
                                    autoComplete='name'
                                    placeholder='Your full name'
                                    className={inputClassName}
                                    required
                                />
                            </label>

                            <label className='block min-w-0 text-left'>
                                <span className='text-[9.5px] font-medium text-body sm:text-[10.5px]'>
                                    Email address
                                </span>
                                <input
                                    name='email'
                                    type='email'
                                    autoComplete='email'
                                    placeholder='you@example.com'
                                    className={inputClassName}
                                    required
                                />
                            </label>

                            <label className='block min-w-0 text-left'>
                                <span className='text-[9.5px] font-medium text-body sm:text-[10.5px]'>
                                    Issue type
                                </span>
                                <select
                                    name='issueType'
                                    value={issueType}
                                    onChange={(event) =>
                                        setIssueType(event.target.value)
                                    }
                                    className={inputClassName}
                                    required
                                >
                                    <option value='' disabled>
                                        Choose support type
                                    </option>
                                    {issueTypes.map(({ value, label }) => (
                                        <option key={value} value={value}>
                                            {label}
                                        </option>
                                    ))}
                                    <option value='Other support'>Other support</option>
                                </select>
                            </label>

                            <label className='block min-w-0 text-left'>
                                <span className='text-[9.5px] font-medium text-body sm:text-[10.5px]'>
                                    Reference{' '}
                                    <span className='text-body/45'>(optional)</span>
                                </span>
                                <input
                                    name='reference'
                                    type='text'
                                    placeholder='Booking/payment ref.'
                                    className={inputClassName}
                                />
                            </label>

                            <label className='col-span-2 block min-w-0 text-left'>
                                <span className='text-[9.5px] font-medium text-body sm:text-[10.5px]'>
                                    What happened?
                                </span>
                                <textarea
                                    name='message'
                                    rows={4}
                                    placeholder='Describe the problem and what you were trying to do...'
                                    className={`${inputClassName} min-h-[92px] resize-y sm:min-h-[104px]`}
                                    required
                                />
                            </label>

                            <div className='col-span-2 flex items-start gap-2 rounded-xl border border-[#d9e5dc] bg-[#f2f7f3] px-3 py-2.5 text-left'>
                                <ShieldCheck className='mt-px h-3.5 w-3.5 shrink-0 text-sage' />
                                <p className='text-[8px] leading-[1.5] text-body/70 sm:text-[9.5px]'>
                                    For your security, never include your card number,
                                    PIN, password or online-banking details.
                                </p>
                            </div>

                            <button
                                type='submit'
                                className='
                                    inline-flex min-h-[39px] items-center
                                    justify-center gap-2 rounded-xl bg-[#17271d]
                                    px-5 text-[10.5px] font-semibold text-white
                                    transition hover:-translate-y-0.5 hover:bg-[#294532]
                                    focus:outline-none focus:ring-2 focus:ring-sage/25
                                    col-span-2 sm:min-h-[43px] sm:text-[11.5px]
                                '
                            >
                                Send support request
                                <Send className='h-3.5 w-3.5' />
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </section>
    );
}