import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'a10tion-active-booking-request';
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
const REQUEST_ENDPOINT = `${API_BASE_URL}/api/bookings/requests`;
const TERMINAL_STATUSES = new Set(['cancelled', 'declined', 'confirmed', 'expired']);
const STATUS_UNAVAILABLE_MESSAGE = 'The booking status is temporarily unavailable. Your request is still saved here; please try again shortly.';

function readStoredRequest() {
    try {
        const request = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || 'null');
        return request?.reference && request?.token && request?.continuationUrl ? request : null;
    } catch {
        return null;
    }
}

function clearStoredRequest() {
    try {
        window.localStorage.removeItem(STORAGE_KEY);
    } catch {
        // The in-memory state is still cleared if browser storage is unavailable.
    }
}

export default function useBookingRequest() {
    const [request, setRequest] = useState(readStoredRequest);
    const [statusError, setStatusError] = useState('');
    const [isCancelling, setIsCancelling] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isPanelOpen, setIsPanelOpen] = useState(false);

    const clearRequest = useCallback(() => {
        clearStoredRequest();
        setRequest(null);
        setStatusError('');
    }, []);

    const saveRequest = useCallback((result, details = {}) => {
        const continuationUrl = result?.continuationUrl;
        if (!result?.reference || !continuationUrl) {
            throw new Error('The request was submitted, but its secure status link is missing. Please contact the business.');
        }
        const link = new URL(continuationUrl, window.location.origin);
        const stored = {
            reference: result.reference,
            token: link.searchParams.get('token') || '',
            continuationUrl: link.toString(),
            status: 'pending',
            canCancel: true,
            notificationSent: result.notificationSent !== false,
            ...details,
        };
        if (!stored.token) {
            throw new Error('The request was submitted, but its secure status token is missing. Please contact the business.');
        }
        try {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
        } catch {
            setStatusError('Your browser could not save this request between visits. Keep the secure status link from your email.');
        }
        setRequest(stored);
        setIsPanelOpen(true);
        return stored;
    }, []);

    const refreshStatus = useCallback(async (activeRequest) => {
        const url = new URL(REQUEST_ENDPOINT, window.location.origin);
        url.searchParams.set('reference', activeRequest.reference);
        url.searchParams.set('token', activeRequest.token);
        const response = await fetch(url, { cache: 'no-store' });
        if (response.status === 404) {
            clearRequest();
            return;
        }
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.message || 'The booking status could not be refreshed.');
        if (TERMINAL_STATUSES.has(result.status)) {
            clearRequest();
            return;
        }
        const updated = { ...activeRequest, ...result };
        try {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        } catch {
            // Keep the latest status in memory if storage is unavailable.
        }
        setRequest(updated);
        setStatusError('');
    }, [clearRequest]);

    useEffect(() => {
        if (!request?.reference || !request?.token) return undefined;
        let active = true;
        const refresh = async () => {
            try {
                await refreshStatus(request);
            } catch (error) {
                if (active) setStatusError(error instanceof TypeError ? STATUS_UNAVAILABLE_MESSAGE : error.message || 'The booking status could not be refreshed.');
            }
        };
        refresh();
        const timer = window.setInterval(refresh, 12_000);
        const handleFocus = () => refresh();
        window.addEventListener('focus', handleFocus);
        return () => {
            active = false;
            window.clearInterval(timer);
            window.removeEventListener('focus', handleFocus);
        };
    }, [request?.reference, request?.token, refreshStatus]);

    const cancelRequest = useCallback(async () => {
        const canCancel = request && (request.canCancel ?? request.status === 'pending');
        if (!request || !canCancel || isCancelling) return;
        setIsCancelling(true);
        setStatusError('');
        try {
            const response = await fetch(REQUEST_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'cancel',
                    reference: request.reference,
                    token: request.token,
                }),
            });
            const result = await response.json().catch(() => ({}));
            if (response.status === 409) {
                await refreshStatus(request);
                return;
            }
            if (!response.ok) throw new Error(result.message || 'Your booking request could not be cancelled.');
            if (result.status === 'cancelled' || result.status === 'expired') {
                clearRequest();
                return;
            }
            throw new Error('The booking request was not cancelled. Please refresh its status and try again.');
        } catch (error) {
            setStatusError(error instanceof TypeError ? 'We could not reach the booking service. Your request is unchanged; please try cancelling again shortly.' : error.message || 'Your booking request could not be cancelled.');
        } finally {
            setIsCancelling(false);
        }
    }, [clearRequest, isCancelling, refreshStatus, request]);

    const refresh = useCallback(async () => {
        if (!request) return;
        if (isRefreshing) return;
        setIsRefreshing(true);
        try {
            await refreshStatus(request);
        } catch (error) {
            setStatusError(error instanceof TypeError ? STATUS_UNAVAILABLE_MESSAGE : error.message || 'The booking status could not be refreshed.');
        } finally {
            setIsRefreshing(false);
        }
    }, [isRefreshing, refreshStatus, request]);

    const openPanel = useCallback(() => setIsPanelOpen(true), []);
    const closePanel = useCallback(() => setIsPanelOpen(false), []);

    return {
        request,
        statusError,
        isCancelling,
        isRefreshing,
        isPanelOpen,
        saveRequest,
        cancelRequest,
        refresh,
        openPanel,
        closePanel,
    };
}
