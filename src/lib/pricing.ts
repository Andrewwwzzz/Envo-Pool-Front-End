/**
 * Dynamic pricing calculation engine.
 * Supports global and per-table pricing rules with priority-based resolution.
 * Public holidays (PH) and PH eves are treated as Fri–Sun for pricing.
 */

export interface PricingRule {
  id: string;
  name: string;
  start_time: string; // HH:MM:SS
  end_time: string;
  hourly_rate: number;
  applies_to_weekdays: string[];
  specific_date: string | null;
  applies_to_table_id: string | null;
  priority: number;
  is_active: boolean;
}

export interface PublicHoliday {
  _id?: string;
  date: string; // YYYY-MM-DD
  name: string;
}

import { getSGWeekday, getSGTimeMinutes, getSGDateStr } from "@/lib/sgTime";

function timeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(":").map(Number);
  return h * 60 + m;
}

/**
 * Given a SGT date string (YYYY-MM-DD) and a Set of PH dates,
 * return the effective extra weekdays to inject for pricing.
 *
 * PH itself  → treated as "Sun" (peak weekend rate)
 * PH eve     → treated as "Fri" (peak start-of-weekend rate)
 *
 * We inject these ALONGSIDE the real weekday, so a rule that covers
 * e.g. ["Fri","Sat","Sun"] will match on PH or PH-eve even if the
 * calendar day is a Tuesday.
 */
function extraWeekdaysForDate(dateStr: string, phDates: Set<string>): string[] {
  if (phDates.has(dateStr)) {
    return ["Fri", "Sat", "Sun"]; // PH itself → full weekend rate
  }
  // Check if tomorrow is a PH (i.e. today is PH eve)
  // Use UTC date arithmetic — dateStr is already the SGT calendar date
  const [y, mo, dy] = dateStr.split("-").map(Number);
  const nextStr = new Date(Date.UTC(y, mo - 1, dy + 1)).toISOString().slice(0, 10);
  if (phDates.has(nextStr)) {
    return ["Fri", "Sat", "Sun"]; // PH eve → same weekend rate as PH
  }
  return [];
}

/**
 * Find the best matching pricing rule for a specific moment in time and table.
 * Priority: specific_date + table > specific_date > table-specific > global
 * Within same scope, higher priority number wins.
 */
function findBestRule(
  rules: PricingRule[],
  dateTime: Date,
  tableId: string,
  phDates: Set<string> = new Set()
): PricingRule | null {
  const timeMin = getSGTimeMinutes(dateTime);
  const dateStr = getSGDateStr(dateTime);

  // Operational day: before 4am SGT belongs to the previous calendar day's session
  const opDateStr = timeMin < 4 * 60
    ? getSGDateStr(new Date(dateTime.getTime() - 24 * 60 * 60 * 1000))
    : dateStr;

  // Use OPERATIONAL day's weekday — e.g. 1am Monday is still Sunday's session
  const WEEKDAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"] as const;
  const weekday = WEEKDAYS[new Date(opDateStr + "T00:00:00Z").getUTCDay()];

  // Effective weekdays: operational day + any PH/PH-eve bonus days
  const effectiveWeekdays = new Set([weekday, ...extraWeekdaysForDate(opDateStr, phDates)]);

  const matching = rules.filter((r) => {
    if (!r.is_active) return false;

    // Check time range
    const rStart = timeToMinutes(r.start_time);
    const rEnd = timeToMinutes(r.end_time);
    const inTimeRange = rEnd > rStart
      ? timeMin >= rStart && timeMin < rEnd
      : timeMin >= rStart || timeMin < rEnd;
    if (!inTimeRange) return false;

    // Check specific date or weekday
    if (r.specific_date) {
      if (r.specific_date !== opDateStr) return false;
    } else {
      // Match if any of the effective weekdays is in the rule's weekday list
      const ruleWeekdays = new Set(r.applies_to_weekdays);
      const overlaps = [...effectiveWeekdays].some((d) => ruleWeekdays.has(d));
      if (!overlaps) return false;
    }

    // Check table scope
    if (r.applies_to_table_id && r.applies_to_table_id !== tableId) return false;

    return true;
  });

  if (matching.length === 0) return null;

  // Sort by specificity then priority
  matching.sort((a, b) => {
    const aDateScore = a.specific_date ? 2 : 0;
    const bDateScore = b.specific_date ? 2 : 0;
    const aTableScore = a.applies_to_table_id ? 1 : 0;
    const bTableScore = b.applies_to_table_id ? 1 : 0;
    const aTotal = aDateScore + aTableScore;
    const bTotal = bDateScore + bTableScore;
    if (aTotal !== bTotal) return bTotal - aTotal;
    return b.priority - a.priority;
  });

  return matching[0];
}

export interface PricingSegment {
  startTime: Date;
  endTime: Date;
  rule: PricingRule | null;
  hourlyRate: number;
  durationHours: number;
  segmentCost: number;
}

const DEFAULT_HOURLY_RATE = 16.25; // fallback if no rules match

/**
 * The hourly rate in effect right now (no specific table — global/default
 * rules only), for prefilling admin "start timer" rate inputs so staff see
 * today's actual rate instead of a stale hardcoded default.
 */
export function getCurrentHourlyRate(
  rules: PricingRule[],
  phDates: Set<string> = new Set()
): number {
  const rule = findBestRule(rules, new Date(), "", phDates);
  return rule?.hourly_rate ?? DEFAULT_HOURLY_RATE;
}

/**
 * Calculate booking price with multi-period support.
 * Splits the booking into 15-minute segments and applies the best matching rule for each.
 * Pass phDates (Set of "YYYY-MM-DD") for public-holiday-aware pricing.
 */
export function calculateBookingPrice(
  rules: PricingRule[],
  tableId: string,
  startTime: Date,
  endTime: Date,
  phDates: Set<string> = new Set()
): { totalPrice: number; segments: PricingSegment[] } {
  const segments: PricingSegment[] = [];
  const intervalMs = 15 * 60 * 1000; // 15 minutes
  let current = new Date(startTime);

  while (current < endTime) {
    const segEnd = new Date(Math.min(current.getTime() + intervalMs, endTime.getTime()));
    const rule = findBestRule(rules, current, tableId, phDates);
    const hourlyRate = rule?.hourly_rate ?? DEFAULT_HOURLY_RATE;
    const durationHours = (segEnd.getTime() - current.getTime()) / (1000 * 60 * 60);

    // Try to merge with previous segment if same rate
    const prev = segments[segments.length - 1];
    if (prev && prev.hourlyRate === hourlyRate && prev.rule?.id === rule?.id) {
      prev.endTime = segEnd;
      prev.durationHours += durationHours;
      prev.segmentCost = Math.round(prev.hourlyRate * prev.durationHours * 100) / 100;
    } else {
      const segmentCost = Math.round(hourlyRate * durationHours * 100) / 100;
      segments.push({
        startTime: new Date(current),
        endTime: segEnd,
        rule,
        hourlyRate,
        durationHours,
        segmentCost,
      });
    }

    current = segEnd;
  }

  const totalPrice = Math.round(segments.reduce((sum, s) => sum + s.segmentCost, 0) * 100) / 100;
  return { totalPrice, segments };
}

/**
 * Calculate promo discount.
 */
export function calculateDiscount(
  originalPrice: number,
  discountType: "percentage" | "fixed",
  discountValue: number,
  maxDiscountAmount: number | null
): number {
  let discount = discountType === "percentage"
    ? Math.round(originalPrice * (discountValue / 100) * 100) / 100
    : discountValue;

  if (maxDiscountAmount !== null && discount > maxDiscountAmount) {
    discount = maxDiscountAmount;
  }

  return Math.min(discount, originalPrice);
}
