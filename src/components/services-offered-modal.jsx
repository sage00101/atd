import { useEffect } from 'react';
import {
    Check,
    ClipboardCheck,
    Droplets,
    X,
} from 'lucide-react';

const serviceGroups = [
    {
        title: 'Full Exterior Cleaning',
        icon: Droplets,
        items: [
            'High pressure rinse',
            'Super foam handwash',
            'Door cleaning',
            'Wheel and tyre cleaning process',
            'Tyre dressing',
            'Exterior glass cleaning',
            'Drying process',
        ],
    },
    {
        title: 'Pristine Interior Cleaning',
        icon: ClipboardCheck,
        items: [
            'Full vacuum',
            'Compressed air blowout',
            'Deep cleaning of plastics and trim',
            'Door panels and cup holders',
            'Floor mats cleaning process',
            'Interior glass cleaning',
            'Boot and engine bay clean out',
        ],
    },
    {
        title: 'Conduct Fleet Maintenance Checks',
        icon: ClipboardCheck,
        items: [
            'Fluids: engine oil, coolant, windscreen washer',
            'Tyres: pressure, tread, damage, wheel nuts tight',
            'Lights: headlights, brake lights, indicators, hazards',
            'Wipers + washers: working and blades not cracked',
            'Mirrors + glass: clean, no cracks',
            'Brakes: pedal feel, no warning lights',
            'Fuel level + mileage: log it',
            'Exterior: new dents, scratches, loose trim',
            'Under vehicle: leaks - oil, coolant, fuel',
            'Battery: terminals clean, no corrosion',
            'Interior: cleanliness, seatbelts, warning lights on dash',
        ],
    },
];

export default function ServicesOfferedModal({ open, onClose }) {
    useEffect(() => {
        if (!open) return undefined;

        const previousOverflow = document.body.style.overflow;
        const closeOnEscape = (event) => {
            if (event.key === 'Escape') onClose();
        };

        document.body.style.overflow = 'hidden';
        document.addEventListener('keydown', closeOnEscape);

        return () => {
            document.body.style.overflow = previousOverflow;
            document.removeEventListener('keydown', closeOnEscape);
        };
    }, [open, onClose]);

    if (!open) return null;

    return (
        <div
            className='fixed inset-0 z-[120] grid h-[100dvh] w-full place-items-center overflow-y-auto bg-[#0c1710]/70 p-3 backdrop-blur-[4px] sm:p-5'
            role='dialog'
            aria-modal='true'
            aria-labelledby='services-offered-title'
        >
            <button type='button' className='absolute inset-0 cursor-default' onClick={onClose} aria-label='Close services offered' />

            <div className='relative z-10 flex max-h-[calc(100dvh-24px)] w-full max-w-3xl flex-col overflow-hidden rounded-[20px] bg-[#f7f9f6] shadow-[0_28px_90px_-30px_rgba(4,14,8,.72)] sm:max-h-[calc(100dvh-40px)] sm:rounded-[24px]'>
                <div className='relative shrink-0 bg-gradient-to-br from-[#17261d] via-[#203529] to-[#2f4d39] px-4 py-5 text-white sm:px-7 sm:py-6'>
                    <button type='button' onClick={onClose} className='absolute right-3 top-3 grid size-5 place-items-center rounded-full border border-white/25 bg-black/15 transition hover:bg-white/15 sm:right-5 sm:top-5 sm:size-8' aria-label='Close services offered'>
                        <X className='size-3 sm:size-4' />
                    </button>
                    <p className='flex items-center gap-1.5 text-[8px] font-semibold uppercase tracking-[0.15em] text-[#bdd3c2]'><ClipboardCheck className='size-3' />Offered in every car wash</p>
                    <h2 id='services-offered-title' className='mt-1 max-w-[calc(100%-32px)] font-display text-[24px] font-medium leading-tight sm:text-[32px]'>Services offered</h2>
                    <p className='mt-1.5 max-w-xl text-[9.5px] leading-[1.55] text-white/65 sm:text-[11px]'>A thorough clean inside and out, with practical checks to help keep your vehicle ready for the road.</p>
                </div>

                <div className='min-h-0 overflow-y-auto overscroll-contain p-3.5 text-left [&::-webkit-scrollbar]:hidden sm:p-6' style={{ scrollbarWidth: 'none' }}>
                    <div className='grid gap-3 sm:grid-cols-2 sm:gap-4'>
                        {serviceGroups.map(({ title, icon: Icon, items }, index) => (
                            <section key={title} className={`rounded-[14px] border border-[#dfe8e1] bg-white p-3.5 text-left sm:p-4 ${index === 2 ? 'sm:col-span-2' : ''}`}>
                                <div className='flex items-start gap-2.5'>
                                    <span className='grid size-8 shrink-0 place-items-center rounded-[10px] bg-[#eaf2eb] text-[#31553c] sm:size-9'>
                                        <Icon className='size-4' strokeWidth={1.8} />
                                    </span>
                                    <h3 className='min-w-0 pt-1 text-left font-display text-[14px] font-semibold leading-tight text-[#172019] sm:text-[18px]'>{title}</h3>
                                </div>
                                <ul className={`mt-3 grid gap-x-5 gap-y-2 ${index === 2 ? 'sm:grid-cols-2' : ''}`}>
                                    {items.map((item) => (
                                        <li key={item} className='flex items-start gap-1.5 text-[9px] leading-[1.4] text-[#5b675f] sm:text-[10.5px]'>
                                            <Check className='mt-0.5 size-3 shrink-0 text-[#4d7958]' strokeWidth={2.2} />
                                            <span>{item}</span>
                                        </li>
                                    ))}
                                </ul>
                            </section>
                        ))}
                    </div>
                </div>

                <div className='shrink-0 border-t border-[#e1e8e2] bg-white px-3.5 py-3 text-right sm:px-6 sm:py-4'>
                    <button type='button' onClick={onClose} className='min-h-[38px] rounded-[10px] bg-[#18241d] px-5 text-[10px] font-semibold text-white transition hover:bg-[#24362a] sm:min-h-[41px] sm:text-[11px]'>
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}
