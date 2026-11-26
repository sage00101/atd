export const WEEKDAY_BOOKING_TIMES = ['09:30', '12:00', '14:30', '16:00', '18:30'];
export const SATURDAY_BOOKING_TIMES = ['09:00', '11:30', '13:30'];
export const DATE_BOOKING_TIME_ADDITIONS = {
    '2026-11-26': ['09:00', '11:30', '14:00', '16:30', '19:00'],
};
export const BOOKING_SLOT_TIMES = [...new Set([
    ...WEEKDAY_BOOKING_TIMES,
    ...SATURDAY_BOOKING_TIMES,
    ...Object.values(DATE_BOOKING_TIME_ADDITIONS).flat(),
])];

function getDayOfWeek(date) {
    if (date instanceof Date) {
        return Number.isNaN(date.getTime()) ? -1 : date.getDay();
    }

    const dateText = String(date || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateText)) return -1;
    const parsedDate = new Date(`${dateText}T00:00:00.000Z`);
    if (Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== dateText) return -1;
    return parsedDate.getUTCDay();
}

export function isBookableBookingDate(date) {
    const day = getDayOfWeek(date);
    return day >= 1 && day <= 6;
}

export function getBookingTimesForDate(date) {
    const dateKey = date instanceof Date
        ? (Number.isNaN(date.getTime())
            ? ''
            : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`)
        : String(date || '');
    const day = getDayOfWeek(date);
    const regularTimes = day === 6
        ? SATURDAY_BOOKING_TIMES
        : day >= 1 && day <= 5
            ? WEEKDAY_BOOKING_TIMES
            : [];
    const additionalTimes = DATE_BOOKING_TIME_ADDITIONS[dateKey] || [];
    return [...new Set([...regularTimes, ...additionalTimes])].sort();
}

export function isBookableBookingTime(date, time) {
    return getBookingTimesForDate(date).includes(time);
}
