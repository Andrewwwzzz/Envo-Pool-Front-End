import { PricingRule } from "@/lib/pricing";

/**
 * Pricing rules are managed locally in the frontend.
 * No backend endpoint exists for this — return empty array
 * so the default hourly rate ($20) is used by calculateBookingPrice.
 */
export function usePricingRules() {
  return { data: [] as PricingRule[], isLoading: false, error: null };
}
