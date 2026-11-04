import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, Droplet, Maximize2, X } from 'lucide-react';
import useReveal from '../hooks/use-reveal';
import aboutImage from '../assets/images/about.jpg';
import vanInterior from '../assets/images/van-interior.jpeg';
import vanInterior2 from '../assets/images/van-interior-2.jpeg';

const aboutItems = [
    {
        title: 'Who Are We',
        description:
            "At A10TION TO DETAIL (Pty) Ltd, we're passionate about keeping your vehicle looking its best. We provide premium hand wash services, combining quality workmanship with exceptional attention to detail.",
    },
    {
        title: 'Why We Started',
        description:
            'We pride ourselves on professional service, attention to detail, and delivering premium results you can trust every time.',
    },
    {
        title: 'Our Vision',
        description:
            "Is to establish our very own premises in future. For now we are investing our passion and purpose into our mobile units."
    },
    {
        title: 'Hand Wash Only',
        description:
            'Every vehicle is carefully hand washed using safe techniques to minimise scratches and deliver a superior finish.',
    },
];

const gallery = [
    {
        src: aboutImage,
        alt: 'A10tion To Detail vehicle being hand washed',
        label: 'On the job',
        caption: 'Every vehicle, hand washed with care',
    },
    {
        src: vanInterior,
        alt: 'Inside the A10tion To Detail mobile unit',
        label: 'Inside the van',
        caption: 'Our mobile unit, fully equipped',
    },
    {
        src: vanInterior2,
        alt: 'Equipment and supplies stored inside the A10tion To Detail van',
        label: 'Everything in its place',
        caption: 'Professional gear, ready to roll to your door',
    },
];

function GalleryTile({ item, index, onOpen, className = '', imgClassName = '', priority = false }) {
    return (
        <button
            type='button'
            onClick={() => onOpen(index)}
            aria-label={`Open image: ${item.label}`}
            className={`group relative block overflow-hidden bg-canvasoft text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-sage ${className}`}
        >
            <img
                src={item.src}
                alt={item.alt}
                className={`w-full transition-transform duration-700 ease-out group-hover:scale-[1.04] ${imgClassName}`}
                loading={priority ? 'eager' : 'lazy'}
                decoding='async'
                sizes='(max-width: 768px) 100vw, 50vw'
                draggable={false}
            />

            <div className='pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-black/0 to-transparent opacity-80 transition-opacity duration-300 group-hover:opacity-100' />

            <span className='pointer-events-none absolute left-2.5 bottom-2.5 inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-black/35 px-2.5 py-1 text-[8.5px] font-semibold uppercase tracking-[0.14em] text-white backdrop-blur-md sm:left-3 sm:bottom-3 sm:text-[9.5px]'>
                <span className='size-1 rounded-full bg-[#9abd9f]' />
                {item.label}
            </span>

            <span className='pointer-events-none absolute right-2.5 top-2.5 grid size-7 place-items-center rounded-full border border-white/20 bg-black/35 text-white opacity-0 backdrop-blur-md transition-all duration-300 group-hover:opacity-100 sm:right-3 sm:top-3'>
                <Maximize2 className='size-3' />
            </span>
        </button>
    );
}

function Lightbox({ index, onClose, onPrev, onNext }) {
    const item = gallery[index];

    return (
        <div
            role='dialog'
            aria-modal='true'
            aria-label='Image gallery'
            className='fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/90 p-4 backdrop-blur-sm sm:p-8'
            onClick={onClose}
        >
            <button
                type='button'
                onClick={onClose}
                aria-label='Close gallery'
                className='absolute right-4 top-4 grid size-10 place-items-center rounded-full border border-white/15 bg-white/10 text-white transition hover:bg-white/20 sm:right-6 sm:top-6'
            >
                <X className='size-5' />
            </button>

            <button
                type='button'
                onClick={(e) => {
                    e.stopPropagation();
                    onPrev();
                }}
                aria-label='Previous image'
                className='absolute left-3 top-1/2 z-10 grid size-10 -translate-y-1/2 place-items-center rounded-full border border-white/15 bg-white/10 text-white transition hover:bg-white/20 sm:left-6'
            >
                <ChevronLeft className='size-5' />
            </button>

            <button
                type='button'
                onClick={(e) => {
                    e.stopPropagation();
                    onNext();
                }}
                aria-label='Next image'
                className='absolute right-3 top-1/2 z-10 grid size-10 -translate-y-1/2 place-items-center rounded-full border border-white/15 bg-white/10 text-white transition hover:bg-white/20 sm:right-6'
            >
                <ChevronRight className='size-5' />
            </button>

            <figure className='flex max-h-full max-w-5xl flex-col items-center' onClick={(e) => e.stopPropagation()}>
                <img
                    key={item.src}
                    src={item.src}
                    alt={item.alt}
                    className='max-h-[76vh] w-auto max-w-full rounded-[14px] object-contain shadow-[0_30px_80px_-20px_rgba(0,0,0,.8)]'
                    draggable={false}
                />
                <figcaption className='mt-4 text-center'>
                    <p className='text-[12px] font-semibold text-white sm:text-[13px]'>{item.caption}</p>
                    <p className='mt-1 text-[10px] tracking-[0.14em] text-white/50'>
                        {index + 1} / {gallery.length}
                    </p>
                </figcaption>
            </figure>
        </div>
    );
}

export default function AboutSection() {
    const ref = useReveal();
    const [open, setOpen] = useState(false);
    const [active, setActive] = useState(null);

    const close = useCallback(() => setActive(null), []);
    const prev = useCallback(() => setActive((i) => (i === null ? i : (i - 1 + gallery.length) % gallery.length)), []);
    const next = useCallback(() => setActive((i) => (i === null ? i : (i + 1) % gallery.length)), []);

    useEffect(() => {
        if (active === null) return undefined;

        const onKey = (e) => {
            if (e.key === 'Escape') close();
            if (e.key === 'ArrowLeft') prev();
            if (e.key === 'ArrowRight') next();
        };

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        window.addEventListener('keydown', onKey);

        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener('keydown', onKey);
        };
    }, [active, close, prev, next]);

    return (
        <section id='about' className='px-3 pt-8 sm:px-4 sm:pt-10 md:px-8 lg:px-10 lg:pt-12'>
            <div ref={ref} className='reveal mx-auto grid max-w-7xl gap-4 sm:gap-5 lg:grid-cols-[1fr_1fr] lg:items-center lg:gap-7'>
                {/* Gallery */}
                <div className='grid grid-cols-2 gap-2 sm:gap-3'>
                    <GalleryTile
                        item={gallery[0]}
                        index={0}
                        onOpen={setActive}
                        priority
                        className='col-span-2 rounded-[18px] sm:rounded-[22px]'
                        imgClassName='h-auto object-contain'
                    />
                    <GalleryTile
                        item={gallery[1]}
                        index={1}
                        onOpen={setActive}
                        className='rounded-[14px] sm:rounded-[18px]'
                        imgClassName='aspect-[4/3] h-full object-cover'
                    />
                    <GalleryTile
                        item={gallery[2]}
                        index={2}
                        onOpen={setActive}
                        className='rounded-[14px] sm:rounded-[18px]'
                        imgClassName='aspect-[4/3] h-full object-cover'
                    />
                </div>

                {/* Copy */}
                <div className='text-center lg:text-left'>
                    <p className='inline-flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[0.16em] text-sage sm:text-[10px]'>
                        <span className='h-px w-5 bg-sage' /> About Us
                    </p>

                    <h2 className='mt-1.5 font-display text-[24px] font-medium leading-[1.08] tracking-[-0.025em] text-ink sm:text-[31px] lg:text-[35px]'>
                        Started in one driveway.
                        <span className='block text-sagedeep'>Built on doing it properly.</span>
                    </h2>

                    <p className='mx-auto mt-2.5 max-w-[620px] text-[10.5px] leading-[1.6] text-body sm:text-[12px] lg:mx-0'>
                        A10tion to Detail was born with one car, one drive way and a promise to never cut corners. Today we bring that same pride to your doorstep - Professional, convenient, and reliable. Our vision is to set a new standard for car washing.
                    </p>

                    <div className='mx-auto mt-3 max-w-[680px] overflow-hidden rounded-[16px] border border-[#6e8b76]/25 bg-[#152119] text-left shadow-[0_16px_40px_-30px_rgba(0,0,0,.75)] lg:mx-0'>
                        <button
                            type='button'
                            onClick={() => setOpen((current) => !current)}
                            className='group relative flex min-h-[46px] w-full items-center justify-between gap-3 overflow-hidden px-3.5 text-left sm:min-h-[50px] sm:px-4'
                            aria-expanded={open}
                        >
                            <span className='pointer-events-none absolute -right-9 top-0 h-full w-[110px] skew-x-[-22deg] bg-gradient-to-r from-transparent via-[#5f856c]/35 to-[#9abd9f]/70 transition-all duration-300 group-hover:w-[140px]' />
                            <span className='relative z-10 text-[11px] font-bold text-[#eef6f0] sm:text-[12px]'>Who we are</span>
                            <span className='relative z-10 grid size-7 place-items-center rounded-full border border-white/10 bg-white/[0.05] text-[#d7e8db]'>
                                <ChevronDown className={`size-3.5 transition-transform duration-300 ${open ? 'rotate-180' : ''}`} />
                            </span>
                        </button>

                        <div className={`grid transition-[grid-template-rows] duration-300 ease-out ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                            <div className='overflow-hidden'>
                                <div className='grid gap-px border-t border-white/10 bg-white/10 sm:grid-cols-2'>
                                    {aboutItems.map((item) => (
                                        <div key={item.title} className='bg-[#18251d] px-3.5 py-3 sm:px-4 sm:py-3.5'>
                                            <p className='text-[10px] font-semibold text-[#cfe2d2] sm:text-[10.5px]'>{item.title}</p>
                                            <p className='mt-1 text-[9.5px] leading-[1.5] text-white/65 sm:text-[10.5px]'>{item.description}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className='mx-auto mt-6 flex max-w-7xl items-center gap-3 sm:mt-8'>
                <span className='h-px flex-1 bg-line' />
                <Droplet className='size-3 text-sage/55' fill='currentColor' />
                <span className='h-px flex-1 bg-line' />
            </div>

            {active !== null && <Lightbox index={active} onClose={close} onPrev={prev} onNext={next} />}
        </section>
    );
}