import {
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';

import {
    ArrowLeft,
    ArrowRight,
    ArrowUpRight,
    CheckCircle2,
    MessageSquareText,
    Quote,
    Star,
} from 'lucide-react';

import useReveal from '../hooks/use-reveal';


const REVIEWS_PER_PAGE = 3;
const MAX_REVIEWS = 12;
const SWIPE_THRESHOLD_TOUCH = 38;
const SWIPE_THRESHOLD_MOUSE = 28;

const GOOGLE_REVIEWS_ENDPOINT =
    `/api/google-reviews?limit=${MAX_REVIEWS}`;

const GOOGLE_REVIEW_URL =
    import.meta.env.VITE_GOOGLE_REVIEW_URL || '';

const GOOGLE_BUSINESS_URL =
    import.meta.env.VITE_GOOGLE_BUSINESS_URL || '';


const fallbackReviews = [
    {
        id: 'naledi-k',
        initial: 'N',
        name: 'Naledi K.',
        date: '2 weeks ago',
        quote: 'Booked the Signature Detail for a work trip send-off. They arrived on time with everything needed and the paint genuinely looked wet afterwards.',
        rating: 5,
        photo: '',
    },
    {
        id: 'ryan-p',
        initial: 'R',
        name: 'Ryan P.',
        date: '1 month ago',
        quote: "First mobile detailer I've used that actually hand-washes. No swirl marks anywhere, and the interior smelled properly clean, not just perfumed.",
        rating: 5,
        photo: '',
    },
    {
        id: 'aisha-m',
        initial: 'A',
        name: 'Aisha M.',
        date: '6 weeks ago',
        quote: "Booked Full Reconditioning on a car I'd neglected for two years. Headlights look new and the engine bay is spotless. Worth every rand.",
        rating: 5,
        photo: '',
    },
];


const demoReviews = [
    {
        id: 'demo-01',
        initial: 'D',
        name: 'Demo Client 01',
        date: 'Demo review',
        quote: 'Temporary review for checking the second page of the review slider and drag navigation.',
        rating: 5,
        photo: '',
    },
    {
        id: 'demo-02',
        initial: 'D',
        name: 'Demo Client 02',
        date: 'Demo review',
        quote: 'Temporary development content used to test the review carousel on desktop and mobile.',
        rating: 5,
        photo: '',
    },
    {
        id: 'demo-03',
        initial: 'D',
        name: 'Demo Client 03',
        date: 'Demo review',
        quote: 'This temporary review confirms that three reviews are displayed together on each page.',
        rating: 4,
        photo: '',
    },
    {
        id: 'demo-04',
        initial: 'D',
        name: 'Demo Client 04',
        date: 'Demo review',
        quote: 'Testing swipe-left navigation between groups of customer reviews on smaller screens.',
        rating: 5,
        photo: '',
    },
    {
        id: 'demo-05',
        initial: 'D',
        name: 'Demo Client 05',
        date: 'Demo review',
        quote: 'Temporary review for testing click-and-drag behaviour with a mouse on desktop.',
        rating: 5,
        photo: '',
    },
    {
        id: 'demo-06',
        initial: 'D',
        name: 'Demo Client 06',
        date: 'Demo review',
        quote: 'Development-only content for checking pagination, arrows and responsive card layouts.',
        rating: 5,
        photo: '',
    },
    {
        id: 'demo-07',
        initial: 'D',
        name: 'Demo Client 07',
        date: 'Demo review',
        quote: 'Another temporary review to demonstrate the maximum-page behaviour.',
        rating: 5,
        photo: '',
    },
    {
        id: 'demo-08',
        initial: 'D',
        name: 'Demo Client 08',
        date: 'Demo review',
        quote: 'Temporary review used to check that page four can be reached by arrow, swipe or drag.',
        rating: 4,
        photo: '',
    },
    {
        id: 'demo-09',
        initial: 'D',
        name: 'Demo Client 09',
        date: 'Demo review',
        quote: 'Development-only content confirming that the twelve-review maximum displays correctly.',
        rating: 5,
        photo: '',
    },
];


const initialReviews = import.meta.env.DEV
    ? [...fallbackReviews, ...demoReviews].slice(0, MAX_REVIEWS)
    : fallbackReviews;


const ratingValues = {
    ONE: 1,
    TWO: 2,
    THREE: 3,
    FOUR: 4,
    FIVE: 5,
};


function readableDate(value) {
    if (!value) return 'Google review';

    const parsedDate = new Date(value);

    if (Number.isNaN(parsedDate.getTime())) {
        return value;
    }

    return new Intl.DateTimeFormat('en-ZA', {
        month: 'short',
        year: 'numeric',
    }).format(parsedDate);
}


function normaliseReview(review, index) {
    const reviewerName =
        review?.reviewer?.displayName ||
        review?.authorName ||
        review?.author_name ||
        review?.name ||
        'Google customer';

    const rawRating =
        review?.starRating ?? review?.rating ?? 5;

    const rating =
        typeof rawRating === 'string'
            ? ratingValues[rawRating] || Number(rawRating) || 5
            : Number(rawRating) || 5;

    const quote =
        review?.comment ||
        review?.text?.text ||
        (typeof review?.text === 'string' ? review.text : '') ||
        review?.quote ||
        '';

    const photo =
        review?.reviewer?.profilePhotoUrl ||
        review?.reviewer?.profilePhotoUri ||
        review?.profilePhotoUrl ||
        review?.profile_photo_url ||
        review?.authorAttribution?.photoUri ||
        review?.photo ||
        '';

    return {
        id:
            review?.reviewId ||
            review?.id ||
            `${reviewerName}-${index}`,
        initial:
            reviewerName.trim().charAt(0).toUpperCase() || 'G',
        name: reviewerName,
        date:
            review?.relativePublishTimeDescription ||
            review?.relativePublishTime ||
            review?.relative_time_description ||
            review?.date ||
            readableDate(
                review?.updateTime || review?.createTime
            ),
        quote,
        rating: Math.max(1, Math.min(5, rating)),
        photo,
    };
}


function Stars({ count = 5, compact = false }) {
    return (
        <div
            className='flex items-center gap-px'
            aria-label={`${count} out of 5 stars`}
        >
            {Array.from({ length: 5 }, (_, index) => (
                <Star
                    key={index}
                    className={`
                        ${compact ? 'h-2.5 w-2.5 sm:h-3 sm:w-3' : 'h-3 w-3 sm:h-3.5 sm:w-3.5'}
                        ${
                            index < count
                                ? 'fill-[#d2a85c] text-[#d2a85c]'
                                : 'fill-transparent text-[#d2a85c]/30'
                        }
                    `}
                    strokeWidth={1.8}
                    aria-hidden='true'
                />
            ))}
        </div>
    );
}


function ReviewerAvatar({ review }) {
    const [imageFailed, setImageFailed] = useState(false);

    if (review.photo && !imageFailed) {
        return (
            <img
                src={review.photo}
                alt=''
                loading='lazy'
                decoding='async'
                referrerPolicy='no-referrer'
                draggable={false}
                onError={() => setImageFailed(true)}
                className='h-8 w-8 shrink-0 rounded-full border border-[#d7e1d9] object-cover sm:h-9 sm:w-9'
            />
        );
    }

    return (
        <div className='grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#1d3426] text-[9px] font-semibold text-[#c8dbcd] sm:h-9 sm:w-9 sm:text-[10px]'>
            {review.initial}
        </div>
    );
}


function ReviewCard({ review }) {
    return (
        <article
            className='
                relative
                min-w-0
                overflow-hidden
                rounded-[13px]
                border
                border-[#dbe4dd]
                bg-white
                shadow-[0_12px_32px_-28px_rgba(19,49,29,.35)]
                transition-all
                duration-300
                hover:border-sage/35

                sm:rounded-[17px]
                sm:bg-gradient-to-br
                sm:from-white
                sm:via-white
                sm:to-[#edf4ef]
                sm:p-3.5
                sm:shadow-[0_18px_42px_-34px_rgba(19,49,29,.42)]
                sm:hover:-translate-y-0.5

                lg:p-4
            '
        >
            <div className='flex min-h-[62px] w-full min-w-0 items-center gap-2.5 px-3 py-2.5 sm:hidden'>
                <ReviewerAvatar review={review} />

                <div className='min-w-0 flex-1'>
                    <p className='line-clamp-2 text-[8.75px] leading-[1.45] text-[#4f5b54]'>
                        “{review.quote}”
                    </p>

                    <p className='mt-1 truncate text-[8.5px] font-semibold leading-none text-[#18221c]'>
                        {review.name}
                    </p>
                </div>
            </div>


            <div className='hidden sm:block'>
                <span className='pointer-events-none absolute -right-5 -top-7 h-20 w-20 rounded-full bg-[#a8c5af]/20 blur-xl' />

                <div className='relative flex items-center justify-between gap-2'>
                    <Stars count={review.rating} compact />
                    <Quote className='h-3.5 w-3.5 shrink-0 text-sage/50' />
                </div>

                <p
                    className='relative mt-2.5 line-clamp-4 text-[10.5px] leading-[1.55] text-body lg:text-[11px]'
                    title={review.quote}
                >
                    “{review.quote}”
                </p>

                <div className='relative mt-3 flex min-w-0 items-center gap-2.5 border-t border-[#dbe5dd] pt-2.5'>
                    <ReviewerAvatar review={review} />

                    <div className='min-w-0'>
                        <p className='truncate text-[10px] font-semibold text-ink'>
                            {review.name}
                        </p>
                        <p className='mt-px truncate text-[8.5px] text-body/65'>
                            {review.date}
                        </p>
                    </div>
                </div>
            </div>
        </article>
    );
}


export default function ReviewsSection() {
    const headerRef = useReveal();
    const commentRef = useReveal();

    const dragState = useRef({
        active: false,
        pointerId: null,
        pointerType: 'touch',
        startX: 0,
        startY: 0,
        lastX: 0,
        lastY: 0,
    });

    const [reviews, setReviews] = useState(initialReviews);
    const [currentPage, setCurrentPage] = useState(0);
    const [direction, setDirection] = useState('next');
    const [dragOffset, setDragOffset] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const [showGestureHint, setShowGestureHint] = useState(true);

    const [reviewSummary, setReviewSummary] = useState({
        averageRating: 5,
        totalReviewCount: initialReviews.length,
        isLive: false,
    });


    useEffect(() => {
        let active = true;
        let controller;

        const loadGoogleReviews = async () => {
            controller?.abort();
            controller = new AbortController();

            try {
                const response = await fetch(
                    GOOGLE_REVIEWS_ENDPOINT,
                    {
                        cache: 'no-store',
                        headers: {
                            Accept: 'application/json',
                        },
                        signal: controller.signal,
                    }
                );

                if (!response.ok) return;

                const result = await response.json();

                const liveReviews = (result?.reviews || [])
                    .map(normaliseReview)
                    .filter((review) => review.quote.trim())
                    .slice(0, MAX_REVIEWS);

                if (!active || liveReviews.length === 0) return;

                setReviews(liveReviews);
                setCurrentPage(0);

                const average =
                    liveReviews.reduce(
                        (total, review) => total + review.rating,
                        0
                    ) / liveReviews.length;

                setReviewSummary({
                    averageRating:
                        Number(result?.averageRating) || average,
                    totalReviewCount:
                        Number(result?.totalReviewCount) ||
                        liveReviews.length,
                    isLive: true,
                });
            } catch (error) {
                if (error?.name !== 'AbortError') {
                    // Keep fallback/demo content until live Google reviews are connected.
                }
            }
        };

        loadGoogleReviews();

        return () => {
            active = false;
            controller?.abort();
        };
    }, []);


    const pages = useMemo(() => {
        const limited = reviews.slice(0, MAX_REVIEWS);
        const result = [];

        for (
            let index = 0;
            index < limited.length;
            index += REVIEWS_PER_PAGE
        ) {
            result.push(
                limited.slice(index, index + REVIEWS_PER_PAGE)
            );
        }

        return result;
    }, [reviews]);


    const totalPages = Math.max(pages.length, 1);
    const visibleReviews = pages[currentPage] || [];


    useEffect(() => {
        if (currentPage > totalPages - 1) {
            setCurrentPage(Math.max(totalPages - 1, 0));
        }
    }, [currentPage, totalPages]);


    useEffect(() => {
        if (totalPages <= 1) {
            setShowGestureHint(false);
            return undefined;
        }

        setShowGestureHint(true);

        const timer = window.setTimeout(() => {
            setShowGestureHint(false);
        }, 4400);

        return () => window.clearTimeout(timer);
    }, [totalPages]);


    const goToPage = (page, nextDirection) => {
        if (
            page < 0 ||
            page >= totalPages ||
            page === currentPage
        ) {
            setDragOffset(0);
            return;
        }

        setDirection(nextDirection);
        setCurrentPage(page);
        setDragOffset(0);
        setShowGestureHint(false);
    };


    const previousPage = () => {
        goToPage(currentPage - 1, 'previous');
    };


    const nextPage = () => {
        goToPage(currentPage + 1, 'next');
    };


    const resetDrag = () => {
        dragState.current.active = false;
        dragState.current.pointerId = null;
        setDragOffset(0);
        setIsDragging(false);
    };


    const handlePointerDown = (event) => {
        if (totalPages <= 1) return;

        if (
            event.pointerType === 'mouse' &&
            event.button !== 0
        ) {
            return;
        }

        dragState.current = {
            active: true,
            pointerId: event.pointerId,
            pointerType: event.pointerType,
            startX: event.clientX,
            startY: event.clientY,
            lastX: event.clientX,
            lastY: event.clientY,
        };

        setIsDragging(true);

        try {
            event.currentTarget.setPointerCapture(
                event.pointerId
            );
        } catch {
            // Pointer capture is optional; dragging still works without it.
        }
    };


    const handlePointerMove = (event) => {
        const drag = dragState.current;

        if (
            !drag.active ||
            drag.pointerId !== event.pointerId
        ) {
            return;
        }

        drag.lastX = event.clientX;
        drag.lastY = event.clientY;

        const deltaX = drag.lastX - drag.startX;
        const deltaY = drag.lastY - drag.startY;

        if (
            event.pointerType !== 'mouse' &&
            Math.abs(deltaY) > Math.abs(deltaX)
        ) {
            return;
        }

        const resistance =
            (currentPage === 0 && deltaX > 0) ||
            (currentPage === totalPages - 1 && deltaX < 0)
                ? 0.22
                : 0.55;

        const nextOffset = Math.max(
            -110,
            Math.min(110, deltaX * resistance)
        );

        setDragOffset(nextOffset);
    };


    const finishPointerGesture = (event) => {
        const drag = dragState.current;

        if (
            !drag.active ||
            drag.pointerId !== event.pointerId
        ) {
            return;
        }

        const deltaX = event.clientX - drag.startX;
        const deltaY = event.clientY - drag.startY;

        const threshold =
            drag.pointerType === 'mouse'
                ? SWIPE_THRESHOLD_MOUSE
                : SWIPE_THRESHOLD_TOUCH;

        const horizontalGesture =
            Math.abs(deltaX) >= threshold &&
            Math.abs(deltaX) > Math.abs(deltaY) * 1.1;

        try {
            event.currentTarget.releasePointerCapture(
                event.pointerId
            );
        } catch {
            // Safe when the browser already released capture.
        }

        dragState.current.active = false;
        dragState.current.pointerId = null;
        setIsDragging(false);
        setShowGestureHint(false);

        if (!horizontalGesture) {
            setDragOffset(0);
            return;
        }

        if (deltaX < 0) {
            nextPage();
        } else {
            previousPage();
        }
    };


    const handlePointerCancel = () => {
        resetDrag();
    };


    const handleKeyDown = (event) => {
        if (event.key === 'ArrowLeft') {
            previousPage();
        }

        if (event.key === 'ArrowRight') {
            nextPage();
        }
    };


    const hasGoogleReviewLink = Boolean(GOOGLE_REVIEW_URL);
    const hasGoogleBusinessLink = Boolean(GOOGLE_BUSINESS_URL);

    const preventUnconfiguredLink = (event, configured) => {
        if (!configured) event.preventDefault();
    };


    return (
        <section
            id='reviews'
            className='px-3 pt-14 sm:px-4 sm:pt-16 md:px-8 lg:px-10 lg:pt-20'
        >
            <div className='mx-auto max-w-7xl overflow-hidden rounded-[22px] border border-[#d7e2d9] bg-gradient-to-br from-[#f8faf8] via-white to-[#e9f1eb] px-3 py-5 sm:rounded-[28px] sm:px-6 sm:py-7 lg:px-8 lg:py-8'>
                <div
                    ref={headerRef}
                    className='reveal flex flex-col items-center text-center'
                >
                    <p className='inline-flex items-center gap-2 text-[8.5px] font-semibold uppercase tracking-[0.17em] text-sage sm:text-[10px]'>
                        <span className='h-px w-5 bg-sage' />
                        Google reviews
                        <span className='h-px w-5 bg-sage' />
                    </p>

                    <h2 className='mt-1.5 font-display text-[25px] font-medium leading-[1.08] tracking-[-0.025em] text-ink sm:text-[32px] lg:text-[35px]'>
                        What clients notice first
                    </h2>

                    <div className='mt-3 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-full border border-[#cbdacd] bg-white/80 px-3 py-1.5 shadow-sm sm:mt-4 sm:px-4 sm:py-2'>
                        <p className='font-display text-[18px] font-medium text-ink sm:text-[21px]'>
                            {reviewSummary.averageRating.toFixed(1)}
                        </p>

                        <Stars
                            count={Math.round(
                                reviewSummary.averageRating
                            )}
                        />

                        <span className='text-[8.5px] text-body sm:text-[10px]'>
                            {reviewSummary.totalReviewCount} Google reviews
                        </span>

                        {reviewSummary.isLive && (
                            <CheckCircle2
                                className='h-3 w-3 text-sage'
                                aria-label='Live Google review data'
                            />
                        )}
                    </div>
                </div>


                {/* =================================================
                    POINTER-DRAG REVIEW AREA

                    Finger on phone/tablet.
                    Click + drag with mouse on desktop.
                    Vertical phone scrolling remains enabled.
                ================================================= */}

                <div className='relative mt-4 sm:mt-6'>
                    <div
                        className={`
                            absolute
                            -top-3
                            left-1/2
                            z-20
                            -translate-x-1/2
                            transition-all
                            duration-500

                            ${
                                showGestureHint && totalPages > 1
                                    ? 'translate-y-0 opacity-100'
                                    : '-translate-y-1 opacity-0'
                            }
                        `}
                    >
                        <div className='gesture-hint flex items-center gap-1.5 whitespace-nowrap rounded-full border border-[#ccdad0] bg-white/95 px-2.5 py-1 text-[7px] font-semibold uppercase tracking-[0.1em] text-[#607067] shadow-[0_8px_22px_-14px_rgba(20,45,28,.35)] backdrop-blur-md'>
                            <ArrowLeft className='h-2.5 w-2.5' />

                            <span className='sm:hidden'>
                                Swipe reviews
                            </span>

                            <span className='hidden sm:inline'>
                                Click + drag reviews
                            </span>

                            <ArrowRight className='h-2.5 w-2.5' />
                        </div>
                    </div>


                    <div
                        role='region'
                        aria-label='Customer review carousel'
                        tabIndex={0}
                        onPointerDown={handlePointerDown}
                        onPointerMove={handlePointerMove}
                        onPointerUp={finishPointerGesture}
                        onPointerCancel={handlePointerCancel}
                        onKeyDown={handleKeyDown}
                        onDragStart={(event) => event.preventDefault()}
                        className={`
                            touch-pan-y
                            select-none
                            outline-none
                            transition-[transform,opacity]
                            duration-150

                            ${
                                isDragging
                                    ? 'cursor-grabbing'
                                    : 'cursor-grab'
                            }
                        `}
                        style={{
                            transform: `translate3d(${dragOffset}px, 0, 0)`,
                            opacity: isDragging
                                ? Math.max(
                                      0.72,
                                      1 - Math.abs(dragOffset) / 420
                                  )
                                : 1,
                        }}
                    >
                        <div
                            key={currentPage}
                            className={`
                                review-page-enter
                                grid
                                grid-cols-1
                                gap-2
                                sm:grid-cols-3
                                sm:gap-3
                                lg:gap-3.5

                                ${
                                    direction === 'previous'
                                        ? 'review-from-left'
                                        : 'review-from-right'
                                }
                            `}
                        >
                            {visibleReviews.map((review) => (
                                <ReviewCard
                                    key={review.id}
                                    review={review}
                                />
                            ))}
                        </div>
                    </div>
                </div>


                <nav
                    className='mt-3 flex items-center justify-center gap-3 sm:mt-5 sm:gap-4'
                    aria-label='Review navigation'
                >
                    <button
                        type='button'
                        onClick={previousPage}
                        disabled={currentPage === 0}
                        aria-label='Previous reviews'
                        className='group grid h-8 w-8 place-items-center rounded-full border border-[#cad8cd] bg-white p-0 text-[#314b3a] shadow-sm transition-all duration-200 hover:-translate-x-[2px] hover:border-sage/50 hover:bg-[#f5f9f6] active:scale-[0.92] disabled:pointer-events-none disabled:opacity-25 sm:h-9 sm:w-9'
                    >
                        <ArrowLeft className='h-3.5 w-3.5 transition-transform group-hover:-translate-x-[1px]' strokeWidth={1.8} />
                    </button>


                    <div
                        className='flex min-w-[62px] items-center justify-center gap-1 rounded-full border border-[#d9e2db] bg-white px-3 py-1.5 text-[8px] font-semibold text-body shadow-sm sm:min-w-[70px] sm:text-[9px]'
                        aria-live='polite'
                    >
                        <span className='text-ink'>
                            {currentPage + 1}
                        </span>
                        <span className='text-body/35'>/</span>
                        <span>{totalPages}</span>
                    </div>


                    <button
                        type='button'
                        onClick={nextPage}
                        disabled={currentPage === totalPages - 1}
                        aria-label='Next reviews'
                        className='group grid h-8 w-8 place-items-center rounded-full border border-[#cad8cd] bg-white p-0 text-[#314b3a] shadow-sm transition-all duration-200 hover:translate-x-[2px] hover:border-sage/50 hover:bg-[#f5f9f6] active:scale-[0.92] disabled:pointer-events-none disabled:opacity-25 sm:h-9 sm:w-9'
                    >
                        <ArrowRight className='h-3.5 w-3.5 transition-transform group-hover:translate-x-[1px]' strokeWidth={1.8} />
                    </button>
                </nav>


                {totalPages > 1 && (
                    <div
                        className='mt-2 flex items-center justify-center gap-1'
                        aria-label='Review pages'
                    >
                        {Array.from({ length: totalPages }).map(
                            (_, index) => (
                                <button
                                    key={index}
                                    type='button'
                                    onClick={() =>
                                        goToPage(
                                            index,
                                            index > currentPage
                                                ? 'next'
                                                : 'previous'
                                        )
                                    }
                                    aria-label={`Show review page ${index + 1}`}
                                    aria-current={
                                        index === currentPage
                                            ? 'page'
                                            : undefined
                                    }
                                    className={`
                                        h-1.5
                                        rounded-full
                                        p-0
                                        transition-all
                                        duration-300

                                        ${
                                            index === currentPage
                                                ? 'w-5 bg-[#36543f]'
                                                : 'w-1.5 bg-[#b9c8bd] hover:bg-[#879b8d]'
                                        }
                                    `}
                                />
                            )
                        )}
                    </div>
                )}


                <div
                    ref={commentRef}
                    className='reveal relative mt-4 overflow-hidden rounded-[16px] bg-gradient-to-r from-[#17261d] via-[#21382a] to-[#31513c] px-3.5 py-3.5 text-center text-white sm:mt-6 sm:flex sm:items-center sm:justify-between sm:gap-5 sm:rounded-[20px] sm:px-5 sm:py-4 sm:text-left lg:px-6'
                >
                    <div className='relative min-w-0'>
                        <p className='flex items-center justify-center gap-1.5 text-[8px] font-semibold uppercase tracking-[0.14em] text-[#b8d2be] sm:justify-start sm:text-[9px]'>
                            <MessageSquareText className='h-3 w-3' />
                            Share your experience
                        </p>

                        <h3 className='mt-1 font-display text-[17px] font-medium leading-tight sm:text-[23px]'>
                            Had your vehicle detailed by us?
                        </h3>

                        <p className='mx-auto mt-1 max-w-md text-[8.5px] leading-[1.5] text-white/65 sm:mx-0 sm:text-[10px]'>
                            Continue with Google to leave a public review. Google handles sign-in, publishing and moderation securely.
                        </p>
                    </div>


                    <a
                        href={GOOGLE_REVIEW_URL || '#'}
                        target='_blank'
                        rel='noreferrer'
                        onClick={(event) =>
                            preventUnconfiguredLink(
                                event,
                                hasGoogleReviewLink
                            )
                        }
                        className={`
                            relative
                            mt-3
                            inline-flex
                            min-h-[37px]
                            shrink-0
                            items-center
                            justify-center
                            gap-2
                            rounded-full
                            px-4
                            text-[9.5px]
                            font-semibold
                            transition-all
                            sm:mt-0
                            sm:min-h-[41px]
                            sm:px-5
                            sm:text-[10.5px]

                            ${
                                hasGoogleReviewLink
                                    ? 'bg-white text-[#1d3426] hover:-translate-y-0.5 hover:bg-[#edf4ef]'
                                    : 'cursor-not-allowed bg-white/20 text-white/55'
                            }
                        `}
                        aria-disabled={!hasGoogleReviewLink}
                    >
                        <span className='grid h-5 w-5 place-items-center rounded-full bg-white text-[11px] font-bold text-[#4285f4] shadow-sm'>
                            G
                        </span>
                        Write a Google review
                        <ArrowUpRight className='h-3 w-3' />
                    </a>
                </div>


                <div className='mt-3 flex justify-center sm:mt-4'>
                    <a
                        href={GOOGLE_BUSINESS_URL || '#'}
                        target='_blank'
                        rel='noreferrer'
                        onClick={(event) =>
                            preventUnconfiguredLink(
                                event,
                                hasGoogleBusinessLink
                            )
                        }
                        className={`
                            inline-flex
                            items-center
                            gap-1.5
                            text-[8.5px]
                            font-semibold
                            transition
                            sm:text-[10px]

                            ${
                                hasGoogleBusinessLink
                                    ? 'text-sagedeep hover:text-ink'
                                    : 'cursor-not-allowed text-body/40'
                            }
                        `}
                        aria-disabled={!hasGoogleBusinessLink}
                    >
                        View the full Google Business Profile
                        <ArrowUpRight className='h-3 w-3' />
                    </a>
                </div>
            </div>


            <style>{`
                @keyframes reviewFromRight {
                    from {
                        opacity: 0;
                        transform: translateX(18px);
                    }
                    to {
                        opacity: 1;
                        transform: translateX(0);
                    }
                }

                @keyframes reviewFromLeft {
                    from {
                        opacity: 0;
                        transform: translateX(-18px);
                    }
                    to {
                        opacity: 1;
                        transform: translateX(0);
                    }
                }

                @keyframes gestureHint {
                    0%, 100% {
                        transform: translateX(0);
                    }
                    35% {
                        transform: translateX(-3px);
                    }
                    70% {
                        transform: translateX(3px);
                    }
                }

                .review-page-enter.review-from-right {
                    animation: reviewFromRight .38s cubic-bezier(.22,1,.36,1) both;
                }

                .review-page-enter.review-from-left {
                    animation: reviewFromLeft .38s cubic-bezier(.22,1,.36,1) both;
                }

                .gesture-hint {
                    animation: gestureHint 1.4s ease-in-out infinite;
                }

                @media (prefers-reduced-motion: reduce) {
                    .review-page-enter,
                    .gesture-hint {
                        animation: none !important;
                    }
                }
            `}</style>
        </section>
    );
}
