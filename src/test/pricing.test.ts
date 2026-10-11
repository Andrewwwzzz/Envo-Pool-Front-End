import { describe, it, expect } from "vitest";
import {
  calculateBookingPrice,
  calculateDiscount,
  isPHOrPHEve,
  sortPricingRules,
  PricingRule,
} from "@/lib/pricing";

// Expected figures are what the server (utils/pricingRules.js findBestRule +
// segmentCost, priced in 30-minute slots by booking.routes.new.js) charges for
// the same booking.

const ALL_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const sg = (local: string) => new Date(`${local}+08:00`); // SGT wall-clock time

let n = 0;
function rule(partial: Partial<PricingRule>): PricingRule {
  n += 1;
  return {
    id: `rule${n}`,
    name: `Rule ${n}`,
    start_time: "00:00",
    end_time: "00:00",
    hourly_rate: 10,
    applies_to_weekdays: ALL_DAYS,
    specific_date: null,
    applies_to_table_id: null,
    priority: 0,
    is_active: true,
    ...partial,
  };
}

const price = (rules: PricingRule[], table: string | string[], from: string, to: string, ph: string[] = []) =>
  calculateBookingPrice(rules, table, sg(from), sg(to), new Set(ph));

const TABLE_ID = "66aa00000000000000000001";
const TABLE_HW = "T1";

describe("calculateBookingPrice matches the server", () => {
  const day = rule({ name: "Day", start_time: "10:00", end_time: "17:00", hourly_rate: 10 });
  const evening = rule({ name: "Evening", start_time: "17:00", end_time: "04:00", hourly_rate: 15 });

  it("switches rate exactly at a 17:00 boundary", () => {
    const r = price([day, evening], TABLE_ID, "2026-10-12T16:00:00", "2026-10-12T18:00:00");
    expect(r.totalPrice).toBe(25);
    expect(r.segments.map((s) => [s.hourlyRate, s.segmentCost])).toEqual([[10, 10], [15, 15]]);
    expect(r.segments[1].startTime.getTime()).toBe(sg("2026-10-12T17:00:00").getTime());
  });

  it("applies a specific-date rule on that SGT calendar date only — not on its ticked weekday elsewhere", () => {
    const special = rule({ name: "Special", specific_date: "2026-10-14", applies_to_weekdays: ["Wed"], start_time: "10:00", end_time: "22:00", hourly_rate: 20 });
    expect(price([special], TABLE_ID, "2026-10-14T14:00:00", "2026-10-14T15:00:00").totalPrice).toBe(20);
    // 2026-10-21 is also a Wednesday — the rule's weekday tick doesn't apply
    expect(price([special], TABLE_ID, "2026-10-21T14:00:00", "2026-10-21T15:00:00").totalPrice).toBe(13.5);
  });

  it("matches a specific-date rule after midnight on the calendar date, not the operational day", () => {
    const special = rule({ name: "Late special", specific_date: "2026-10-15", start_time: "00:00", end_time: "04:00", hourly_rate: 30 });
    // 01:00 on the 15th belongs to the 14th's operational day, but the date rule is for the 15th
    expect(price([special], TABLE_ID, "2026-10-15T01:00:00", "2026-10-15T02:00:00").totalPrice).toBe(30);
    expect(price([special], TABLE_ID, "2026-10-14T01:00:00", "2026-10-14T02:00:00").totalPrice).toBe(13.5);
  });

  it("applies a per-table rule referenced by the table's _id or its hardware_id", () => {
    const byHw = rule({ name: "T1 deal", applies_to_table_id: TABLE_HW, start_time: "10:00", end_time: "22:00", hourly_rate: 9 });
    const byId = rule({ name: "T1 deal (id)", applies_to_table_id: TABLE_ID, start_time: "10:00", end_time: "22:00", hourly_rate: 8 });
    const ids = [TABLE_ID, TABLE_HW];
    expect(price([day, byHw], ids, "2026-10-12T12:00:00", "2026-10-12T13:00:00").totalPrice).toBe(9);
    expect(price([day, byId], ids, "2026-10-12T12:00:00", "2026-10-12T13:00:00").totalPrice).toBe(8);
    // A different table gets the general rule
    expect(price([day, byHw, byId], ["66aa00000000000000000002", "T2"], "2026-10-12T12:00:00", "2026-10-12T13:00:00").totalPrice).toBe(10);
  });

  it("charges $13.50/hr when no rule matches", () => {
    const r = price([day], TABLE_ID, "2026-10-12T08:00:00", "2026-10-12T10:00:00");
    expect(r.totalPrice).toBe(27);
    expect(r.segments).toHaveLength(1);
    expect(r.segments[0].hourlyRate).toBe(13.5);
    expect(r.segments[0].rule).toBeNull();
    expect(price([], TABLE_ID, "2026-10-12T12:00:00", "2026-10-12T13:30:00").totalPrice).toBe(20.25);
  });

  it("prices after midnight by the operational day's weekday", () => {
    const friLate = rule({ name: "Friday late", applies_to_weekdays: ["Fri"], start_time: "22:00", end_time: "04:00", hourly_rate: 18 });
    // Sat 01:00–02:00 is still Friday's session (2026-10-16 is a Friday)
    expect(price([friLate], TABLE_ID, "2026-10-17T01:00:00", "2026-10-17T02:00:00").totalPrice).toBe(18);
    // Fri 01:00–02:00 is Thursday's session — the Friday rule doesn't apply
    expect(price([friLate], TABLE_ID, "2026-10-16T01:00:00", "2026-10-16T02:00:00").totalPrice).toBe(13.5);
  });

  it("treats a PH eve (and its after-midnight hours) as a weekend", () => {
    const weekday = rule({ name: "Weekday", applies_to_weekdays: ["Mon", "Tue", "Wed", "Thu"], start_time: "10:00", end_time: "04:00", hourly_rate: 12 });
    const weekend = rule({ name: "Weekend", applies_to_weekdays: ["Fri", "Sat", "Sun"], start_time: "10:00", end_time: "04:00", hourly_rate: 18, priority: 1 });
    const ph = ["2026-10-20"]; // Tuesday PH → Monday 19th is its eve
    expect(price([weekday, weekend], TABLE_ID, "2026-10-19T14:00:00", "2026-10-19T15:00:00", ph).totalPrice).toBe(18);
    // 01:00 on the PH's calendar date is still the eve's operational day
    expect(price([weekday, weekend], TABLE_ID, "2026-10-20T01:00:00", "2026-10-20T02:00:00", ph).totalPrice).toBe(18);
    // Without the PH it's a normal Monday
    expect(price([weekday, weekend], TABLE_ID, "2026-10-19T14:00:00", "2026-10-19T15:00:00").totalPrice).toBe(12);
    expect(isPHOrPHEve(sg("2026-10-20T01:00:00"), new Set(ph))).toBe(true);
    expect(isPHOrPHEve(sg("2026-10-18T14:00:00"), new Set(ph))).toBe(false);
  });

  it("rounds each segment once to the cent for odd-cent rates over 2h", () => {
    const odd = rule({ name: "Odd", start_time: "10:00", end_time: "22:00", hourly_rate: 16.25 });
    // per-slot rounding would give 4 × 8.13 = 32.52
    expect(price([odd], TABLE_ID, "2026-10-12T12:00:00", "2026-10-12T14:00:00").totalPrice).toBe(32.5);
    expect(price([odd], TABLE_ID, "2026-10-12T12:00:00", "2026-10-12T13:30:00").totalPrice).toBe(24.38);
    const odd2 = rule({ name: "Odd 2", start_time: "10:00", end_time: "22:00", hourly_rate: 13.33 });
    expect(price([odd2], TABLE_ID, "2026-10-12T12:00:00", "2026-10-12T14:00:00").totalPrice).toBe(26.66);
    // Two odd-cent segments across a boundary: 1.5h × 16.25 + 0.5h × 13.33
    const a = rule({ name: "A", start_time: "10:00", end_time: "13:30", hourly_rate: 16.25 });
    const b = rule({ name: "B", start_time: "13:30", end_time: "22:00", hourly_rate: 13.33 });
    const r = price([a, b], TABLE_ID, "2026-10-12T12:00:00", "2026-10-12T14:00:00");
    expect(r.segments.map((s) => s.segmentCost)).toEqual([24.38, 6.67]);
    expect(r.totalPrice).toBe(31.05);
  });

  it("picks the more specific rule, then higher priority, then the earlier rule on a tie", () => {
    const general = rule({ name: "General", start_time: "10:00", end_time: "22:00", hourly_rate: 10, priority: 9 });
    const table = rule({ name: "Table", applies_to_table_id: TABLE_HW, start_time: "10:00", end_time: "22:00", hourly_rate: 11 });
    expect(price([general, table], [TABLE_ID, TABLE_HW], "2026-10-12T12:00:00", "2026-10-12T13:00:00").totalPrice).toBe(11);
    const first = rule({ name: "First", start_time: "10:00", end_time: "22:00", hourly_rate: 12, priority: 2, created_at: "2026-01-01T00:00:00Z" });
    const second = rule({ name: "Second", start_time: "10:00", end_time: "22:00", hourly_rate: 14, priority: 2, created_at: "2026-02-01T00:00:00Z" });
    // the server lists rules priority desc, older first — the older one wins a tie
    const ordered = sortPricingRules([second, first]);
    expect(ordered.map((r) => r.name)).toEqual(["First", "Second"]);
    expect(price(ordered, TABLE_ID, "2026-10-12T12:00:00", "2026-10-12T13:00:00").totalPrice).toBe(12);
  });
});

describe("calculateDiscount matches the server", () => {
  it("caps a percentage promo at its max discount", () => {
    expect(calculateDiscount(50, "percentage", 20, 5)).toBe(5);
    expect(calculateDiscount(50, "percentage", 20, null)).toBe(10);
    expect(calculateDiscount(32.5, "percentage", 15, 0)).toBe(4.88); // 0 = no cap
  });

  it("does not cap a fixed promo at the max discount, only at the price", () => {
    expect(calculateDiscount(50, "fixed", 10, 5)).toBe(10);
    expect(calculateDiscount(8, "fixed", 10, null)).toBe(8);
  });
});
