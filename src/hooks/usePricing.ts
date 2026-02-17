import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PricingRule } from "@/lib/pricing";

export function usePricingRules() {
  return useQuery({
    queryKey: ["pricing-rules"],
    queryFn: async (): Promise<PricingRule[]> => {
      const { data, error } = await supabase
        .from("pricing_rules")
        .select("*")
        .eq("is_active", true)
        .order("priority", { ascending: false });
      if (error) throw error;
      return (data || []) as PricingRule[];
    },
  });
}
