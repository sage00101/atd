export const MIN_LEAD_TIME_MS = 60 * 60 * 1000;

export function slotDateTime(date, time) {
    return new Date(`${date}T${time}:00+02:00`);
}
