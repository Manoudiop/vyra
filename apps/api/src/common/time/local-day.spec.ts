import { localDay, startOfLocalDay } from './local-day';

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

describe('startOfLocalDay', () => {
  it('returns the instant local midnight happens', () => {
    expect(startOfLocalDay('2026-10-18', 'Africa/Abidjan').toISOString()).toBe(
      '2026-10-18T00:00:00.000Z',
    );
    expect(startOfLocalDay('2026-10-18', 'Europe/Paris').toISOString()).toBe(
      '2026-10-17T22:00:00.000Z',
    );
    expect(startOfLocalDay('2026-10-18', 'America/New_York').toISOString()).toBe(
      '2026-10-18T04:00:00.000Z',
    );
  });

  it('handles days when the clocks change', () => {
    // Paris leaves summer time on 2026-10-25: that day starts at UTC+2.
    expect(startOfLocalDay('2026-10-25', 'Europe/Paris').toISOString()).toBe(
      '2026-10-24T22:00:00.000Z',
    );
    expect(startOfLocalDay('2026-10-26', 'Europe/Paris').toISOString()).toBe(
      '2026-10-25T23:00:00.000Z',
    );
  });

  it('is consistent with localDay', () => {
    for (const zone of [
      'Africa/Dakar',
      'Asia/Tokyo',
      'America/Los_Angeles',
      'Pacific/Kiritimati',
    ]) {
      const start = startOfLocalDay('2026-10-18', zone);
      expect(localDay(start, zone)).toBe('2026-10-18');
      expect(localDay(new Date(start.getTime() - 1000), zone)).toBe('2026-10-17');
    }
  });
});
