import { useState } from 'react';
import { ChevronDown, Droplet } from 'lucide-react';
import useReveal from '../hooks/use-reveal';
import aboutImage from '../assets/images/about.jpg';

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

export default function AboutSection() {
    const ref = useReveal();
    const [open, setOpen] = useState(false);

    return (
        <section id='about' className='px-3 pt-8 sm:px-4 sm:pt-10 md:px-8 lg:px-10 lg:pt-12'>
            <div ref={ref} className='reveal mx-auto grid max-w-7xl gap-4 sm:gap-5 lg:grid-cols-[1fr_1fr] lg:items-center lg:gap-7'>
                <div className='relative overflow-hidden rounded-[18px] bg-canvasoft sm:rounded-[22px]'>
                    <img
                        src={aboutImage}
                        alt='A10tion To Detail vehicle being hand washed'
                        className='h-auto w-full object-contain'
                        loading='lazy'
                        decoding='async'
                        sizes='(max-width: 768px) 100vw, 50vw'
                        draggable={false}
                    />
                    <div className='pointer-events-none absolute inset-0 bg-gradient-to-t from-black/10 via-transparent to-transparent' />
                </div>

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
        </section>
    );
}
