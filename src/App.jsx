import { useState } from 'react';

import LenisScroll from './components/lenis-scroll';
import Navbar from './components/navbar';
import Footer from './components/footer';
import VacancyModal from './components/vacancy-modal';
import CookieConsent from './components/cookie-consent';
import HeroSection from './sections/hero-section';
import AboutSection from './sections/about-section';
import PricingSection from './sections/pricing-section';
import GallerySection from './sections/gallery-section';
import BookingSection from './sections/booking-section';
import ReviewsSection from './sections/reviews-section';
import ContactSection from './sections/contact-section';
import PromoSection from './sections/promo-section';
import FaqSection from './sections/faq-section';
import MonthlyCheckoutPage from './sections/monthly-checkout-page';
import BookingRequestPage from './sections/booking-request-page';
import useBookingRequest from './hooks/use-booking-request';

export default function App() {
    const [vacanciesOpen, setVacanciesOpen] = useState(false);
    const bookingRequest = useBookingRequest();

    if (new URLSearchParams(window.location.search).get('monthly-checkout') === '1') {
        return <MonthlyCheckoutPage bookingRequest={bookingRequest} />;
    }
    if (new URLSearchParams(window.location.search).has('booking-request')) {
        return <BookingRequestPage />;
    }

    return (
        <>
            <LenisScroll />
            <Navbar
                onOpenVacancies={() => setVacanciesOpen(true)}
                bookingRequest={bookingRequest}
            />
            <main>
                <HeroSection />
                <AboutSection />
                <GallerySection />
                <PricingSection />
                <BookingSection bookingRequest={bookingRequest} />
                <ReviewsSection />
                <FaqSection />
                <PromoSection />
                <ContactSection />
            </main>
            <Footer onOpenVacancies={() => setVacanciesOpen(true)} />
            <VacancyModal
                open={vacanciesOpen}
                onClose={() => setVacanciesOpen(false)}
            />
            <CookieConsent />
        </>
    );
}
