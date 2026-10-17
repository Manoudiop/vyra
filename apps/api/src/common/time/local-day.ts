const formatters = new Map<string, Intl.DateTimeFormat>();

/**
 * Calendar day ("YYYY-MM-DD") of an instant in an IANA timezone. "Worn today"
 * must follow the user's day, not the server's: 23:30 in Dakar is still today
 * there even when the server runs in another timezone.
 */
export function localDay(instant: Date, timeZone: string): string {
  let format = formatters.get(timeZone);
  if (!format) {
    try {
      format = new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
    } catch {
      // A stale or invalid stored timezone must not break the request.
      return localDay(instant, 'UTC');
    }
    formatters.set(timeZone, format);
  }
  return format.format(instant);
}
