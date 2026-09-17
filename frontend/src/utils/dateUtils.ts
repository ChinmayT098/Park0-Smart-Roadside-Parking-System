const TIMEZONE = 'Asia/Kolkata';

/**
 * Formats a date, string, or timestamp as a time string in IST (Asia/Kolkata).
 * Output format example: "09:00:00 AM"
 */
export function formatISTTime(dateInput: string | Date | number | null | undefined): string {
  if (!dateInput) return 'N/A';
  try {
    const d = typeof dateInput === 'string' || typeof dateInput === 'number'
      ? new Date(dateInput)
      : dateInput;
    if (isNaN(d.getTime())) return 'N/A';
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
  if (!dateInput) return 'N/A';
  try {
    const d = typeof dateInput === 'string' || typeof dateInput === 'number'
      ? new Date(dateInput)
      : dateInput;
    if (isNaN(d.getTime())) return 'N/A';
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
  if (!dateInput) return 'N/A';
  try {
    const d = typeof dateInput === 'string' || typeof dateInput === 'number'
      ? new Date(dateInput)
      : dateInput;
    if (isNaN(d.getTime())) return 'N/A';
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
