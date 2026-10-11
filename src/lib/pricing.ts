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
  created_at?: string | null; // only used to order ties (older rule first, as the server does)
}

export interface PublicHoliday {
  _id?: string;
  date: string; // YYYY-MM-DD
  name: string;
}

const SGT_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const PRICE_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function timeToMinutes(timeStr: string): number {
  const [h, m] = String(timeStr || "00:00").split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** SGT time of day (minutes), SGT calendar date and operational date (before 4am = previous day). */
function sgtParts(dateTime: Date) {
  const sgt = new Date(dateTime.getTime() + SGT_MS);
  const timeMin = sgt.getUTCHours() * 60 + sgt.getUTCMinutes();
  const dateStr = sgt.toISOString().slice(0, 10);
  const opDateStr = timeMin < 4 * 60
    ? new Date(dateTime.getTime() + SGT_MS - DAY_MS).toISOString().slice(0, 10)
    : dateStr;
  return { timeMin, dateStr, opDateStr };
}

/**
 * PH and PH-eve operational days also count as Fri/Sat/Sun for pricing.
 * The real weekday is kept alongside, so a rule covering ["Fri","Sat","Sun"]
 * matches on a PH or PH eve even if the calendar day is a Tuesday.
 */
function extraWeekdaysForPH(opDateStr: string, phDates: Set<string>): string[] {
  if (phDates.has(opDateStr)) return ["Fri", "Sat", "Sun"];
  const [y, mo, dy] = opDateStr.split("-").map(Number);
  const nextStr = new Date(Date.UTC(y, mo - 1, dy + 1)).toISOString().slice(0, 10);
  return phDates.has(nextStr) ? ["Fri", "Sat", "Sun"] : [];
}

/**
 * Whether a moment falls on a public holiday or PH eve, judged on the
 * operational day (before 4am SGT = previous day), like the server.
 */
export function isPHOrPHEve(dateTime: Date, phDates: Set<string>): boolean {
  return extraWeekdaysForPH(sgtParts(dateTime).opDateStr, phDates).length > 0;
}

/**
 * Put rules in the server's order (priority desc, then older first, then lower
 * id) so a tie between equally specific rules resolves the same way here.
 */
export function sortPricingRules(rules: PricingRule[]): PricingRule[] {
  const created = (r: PricingRule) => (r.created_at ? new Date(r.created_at).getTime() || 0 : 0);
  const byId = (a: PricingRule, b: PricingRule) => (String(a.id) < String(b.id) ? -1 : String(a.id) > String(b.id) ? 1 : 0);
  return [...rules].sort((a, b) =>
    ((b.priority || 0) - (a.priority || 0)) || (created(a) - created(b)) || byId(a, b)
  );
}

/**
 * The pricing rule for one moment on one table. Mirrors the server's
 * findBestRule (utils/pricingRules.js):
 *   time  - SGT time of day inside the rule's start/end (overnight allowed)
 *   date  - a rule with a specific_date applies on that SGT calendar date only
 *           (its weekdays are ignored); otherwise its weekdays are matched
 *           against the operational day (before 4am = previous day), plus
 *           Fri/Sat/Sun on a PH or PH-eve
 *   table - a per-table rule applies only to that table, whether it names the
 *           table's hardware_id or its _id (tableIds should list both)
 * Winner: most specific (date + table > date > table > general), then highest
 * priority, then the order the rules were given in (see sortPricingRules).
 */
function findBestRule(
  rules: PricingRule[],
  dateTime: Date,
  tableIds: string[],
  phDates: Set<string> = new Set()
): PricingRule | null {
  const { timeMin, dateStr, opDateStr } = sgtParts(dateTime);
  const weekday = PRICE_DAYS[new Date(opDateStr + "T00:00:00Z").getUTCDay()];
  const effectiveWeekdays = [weekday, ...extraWeekdaysForPH(opDateStr, phDates)];
  const ids = tableIds.filter(Boolean).map(String);

  const matching = rules.filter((r) => {
    if (!r.is_active) return false;

    // Check time range
    const rStart = timeToMinutes(r.start_time);
    const rEnd = timeToMinutes(r.end_time);
    const inTimeRange = rEnd > rStart
      ? timeMin >= rStart && timeMin < rEnd
      : timeMin >= rStart || timeMin < rEnd;
    if (!inTimeRange) return false;

    // Specific date: the SGT calendar date. Weekdays: the operational day (+ PH bonus days)
    if (r.specific_date) {
      if (r.specific_date !== dateStr) return false;
    } else if (!effectiveWeekdays.some((d) => (r.applies_to_weekdays || []).includes(d))) {
      return false;
    }

    // Table scope — either of the table's ids
    if (r.applies_to_table_id && !ids.includes(String(r.applies_to_table_id))) return false;

    return true;
  });

  if (matching.length === 0) return null;

  // Sort by specificity then priority. Array sort is stable, so an equal score
  // and priority keeps the given (server) order.
  const score = (r: PricingRule) => (r.specific_date ? 2 : 0) + (r.applies_to_table_id ? 1 : 0);
  matching.sort((a, b) => (score(b) - score(a)) || ((b.priority || 0) - (a.priority || 0)));

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

const DEFAULT_HOURLY_RATE = 13.5; // fallback if no rules match (same as the server)

/** A segment's cost: its whole length at its rate, rounded to the cent once (as the server does). */
function segmentCost(hourlyRate: number, durationHours: number): number {
  return Math.round(Number((hourlyRate * durationHours * 100).toFixed(6))) / 100;
}

/**
 * The hourly rate in effect right now (no specific table — global/default
 * rules only), for prefilling admin "start timer" rate inputs so staff see
 * today's actual rate instead of a stale hardcoded default.
 */
export function getCurrentHourlyRate(
  rules: PricingRule[],
  phDates: Set<string> = new Set()
): number {
  const rule = findBestRule(rules, new Date(), [], phDates);
  return rule?.hourly_rate ?? DEFAULT_HOURLY_RATE;
}

/**
 * Calculate booking price the way the server prices an online booking:
 * 30-minute slots from the start, each priced by the rule in effect at the
 * slot's start; consecutive slots with the same rate and rule merge, and each
 * segment is rounded to the cent once.
 * Pass the table's _id and hardware_id (a per-table rule may name either) and
 * phDates (Set of "YYYY-MM-DD") for public-holiday-aware pricing.
 */
export function calculateBookingPrice(
  rules: PricingRule[],
  tableId: string | string[],
  startTime: Date,
  endTime: Date,
  phDates: Set<string> = new Set()
): { totalPrice: number; segments: PricingSegment[] } {
  const tableIds = Array.isArray(tableId) ? tableId : [tableId];
  const segments: PricingSegment[] = [];
  const intervalMs = 30 * 60 * 1000; // 30 minutes, like the server
  let current = new Date(startTime);

  while (current < endTime) {
    const segEnd = new Date(Math.min(current.getTime() + intervalMs, endTime.getTime()));
    const rule = findBestRule(rules, current, tableIds, phDates);
    const hourlyRate = rule?.hourly_rate ?? DEFAULT_HOURLY_RATE;
    const durationHours = (segEnd.getTime() - current.getTime()) / (1000 * 60 * 60);

    // Merge with the previous segment if same rate and rule (the server compares rule names)
    const prev = segments[segments.length - 1];
    if (prev && prev.hourlyRate === hourlyRate && (prev.rule?.name ?? "Default") === (rule?.name ?? "Default")) {
      prev.endTime = segEnd;
      prev.durationHours = (segEnd.getTime() - prev.startTime.getTime()) / (1000 * 60 * 60);
      prev.segmentCost = segmentCost(prev.hourlyRate, prev.durationHours);
    } else {
      segments.push({
        startTime: new Date(current),
        endTime: segEnd,
        rule,
        hourlyRate,
        durationHours,
        segmentCost: segmentCost(hourlyRate, durationHours),
      });
    }

    current = segEnd;
  }

  const totalPrice = parseFloat(segments.reduce((sum, s) => sum + s.segmentCost, 0).toFixed(2));
  return { totalPrice, segments };
}

/**
 * Calculate promo discount the way the server does: a percentage is rounded to
 * the cent and capped at the max discount (when one is set); a fixed amount is
 * capped only by the price.
 */
export function calculateDiscount(
  originalPrice: number,
  discountType: "percentage" | "fixed",
  discountValue: number,
  maxDiscountAmount: number | null
): number {
  let discount: number;
  if (discountType === "percentage") {
    discount = parseFloat(((originalPrice * discountValue) / 100).toFixed(2));
    if (maxDiscountAmount) discount = Math.min(discount, maxDiscountAmount);
  } else {
    discount = Math.min(discountValue, originalPrice);
  }
  return parseFloat(discount.toFixed(2));
}
