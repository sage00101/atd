import { useState } from 'react';

import {
    CalendarDays,
    CreditCard,
    MapPin,
    BadgePercent,
    CarFront,
    ChevronDown,
    ArrowUpRight,
    HelpCircle,
} from 'lucide-react';


const faqGroups = [
    {
        title: 'About us',
        icon: CarFront,
        questions: [
            {
                question: 'Who are you?',
                answer:
                    'A10TION TO DETAIL (PTY) LTD - Reg No: 2020/348075/07. 100% Black Owned EME, Level 1 B-BBEE with 135% Procurement Recognition. Based at 2 Pinnacle Crescent, Strandfontein, 7798. Tel: 083 445 3888',
            },
            {
                question: 'Are you mobile?',
                answer:
                    'Yes, we come to you - home, office, dealership, business park in Cape Town. We bring our own water, power, and equipment.',
            },
        ],
    },

    {
        title: 'Services',
        icon: BadgePercent,
        questions: [
            {
                question: 'What is included in every wash?',
                answer:
                    'Full Exterior: High pressure rinse, super foam handwash, door cleaning, wheel &amp; tyre cleaning, tyre dressing, exterior glass, drying. Pristine Interior: Full vacuum, compressed air blowout, deep cleaning of plastics/trim, door panels &amp; cup holders, floor mats cleaning, interior glass, boot &amp; engine bay clean out. Air freshener included.',
            },
            {
                question: 'Do you use my sponge/rag?',
                answer:
                    'No. Every vehicle has its OWN wash kit - sponge, 2 microfibers wash mits, drying towel. No cross-contamination, no scratches.',
            },
            {
                question: 'What fleet checks are included free?',
                answer:
                    'Fluids (oil, coolant, washer), Tyres (pressure, tread, nuts), Lights (head, brake, indicators, hazards), Wipers, Mirrors &amp; Glass, Brakes, Fuel &amp; mileage log, Exterior dents/scratches, under vehicle leaks, Battery terminals, Interior warning lights &amp; seatbelts.',
            },
            {
                question: 'Do you clean engines?',
                answer:
                    'Yes, engine bay clean out is included in full service. No high-pressure on engine electrics.'
            },
            {
                question: 'Do you do ceramic coating, car wash, buff &amp; polish?',
                answer:
                    'Yes - on request for dealerships and private clients. Quote based on vehicle.'
            },
        ],
    },

    {
        title: 'Prices & Packages',
        icon: CreditCard,
        questions: [
            {
                question: 'What are your 2026 rates?',
                answer:
                    'Pay As You Go: Sedan/Hatch R650 | SUV/Bakkie R850 | Minibus/Van R1,100 Standard (2x per month): Sedan R1,150 | SUV R1,550 | Minibus R2,050 - Save R150 Premium (4x per month): Sedan R2,300 | SUV R3,100 | Minibus R4,100 - Save R300 3 Month Prepay: Sedan Std R3,300 Prem R7,200 | SUV Std R4,500 Prem R9,600 | Minibus Std R6,000 Prem R12,600',
            },
            {
                question: 'Do you offer monthly accounts for businesses?',
                answer:
                    'Yes. Single monthly invoice, one payment for all vehicles. PO number accepted.',
            },
            {
                question: 'Is there a B-BBEE Benefit?',
                answer:
                    'Yes. We are Level 1 B-BBEE - your company gets 135% procurement recognition when you use us.',
            },
        ],
    },

    {
        title: 'Booking & Payments',
        icon: CreditCard,
        questions: [
            {
                question: 'How do I book?',
                answer:
                    'Website – bookings@a10tion.co.za For fleet: give us list of regs and address.',
            },
            {
                question: 'What are your banking details?',
                answer:
                    'NEDBANK | Account Holder: A10TION TO DETAIL (PTY) LTD | Account No: 1344476058 | Branch: RRB CLAREMONT | Branch Code: 198765 | Current Account | Reference: Vehicle Reg / Company Name. POP to info@a10tion.co.za or WhatsApp.',
            },
            {
                question: 'When must I pay?',
                answer:
                    'Private: Pay on day of wash. Fleet: 7 days from invoice or as per agreement.',
            },
            {
                question: 'What areas do you cover?',
                answer:
                    'Greater Southern Suburbs – Muizenberg, Plumstead, Newlands, Claremont, Tokai, Constantia, Bergvleit, Bishops Court.'
            }
        ],
    },

    {
        title: 'Other',
        icon: CarFront,
        questions: [
            {
                question: 'What if it rains?',
                answer:
                    'We reschedule free - no charge. Your slot moves to next dry day.',
            },
            {
                question: "What if I'm not happy?",
                answer:
                    'Tell us on the spot. We re-clean immediately free. Customer satisfaction is our guarantee.',
            },
            {
                question: 'Do you need water or electricity from me?',
                answer:
                    'No, we are fully self-sufficient.',
            },
            {
                question: 'How long does a wash take?',
                answer:
                    '45-75 mins per car for full service, depending on size and condition.',
            },
        ],
    },
];


export default function FAQSection() {
    const [activeGroup, setActiveGroup] = useState(null);
    const [openQuestion, setOpenQuestion] = useState(null);


    const selectGroup = (index) => {
        if (activeGroup === index) {
            setActiveGroup(null);
            setOpenQuestion(null);
            return;
        }

        setActiveGroup(index);
        setOpenQuestion(null);
    };


    const toggleQuestion = (index) => {
        setOpenQuestion((current) =>
            current === index ? null : index
        );
    };


    const activeData =
        activeGroup !== null
            ? faqGroups[activeGroup]
            : null;


    return (
        <section
            id='faq'
            className='
                w-full
                overflow-hidden
                bg-white
                px-3
                py-8

                min-[390px]:px-4

                sm:px-6
                sm:py-10

                md:px-8

                lg:px-10
                lg:py-12
            '
        >
            <div className='mx-auto max-w-7xl'>

                {/* =====================================================
                    HEADER
                ===================================================== */}

                <div className='mx-auto max-w-xl text-center'>

                    <div
                        className='
                            inline-flex
                            items-center
                            justify-center
                            gap-1.5
                            text-[8px]
                            font-semibold
                            uppercase
                            tracking-[0.18em]
                            text-[#2F4B3C]

                            sm:text-[9px]
                        '
                    >
                        <HelpCircle
                            className='h-3 w-3'
                            strokeWidth={1.8}
                        />

                        Need to know
                    </div>


                    <h2
                        className='
                            mt-2
                            px-2
                            font-display
                            text-[24px]
                            font-semibold
                            leading-[1.08]
                            tracking-[-0.035em]
                            text-[#161B18]

                            min-[360px]:text-[25px]

                            min-[390px]:text-[27px]

                            sm:text-[32px]

                            md:text-[36px]

                            lg:text-[39px]
                        '
                    >
                        Questions,
                        <span className='ml-1.5 text-[#2F4B3C]'>
                            answered.
                        </span>
                    </h2>


                    <p
                        className='
                            mx-auto
                            mt-2
                            max-w-[320px]
                            px-3
                            text-[9px]
                            leading-[1.55]
                            text-[#5B6560]

                            min-[390px]:text-[9.5px]

                            sm:max-w-md
                            sm:text-[10.5px]
                        '
                    >
                        Choose a topic, then open only the
                        answers you need.
                    </p>
                </div>


                {/* =====================================================
                    RESPONSIVE CATEGORY GRID

                    320–429px  = 2 columns
                    430–767px  = 3 columns
                    Desktop    = 5 columns
                ===================================================== */}

                <div
                    className='
                        mx-auto
                        mt-4
                        grid
                        max-w-6xl
                        grid-cols-2
                        gap-2

                        min-[430px]:grid-cols-3

                        md:mt-5
                        md:grid-cols-5
                    '
                >
                    {faqGroups.map((group, index) => {
                        const Icon = group.icon;
                        const isActive =
                            activeGroup === index;


                        return (
                            <button
                                key={group.title}
                                type='button'
                                onClick={() =>
                                    selectGroup(index)
                                }
                                aria-expanded={isActive}
                                className={`
                                    group
                                    relative
                                    flex
                                    min-h-[44px]
                                    min-w-0
                                    items-center
                                    gap-2
                                    overflow-hidden
                                    rounded-[12px]
                                    border
                                    bg-white
                                    px-2.5
                                    py-2
                                    text-left
                                    transition-all
                                    duration-300

                                    hover:-translate-y-[1px]
                                    hover:border-[#bac9be]
                                    hover:shadow-[0_8px_20px_-18px_rgba(20,40,26,0.3)]

                                    active:scale-[0.98]

                                    sm:min-h-[48px]
                                    sm:px-3

                                    md:min-h-[50px]

                                    ${
                                        isActive
                                            ? `
                                                border-[#6f8a76]
                                                shadow-[0_8px_20px_-18px_rgba(31,57,39,0.4)]
                                            `
                                            : `
                                                border-[#e1e6e2]
                                            `
                                    }
                                `}
                            >
                                {/* icon */}

                                <span
                                    className={`
                                        grid
                                        h-7
                                        w-7
                                        shrink-0
                                        place-items-center
                                        rounded-[8px]
                                        border
                                        transition-all
                                        duration-300

                                        ${
                                            isActive
                                                ? `
                                                    rotate-[-3deg]
                                                    border-[#8ba092]
                                                    text-[#2F4B3C]
                                                `
                                                : `
                                                    border-[#e0e5e1]
                                                    text-[#748078]

                                                    group-hover:rotate-[-2deg]
                                                    group-hover:text-[#2F4B3C]
                                                `
                                        }
                                    `}
                                >
                                    <Icon
                                        className='h-3.5 w-3.5'
                                        strokeWidth={1.65}
                                    />
                                </span>


                                {/* WRAPPING TITLE */}

                                <span
                                    className='
                                        min-w-0
                                        flex-1
                                        whitespace-normal
                                        break-words
                                        text-[8.5px]
                                        font-semibold
                                        leading-[1.2]
                                        text-[#161B18]

                                        min-[360px]:text-[9px]

                                        min-[390px]:text-[9.5px]

                                        sm:text-[10px]

                                        md:text-[9.5px]

                                        lg:text-[10.5px]
                                    '
                                >
                                    {group.title}
                                </span>


                                <ChevronDown
                                    className={`
                                        h-3
                                        w-3
                                        shrink-0
                                        text-[#68726C]
                                        transition-transform
                                        duration-300

                                        ${
                                            isActive
                                                ? 'rotate-180'
                                                : 'rotate-0'
                                        }
                                    `}
                                    strokeWidth={1.8}
                                />
                            </button>
                        );
                    })}
                </div>


                {/* =====================================================
                    SELECTED CATEGORY
                ===================================================== */}

                <div
                    className={`
                        mx-auto
                        grid
                        max-w-6xl
                        transition-all
                        duration-500
                        ease-out

                        ${
                            activeData
                                ? `
                                    mt-3
                                    grid-rows-[1fr]
                                    opacity-100
                                `
                                : `
                                    mt-0
                                    grid-rows-[0fr]
                                    opacity-0
                                `
                        }
                    `}
                >
                    <div className='overflow-hidden'>

                        {activeData && (
                            <div
                                className='
                                    rounded-[15px]
                                    border
                                    border-[#e1e7e2]
                                    bg-white
                                    p-2.5
                                    shadow-[0_12px_35px_-30px_rgba(20,40,26,0.3)]

                                    sm:p-3

                                    md:rounded-[17px]
                                '
                            >
                                {/* =================================================
                                    CATEGORY HEADING
                                ================================================= */}

                                <div
                                    className='
                                        flex
                                        min-w-0
                                        items-start
                                        justify-between
                                        gap-3
                                        px-1
                                        pb-2.5

                                        sm:items-center
                                    '
                                >
                                    <div
                                        className='
                                            min-w-0
                                            flex-1
                                        '
                                    >
                                        <p
                                            className='
                                                whitespace-normal
                                                break-words
                                                text-[10px]
                                                font-semibold
                                                leading-[1.35]
                                                text-[#161B18]

                                                sm:text-[11px]

                                                md:text-[11.5px]
                                            '
                                        >
                                            {activeData.fullTitle}
                                        </p>


                                        <p
                                            className='
                                                mt-0.5
                                                whitespace-normal
                                                break-words
                                                text-[8px]
                                                leading-[1.35]
                                                text-[#6A746E]

                                                min-[390px]:text-[8.5px]

                                                sm:text-[9px]
                                            '
                                        >
                                            {activeData.subtitle}
                                        </p>
                                    </div>


                                    <span
                                        className='
                                            shrink-0
                                            whitespace-nowrap
                                            pt-0.5
                                            text-[7px]
                                            font-medium
                                            uppercase
                                            tracking-[0.11em]
                                            text-[#7E9686]

                                            min-[390px]:text-[7.5px]

                                            sm:text-[8px]
                                        '
                                    >
                                        {activeData.questions.length}
                                        {' '}questions
                                    </span>
                                </div>


                                {/* =================================================
                                    QUESTIONS

                                    MOBILE = vertical
                                    TABLET = 2 columns
                                    DESKTOP = 3 columns
                                ================================================= */}

                                <div
                                    className='
                                        grid
                                        grid-cols-1
                                        gap-2

                                        sm:grid-cols-2

                                        lg:grid-cols-3
                                    '
                                >
                                    {activeData.questions.map(
                                        (faq, index) => {
                                            const isOpen =
                                                openQuestion ===
                                                index;


                                            return (
                                                <div
                                                    key={
                                                        faq.question
                                                    }
                                                    style={{
                                                        animationDelay:
                                                            `${index * 55}ms`,
                                                    }}
                                                    className='
                                                        faq-card-enter
                                                        min-w-0
                                                        self-start
                                                        overflow-hidden
                                                        rounded-[12px]
                                                        border
                                                        border-[#e5e9e6]
                                                        bg-white
                                                        transition-all
                                                        duration-300

                                                        hover:border-[#ccd7cf]
                                                    '
                                                >
                                                    {/* =================================================
                                                        QUESTION
                                                    ================================================= */}

                                                    <button
                                                        type='button'
                                                        onClick={() =>
                                                            toggleQuestion(
                                                                index
                                                            )
                                                        }
                                                        aria-expanded={
                                                            isOpen
                                                        }
                                                        className='
                                                            flex
                                                            min-h-[42px]
                                                            w-full
                                                            min-w-0
                                                            items-center
                                                            gap-2
                                                            px-2.5
                                                            py-2
                                                            text-left
                                                            transition-colors
                                                            duration-200

                                                            hover:bg-[#fafbfa]

                                                            min-[390px]:px-3

                                                            md:min-h-[46px]
                                                        '
                                                    >
                                                        <span
                                                            className={`
                                                                grid
                                                                h-5
                                                                w-5
                                                                shrink-0
                                                                place-items-center
                                                                rounded-full
                                                                border
                                                                text-[7px]
                                                                font-bold
                                                                transition-all
                                                                duration-300

                                                                ${
                                                                    isOpen
                                                                        ? `
                                                                            scale-105
                                                                            border-[#2F4B3C]
                                                                            text-[#2F4B3C]
                                                                        `
                                                                        : `
                                                                            border-[#dfe5e0]
                                                                            text-[#7d8880]
                                                                        `
                                                                }
                                                            `}
                                                        >
                                                            {String(
                                                                index + 1
                                                            ).padStart(
                                                                2,
                                                                '0'
                                                            )}
                                                        </span>


                                                        {/* WRAPPING QUESTION */}

                                                        <span
                                                            className='
                                                                min-w-0
                                                                flex-1
                                                                whitespace-normal
                                                                break-words
                                                                text-[8.75px]
                                                                font-semibold
                                                                leading-[1.35]
                                                                text-[#161B18]

                                                                min-[360px]:text-[9px]

                                                                min-[390px]:text-[9.5px]

                                                                sm:text-[9.75px]

                                                                md:text-[10px]

                                                                lg:text-[10.25px]
                                                            '
                                                        >
                                                            {faq.question}
                                                        </span>


                                                        <ChevronDown
                                                            className={`
                                                                h-3
                                                                w-3
                                                                shrink-0
                                                                text-[#68726C]
                                                                transition-transform
                                                                duration-300

                                                                ${
                                                                    isOpen
                                                                        ? 'rotate-180'
                                                                        : ''
                                                                }
                                                            `}
                                                            strokeWidth={
                                                                1.8
                                                            }
                                                        />
                                                    </button>


                                                    {/* =================================================
                                                        ANSWER
                                                    ================================================= */}

                                                    <div
                                                        className={`
                                                            grid
                                                            transition-all
                                                            duration-300
                                                            ease-out

                                                            ${
                                                                isOpen
                                                                    ? `
                                                                        grid-rows-[1fr]
                                                                        opacity-100
                                                                    `
                                                                    : `
                                                                        grid-rows-[0fr]
                                                                        opacity-0
                                                                    `
                                                            }
                                                        `}
                                                    >
                                                        <div className='overflow-hidden'>

                                                            <div
                                                                className='
                                                                    border-t
                                                                    border-[#edf0ee]
                                                                    px-3
                                                                    pb-2.5
                                                                    pt-2
                                                                '
                                                            >
                                                                <p
                                                                    className='
                                                                        whitespace-normal
                                                                        break-words
                                                                        text-[8.5px]
                                                                        leading-[1.55]
                                                                        text-[#5B6560]

                                                                        min-[390px]:text-[9px]

                                                                        sm:text-[9.25px]

                                                                        md:text-[9.5px]
                                                                    '
                                                                >
                                                                    {
                                                                        faq.answer
                                                                    }
                                                                </p>
                                                            </div>

                                                        </div>
                                                    </div>

                                                </div>
                                            );
                                        }
                                    )}
                                </div>
                            </div>
                        )}

                    </div>
                </div>


                {/* =====================================================
                    CONTACT
                ===================================================== */}

                <div
                    className='
                        mx-auto
                        mt-4
                        flex
                        max-w-6xl
                        flex-wrap
                        items-center
                        justify-center
                        gap-x-2
                        gap-y-1
                        px-2
                        text-center
                    '
                >
                    <p
                        className='
                            text-[8px]
                            leading-4
                            text-[#6A746E]

                            sm:text-[9px]
                        '
                    >
                        Still have a question?
                    </p>


                    <a
                        href='#contact'
                        className='
                            group
                            inline-flex
                            items-center
                            gap-1
                            text-[8px]
                            font-semibold
                            text-[#2F4B3C]
                            transition-colors
                            duration-200

                            hover:text-[#1E3128]

                            sm:text-[9px]
                        '
                    >
                        Contact us

                        <ArrowUpRight
                            className='
                                h-3
                                w-3
                                transition-transform
                                duration-200

                                group-hover:-translate-y-[1px]
                                group-hover:translate-x-[1px]
                            '
                        />
                    </a>
                </div>

            </div>


            {/* =====================================================
                MOTION
            ===================================================== */}

            <style>{`
                @keyframes faqCardEnter {
                    from {
                        opacity: 0;
                        transform: translateY(6px) scale(.99);
                    }

                    to {
                        opacity: 1;
                        transform: translateY(0) scale(1);
                    }
                }


                .faq-card-enter {
                    animation:
                        faqCardEnter
                        .38s
                        cubic-bezier(.22, 1, .36, 1)
                        both;
                }


                @media (prefers-reduced-motion: reduce) {
                    .faq-card-enter {
                        animation: none;
                    }
                }
            `}</style>
        </section>
    );
}