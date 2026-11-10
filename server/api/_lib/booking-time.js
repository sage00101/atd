export const MIN_LEAD_TIME_MS = 60 * 60 * 1000;

export function hasMinimumBookingNotice(date, time, now = Date.now()) {
    const slot = new Date(`${date}T${time}:00+02:00`).getTime();
    return Number.isFinite(slot) && slot - now >= MIN_LEAD_TIME_MS;
}
