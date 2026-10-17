const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let format = formatters.get(timeZone);
  if (!format) {
    try {
      format = new Intl.DateTimeFormat('en-CA', {
        timeZone,
        hourCycle: 'h23',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      // A stale or invalid stored timezone must not break the request.
      return formatterFor('UTC');
    }
    formatters.set(timeZone, format);
  }
  return format;
}

function partsOf(instant: Date, timeZone: string) {
  const parts: Record<string, number> = {};
  for (const part of formatterFor(timeZone).formatToParts(instant)) {
    if (part.type !== 'literal') parts[part.type] = Number(part.value);
  }
  return parts as Record<'year' | 'month' | 'day' | 'hour' | 'minute' | 'second', number>;
}

/**
 * Calendar day ("YYYY-MM-DD") of an instant in an IANA timezone. "Worn today"
 * must follow the user's day, not the server's: 23:30 in Dakar is still today
 * there even when the server runs in another timezone.
 */
export function localDay(instant: Date, timeZone: string): string {
  const { year, month, day } = partsOf(instant, timeZone);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Offset of the timezone from UTC at that instant, in ms (Paris in summer: +2 h). */
function offsetMs(instant: Date, timeZone: string): number {
  const p = partsOf(instant, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/** The instant a local calendar day starts, e.g. for "worn on or after that day" queries. */
export function startOfLocalDay(day: string, timeZone: string): Date {
  const midnightUtc = Date.parse(`${day}T00:00:00Z`);
  const first = midnightUtc - offsetMs(new Date(midnightUtc), timeZone);
  // Re-check with the offset at the candidate instant (DST change around midnight).
  return new Date(midnightUtc - offsetMs(new Date(first), timeZone));
}

/** A `@db.Date` column value for a calendar day. */
export const dateColumn = (day: string) => new Date(`${day}T00:00:00Z`);
export const dayOfDateColumn = (value: Date) => value.toISOString().slice(0, 10);
