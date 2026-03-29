import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api";

export function useAdminBookings() {
  return useQuery({
    queryKey: ["admin-bookings"],
    queryFn: async () => {
      const res = await apiFetch("/api/admin/bookings");
      if (!res.ok) throw new Error("Failed to fetch bookings");
      return await res.json();
    },
    refetchInterval: 30000,
  });
}

export function useDeleteBooking() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (bookingId: string) => {
      const res = await apiFetch(`/api/admin/bookings/${bookingId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete booking");
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
      const res = await apiFetch("/api/tables");
      if (!res.ok) throw new Error("Failed to fetch tables");
      const data = await res.json();
      return (data || []).map((t: any) => ({
        id: t._id || t.id,
        table_number: t.tableNumber ?? t.table_number,
        hardware_id: t.hardwareId ?? t.hardware_id ?? null,
        hourly_rate: t.hourlyRate ?? t.hourly_rate ?? null,
        status: t.status ?? "available",
        timer_started_at: t.timerStartedAt ?? t.timer_started_at ?? null,
        created_at: t.createdAt ?? t.created_at ?? "",
      }));
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ tableId, status }: { tableId: string; status: string }) => {
      const res = await apiFetch(`/api/admin/tables/${tableId}/status`, {
        method: "POST",
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Failed to update table status");
    },
    onSuccess: () => {
      toast({ title: "Table updated" });
      queryClient.invalidateQueries({ queryKey: ["admin-tables"] });
      queryClient.invalidateQueries({ queryKey: ["tables-with-status"] });
    },
  });

  const startTimer = useMutation({
    mutationFn: async ({ tableId, hourlyRate }: { tableId: string; hourlyRate: number }) => {
      const res = await apiFetch(`/api/admin/tables/${tableId}/start-timer`, {
        method: "POST",
        body: JSON.stringify({ hourlyRate }),
      });
      if (!res.ok) throw new Error("Failed to start timer");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-tables"] });
      queryClient.invalidateQueries({ queryKey: ["tables-with-status"] });
    },
  });

  const stopTimer = useMutation({
    mutationFn: async ({ tableId, durationSeconds, hourlyRate, startedAt }: { tableId: string; durationSeconds: number; hourlyRate: number; startedAt: string }) => {
      const res = await apiFetch(`/api/admin/tables/${tableId}/stop-timer`, {
        method: "POST",
        body: JSON.stringify({ durationSeconds, hourlyRate, startedAt }),
      });
      if (!res.ok) throw new Error("Failed to stop timer");
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-tables"] });
      queryClient.invalidateQueries({ queryKey: ["admin-timer-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["tables-with-status"] });
    },
  });

  const setMaintenance = useMutation({
    mutationFn: async ({ tableId, maintenance }: { tableId: string; maintenance: boolean }) => {
      const res = await apiFetch(`/api/admin/tables/${tableId}/status`, {
        method: "POST",
        body: JSON.stringify({ status: maintenance ? "maintenance" : "available" }),
      });
      if (!res.ok) throw new Error("Failed to update table status");
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
      const res = await apiFetch("/api/admin/timer-sessions");
      if (!res.ok) throw new Error("Failed to fetch timer sessions");
      return await res.json();
    },
  });
}

export function useAdminPricingRules() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const query = useQuery({
    queryKey: ["admin-pricing-rules"],
    queryFn: async () => {
      const res = await apiFetch("/api/admin/pricing-rules");
      if (!res.ok) throw new Error("Failed to fetch pricing rules");
      return await res.json();
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
      const res = await apiFetch("/api/admin/pricing-rules", {
        method: "POST",
        body: JSON.stringify(rule),
      });
      if (!res.ok) throw new Error("Failed to create pricing rule");
    },
    onSuccess: () => {
      toast({ title: "Pricing rule created" });
      queryClient.invalidateQueries({ queryKey: ["admin-pricing-rules"] });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiFetch(`/api/admin/pricing-rules/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete pricing rule");
    },
    onSuccess: () => {
      toast({ title: "Pricing rule deleted" });
      queryClient.invalidateQueries({ queryKey: ["admin-pricing-rules"] });
    },
  });

  const toggle = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const res = await apiFetch(`/api/admin/pricing-rules/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ is_active }),
      });
      if (!res.ok) throw new Error("Failed to toggle pricing rule");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-pricing-rules"] });
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
      const res = await apiFetch(`/api/admin/pricing-rules/${id}`, {
        method: "PUT",
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error("Failed to update pricing rule");
    },
    onSuccess: () => {
      toast({ title: "Pricing rule updated" });
      queryClient.invalidateQueries({ queryKey: ["admin-pricing-rules"] });
      
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
      const res = await apiFetch("/api/admin/promo-codes");
      if (!res.ok) throw new Error("Failed to fetch promo codes");
      return await res.json();
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
      const res = await apiFetch("/api/admin/promo-codes", {
        method: "POST",
        body: JSON.stringify({ ...promo, code: promo.code.toUpperCase() }),
      });
      if (!res.ok) throw new Error("Failed to create promo code");
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
      const res = await apiFetch(`/api/admin/promo-codes/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ is_active }),
      });
      if (!res.ok) throw new Error("Failed to toggle promo code");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-promo-codes"] });
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiFetch(`/api/admin/promo-codes/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete promo code");
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
      const res = await apiFetch(`/api/admin/bookings/${bookingId}/status`, {
        method: "POST",
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Failed to update booking status");
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
      const res = await apiFetch("/api/admin/stats");
      if (!res.ok) throw new Error("Failed to fetch stats");
      return await res.json();
    },
    refetchInterval: 60000,
  });
}

export function useAdminCustomers(searchTerm: string) {
  return useQuery({
    queryKey: ["admin-customers", searchTerm],
    queryFn: async () => {
      const params = searchTerm.trim() ? `?search=${encodeURIComponent(searchTerm)}` : "";
      const res = await apiFetch(`/api/admin/customers${params}`);
      if (!res.ok) throw new Error("Failed to fetch customers");
      return await res.json();
    },
  });
}

export function useCustomerBookings(userId: string) {
  return useQuery({
    queryKey: ["admin-customer-bookings", userId],
    queryFn: async () => {
      const res = await apiFetch(`/api/admin/customers/${userId}/bookings`);
      if (!res.ok) throw new Error("Failed to fetch customer bookings");
      return await res.json();
    },
    enabled: !!userId,
  });
}

export function useCustomerWalletHistory(userId: string) {
  return useQuery({
    queryKey: ["admin-customer-wallet", userId],
    queryFn: async () => {
      const res = await apiFetch(`/api/admin/customers/${userId}/wallet`);
      if (!res.ok) throw new Error("Failed to fetch wallet history");
      return await res.json();
    },
    enabled: !!userId,
  });
}

export function useCustomerRewardHistory(userId: string) {
  return useQuery({
    queryKey: ["admin-customer-rewards", userId],
    queryFn: async () => {
      const res = await apiFetch(`/api/admin/customers/${userId}/rewards`);
      if (!res.ok) throw new Error("Failed to fetch reward history");
      return await res.json();
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
      const res = await apiFetch(`/api/admin/customers/${userId}`, {
        method: "PATCH",
        body: JSON.stringify({ walletBalance: wallet_balance, rewardPoints: reward_points }),
      });
      if (!res.ok) throw new Error("Failed to update customer");
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

export function useDeleteCustomer() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (userId: string) => {
      const res = await apiFetch(`/api/admin/customers/${userId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete customer");
    },
    onSuccess: () => {
      toast({ title: "Customer deleted" });
      queryClient.invalidateQueries({ queryKey: ["admin-customers"] });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });
}
