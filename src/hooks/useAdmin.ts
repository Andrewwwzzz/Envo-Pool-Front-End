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

export function useDeleteBooking() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (bookingId: string) => {
      // Delete related promo_usage first
      await supabase.from("promo_usage").delete().eq("booking_id", bookingId);
      const { error } = await supabase.from("bookings").delete().eq("id", bookingId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Booking deleted" });
      queryClient.invalidateQueries({ queryKey: ["admin-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["tables-with-status"] });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
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
      queryClient.invalidateQueries({ queryKey: ["tables-with-status"] });
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
      queryClient.invalidateQueries({ queryKey: ["tables-with-status"] });
    },
  });

  const stopTimer = useMutation({
    mutationFn: async ({ tableId, durationSeconds, hourlyRate, startedAt }: { tableId: string; durationSeconds: number; hourlyRate: number; startedAt: string }) => {
      const totalCost = Math.round((durationSeconds / 3600) * hourlyRate * 100) / 100;

      // Save invoice record
      const { error: invoiceErr } = await supabase.from("timer_sessions").insert({
        table_id: tableId,
        started_at: startedAt,
        ended_at: new Date().toISOString(),
        duration_seconds: durationSeconds,
        hourly_rate: hourlyRate,
        total_cost: totalCost,
      });
      if (invoiceErr) throw invoiceErr;

      // Reset table
      const { error } = await supabase
        .from("tables")
        .update({ status: "available", timer_started_at: null })
        .eq("id", tableId);
      if (error) throw error;

      return { totalCost, durationSeconds };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-tables"] });
      queryClient.invalidateQueries({ queryKey: ["admin-timer-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["tables-with-status"] });
    },
  });

  const setMaintenance = useMutation({
    mutationFn: async ({ tableId, maintenance }: { tableId: string; maintenance: boolean }) => {
      const { error } = await supabase
        .from("tables")
        .update({ status: maintenance ? "maintenance" : "available" })
        .eq("id", tableId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Table status updated" });
      queryClient.invalidateQueries({ queryKey: ["admin-tables"] });
      queryClient.invalidateQueries({ queryKey: ["tables-with-status"] });
    },
  });

  return { ...tablesQuery, updateStatus, startTimer, stopTimer, setMaintenance };
}

export function useAdminTimerSessions() {
  return useQuery({
    queryKey: ["admin-timer-sessions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("timer_sessions")
        .select("*, tables(table_number)")
        .order("ended_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data || [];
    },
  });
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

  const update = useMutation({
    mutationFn: async (rule: {
      id: string;
      name: string;
      start_time: string;
      end_time: string;
      hourly_rate: number;
      applies_to_weekdays: string[];
      specific_date?: string | null;
      applies_to_table_id?: string | null;
      priority: number;
    }) => {
      const { id, ...updates } = rule;
      const { error } = await supabase.from("pricing_rules").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Pricing rule updated" });
      queryClient.invalidateQueries({ queryKey: ["admin-pricing-rules"] });
      queryClient.invalidateQueries({ queryKey: ["pricing-rules"] });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  return { ...query, create, remove, toggle, update };
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

export function useUpdateBookingStatus() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ bookingId, status }: { bookingId: string; status: string }) => {
      const { error } = await supabase
        .from("bookings")
        .update({ status })
        .eq("id", bookingId);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      toast({ title: `Booking marked as ${variables.status}` });
      queryClient.invalidateQueries({ queryKey: ["admin-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
      queryClient.invalidateQueries({ queryKey: ["tables-with-status"] });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });
}

export function useAdminStats() {
  return useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const now = new Date();
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date(now);
      todayEnd.setHours(23, 59, 59, 999);

      // Week start (Monday)
      const weekStart = new Date(now);
      const dayOfWeek = weekStart.getDay();
      const diffToMon = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      weekStart.setDate(weekStart.getDate() - diffToMon);
      weekStart.setHours(0, 0, 0, 0);

      // Month start
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      const { data: todayBookings } = await supabase
        .from("bookings")
        .select("*")
        .gte("start_time", todayStart.toISOString())
        .lte("start_time", todayEnd.toISOString());

      const { data: weekBookings } = await supabase
        .from("bookings")
        .select("id, final_price, status")
        .gte("start_time", weekStart.toISOString())
        .in("status", ["confirmed", "completed"]);

      const { data: monthBookings } = await supabase
        .from("bookings")
        .select("id, final_price, status, duration_hours")
        .gte("start_time", monthStart.toISOString())
        .in("status", ["confirmed", "completed"]);

      const { data: allBookings } = await supabase
        .from("bookings")
        .select("id, final_price, status")
        .in("status", ["confirmed", "completed"]);

      const { data: tables } = await supabase.from("tables").select("id");

      const todayRevenue = (todayBookings || [])
        .filter((b) => b.status === "confirmed" || b.status === "completed")
        .reduce((sum, b) => sum + (b.final_price || 0), 0);

      const weekRevenue = (weekBookings || []).reduce((sum, b) => sum + (b.final_price || 0), 0);
      const monthRevenue = (monthBookings || []).reduce((sum, b) => sum + (b.final_price || 0), 0);

      // Average session length from month bookings
      const completedWithDuration = (monthBookings || []).filter((b: any) => b.duration_hours > 0);
      const avgSessionHours = completedWithDuration.length > 0
        ? completedWithDuration.reduce((sum: number, b: any) => sum + Number(b.duration_hours), 0) / completedWithDuration.length
        : 0;

      const totalBookings = allBookings?.length || 0;

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
        weekRevenue,
        monthRevenue,
        avgSessionHours: Math.round(avgSessionHours * 10) / 10,
        totalBookings,
        utilisation,
      };
    },
    refetchInterval: 60000,
  });
}

export function useAdminCustomers(searchTerm: string) {
  return useQuery({
    queryKey: ["admin-customers", searchTerm],
    queryFn: async () => {
      let query = supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (searchTerm.trim()) {
        query = query.or(`email.ilike.%${searchTerm}%,name.ilike.%${searchTerm}%`);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });
}

export function useCustomerBookings(userId: string) {
  return useQuery({
    queryKey: ["admin-customer-bookings", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("*, tables(table_number)")
        .eq("user_id", userId)
        .order("start_time", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
    enabled: !!userId,
  });
}

export function useCustomerWalletHistory(userId: string) {
  return useQuery({
    queryKey: ["admin-customer-wallet", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wallet_transactions")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
    enabled: !!userId,
  });
}

export function useCustomerRewardHistory(userId: string) {
  return useQuery({
    queryKey: ["admin-customer-rewards", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reward_transactions")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
    enabled: !!userId,
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
      // Get current profile to calculate difference
      const { data: currentProfile, error: fetchErr } = await supabase
        .from("profiles")
        .select("wallet_balance, reward_points")
        .eq("user_id", userId)
        .single();
      if (fetchErr) throw fetchErr;

      const updates: Record<string, number> = {};
      if (wallet_balance !== undefined) updates.wallet_balance = wallet_balance;
      if (reward_points !== undefined) updates.reward_points = reward_points;

      const { error } = await supabase
        .from("profiles")
        .update(updates)
        .eq("user_id", userId);
      if (error) throw error;

      // Log wallet transaction if balance changed
      if (wallet_balance !== undefined && currentProfile) {
        const diff = wallet_balance - currentProfile.wallet_balance;
        if (diff !== 0) {
          await supabase.from("wallet_transactions").insert({
            user_id: userId,
            type: "adjustment",
            amount: diff,
            balance_after: wallet_balance,
          });
        }
      }

      // Log reward transaction if points changed
      if (reward_points !== undefined && currentProfile) {
        const diff = reward_points - currentProfile.reward_points;
        if (diff !== 0) {
          await supabase.from("reward_transactions").insert({
            user_id: userId,
            type: "adjustment",
            points: diff,
          });
        }
      }
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
