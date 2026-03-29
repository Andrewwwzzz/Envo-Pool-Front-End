import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { PricingRule } from "@/lib/pricing";

export function usePricingRules() {
  return useQuery({
    queryKey: ["pricing-rules"],
    queryFn: async (): Promise<PricingRule[]> => {
      const res = await apiFetch("/api/pricing-rules");
      if (!res.ok) throw new Error("Failed to fetch pricing rules");
      const data = await res.json();
      return (data || []).map((r: any) => ({
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
        created_at: r.createdAt ?? r.created_at ?? "",
      })) as PricingRule[];
    },
  });
}
