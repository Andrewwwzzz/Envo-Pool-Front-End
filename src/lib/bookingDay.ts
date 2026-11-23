// The Book page's day runs 06:00 → 05:59 SGT (same as the sales day), so a
// late-night booking (11pm–1am) is one continuous pick on one date.
//
// A slot key is "HH:MM" counted from 00:00 of the chosen date, with hours past
// 23 meaning the next morning: "25:00" is 1:00 AM the day after.

const SGT_OFFSET_MS = 8 * 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * MINUTE_MS;

export const BOOKING_DAY_START_MIN = 6 * 60;
export const SLOT_MINUTES = 30;
export const SLOTS_PER_DAY = (24 * 60) / SLOT_MINUTES;

export interface BookingDaySlot {
  key: string;          // "06:00" … "29:30"
  offsetMin: number;    // minutes from 00:00 of the chosen date
  clock: string;        // wall-clock "HH:MM" (00–23)
  calendarDate: Date;   // SGT calendar date the slot falls on (noon, safe for date-only helpers)
  label: string;        // "1:00 AM"
  nextDay: boolean;     // after midnight, i.e. on the following calendar date
}

const pad = (n: number) => String(n).padStart(2, "0");

/** "YYYY-MM-DD" of a date as seen in Singapore. */
export function sgDateStr(date: Date): string {
  return new Date(date.getTime() + SGT_OFFSET_MS).toISOString().slice(0, 10);
}

/** 00:00 SGT of the chosen date, as a real instant. */
export function bookingDayMidnight(date: Date): number {
  return Date.parse(`${sgDateStr(date)}T00:00:00+08:00`);
}

export function keyToMinutes(key: string): number {
  const [h, m] = key.split(":").map(Number);
  return h * 60 + m;
}

export function minutesToKey(min: number): string {
  return `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;
}

/** The real instant a slot key stands for on the chosen date. */
export function slotKeyToDate(date: Date, key: string): Date {
  return new Date(bookingDayMidnight(date) + keyToMinutes(key) * MINUTE_MS);
}

export function formatClock(min: number): string {
  const h = Math.floor(min / 60) % 24;
  return `${h % 12 || 12}:${pad(min % 60)} ${h < 12 ? "AM" : "PM"}`;
}

/** The 48 half-hour slots of the chosen date's booking day, 06:00 to 05:30 next morning. */
export function bookingDaySlots(date: Date): BookingDaySlot[] {
  const midnight = bookingDayMidnight(date);
  return Array.from({ length: SLOTS_PER_DAY }, (_, i) => {
    const offsetMin = BOOKING_DAY_START_MIN + i * SLOT_MINUTES;
    const nextDay = offsetMin >= 24 * 60;
    return {
      key: minutesToKey(offsetMin),
      offsetMin,
      clock: minutesToKey(offsetMin % (24 * 60)),
      calendarDate: new Date(midnight + (nextDay ? DAY_MS : 0) + 12 * 60 * MINUTE_MS),
      label: formatClock(offsetMin),
      nextDay,
    };
  });
}

/**
 * The booking date "now" belongs to: before 06:00 it is still last night's.
 * Returned as 00:00 SGT of that date.
 */
export function currentBookingDate(now: Date = new Date()): Date {
  return new Date(Date.parse(`${sgDateStr(new Date(now.getTime() - BOOKING_DAY_START_MIN * MINUTE_MS))}T00:00:00+08:00`));
}

export function isCurrentBookingDay(date: Date, now: Date = new Date()): boolean {
  return sgDateStr(date) === sgDateStr(currentBookingDate(now));
}

/** The chosen date's booking day as real instants [start, end). */
export function bookingDayWindow(date: Date): { start: number; end: number } {
  const start = bookingDayMidnight(date) + BOOKING_DAY_START_MIN * MINUTE_MS;
  return { start, end: start + DAY_MS };
}

/** The calendar dates ("YYYY-MM-DD") a booking day touches: the date and the next one. */
export function bookingDayCalendarDates(date: Date): [string, string] {
  const midnight = bookingDayMidnight(date);
  return [sgDateStr(new Date(midnight + 12 * 60 * MINUTE_MS)), sgDateStr(new Date(midnight + DAY_MS + 12 * 60 * MINUTE_MS))];
}
