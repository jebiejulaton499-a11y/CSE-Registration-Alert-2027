import { describe, expect, it } from 'vitest';
import { availableDates } from './slot-checker.js';

describe('CSC appointment availability', () => {
  it('alerts only for a future date with capacity, using the calendar mean occupancy rule', () => {
    expect(availableDates([
      { start: '2026-11-02', percent: 100 },
      { start: '2026-11-03', percent: 100 },
      { start: '2026-11-03', percent: 50 },
      { start: '2026-10-30', percent: 20 },
      { start: '2027-03-14', percent: 0 }
    ], '2026-10-31')).toEqual(['2026-11-03']);
  });

  it('rejects malformed calendar data rather than claiming no slots', () => {
    expect(() => availableDates([{ start: '2026-11-03' }], '2026-10-31')).toThrow();
    expect(() => availableDates({ error: 'login expired' }, '2026-10-31')).toThrow();
  });
});
