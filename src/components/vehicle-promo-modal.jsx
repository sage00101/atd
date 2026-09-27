import { useEffect, useRef, useState } from 'react';

import {
    CheckCircle2,
    LoaderCircle,
    ShieldCheck,
    Tag,
    X,
} from 'lucide-react';


const PROMO_FORM_URL =
    import.meta.env.VITE_FORMSPREE_PROMO_URL || '';


const fieldClassName = `
    h-[38px]
    w-full
    rounded-[10px]
    border
    border-[#dfe6e1]
    bg-white
    px-3
    text-[10px]
    text-[#18211b]
    outline-none
    transition-all
    duration-200
    placeholder:text-[#869189]
    focus:border-[#6f8f79]
    focus:ring-2
    focus:ring-[#6f8f79]/10

    sm:h-[42px]
    sm:text-[11px]

    lg:h-[46px]
    lg:text-[12px]
`;


export default function VehiclePromoModal({
    open,
    onClose,
    defaults = {},
}) {
    const [status, setStatus] = useState('idle');
    const [message, setMessage] = useState('');
    const firstInputRef = useRef(null);


    useEffect(() => {
        if (!open) {
            return undefined;
        }


        const previousOverflow =
            document.body.style.overflow;


        const closeOnEscape = (event) => {
            if (
                event.key === 'Escape' &&
                status !== 'loading'
            ) {
                onClose();
            }
        };


        document.body.style.overflow = 'hidden';

        document.addEventListener(
            'keydown',
            closeOnEscape
        );


        const focusTimer = window.setTimeout(() => {
            firstInputRef.current?.focus({
                preventScroll: true,
            });
        }, 120);


        return () => {
            document.body.style.overflow =
                previousOverflow;

            document.removeEventListener(
                'keydown',
                closeOnEscape
            );

            window.clearTimeout(focusTimer);
        };
    }, [open, onClose, status]);


    if (!open) {
        return null;
    }


    const submitRegistration = async (event) => {
        event.preventDefault();

        setStatus('loading');
        setMessage('');


        if (!PROMO_FORM_URL) {
            setStatus('error');
            setMessage(
                'Promo registration is not connected yet. Please contact A10tion To Detail.'
            );
            return;
        }


        const form = event.currentTarget;
        const data = new FormData(form);


        const registration = data
            .get('vehicle_registration')
            ?.toString()
            .trim()
            .toUpperCase();


        data.set(
            'vehicle_registration',
            registration || ''
        );

        data.set(
            'registration_status',
            'Pending verification'
        );

        data.set(
            'source',
            'Website vehicle promo registration'
        );


        try {
            const response = await fetch(
                PROMO_FORM_URL,
                {
                    method: 'POST',
                    body: data,
                    headers: {
                        Accept: 'application/json',
                    },
                }
            );


            if (!response.ok) {
                throw new Error(
                    'Registration could not be submitted.'
                );
            }


            form.reset();

            setStatus('success');

            setMessage(
                'Registration received. A10tion To Detail will verify the vehicle before the registration number can be used as a single-wash promo code.'
            );
        } catch (error) {
            setStatus('error');

            setMessage(
                error instanceof Error
                    ? error.message
                    : 'Registration could not be submitted. Please try again.'
            );
        }
    };


    return (
        <div
            className='
                fixed
                inset-0
                z-[999]
                h-[100dvh]
                w-screen
                overflow-hidden
                bg-[#f6f7f3]
            '
            role='dialog'
            aria-modal='true'
            aria-labelledby='promo-register-title'
        >
            <div
                className='
                    grid
                    h-full
                    w-full
                    grid-rows-[auto_minmax(0,1fr)]

                    lg:grid-cols-[34%_66%]
                    lg:grid-rows-1
                '
            >
                {/* =====================================================
                    BRAND / INTRO PANEL
                ===================================================== */}

                <aside
                    className='
                        relative
                        overflow-hidden
                        bg-gradient-to-br
                        from-[#0e1d14]
                        via-[#172c1f]
                        to-[#2e5039]
                        px-4
                        pb-4
                        pt-4
                        text-white

                        sm:px-6
                        sm:pb-5
                        sm:pt-5

                        lg:flex
                        lg:min-h-0
                        lg:flex-col
                        lg:justify-between
                        lg:px-8
                        lg:py-8

                        xl:px-10
                        xl:py-10
                    '
                >
                    <span
                        className='
                            pointer-events-none
                            absolute
                            -right-20
                            -top-24
                            h-72
                            w-72
                            rounded-full
                            bg-[#a8cbb0]/15
                            blur-[80px]
                        '
                    />

                    <span
                        className='
                            pointer-events-none
                            absolute
                            -bottom-28
                            -left-24
                            h-72
                            w-72
                            rounded-full
                            bg-black/20
                            blur-[90px]
                        '
                    />


                    <div className='relative z-10'>
                        <div
                            className='
                                inline-flex
                                items-center
                                gap-1.5
                                rounded-full
                                border
                                border-white/15
                                bg-white/[0.06]
                                px-2.5
                                py-1.5
                                text-[7.5px]
                                font-semibold
                                uppercase
                                tracking-[0.16em]
                                text-[#c4d8c9]

                                sm:text-[8px]
                            '
                        >
                            <Tag
                                className='h-3 w-3'
                                strokeWidth={1.8}
                            />

                            Vehicle promo
                        </div>


                        <h2
                            id='promo-register-title'
                            className='
                                mt-3
                                max-w-xl
                                font-display
                                text-[25px]
                                font-semibold
                                leading-[1.02]
                                tracking-[-0.035em]
                                text-white

                                min-[390px]:text-[28px]

                                sm:text-[32px]

                                lg:mt-6
                                lg:max-w-md
                                lg:text-[40px]

                                xl:text-[46px]
                            '
                        >
                            Register your vehicle.
                        </h2>


                        <p
                            className='
                                mt-2
                                max-w-2xl
                                text-[9px]
                                leading-[1.55]
                                text-white/65

                                sm:text-[10px]

                                lg:mt-4
                                lg:max-w-md
                                lg:text-[11px]
                                lg:leading-[1.7]
                            '
                        >
                            Once approved, your registration number becomes your personal promo code for eligible single washes only.
                        </p>
                    </div>


                    <div
                        className='
                            relative
                            z-10
                            mt-3
                            hidden
                            space-y-3

                            lg:block
                        '
                    >
                        {[
                            'Submit your client and vehicle details.',
                            'A10tion verifies the vehicle against its records.',
                            'Use the approved registration as your single-wash promo code.',
                        ].map((step, index) => (
                            <div
                                key={step}
                                className='
                                    flex
                                    items-start
                                    gap-3
                                '
                            >
                                <span
                                    className='
                                        grid
                                        h-7
                                        w-7
                                        shrink-0
                                        place-items-center
                                        rounded-full
                                        border
                                        border-white/15
                                        bg-white/[0.06]
                                        text-[8px]
                                        font-semibold
                                        text-[#c9ddce]
                                    '
                                >
                                    0{index + 1}
                                </span>

                                <p
                                    className='
                                        pt-1
                                        text-[9.5px]
                                        leading-[1.55]
                                        text-white/55
                                    '
                                >
                                    {step}
                                </p>
                            </div>
                        ))}
                    </div>
                </aside>


                {/* =====================================================
                    FORM PANEL
                ===================================================== */}

                <main
                    className='
                        relative
                        min-h-0
                        bg-[#f7f8f5]
                    '
                >
                    <button
                        type='button'
                        onClick={onClose}
                        disabled={status === 'loading'}
                        className='
                            absolute
                            right-3
                            top-3
                            z-30
                            grid
                            h-9
                            w-9
                            place-items-center
                            rounded-full
                            border
                            border-[#dbe3dd]
                            bg-white/95
                            p-0
                            text-[#34443b]
                            shadow-sm
                            backdrop-blur-md
                            transition
                            hover:border-[#a7baac]
                            hover:bg-white
                            disabled:opacity-40

                            sm:right-4
                            sm:top-4

                            lg:right-6
                            lg:top-6
                        '
                        aria-label='Close vehicle promo registration'
                    >
                        <X
                            className='h-4 w-4'
                            strokeWidth={1.8}
                        />
                    </button>


                    <div
                        className='
                            h-full
                            overflow-y-auto
                            px-3
                            pb-4
                            pt-3

                            min-[390px]:px-4

                            sm:px-6
                            sm:pb-6
                            sm:pt-5

                            lg:px-8
                            lg:pb-8
                            lg:pt-8

                            xl:px-12
                            xl:py-10

                            [&::-webkit-scrollbar]:hidden
                        '
                        style={{
                            scrollbarWidth: 'none',
                        }}
                    >
                        <form
                            onSubmit={submitRegistration}
                            className='
                                mx-auto
                                flex
                                min-h-full
                                w-full
                                max-w-5xl
                                flex-col
                                justify-center
                                pr-0

                                lg:pr-10
                            '
                        >
                            <div className='mb-3 pr-12 sm:mb-4 lg:mb-6'>
                                <p
                                    className='
                                        text-[7.5px]
                                        font-semibold
                                        uppercase
                                        tracking-[0.16em]
                                        text-[#6e8275]

                                        sm:text-[8.5px]
                                    '
                                >
                                    Single-wash promo registration
                                </p>

                                <h3
                                    className='
                                        mt-1
                                        font-display
                                        text-[19px]
                                        font-semibold
                                        leading-tight
                                        tracking-[-0.025em]
                                        text-[#172019]

                                        min-[390px]:text-[21px]

                                        sm:text-[24px]

                                        lg:text-[28px]
                                    '
                                >
                                    Your details
                                </h3>
                            </div>


                            <div
                                className='
                                    grid
                                    grid-cols-2
                                    gap-2

                                    sm:gap-3

                                    lg:gap-4
                                '
                            >
                                <label className='block min-w-0'>
                                    <span className='mb-1 block text-[8px] font-semibold text-[#28352e] sm:text-[9px] lg:text-[10px]'>
                                        First name
                                    </span>

                                    <input
                                        ref={firstInputRef}
                                        className={fieldClassName}
                                        name='first_name'
                                        defaultValue={defaults.firstName || ''}
                                        autoComplete='given-name'
                                        required
                                    />
                                </label>


                                <label className='block min-w-0'>
                                    <span className='mb-1 block text-[8px] font-semibold text-[#28352e] sm:text-[9px] lg:text-[10px]'>
                                        Surname
                                    </span>

                                    <input
                                        className={fieldClassName}
                                        name='surname'
                                        defaultValue={defaults.surname || ''}
                                        autoComplete='family-name'
                                        required
                                    />
                                </label>


                                <label className='block min-w-0'>
                                    <span className='mb-1 block text-[8px] font-semibold text-[#28352e] sm:text-[9px] lg:text-[10px]'>
                                        Email address
                                    </span>

                                    <input
                                        className={fieldClassName}
                                        type='email'
                                        name='email'
                                        defaultValue={defaults.email || ''}
                                        autoComplete='email'
                                        required
                                    />
                                </label>


                                <label className='block min-w-0'>
                                    <span className='mb-1 block text-[8px] font-semibold text-[#28352e] sm:text-[9px] lg:text-[10px]'>
                                        Cell number
                                    </span>

                                    <input
                                        className={fieldClassName}
                                        type='tel'
                                        name='cell'
                                        defaultValue={defaults.mobile || ''}
                                        autoComplete='tel'
                                        required
                                    />
                                </label>
                            </div>


                            <label className='mt-2.5 block sm:mt-3 lg:mt-4'>
                                <span className='mb-1 block text-[8px] font-semibold text-[#28352e] sm:text-[9px] lg:text-[10px]'>
                                    Vehicle registration number
                                </span>

                                <input
                                    className={`${fieldClassName} uppercase tracking-[0.06em]`}
                                    name='vehicle_registration'
                                    defaultValue={defaults.registration || ''}
                                    placeholder='e.g. CA 123-456'
                                    autoCapitalize='characters'
                                    autoComplete='off'
                                    required
                                />
                            </label>


                            <div
                                className='
                                    mt-2.5
                                    grid
                                    gap-2

                                    sm:mt-3

                                    lg:mt-4
                                    lg:grid-cols-2
                                    lg:gap-3
                                '
                            >
                                <label
                                    className='
                                        flex
                                        items-start
                                        gap-2
                                        rounded-[11px]
                                        border
                                        border-[#dfe6e1]
                                        bg-white
                                        px-2.5
                                        py-2

                                        sm:px-3
                                        sm:py-2.5
                                    '
                                >
                                    <input
                                        type='checkbox'
                                        name='_optin'
                                        value='yes'
                                        className='mt-0.5 shrink-0 accent-[#365943]'
                                        required
                                    />

                                    <span
                                        className='
                                            text-[8px]
                                            leading-[1.45]
                                            text-[#5e6962]

                                            sm:text-[9px]

                                            lg:text-[9.5px]
                                        '
                                    >
                                        I consent to A10tion To Detail processing these details to administer the vehicle-promo programme. This does not subscribe me to marketing emails.
                                    </span>
                                </label>


                                <div
                                    className='
                                        flex
                                        items-start
                                        gap-2
                                        rounded-[11px]
                                        border
                                        border-[#d9e4db]
                                        bg-[#edf3ee]
                                        px-2.5
                                        py-2

                                        sm:px-3
                                        sm:py-2.5
                                    '
                                >
                                    <ShieldCheck
                                        className='
                                            mt-0.5
                                            h-3.5
                                            w-3.5
                                            shrink-0
                                            text-[#345541]
                                        '
                                        strokeWidth={1.8}
                                    />

                                    <p
                                        className='
                                            text-[8px]
                                            leading-[1.45]
                                            text-[#5b6960]

                                            sm:text-[9px]

                                            lg:text-[9.5px]
                                        '
                                    >
                                        Registration is not activated automatically. The business must first confirm the vehicle against its client/vehicle records and mark it as verified.
                                    </p>
                                </div>
                            </div>


                            {message && (
                                <div
                                    className={`
                                        mt-2.5
                                        rounded-[11px]
                                        border
                                        px-3
                                        py-2
                                        text-[8.5px]
                                        leading-[1.45]

                                        sm:mt-3
                                        sm:text-[9.5px]

                                        ${
                                            status === 'success'
                                                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                                                : 'border-red-200 bg-red-50 text-red-700'
                                        }
                                    `}
                                    role='status'
                                >
                                    <div className='flex items-start gap-2'>
                                        {status === 'success' && (
                                            <CheckCircle2
                                                className='mt-0.5 h-3.5 w-3.5 shrink-0'
                                                strokeWidth={1.8}
                                            />
                                        )}

                                        <span>{message}</span>
                                    </div>
                                </div>
                            )}


                            <div
                                className='
                                    mt-3
                                    flex
                                    flex-col-reverse
                                    gap-2

                                    min-[390px]:flex-row
                                    min-[390px]:items-center
                                    min-[390px]:justify-between

                                    sm:mt-4

                                    lg:mt-5
                                '
                            >
                                <p
                                    className='
                                        text-center
                                        text-[7px]
                                        leading-[1.4]
                                        text-[#849087]

                                        min-[390px]:max-w-[55%]
                                        min-[390px]:text-left

                                        sm:text-[8px]
                                    '
                                >
                                    Your registration is used only for the promo verification process and remains subject to approval.
                                </p>


                                <button
                                    type='submit'
                                    disabled={status === 'loading'}
                                    className='
                                        inline-flex
                                        min-h-[40px]
                                        shrink-0
                                        items-center
                                        justify-center
                                        gap-2
                                        rounded-full
                                        bg-[#18241d]
                                        px-5
                                        text-[9.5px]
                                        font-semibold
                                        text-white
                                        shadow-[0_12px_28px_-18px_rgba(24,36,29,.65)]
                                        transition-all
                                        hover:-translate-y-0.5
                                        hover:bg-[#24362a]
                                        disabled:cursor-wait
                                        disabled:opacity-60

                                        min-[390px]:min-w-[145px]

                                        sm:min-h-[43px]
                                        sm:px-6
                                        sm:text-[10.5px]

                                        lg:min-h-[46px]
                                        lg:min-w-[170px]
                                        lg:text-[11px]
                                    '
                                >
                                    {status === 'loading' && (
                                        <LoaderCircle
                                            className='h-3.5 w-3.5 animate-spin'
                                            strokeWidth={1.8}
                                        />
                                    )}

                                    {status === 'loading'
                                        ? 'Submitting…'
                                        : 'Register vehicle'}
                                </button>
                            </div>
                        </form>
                    </div>
                </main>
            </div>
        </div>
    );
}