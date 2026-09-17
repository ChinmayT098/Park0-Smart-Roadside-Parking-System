const TIMEZONE = 'Asia/Kolkata';

/**
 * Safely parses any date input into a JS Date object.
 * If a naive ISO string without a timezone indicator (e.g. "2026-09-17T09:00:00") is provided,
 * it auto-appends '+05:30' so the string is interpreted explicitly in Asia/Kolkata time.
 */
export function parseAsISTDate(dateInput: string | Date | number | null | undefined): Date | null {
  if (!dateInput) return null;
  if (dateInput instanceof Date) {
    return isNaN(dateInput.getTime()) ? null : dateInput;
  }
  if (typeof dateInput === 'number') {
    const d = new Date(dateInput);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof dateInput === 'string') {
    let str = dateInput.trim();
    if (!str) return null;

    // Check if string matches ISO pattern YYYY-MM-DD[T ]HH:mm:ss without timezone offset (+/- or Z)
    if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2})?(\.\d+)?$/i.test(str)) {
      str = str.replace(' ', 'T') + '+05:30';
    }
    const d = new Date(str);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/**
 * Formats a date, string, or timestamp as a time string in IST (Asia/Kolkata).
 * Output format example: "09:00:00 AM"
 */
export function formatISTTime(dateInput: string | Date | number | null | undefined): string {
  const d = parseAsISTDate(dateInput);
  if (!d) return 'N/A';
  try {
    return d.toLocaleTimeString('en-IN', {
      timeZone: TIMEZONE,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  } catch {
    return 'N/A';
  }
}

/**
 * Formats a date, string, or timestamp as a date string in IST (Asia/Kolkata).
 * Output format example: "17 Sep 2026"
 */
export function formatISTDate(dateInput: string | Date | number | null | undefined): string {
  const d = parseAsISTDate(dateInput);
  if (!d) return 'N/A';
  try {
    return d.toLocaleDateString('en-IN', {
      timeZone: TIMEZONE,
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  } catch {
    return 'N/A';
  }
}

/**
 * Formats a date, string, or timestamp as a combined date & time string in IST (Asia/Kolkata).
 * Output format example: "17 Sep 2026, 09:00:00 AM"
 */
export function formatISTDateTime(dateInput: string | Date | number | null | undefined): string {
  const d = parseAsISTDate(dateInput);
  if (!d) return 'N/A';
  try {
    return d.toLocaleString('en-IN', {
      timeZone: TIMEZONE,
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  } catch {
    return 'N/A';
  }
}

/**
 * Returns today's ISO date string (YYYY-MM-DD) in IST (Asia/Kolkata).
 */
export function getTodayISTString(): string {
  const d = new Date();
  return d.toLocaleDateString('en-CA', { timeZone: TIMEZONE });
}

