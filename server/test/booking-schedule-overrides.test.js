import assert from 'node:assert/strict';
import test from 'node:test';
import {
    BOOKING_SLOT_TIMES,
    getBookingTimesForDate,
    isBookableBookingTime,
} from '../../shared/booking-schedule.js';

test('Nov 26, 2026 uses custom slots while other dates keep their regular schedule', () => {
    const customTimes = ['09:00', '11:30', '14:00', '16:30', '19:00'];

    assert.deepEqual(getBookingTimesForDate('2026-11-26'), customTimes);
    assert.deepEqual(getBookingTimesForDate(new Date('2026-11-26T00:00:00Z')), customTimes);
    assert.deepEqual(getBookingTimesForDate('2026-11-27'), ['09:30', '12:00', '14:30', '16:00', '18:30']);
    assert.equal(isBookableBookingTime('2026-11-26', '09:30'), false);
    assert.equal(isBookableBookingTime('2026-11-26', '09:00'), true);
    assert.ok(BOOKING_SLOT_TIMES.includes('19:00'));
});
