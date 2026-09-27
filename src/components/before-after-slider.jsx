import { useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function BeforeAfterSlider({ before, after, beforeAlt, afterAlt }) {
    const containerRef = useRef(null);
    const [position, setPosition] = useState(50);
    const dragging = useRef(false);

    const setFromClientX = (clientX) => {
        const rect = containerRef.current.getBoundingClientRect();
        const pct = ((clientX - rect.left) / rect.width) * 100;
        setPosition(Math.max(0, Math.min(100, pct)));
    };

    const start = (clientX) => {
        dragging.current = true;
        setFromClientX(clientX);
    };
    const move = (clientX) => {
        if (dragging.current) setFromClientX(clientX);
    };
    const stop = () => {
        dragging.current = false;
    };

    return (
        <div
            ref={containerRef}
            className='compare relative h-52 select-none overflow-hidden rounded-[20px] sm:h-96 sm:rounded-4xl'
            style={{ cursor: 'ew-resize', touchAction: 'none' }}
            onMouseDown={(e) => start(e.clientX)}
            onMouseMove={(e) => move(e.clientX)}
            onMouseUp={stop}
            onMouseLeave={stop}
            onTouchStart={(e) => start(e.touches[0].clientX)}
            onTouchMove={(e) => move(e.touches[0].clientX)}
            onTouchEnd={stop}
        >
            <img src={before} alt={beforeAlt} className='block h-full w-full object-cover' draggable={false} loading='lazy' decoding='async' sizes='(max-width: 768px) 100vw, 50vw' />
            <div className='absolute inset-0' style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}>
                <img src={after} alt={afterAlt} className='block h-full w-full object-cover' draggable={false} loading='lazy' decoding='async' sizes='(max-width: 768px) 100vw, 50vw' />
            </div>

            <span className='tag-label absolute left-3 top-3 rounded-full bg-ink/55 px-2 py-0.5 text-[9px] tracking-wide text-white backdrop-blur-sm sm:left-4 sm:top-4 sm:px-2.5 sm:py-1 sm:text-[11px]'>Before</span>
            <span className='tag-label absolute right-3 top-3 rounded-full bg-ink/55 px-2 py-0.5 text-[9px] tracking-wide text-white backdrop-blur-sm sm:right-4 sm:top-4 sm:px-2.5 sm:py-1 sm:text-[11px]'>After</span>

            <div className='pointer-events-none absolute top-0 bottom-0 w-0.5 bg-white' style={{ left: `${position}%`, transform: 'translateX(-50%)' }}>
                <div className='absolute top-1/2 left-1/2 flex size-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center gap-0.5 rounded-full bg-white text-sage shadow-[0_4px_14px_rgba(20,26,22,.25)] sm:size-10'>
                    <ChevronLeft className='size-2.5 sm:size-3' />
                    <ChevronRight className='size-2.5 sm:size-3' />
                </div>
            </div>
        </div>
    );
}
