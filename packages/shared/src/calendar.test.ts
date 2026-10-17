import { describe, expect, it } from 'vitest';
import {
  addDays,
  calendarDateSchema,
  daysBetween,
  monthGrid,
  monthRange,
  shiftMonth,
  weekOf,
} from './calendar';

describe('calendar days', () => {
  it('validates real dates only', () => {
    expect(calendarDateSchema.safeParse('2026-10-18').success).toBe(true);
    expect(calendarDateSchema.safeParse('2026-02-30').success).toBe(false);
    expect(calendarDateSchema.safeParse('18/10/2026').success).toBe(false);
  });

  it('adds days across months, years and DST changes', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-29', 1)).toBe('2026-03-30');
    expect(daysBetween('2026-10-18', '2026-10-25')).toBe(7);
    expect(daysBetween('2026-10-18', '2026-10-11')).toBe(-7);
  });

  it('finds the Monday-to-Sunday week', () => {
    // 2026-10-18 is a Sunday.
    expect(weekOf('2026-10-18')).toEqual({ from: '2026-10-12', to: '2026-10-18' });
    expect(weekOf('2026-10-19')).toEqual({ from: '2026-10-19', to: '2026-10-25' });
  });

  it('builds month ranges and grids starting on Monday', () => {
    expect(monthRange('2026-02')).toEqual({ from: '2026-02-01', to: '2026-02-28' });
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    const grid = monthGrid('2026-10');
    // October 1st 2026 is a Thursday.
    expect(grid[0]).toEqual([
      null,
      null,
      null,
      '2026-10-01',
      '2026-10-02',
      '2026-10-03',
      '2026-10-04',
    ]);
    expect(grid.every((week) => week.length === 7)).toBe(true);
    expect(grid.flat().filter(Boolean)).toHaveLength(31);
  });
});
