import { useQuery } from "@tanstack/react-query";
import { PricingRule } from "@/lib/pricing";
import { apiFetch } from "@/lib/api";
import { getCached, setCache } from "@/lib/queryCache";

/**
 * Public pricing rules fetched from the backend. Returns only active rules.
 */
export function usePricingRules() {
  return useQuery<PricingRule[]>({
    queryKey: ["pricing-rules-public"],
    queryFn: async () => {
      const res = await apiFetch("/api/admin/pricing-rules/public");
      if (!res.ok) throw new Error("Failed to fetch pricing rules");
      const raw = await res.json();
      const list = Array.isArray(raw) ? raw : (raw?.pricingRules || raw?.rules || []);
      const data: PricingRule[] = list.map((r: any) => ({
        id: r._id || r.id,
        name: r.name,
        start_time: r.startTime ?? r.start_time,
        end_time: r.endTime ?? r.end_time,
        hourly_rate: r.hourlyRate ?? r.hourly_rate,
        applies_to_weekdays: r.appliesToWeekdays ?? r.applies_to_weekdays ?? [],
        specific_date: r.specificDate ?? r.specific_date ?? null,
        applies_to_table_id: r.appliesToTableId ?? r.applies_to_table_id ?? null,
        priority: r.priority ?? 0,
        is_active: r.isActive ?? r.is_active ?? true,
      }));
      setCache("pricing-rules-public", data);
      return data;
    },
    initialData: () => getCached<PricingRule[]>("pricing-rules-public") ?? [],
  });
}
