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

export default function App() {
    const [vacanciesOpen, setVacanciesOpen] = useState(false);

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
