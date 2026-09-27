import useReveal from '../hooks/use-reveal';

export default function SectionTitle({ eyebrow, title, description, align = 'center' }) {
    const ref = useReveal();
    const isCenter = align === 'center';

    return (
        <div ref={ref} className={`reveal flex flex-col ${isCenter ? 'mx-auto max-w-xl items-center text-center' : 'max-w-lg items-start text-left'}`}>
            {eyebrow && (
                <p className='inline-flex items-center gap-2 text-[12.5px] font-semibold uppercase tracking-[0.14em] text-sage'>
                    <span className='h-px w-6 bg-sage' />
                    {eyebrow}
                    {isCenter && <span className='h-px w-6 bg-sage' />}
                </p>
            )}
            <h2 className='mt-4 font-display text-[28px] font-medium leading-tight sm:text-[42px]'>{title}</h2>
            {description && <p className='mt-4 max-w-lg text-[13px] leading-6 text-body sm:text-[15px] sm:leading-7'>{description}</p>}
        </div>
    );
}
