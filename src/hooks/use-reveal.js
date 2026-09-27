import { useEffect, useRef } from 'react';

/**
 * Attaches an IntersectionObserver to the returned ref and adds the
 * `.in` class (see `.reveal` in index.css) once the element scrolls
 * into view. Reusable across any section that wants a gentle fade/rise.
 */
export default function useReveal(threshold = 0.12) {
    const ref = useRef(null);

    useEffect(() => {
        const node = ref.current;
        if (!node) return;

        const io = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('in');
                    io.unobserve(entry.target);
                }
            },
            { threshold },
        );

        io.observe(node);
        return () => io.disconnect();
    }, [threshold]);

    return ref;
}
