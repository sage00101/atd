import { useEffect, useState } from 'react';

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
import BookingRequestStatusPage from './sections/booking-request-status';

export default function App() {
    const [vacanciesOpen, setVacanciesOpen] = useState(false);

    useEffect(() => {
        try {
            window.localStorage.removeItem('a10tion-active-booking-request');
        } catch (error) {
            console.warn('Could not clear the retired booking-request state.', error);
        }
    }, []);

    const params = new URLSearchParams(window.location.search);
    if (params.has('booking-request') || params.has('booking-continuation')) {
        return <BookingRequestStatusPage />;
    }

    if (params.get('monthly-checkout') === '1') {
        return <MonthlyCheckoutPage />;
    }

    return (
        <>
            <LenisScroll />
            <Navbar onOpenVacancies={() => setVacanciesOpen(true)} />
            <main>
                <HeroSection />
                <AboutSection />
                <GallerySection />
                <PricingSection />
                <BookingSection />
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
