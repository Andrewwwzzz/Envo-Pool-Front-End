import { describe, it, expect } from "vitest";
import {
  bookingDaySlots, slotKeyToDate, currentBookingDate, isCurrentBookingDay, bookingDayWindow,
  bookingDayCalendarDates, sgDateStr,
} from "@/lib/bookingDay";

const sgt = (s: string) => new Date(`${s}+08:00`);
const date24 = sgt("2026-11-24T00:00:00");

describe("bookingDaySlots", () => {
  const slots = bookingDaySlots(date24);

  it("runs 6:00 AM to 5:30 AM the next morning in 48 half-hours", () => {
    expect(slots).toHaveLength(48);
    expect(slots[0]).toMatchObject({ key: "06:00", label: "6:00 AM", clock: "06:00", nextDay: false });
    expect(slots[35]).toMatchObject({ key: "23:30", label: "11:30 PM", nextDay: false });
    expect(slots[36]).toMatchObject({ key: "24:00", label: "12:00 AM", clock: "00:00", nextDay: true });
    expect(slots[47]).toMatchObject({ key: "29:30", label: "5:30 AM", clock: "05:30", nextDay: true });
  });

  it("puts after-midnight slots on the next calendar date", () => {
    expect(sgDateStr(slots[35].calendarDate)).toBe("2026-11-24");
    expect(sgDateStr(slots[36].calendarDate)).toBe("2026-11-25");
  });
});

describe("slotKeyToDate", () => {
  it("maps keys past 24:00 onto the next morning", () => {
    expect(slotKeyToDate(date24, "23:00").toISOString()).toBe(sgt("2026-11-24T23:00:00").toISOString());
    expect(slotKeyToDate(date24, "25:00").toISOString()).toBe(sgt("2026-11-25T01:00:00").toISOString());
    expect(slotKeyToDate(date24, "30:00").toISOString()).toBe(sgt("2026-11-25T06:00:00").toISOString());
  });

  it("works whatever time of day the chosen Date carries", () => {
    expect(slotKeyToDate(sgt("2026-11-24T15:47:00"), "25:00").toISOString()).toBe(sgt("2026-11-25T01:00:00").toISOString());
  });

  it("crosses month and year ends", () => {
    expect(slotKeyToDate(sgt("2026-11-30T00:00:00"), "24:30").toISOString()).toBe(sgt("2026-12-01T00:30:00").toISOString());
    expect(slotKeyToDate(sgt("2026-12-31T00:00:00"), "26:00").toISOString()).toBe(sgt("2027-01-01T02:00:00").toISOString());
  });
});

describe("current booking day", () => {
  it("is still last night's date before 6am", () => {
    expect(sgDateStr(currentBookingDate(sgt("2026-11-25T01:30:00")))).toBe("2026-11-24");
    expect(sgDateStr(currentBookingDate(sgt("2026-11-25T05:59:00")))).toBe("2026-11-24");
    expect(sgDateStr(currentBookingDate(sgt("2026-11-25T06:00:00")))).toBe("2026-11-25");
    expect(sgDateStr(currentBookingDate(sgt("2026-11-24T23:00:00")))).toBe("2026-11-24");
  });

  it("recognises the chosen date as the current booking day", () => {
    expect(isCurrentBookingDay(date24, sgt("2026-11-25T02:00:00"))).toBe(true);
    expect(isCurrentBookingDay(sgt("2026-11-25T00:00:00"), sgt("2026-11-25T02:00:00"))).toBe(false);
  });
});

describe("bookingDayWindow / calendar dates", () => {
  it("covers 06:00 to 06:00 next day", () => {
    const w = bookingDayWindow(date24);
    expect(new Date(w.start).toISOString()).toBe(sgt("2026-11-24T06:00:00").toISOString());
    expect(new Date(w.end).toISOString()).toBe(sgt("2026-11-25T06:00:00").toISOString());
  });

  it("touches the date and the next one", () => {
    expect(bookingDayCalendarDates(sgt("2026-11-30T00:00:00"))).toEqual(["2026-11-30", "2026-12-01"]);
  });
});
