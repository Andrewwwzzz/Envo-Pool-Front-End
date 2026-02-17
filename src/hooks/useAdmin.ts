import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export function useAdminBookings() {
  return useQuery({
    queryKey: ["admin-bookings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("*, tables(table_number)")
        .order("start_time", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 30000,
  });
}

export function useAdminTables() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const tablesQuery = useQuery({
    queryKey: ["admin-tables"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tables")
        .select("*")
        .order("table_number");
      if (error) throw error;
      return data || [];
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ tableId, status }: { tableId: string; status: string }) => {
      const { error } = await supabase
        .from("tables")
        .update({ status })
        .eq("id", tableId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Table updated" });
      queryClient.invalidateQueries({ queryKey: ["admin-tables"] });
    },
  });

  const startTimer = useMutation({
    mutationFn: async ({ tableId, hourlyRate }: { tableId: string; hourlyRate: number }) => {
      const { error } = await supabase
        .from("tables")
        .update({ status: "available", timer_started_at: new Date().toISOString(), hourly_rate: hourlyRate })
        .eq("id", tableId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-tables"] });
    },
  });

  const stopTimer = useMutation({
    mutationFn: async ({ tableId }: { tableId: string }) => {
      const { error } = await supabase
        .from("tables")
        .update({ status: "maintenance", timer_started_at: null })
        .eq("id", tableId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-tables"] });
    },
  });

  return { ...tablesQuery, updateStatus, startTimer, stopTimer };
}

export function useAdminPricingRules() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const query = useQuery({
    queryKey: ["admin-pricing-rules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pricing_rules")
        .select("*")
        .order("priority", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const create = useMutation({
    mutationFn: async (rule: {
      name: string;
      start_time: string;
      end_time: string;
      hourly_rate: number;
      applies_to_weekdays: string[];
      specific_date?: string | null;
      applies_to_table_id?: string | null;
      priority: number;
      is_active: boolean;
    }) => {
      const { error } = await supabase.from("pricing_rules").insert(rule);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Pricing rule created" });
      queryClient.invalidateQueries({ queryKey: ["admin-pricing-rules"] });
      queryClient.invalidateQueries({ queryKey: ["pricing-rules"] });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("pricing_rules").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Pricing rule deleted" });
      queryClient.invalidateQueries({ queryKey: ["admin-pricing-rules"] });
      queryClient.invalidateQueries({ queryKey: ["pricing-rules"] });
    },
  });

  const toggle = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("pricing_rules").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-pricing-rules"] });
      queryClient.invalidateQueries({ queryKey: ["pricing-rules"] });
    },
  });

  return { ...query, create, remove, toggle };
}

export function useAdminPromoCodes() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const query = useQuery({
    queryKey: ["admin-promo-codes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("promo_codes")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const create = useMutation({
    mutationFn: async (promo: {
      code: string;
      discount_type: string;
      discount_value: number;
      minimum_spend?: number | null;
      max_discount_amount?: number | null;
      usage_limit?: number | null;
      per_user_limit?: number | null;
      applies_to_table_id?: string | null;
      expiry_date?: string | null;
      is_active: boolean;
    }) => {
      const { error } = await supabase.from("promo_codes").insert({
        ...promo,
        code: promo.code.toUpperCase(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Promo code created" });
      queryClient.invalidateQueries({ queryKey: ["admin-promo-codes"] });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const toggle = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("promo_codes").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-promo-codes"] });
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("promo_codes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Promo code deleted" });
      queryClient.invalidateQueries({ queryKey: ["admin-promo-codes"] });
    },
  });

  return { ...query, create, toggle, remove };
}

export function useAdminStats() {
  return useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);

      const { data: todayBookings } = await supabase
        .from("bookings")
        .select("*")
        .gte("start_time", todayStart.toISOString())
        .lte("start_time", todayEnd.toISOString());

      const { data: allBookings } = await supabase
        .from("bookings")
        .select("id, final_price, status")
        .in("status", ["confirmed", "completed"]);

      const { data: tables } = await supabase.from("tables").select("id");

      const todayRevenue = (todayBookings || [])
        .filter((b) => b.status === "confirmed" || b.status === "completed")
        .reduce((sum, b) => sum + (b.final_price || 0), 0);

      const totalBookings = allBookings?.length || 0;

      // Table utilisation: % of tables with confirmed bookings today
      const tablesWithBookingsToday = new Set(
        (todayBookings || [])
          .filter((b) => b.status === "confirmed" || b.status === "completed")
          .map((b) => b.table_id)
      );
      const utilisation = tables?.length
        ? Math.round((tablesWithBookingsToday.size / tables.length) * 100)
        : 0;

      return {
        todayBookings: todayBookings?.length || 0,
        todayRevenue,
        totalBookings,
        utilisation,
      };
    },
    refetchInterval: 60000,
  });
}

export function useAdminCustomers(searchEmail: string) {
  return useQuery({
    queryKey: ["admin-customers", searchEmail],
    queryFn: async () => {
      if (!searchEmail.trim()) return [];
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .ilike("email", `%${searchEmail}%`)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
    enabled: searchEmail.trim().length > 0,
  });
}

export function useUpdateCustomerProfile() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      userId,
      wallet_balance,
      reward_points,
    }: {
      userId: string;
      wallet_balance?: number;
      reward_points?: number;
    }) => {
      const updates: Record<string, number> = {};
      if (wallet_balance !== undefined) updates.wallet_balance = wallet_balance;
      if (reward_points !== undefined) updates.reward_points = reward_points;

      const { error } = await supabase
        .from("profiles")
        .update(updates)
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Customer updated" });
      queryClient.invalidateQueries({ queryKey: ["admin-customers"] });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });
}
