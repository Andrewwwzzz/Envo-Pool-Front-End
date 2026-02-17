/**
 * Dynamic pricing calculation engine.
 * Supports global and per-table pricing rules with priority-based resolution.
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

const WEEKDAY_MAP: Record<number, string> = {
  0: "Sun", 1: "Mon", 2: "Tue", 3: "Wed", 4: "Thu", 5: "Fri", 6: "Sat",
};

function timeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(":").map(Number);
  return h * 60 + m;
}

function dateToTimeMinutes(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

/**
 * Find the best matching pricing rule for a specific moment in time and table.
 * Priority: specific_date + table > specific_date > table-specific > global
 * Within same scope, higher priority number wins.
 */
function findBestRule(
  rules: PricingRule[],
  dateTime: Date,
  tableId: string
): PricingRule | null {
  const weekday = WEEKDAY_MAP[dateTime.getDay()];
  const timeMin = dateToTimeMinutes(dateTime);
  const dateStr = dateTime.toISOString().split("T")[0]; // YYYY-MM-DD

  const matching = rules.filter((r) => {
    if (!r.is_active) return false;

    // Check time range
    const rStart = timeToMinutes(r.start_time);
    const rEnd = timeToMinutes(r.end_time);
    // Handle overnight ranges
    const inTimeRange = rEnd > rStart
      ? timeMin >= rStart && timeMin < rEnd
      : timeMin >= rStart || timeMin < rEnd;
    if (!inTimeRange) return false;

    // Check specific date or weekday
    if (r.specific_date) {
      if (r.specific_date !== dateStr) return false;
    } else {
      if (!r.applies_to_weekdays.includes(weekday)) return false;
    }

    // Check table scope
    if (r.applies_to_table_id && r.applies_to_table_id !== tableId) return false;

    return true;
  });

  if (matching.length === 0) return null;

  // Sort by specificity then priority
  matching.sort((a, b) => {
    // Specific date rules beat weekday rules
    const aDateScore = a.specific_date ? 2 : 0;
    const bDateScore = b.specific_date ? 2 : 0;
    // Table-specific rules beat global rules
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

const DEFAULT_HOURLY_RATE = 20; // fallback if no rules match

/**
 * Calculate booking price with multi-period support.
 * Splits the booking into 15-minute segments and applies the best matching rule for each.
 */
export function calculateBookingPrice(
  rules: PricingRule[],
  tableId: string,
  startTime: Date,
  endTime: Date
): { totalPrice: number; segments: PricingSegment[] } {
  const segments: PricingSegment[] = [];
  const intervalMs = 15 * 60 * 1000; // 15 minutes
  let current = new Date(startTime);

  while (current < endTime) {
    const segEnd = new Date(Math.min(current.getTime() + intervalMs, endTime.getTime()));
    const rule = findBestRule(rules, current, tableId);
    const hourlyRate = rule?.hourly_rate ?? DEFAULT_HOURLY_RATE;
    const durationHours = (segEnd.getTime() - current.getTime()) / (1000 * 60 * 60);
    const segmentCost = Math.round(hourlyRate * durationHours * 100) / 100;

    // Try to merge with previous segment if same rate
    const prev = segments[segments.length - 1];
    if (prev && prev.hourlyRate === hourlyRate && prev.rule?.id === rule?.id) {
      prev.endTime = segEnd;
      prev.durationHours += durationHours;
      prev.segmentCost = Math.round((prev.segmentCost + segmentCost) * 100) / 100;
    } else {
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

  // Can't discount more than original
  return Math.min(discount, originalPrice);
}
