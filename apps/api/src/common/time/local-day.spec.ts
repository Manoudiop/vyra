import { localDay } from './local-day';

describe('localDay', () => {
  it('follows the user timezone, not UTC', () => {
    const instant = new Date('2026-10-18T23:30:00Z');
    expect(localDay(instant, 'Africa/Dakar')).toBe('2026-10-18');
    // Already the next day in Paris (UTC+2 in October).
    expect(localDay(instant, 'Europe/Paris')).toBe('2026-10-19');
    expect(localDay(instant, 'America/New_York')).toBe('2026-10-18');
  });

  it('falls back to UTC for an invalid timezone', () => {
    expect(localDay(new Date('2026-10-18T23:30:00Z'), 'Mars/Olympus')).toBe('2026-10-18');
  });
});
