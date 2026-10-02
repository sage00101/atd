import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'a10tion-cookie-consent';
const OPEN_SETTINGS_EVENT = 'a10tion-open-cookie-settings';
const CONSENT_UPDATED_EVENT = 'a10tion-cookie-consent-updated';
const GA_MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID || '';

function readStoredConsent() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

function writeStoredConsent(consent) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(consent));
    } catch {
        // Consent still applies for this session if storage is unavailable.
    }
}

/** Injects Google Analytics only once, and only after analytics consent is granted. */
function loadAnalytics() {
    if (!GA_MEASUREMENT_ID || window.__a10tionAnalyticsLoaded) return;
    window.__a10tionAnalyticsLoaded = true;

    const script = document.createElement('script');
    script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
    script.async = true;
    document.head.appendChild(script);

    window.dataLayer = window.dataLayer || [];
    function gtag() { window.dataLayer.push(arguments); }
    window.gtag = gtag;
    gtag('js', new Date());
    gtag('config', GA_MEASUREMENT_ID, { anonymize_ip: true });
}

/** Revokes analytics storage via Consent Mode so gtag (if present) stops collecting data. */
function revokeAnalytics() {
    if (typeof window.gtag === 'function') {
        window.gtag('consent', 'update', { analytics_storage: 'denied' });
    }
}

function applyConsent(consent) {
    if (consent?.analytics) loadAnalytics();
    else revokeAnalytics();
}

/** Drives the cookie banner/preferences UI and persists the visitor's choice. */
export default function useCookieConsent() {
    const [consent, setConsent] = useState(readStoredConsent);
    const [bannerOpen, setBannerOpen] = useState(() => !readStoredConsent());
    const [settingsOpen, setSettingsOpen] = useState(false);

    useEffect(() => {
        if (consent) applyConsent(consent);
    }, []);

    useEffect(() => {
        const openSettings = () => setSettingsOpen(true);
        window.addEventListener(OPEN_SETTINGS_EVENT, openSettings);
        return () => window.removeEventListener(OPEN_SETTINGS_EVENT, openSettings);
    }, []);

    const saveConsent = useCallback((next) => {
        const record = { ...next, necessary: true, consentedAt: new Date().toISOString() };
        writeStoredConsent(record);
        setConsent(record);
        applyConsent(record);
        setBannerOpen(false);
        setSettingsOpen(false);
        window.dispatchEvent(new CustomEvent(CONSENT_UPDATED_EVENT, { detail: record }));
    }, []);

    const acceptAll = useCallback(() => saveConsent({ analytics: true }), [saveConsent]);
    const rejectNonEssential = useCallback(() => saveConsent({ analytics: false }), [saveConsent]);

    return {
        consent,
        bannerOpen,
        settingsOpen,
        openSettings: () => setSettingsOpen(true),
        closeSettings: () => setSettingsOpen(false),
        acceptAll,
        rejectNonEssential,
        saveConsent,
    };
}
