import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PricingRule, PublicHoliday } from "@/lib/pricing";
import { apiFetch } from "@/lib/api";
import { getCached, setCache } from "@/lib/queryCache";
import { useToast } from "@/hooks/use-toast";

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

/**
 * Public list of public holidays — used by the frontend pricing engine
 * to determine PH / PH-eve dates.
 */
export function usePublicHolidays() {
  return useQuery<PublicHoliday[]>({
    queryKey: ["public-holidays"],
    queryFn: async () => {
      const res = await apiFetch("/api/admin/public-holidays");
      if (!res.ok) throw new Error("Failed to fetch public holidays");
      return res.json();
    },
    staleTime: 5 * 60 * 1000, // 5 min — PH list changes rarely
  });
}

/**
 * Returns a Set<string> of PH dates ("YYYY-MM-DD") for use in calculateBookingPrice.
 */
export function usePublicHolidaySet(): Set<string> {
  const { data: holidays = [] } = usePublicHolidays();
  return new Set(holidays.map((h) => h.date));
}

/**
 * Admin hooks for managing public holidays.
 */
export function useAdminPublicHolidays() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const holidays = useQuery<PublicHoliday[]>({
    queryKey: ["public-holidays"],
    queryFn: async () => {
      const res = await apiFetch("/api/admin/public-holidays");
      if (!res.ok) throw new Error("Failed to fetch public holidays");
      return res.json();
    },
  });

  const create = useMutation({
    mutationFn: async ({ date, name }: { date: string; name: string }) => {
      const res = await apiFetch("/api/membership/public-holidays", {
        method: "POST",
        body: JSON.stringify({ date, name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add holiday");
      return data;
    },
    onSuccess: () => {
      toast({ title: "Public holiday added" });
      qc.invalidateQueries({ queryKey: ["public-holidays"] });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiFetch(`/api/membership/public-holidays/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to remove holiday");
      return data;
    },
    onSuccess: () => {
      toast({ title: "Public holiday removed" });
      qc.invalidateQueries({ queryKey: ["public-holidays"] });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  return { ...holidays, create, remove };
}
