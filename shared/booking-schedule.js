export const WEEKDAY_BOOKING_TIMES = ['09:30', '12:00', '14:30', '16:00', '18:30'];
export const SATURDAY_BOOKING_TIMES = ['09:00', '11:30', '13:30'];
export const BOOKING_SLOT_TIMES = [...WEEKDAY_BOOKING_TIMES, ...SATURDAY_BOOKING_TIMES];

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
    const day = getDayOfWeek(date);
    if (day === 6) return SATURDAY_BOOKING_TIMES;
    if (day >= 1 && day <= 5) return WEEKDAY_BOOKING_TIMES;
    return [];
}

export function isBookableBookingTime(date, time) {
    return getBookingTimesForDate(date).includes(time);
}
