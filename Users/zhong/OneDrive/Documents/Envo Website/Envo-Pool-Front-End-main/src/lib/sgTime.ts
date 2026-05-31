/**
 * Singapore timezone utilities.
 * All date/time logic should use these helpers to ensure consistent SG time,
 * regardless of the user's browser timezone.
 */

const SG_TZ = "Asia/Singapore";

/**
 * Get current date/time as a Date object whose local-time methods
 * (.getHours(), .getDay(), etc.) return Singapore time values.
 * 
 * IMPORTANT: This Date is "shifted" — its UTC value is NOT real UTC.
 * Use it only for local display / comparisons, never for .toISOString().
 */
export function nowSG(): Date {
  const now = new Date();
  const sgStr = now.toLocaleString("en-US", { timeZone: SG_TZ });
  return new Date(sgStr);
}

/**
 * Convert any Date to a "SG-local" Date whose .getHours()/.getDay() etc.
 * reflect Singapore time.
 */
export function toSG(date: Date): Date {
  const sgStr = date.toLocaleString("en-US", { timeZone: SG_TZ });
  return new Date(sgStr);
}

/**
 * Get today's date at midnight in SG time (as a shifted Date).
 */
export function todaySG(): Date {
  const sg = nowSG();
  sg.setHours(0, 0, 0, 0);
  return sg;
}

/**
 * Check if a given date is today in Singapore timezone.
 */
export function isTodaySG(date: Date): boolean {
  const sg = toSG(date);
  const today = todaySG();
  return (
    sg.getFullYear() === today.getFullYear() &&
    sg.getMonth() === today.getMonth() &&
    sg.getDate() === today.getDate()
  );
}

/**
 * Get current SG time as minutes since midnight (for slot comparisons).
 */
export function nowSGMinutes(): number {
  const sg = nowSG();
  return sg.getHours() * 60 + sg.getMinutes();
}

/**
 * Format a date string for Singapore display (DD/MM/YYYY).
 */
export function fmtDateSG(d: string | Date): string {
  return new Date(d).toLocaleDateString("en-GB", {
    timeZone: SG_TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/**
 * Format a date string for Singapore display (HH:MM).
 */
export function fmtTimeSG(d: string | Date): string {
  return new Date(d).toLocaleTimeString("en-GB", {
    timeZone: SG_TZ,
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Format date + time for Singapore.
 */
export function fmtDateTimeSG(d: string | Date): string {
  return `${fmtDateSG(d)} ${fmtTimeSG(d)}`;
}

/**
 * Get SG weekday abbreviation for a Date.
 */
const WEEKDAY_MAP: Record<number, string> = {
  0: "Sun", 1: "Mon", 2: "Tue", 3: "Wed", 4: "Thu", 5: "Fri", 6: "Sat",
};

export function getSGWeekday(date: Date): string {
  return WEEKDAY_MAP[toSG(date).getDay()];
}

/**
 * Get SG hours and minutes from a Date.
 */
export function getSGTimeMinutes(date: Date): number {
  const sg = toSG(date);
  return sg.getHours() * 60 + sg.getMinutes();
}

/**
 * Get YYYY-MM-DD string in SG timezone.
 */
export function getSGDateStr(date: Date): string {
  const sg = toSG(date);
  const y = sg.getFullYear();
  const m = (sg.getMonth() + 1).toString().padStart(2, "0");
  const d = sg.getDate().toString().padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Build a proper UTC Date from Singapore date components + time slot string.
 * 
 * Given a calendar date (treated as SG date) and a time like "22:00",
 * returns a Date whose .toISOString() is the correct UTC representation
 * of 22:00 SGT on that date.
 * 
 * Example: 2026-03-30, "22:00" → 2026-03-30T14:00:00.000Z
 */
export function sgSlotToUTC(sgDate: Date, slot: string): Date {
  const sg = toSG(sgDate);
  const [h, m] = slot.split(":").map(Number);
  // Build YYYY-MM-DDTHH:MM:00+08:00 string and let Date parse it to correct UTC
  const y = sg.getFullYear();
  const mo = (sg.getMonth() + 1).toString().padStart(2, "0");
  const d = sg.getDate().toString().padStart(2, "0");
  const hh = h.toString().padStart(2, "0");
  const mm = m.toString().padStart(2, "0");
  return new Date(`${y}-${mo}-${d}T${hh}:${mm}:00+08:00`);
}

/**
 * Build start-of-day (00:00 SGT) and end-of-day (23:59:59.999 SGT) as UTC Dates
 * for a given SG calendar date. Useful for day-boundary queries.
 */
export function sgDayBoundsUTC(sgDate: Date): { dayStart: Date; dayEnd: Date } {
  const sg = toSG(sgDate);
  const y = sg.getFullYear();
  const mo = (sg.getMonth() + 1).toString().padStart(2, "0");
  const d = sg.getDate().toString().padStart(2, "0");
  const dayStart = new Date(`${y}-${mo}-${d}T00:00:00+08:00`);
  const dayEnd = new Date(`${y}-${mo}-${d}T23:59:59.999+08:00`);
  return { dayStart, dayEnd };
}
