import assert from 'node:assert/strict';
import test from 'node:test';
import {
    BOOKING_SLOT_TIMES,
    getBookingTimesForDate,
    isBookableBookingTime,
} from '../../shared/booking-schedule.js';

test('Nov 26, 2026 adds and removes date-specific slots without changing nearby dates', () => {
    const customTimes = ['09:00', '11:30', '14:00', '16:30', '19:00'];
    const regularTimes = ['09:30', '12:00', '14:30', '16:00', '18:30'];
    const removedTimes = ['12:00', '18:30'];
    const expectedTimes = [...regularTimes.filter((time) => !removedTimes.includes(time)), ...customTimes].sort();

    assert.deepEqual(getBookingTimesForDate('2026-11-26'), expectedTimes);
    assert.deepEqual(getBookingTimesForDate(new Date(2026, 10, 26)), expectedTimes);
    assert.deepEqual(getBookingTimesForDate('2026-11-27'), regularTimes);
    assert.deepEqual(getBookingTimesForDate('2026-11-30'), customTimes);
    assert.deepEqual(getBookingTimesForDate('2026-12-01'), customTimes);
    assert.deepEqual(getBookingTimesForDate('2026-12-05'), ['09:00', '11:30', '13:30']);
    assert.equal(isBookableBookingTime('2026-11-26', '09:30'), true);
    assert.equal(isBookableBookingTime('2026-11-26', '09:00'), true);
    assert.equal(isBookableBookingTime('2026-11-26', '12:00'), false);
    assert.equal(isBookableBookingTime('2026-11-26', '18:30'), false);
    assert.equal(isBookableBookingTime('2026-11-27', '14:30'), true);
    assert.equal(isBookableBookingTime('2026-11-30', '09:00'), true);
    assert.equal(isBookableBookingTime('2026-12-01', '09:30'), false);
    assert.ok(BOOKING_SLOT_TIMES.includes('19:00'));
    assert.ok(BOOKING_SLOT_TIMES.includes('12:00'));
});
