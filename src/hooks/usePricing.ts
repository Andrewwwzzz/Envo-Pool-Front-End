import { useQuery } from "@tanstack/react-query";
import { PricingRule } from "@/lib/pricing";

/**
 * Pricing rules are managed locally in localStorage via the admin dashboard.
 * This hook reads them for use in booking price calculations.
 */
export function usePricingRules() {
  return useQuery({
    queryKey: ["admin-pricing-rules"],
    queryFn: async () => {
      try {
        const stored = localStorage.getItem("pricing-rules");
        return stored ? (JSON.parse(stored) as PricingRule[]) : [];
      } catch {
        return [];
      }
    },
    initialData: (): PricingRule[] => {
      try {
        const stored = localStorage.getItem("pricing-rules");
        return stored ? JSON.parse(stored) : [];
      } catch {
        return [];
      }
    },
  });
}
