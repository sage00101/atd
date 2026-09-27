import { useState } from 'react';

import {
    CarFront,
    Sparkles,
    ClipboardCheck,
    Check,
    ChevronDown,
} from 'lucide-react';

import useReveal from '../hooks/use-reveal';


const ROUND_LOGO = '/assets/logo-round.svg';


const includedServices = [
    {
        number: '01',
        icon: CarFront,
        title: 'Full Exterior Cleaning',
        description:
            'High pressure rinse, super foam handwash, door cleaning, wheel and tyre cleaning process, tyre dressing, exterior glass cleaning and drying process.',
    },
    {
        number: '02',
        icon: Sparkles,
        title: 'Pristine Interior Cleaning',
        description:
            'Full vacuum, compressed air blowout, deep cleaning of plastics and trim, door panels and cup holders, floor mats cleaning process, interior glass cleaning, boot and engine bay clean out.',
    },
    {
        number: '03',
        icon: ClipboardCheck,
        title: 'Conduct Fleet Maintenance Checks',
        checklist: [
            {
                label: 'Fluids',
                value: 'Engine oil, coolant, windscreen washer.',
            },
            {
                label: 'Tyres',
                value: 'Pressure, tread, damage, wheel nuts tight.',
            },
            {
                label: 'Lights',
                value: 'Headlights, brake lights, indicators, hazards.',
            },
            {
                label: 'Wipers + Washers',
                value: 'Working and blades not cracked.',
            },
            {
                label: 'Mirrors + Glass',
                value: 'Clean, no cracks.',
            },
            {
                label: 'Brakes',
                value: 'Pedal feel, no warning lights.',
            },
            {
                label: 'Fuel Level + Mileage',
                value: 'Log it.',
            },
            {
                label: 'Exterior',
                value: 'New dents, scratches, loose trim.',
            },
            {
                label: 'Under Vehicle',
                value: 'Leaks - oil, coolant, fuel.',
            },
            {
                label: 'Battery',
                value: 'Terminals clean, no corrosion.',
            },
            {
                label: 'Interior',
                value: 'Cleanliness, seatbelts and warning lights on dash.',
            },
        ],
    },
];


function ServiceDetails({
    service,
    showHeading = false,
}) {
    const Icon = service.icon;


    return (
        <div>
            <p
                className='
                    text-[8.5px]
                    font-semibold
                    uppercase
                    tracking-[0.18em]
                    text-[#b5cfba]/80

                    sm:text-[9px]
                '
            >
                Details
            </p>


            {showHeading && (
                <div className='mt-3 flex items-center gap-2.5'>
                    <span
                        className='
                            grid
                            size-9
                            shrink-0
                            place-items-center
                            rounded-[11px]
                            border
                            border-[#90ad98]/25
                            bg-white/[0.05]
                        '
                    >
                        <Icon className='size-4 text-[#9abd9f]' />
                    </span>


                    <div>
                        <h3
                            className='
                                text-[16px]
                                font-semibold
                                leading-tight
                                text-white

                                md:text-[18px]

                                lg:text-[19px]
                            '
                        >
                            {service.title}
                        </h3>


                        <div
                            className='
                                mt-1
                                flex
                                items-center
                                gap-1.5
                                text-[9px]
                                font-medium
                                text-white/50
                            '
                        >
                            <Check className='size-3 text-[#9abd9f]' />

                            Included with every wash
                        </div>
                    </div>
                </div>
            )}


            {service.description && (
                <p
                    className={
                        'text-[10.5px] leading-[1.75] text-white/70 ' +
                        'sm:text-[11.5px] md:text-[12px] ' +
                        (showHeading ? 'mt-4' : 'mt-2')
                    }
                >
                    {service.description}
                </p>
            )}


            {service.checklist && (
                <div
                    className={
                        'grid gap-2 sm:grid-cols-2 sm:gap-2.5 ' +
                        (showHeading ? 'mt-5' : 'mt-3')
                    }
                >
                    {service.checklist.map((item) => (
                        <div
                            key={item.label}
                            className='
                                rounded-[12px]
                                border
                                border-white/10
                                bg-white/[0.04]
                                px-3
                                py-2.5
                                shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]
                            '
                        >
                            <p
                                className='
                                    text-[9.5px]
                                    font-semibold
                                    text-[#b5cfba]

                                    sm:text-[10px]
                                '
                            >
                                {item.label}
                            </p>


                            <p
                                className='
                                    mt-1
                                    text-[9.5px]
                                    leading-[1.5]
                                    text-white/65

                                    sm:text-[10px]
                                '
                            >
                                {item.value}
                            </p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}


export default function ServicesSection() {
    const ref = useReveal();
    const [openService, setOpenService] = useState('01');


    const activeService =
        includedServices.find(
            (service) => service.number === openService
        ) || includedServices[0];


    const toggleService = (number) => {
        setOpenService((current) =>
            current === number ? null : number
        );
    };


    return (
        <section
            id='services'
            className='
                px-3
                pt-12

                sm:px-4
                sm:pt-14

                md:px-8

                lg:px-10
                lg:pt-16
            '
        >
            <div
                ref={ref}
                className='reveal mx-auto max-w-7xl'
            >


                {/* =====================================================
                    HEADER
                ===================================================== */}
                <div className='text-center'>
                    <p
                        className='
                            inline-flex
                            items-center
                            gap-2
                            text-[9.5px]
                            font-semibold
                            uppercase
                            tracking-[0.18em]
                            text-sage

                            sm:text-[10.5px]
                        '
                    >
                        <span className='h-px w-5 bg-sage' />

                        Standard with every wash

                        <span className='h-px w-5 bg-sage' />
                    </p>


                    <div
                        className='
                            mt-3
                            flex
                            items-center
                            justify-center
                            gap-3

                            sm:gap-3.5
                        '
                    >
                        <span
                            className='
                                grid
                                order-2
                                size-10
                                shrink-0
                                place-items-center
                                overflow-hidden
                                rounded-full
                                border
                                border-sage/20
                                bg-sagelight/45
                                p-1
                                shadow-[0_8px_22px_-16px_rgba(31,69,44,.65)]

                                sm:size-12
                            '
                        >
                            <img
                                src={ROUND_LOGO}
                                alt='A10tion To Detail'
                                className='h-full w-full object-contain'
                                draggable={false}
                                loading='lazy'
                                decoding='async'
                            />
                        </span>


                        <h2
                            className='
                                font-display
                                text-[25px]
                                font-medium
                                leading-none
                                tracking-[-0.025em]
                                text-ink

                                min-[390px]:text-[27px]

                                sm:text-[34px]

                                md:text-[38px]
                            '
                        >
                            All Washes Included
                        </h2>
                    </div>


                    <p
                        className='
                            mx-auto
                            mt-2.5
                            max-w-md
                            text-[11px]
                            leading-5
                            text-body

                            sm:text-[12px]
                        '
                    >
                        The essentials are covered every time we service your vehicle.
                    </p>
                </div>


                {/* =====================================================
                    ONE UNIFIED SERVICES BOX
                ===================================================== */}
                <div
                    className='
                        group
                        relative
                        mt-6
                        overflow-hidden
                        rounded-[22px]
                        border
                        border-[#6e8b76]/30
                        bg-[#101b14]
                        shadow-[0_22px_55px_-38px_rgba(0,0,0,.9)]

                        sm:mt-7
                        sm:rounded-[26px]
                    '
                >


                    {/* Large diagonal brand accent */}
                    <span
                        className='
                            pointer-events-none
                            absolute
                            -right-20
                            top-0
                            h-full
                            w-[180px]
                            skew-x-[-20deg]
                            bg-gradient-to-r
                            from-transparent
                            via-[#4f745b]/15
                            to-[#9abd9f]/22

                            sm:w-[260px]
                        '
                    />


                    {/* Ambient panel glow */}
                    <span
                        className='
                            pointer-events-none
                            absolute
                            -right-10
                            top-1/3
                            size-44
                            rounded-full
                            bg-[#94b59b]/10
                            blur-3xl

                            sm:size-64
                        '
                    />


                    {/* =============================================
                        MOBILE ACCORDION
                    ============================================= */}
                    <div
                        className='
                            relative
                            z-10
                            divide-y
                            divide-white/10

                            sm:hidden
                        '
                    >
                        {includedServices.map((service) => {
                            const Icon = service.icon;
                            const isOpen =
                                openService === service.number;


                            return (
                                <div key={service.number}>
                                    <button
                                        type='button'
                                        onClick={() =>
                                            toggleService(
                                                service.number
                                            )
                                        }
                                        aria-expanded={isOpen}
                                        aria-controls={
                                            'wash-mobile-panel-' +
                                            service.number
                                        }
                                        className={
                                            'flex min-h-[66px] w-full items-center gap-3 ' +
                                            'px-4 py-3 text-left transition-colors duration-300 ' +
                                            (
                                                isOpen
                                                    ? 'bg-white/[0.045]'
                                                    : 'hover:bg-white/[0.025]'
                                            )
                                        }
                                    >
                                        <span
                                            className='
                                                grid
                                                size-9
                                                shrink-0
                                                place-items-center
                                                rounded-[11px]
                                                border
                                                border-[#90ad98]/25
                                                bg-white/[0.05]
                                                text-[10px]
                                                font-bold
                                                tracking-[0.08em]
                                                text-[#b5cfba]
                                            '
                                        >
                                            {service.number}
                                        </span>


                                        <span className='min-w-0 flex-1'>
                                            <span className='flex items-center gap-2'>
                                                <Icon
                                                    className='
                                                        size-3.5
                                                        shrink-0
                                                        text-[#9abd9f]
                                                    '
                                                />


                                                <span
                                                    className='
                                                        text-[11.5px]
                                                        font-semibold
                                                        leading-[1.3]
                                                        text-white

                                                        min-[390px]:text-[12px]
                                                    '
                                                >
                                                    {service.title}
                                                </span>
                                            </span>


                                            <span
                                                className='
                                                    mt-1
                                                    flex
                                                    items-center
                                                    gap-1.5
                                                    text-[8.5px]
                                                    font-medium
                                                    text-white/45
                                                '
                                            >
                                                <Check className='size-3 text-[#9abd9f]' />

                                                Included
                                            </span>
                                        </span>


                                        <span
                                            className={
                                                'grid size-7 shrink-0 place-items-center rounded-full ' +
                                                'border border-white/10 bg-white/[0.04] text-[#cfe2d2] ' +
                                                'transition-all duration-300 ' +
                                                (
                                                    isOpen
                                                        ? 'border-[#9abd9f]/35 bg-[#9abd9f]/10'
                                                        : ''
                                                )
                                            }
                                        >
                                            <ChevronDown
                                                className={
                                                    'size-3.5 transition-transform duration-300 ' +
                                                    (
                                                        isOpen
                                                            ? 'rotate-180'
                                                            : 'rotate-0'
                                                    )
                                                }
                                            />
                                        </span>
                                    </button>


                                    <div
                                        id={
                                            'wash-mobile-panel-' +
                                            service.number
                                        }
                                        className={
                                            'grid transition-all ease-out ' +
                                            (
                                                isOpen
                                                    ? 'grid-rows-[1fr] opacity-100 duration-300'
                                                    : 'grid-rows-[0fr] opacity-0 duration-200'
                                            )
                                        }
                                    >
                                        <div className='overflow-hidden'>
                                            <div
                                                className='
                                                    mx-3
                                                    mb-3
                                                    rounded-[15px]
                                                    border
                                                    border-white/10
                                                    bg-white/[0.04]
                                                    px-3.5
                                                    py-3
                                                    text-left
                                                    shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]
                                                    backdrop-blur-[2px]
                                                '
                                            >
                                                <ServiceDetails
                                                    service={service}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>


                    {/* =============================================
                        TABLET / DESKTOP SERVICE SELECTOR
                    ============================================= */}
                    <div
                        className='
                            relative
                            z-10
                            hidden

                            sm:grid
                            sm:grid-cols-[210px_minmax(0,1fr)]

                            lg:grid-cols-[245px_minmax(0,1fr)]
                        '
                    >


                        {/* Service navigation */}
                        <div
                            className='
                                border-r
                                border-white/10
                                bg-black/10
                                p-3

                                lg:p-4
                            '
                        >
                            <p
                                className='
                                    px-2
                                    pb-2.5
                                    text-[8.5px]
                                    font-semibold
                                    uppercase
                                    tracking-[0.18em]
                                    text-[#b5cfba]/65
                                '
                            >
                                Services included
                            </p>


                            <div className='grid gap-2'>
                                {includedServices.map(
                                    (service) => {
                                        const Icon =
                                            service.icon;
                                        const isActive =
                                            activeService.number ===
                                            service.number;


                                        return (
                                            <button
                                                key={service.number}
                                                type='button'
                                                onClick={() =>
                                                    setOpenService(
                                                        service.number
                                                    )
                                                }
                                                aria-pressed={isActive}
                                                className={
                                                    'group/tab relative overflow-hidden rounded-[14px] border ' +
                                                    'px-3 py-3 text-left transition-all duration-300 ' +
                                                    (
                                                        isActive
                                                            ? 'border-[#9abd9f]/35 bg-[#9abd9f]/10'
                                                            : 'border-white/[0.07] bg-white/[0.025] hover:border-[#94b39c]/25 hover:bg-white/[0.045]'
                                                    )
                                                }
                                            >
                                                <span
                                                    className={
                                                        'absolute inset-y-0 left-0 w-[3px] ' +
                                                        'bg-gradient-to-b from-[#9abd9f] to-[#52745c] ' +
                                                        'transition-opacity duration-300 ' +
                                                        (
                                                            isActive
                                                                ? 'opacity-100'
                                                                : 'opacity-0'
                                                        )
                                                    }
                                                />


                                                <span className='flex items-center gap-2.5'>
                                                    <span
                                                        className='
                                                            grid
                                                            size-8
                                                            shrink-0
                                                            place-items-center
                                                            rounded-[10px]
                                                            border
                                                            border-[#90ad98]/20
                                                            bg-white/[0.04]
                                                            text-[9px]
                                                            font-bold
                                                            text-[#b5cfba]
                                                        '
                                                    >
                                                        {service.number}
                                                    </span>


                                                    <span className='min-w-0'>
                                                        <span className='flex items-center gap-1.5'>
                                                            <Icon
                                                                className='
                                                                    size-3.5
                                                                    shrink-0
                                                                    text-[#9abd9f]
                                                                '
                                                            />


                                                            <span
                                                                className='
                                                                    text-[10.5px]
                                                                    font-semibold
                                                                    leading-[1.3]
                                                                    text-white

                                                                    lg:text-[11.5px]
                                                                '
                                                            >
                                                                {service.title}
                                                            </span>
                                                        </span>


                                                        <span
                                                            className='
                                                                mt-1
                                                                flex
                                                                items-center
                                                                gap-1
                                                                text-[8.5px]
                                                                text-white/45
                                                            '
                                                        >
                                                            <Check className='size-2.5 text-[#9abd9f]' />

                                                            Included
                                                        </span>
                                                    </span>
                                                </span>
                                            </button>
                                        );
                                    }
                                )}
                            </div>
                        </div>


                        {/* Active service details */}
                        <div
                            className='
                                min-w-0
                                p-5

                                md:p-6

                                lg:p-7
                            '
                        >
                            <ServiceDetails
                                service={activeService}
                                showHeading
                            />
                        </div>
                    </div>


                    {/* =============================================
                        CLIENT NOTE
                    ============================================= */}
                    <div
                        className='
                            relative
                            z-10
                            border-t
                            border-white/10
                            bg-white/[0.035]
                            px-4
                            py-3
                            text-center
                            text-[9.5px]
                            font-medium
                            leading-[1.55]
                            text-white/65

                            sm:px-6
                            sm:text-[10.5px]

                            md:py-3.5
                        '
                    >
                        <span
                            className='
                                mr-1
                                font-bold
                                text-[#b5cfba]
                            '
                        >
                            N.B.
                        </span>

                        Each vehicle will have its own wash sponge, glass cloth,
                        2 microfiber cloths &amp; brush.
                    </div>
                </div>
            </div>
        </section>
    );
}