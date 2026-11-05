const STORAGE_KEY = 'a10tion-tracked-booking-request';
export const TRACKER_EVENT = 'a10tion-booking-request-tracked';

export function readTrackedRequest() {
    try {
        const value = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || 'null');
        return value?.statusToken ? value : null;
    } catch {
        return null;
    }
}

export function writeTrackedRequest(value) {
    try {
        if (value) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
        else window.localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
        console.warn('Could not save the booking request tracker.', error);
    }
}

/** Remembers a freshly submitted request so the site can show its live status. */
export function trackSubmittedRequest({ reference, statusUrl }) {
    let statusToken = '';
    try {
        statusToken = new URL(statusUrl).searchParams.get('booking-request') || '';
    } catch {
        return;
    }
    if (!statusToken) return;
    writeTrackedRequest({ statusToken, reference, dismissedStatus: '' });
    window.dispatchEvent(new Event(TRACKER_EVENT));
}
