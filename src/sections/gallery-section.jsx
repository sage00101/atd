import SectionTitle from '../components/section-title';
import BeforeAfterSlider from '../components/before-after-slider';
import useReveal from '../hooks/use-reveal';
import exteriorAfter from '../assets/images/eafter.png';
import exteriorBefore from '../assets/images/ebefore.png';
import interiorAfter from '../assets/images/iafter.png';
import interiorBefore from '../assets/images/ibefore.png';

const pairs = [
    {
        before: exteriorAfter,
        beforeAlt: 'Before: exterior detail preparation',
        after: exteriorBefore,
        afterAlt: 'After: completed exterior detail',
        caption: 'Exterior',
    },
    {
        before: interiorAfter,
        beforeAlt: 'Before: interior mid-clean',
        after: interiorBefore,
        afterAlt: 'After: glossy conditioned dashboard and leather',
        caption: 'Interior',
    },
];

function GalleryItem({ pair }) {
    const ref = useReveal();
    return (
        <div
            ref={ref}
            className='reveal mx-auto w-full max-w-[320px] md:max-w-none'
        >
            <BeforeAfterSlider before={pair.before} beforeAlt={pair.beforeAlt} after={pair.after} afterAlt={pair.afterAlt} />
            <p className='mt-3 text-[13px] font-medium text-ink sm:text-sm'>{pair.caption}</p>
            <p className='text-[11.5px] text-body sm:text-[12.5px]'>{pair.note}</p>
        </div>
    );
}

export default function GallerySection() {
    return (
        <section id='gallery' className='px-4 pt-20 sm:pt-24 md:px-8 lg:px-10 lg:pt-28'>
            <div className='mx-auto max-w-6xl'>
                <SectionTitle eyebrow='Before & after' title='Drag to see the difference' description='A small sample of recent work - swipe the divider on each pair.' />

                <div className='mt-9 grid gap-6 sm:mt-10 md:grid-cols-2 md:gap-5 lg:gap-6'>
                    {pairs.map((pair) => (
                        <GalleryItem key={pair.caption} pair={pair} />
                    ))}
                </div>
            </div>
        </section>
    );
}