js/**
 * Convert a variety of date/time inputs into a normalized ISO string.
 * Accepts:
 *  - ISO strings
 *  - millisecond timestamps
 *  - second timestamps
 *  - null/undefined (returns undefined)
 */
function toIsoString(input) {
  if (!input && input !== 0) return undefined;

  // Already a Date
  if (input instanceof Date) {
    return input.toISOString();
  }

  // Numeric timestamp
  if (typeof input === 'number') {
    // Heuristic: treat 10-digit as seconds, 13-digit as ms
    if (input < 1e12) {
      return new Date(input * 1000).toISOString();
    }
    return new Date(input).toISOString();
  }

  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (!trimmed) return undefined;

    // If it's a pure number string
    if (/^\d+$/.test(trimmed)) {
      const num = Number(trimmed);
      if (!Number.isNaN(num)) {
        return toIsoString(num);
      }
    }

    const parsed = Date.parse(trimmed);
    if (!Number.isNaN(parsed)) {
      return new Date(parsed).toISOString();
    }
  }

  return undefined;
}

/**
 * Build an ISO timestamp from a local date (YYYY-MM-DD) and time (HH:mm or HH:mm:ss).
 * Treats the values as local time and converts to ISO.
 */
function fromLocalDateAndTime(dateStr, timeStr) {
  if (!dateStr || !timeStr) return undefined;

  const [year, month, day] = String(dateStr).split('-').map((v) => Number(v));
  const [hour, minute, second = 0] = String(timeStr).split(':').map((v) => Number(v));

  if (
    Number.isNaN(year) ||
    Number.isNaN(month) ||
    Number.isNaN(day) ||
    Number.isNaN(hour) ||
    Number.isNaN(minute) ||
    Number.isNaN(second)
  ) {
    return undefined;
  }

  const date = new Date(year, month - 1, day, hour, minute, second);
  return date.toISOString();
}

module.exports = {
  toIsoString,
  fromLocalDateAndTime
};