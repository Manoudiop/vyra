import { usageWindow } from './usage-period';

const iso = (window: { start: Date; resetsAt: Date }) => [
  window.start.toISOString(),
  window.resetsAt.toISOString(),
];

describe('usageWindow', () => {
  // Wednesday 14 October 2026, 15:30 UTC.
  const at = new Date('2026-10-14T15:30:00Z');

  it('uses days, Monday weeks and months', () => {
    expect(iso(usageWindow('DAY', 'UTC', at))).toEqual([
      '2026-10-14T00:00:00.000Z',
      '2026-10-15T00:00:00.000Z',
    ]);
    expect(iso(usageWindow('WEEK', 'UTC', at))).toEqual([
      '2026-10-12T00:00:00.000Z',
      '2026-10-19T00:00:00.000Z',
    ]);
    // Sunday night still belongs to the week that started on Monday.
    expect(iso(usageWindow('WEEK', 'UTC', new Date('2026-10-18T23:59:00Z')))[0]).toBe(
      '2026-10-12T00:00:00.000Z',
    );
    expect(iso(usageWindow('MONTH', 'UTC', at))).toEqual([
      '2026-10-01T00:00:00.000Z',
      '2026-11-01T00:00:00.000Z',
    ]);
    expect(iso(usageWindow('MONTH', 'UTC', new Date('2026-12-20T10:00:00Z')))[1]).toBe(
      '2027-01-01T00:00:00.000Z',
    );
  });

  it('follows the user’s midnight, not the server’s', () => {
    // 23:30 UTC on Sunday is already Monday in Paris: a new week there.
    const late = new Date('2026-10-18T23:30:00Z');
    expect(iso(usageWindow('WEEK', 'Europe/Paris', late))).toEqual([
      '2026-10-18T22:00:00.000Z',
      '2026-10-25T23:00:00.000Z', // Paris is back to UTC+1 on the 25th
    ]);
    expect(iso(usageWindow('WEEK', 'Africa/Dakar', late))[0]).toBe('2026-10-12T00:00:00.000Z');
    expect(iso(usageWindow('DAY', 'America/New_York', late))).toEqual([
      '2026-10-18T04:00:00.000Z',
      '2026-10-19T04:00:00.000Z',
    ]);
  });
});
