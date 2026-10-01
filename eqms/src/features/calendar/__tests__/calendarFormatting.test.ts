import { describe, expect, it } from 'vitest';
import { inclusiveEnd, localToPicker, pickerToLocal } from '../calendarFormatting';

describe('calendar display formats', () => {
  it('converts DateTimePicker values without changing their local time', () => {
    expect(pickerToLocal('29/02/2028')).toBe('2028-02-29T00:00:00');
    expect(pickerToLocal('02/10/2026 09:30')).toBe('2026-10-02T09:30:00');
    expect(localToPicker('2026-10-02T09:30:00', false)).toBe('02/10/2026 09:30');
  });
  it('converts the exclusive all-day end to the inclusive editor date across year and leap boundaries', () => {
    expect(inclusiveEnd('2027-01-01T00:00:00', true)).toBe('2026-12-31T00:00:00');
    expect(inclusiveEnd('2028-03-01T00:00:00', true)).toBe('2028-02-29T00:00:00');
    expect(inclusiveEnd('2026-10-02T10:00:00', false)).toBe('2026-10-02T10:00:00');
  });
});
