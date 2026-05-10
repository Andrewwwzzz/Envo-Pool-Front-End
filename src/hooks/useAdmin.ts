import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api";
import { getCached, setCache } from "@/lib/queryCache";

export function useAdminBookings() {
  return useQuery({
    queryKey: ["admin-bookings"],
    queryFn: async () => {
      const res = await apiFetch("/api/bookings");
      if (!res.ok) throw new Error("Failed to fetch bookings");
      const data = await res.json();
      setCache("admin-bookings", data);
      return data;
    },
    refetchInterval: 30000,
    initialData: () => getCached("admin-bookings"),
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
      queryClient.invalidateQueries({ queryKey: ["admin-booking-logs"] });
      queryClient.invalidateQueries({ queryKey: ["admin-activity-logs"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
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
      const mapped = (data || []).map((t: any) => ({
        id: t._id || t.id,
        table_number: t.tableNumber ?? t.table_number,
        hardware_id: t.hardwareId ?? t.hardware_id ?? null,
        hourly_rate: t.hourlyRate ?? t.hourly_rate ?? null,
        status: t.status ?? "available",
        timer_started_at: t.timerStartedAt ?? t.timer_started_at ?? null,
        created_at: t.createdAt ?? t.created_at ?? "",
      }));
      setCache("admin-tables", mapped);
      return mapped;
    },
    initialData: () => getCached("admin-tables") ?? [],
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
      const data = await res.json();
      setCache("admin-timer-sessions", data);
      return data;
    },
    initialData: () => getCached("admin-timer-sessions"),
  });
}

export function useAdminPricingRules() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const STORAGE_KEY = "pricing-rules";

  const loadRules = (): any[] => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  };

  const saveRules = (rules: any[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rules));
    queryClient.setQueryData(["admin-pricing-rules"], rules);
  };

  const query = useQuery({
    queryKey: ["admin-pricing-rules"],
    queryFn: async () => loadRules(),
    initialData: () => loadRules(),
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
      const rules = loadRules();
      const newRule = { ...rule, id: crypto.randomUUID() };
      rules.push(newRule);
      saveRules(rules);
      return newRule;
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
      const rules = loadRules().filter((r: any) => r.id !== id);
      saveRules(rules);
    },
    onSuccess: () => {
      toast({ title: "Pricing rule deleted" });
      queryClient.invalidateQueries({ queryKey: ["admin-pricing-rules"] });
    },
  });

  const toggle = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const rules = loadRules().map((r: any) => r.id === id ? { ...r, is_active } : r);
      saveRules(rules);
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
      const rules = loadRules().map((r: any) => r.id === id ? { ...r, ...updates } : r);
      saveRules(rules);
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
      const data = await res.json();
      setCache("admin-promo-codes", data);
      return data;
    },
    initialData: () => getCached("admin-promo-codes"),
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
      queryClient.invalidateQueries({ queryKey: ["admin-booking-logs"] });
      queryClient.invalidateQueries({ queryKey: ["admin-activity-logs"] });
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
      // Try /api/admin/dashboard first, fall back to computing from bookings
      try {
        const res = await apiFetch("/api/admin/dashboard");
        if (res.ok) {
          const data = await res.json();
          const stats = {
            totalBookings: data.totalBookings ?? 0,
            totalRevenue: data.totalRevenue ?? 0,
            totalUsers: data.totalUsers ?? 0,
            totalTransactions: data.totalTransactions ?? 0,
            activeBookings: data.activeBookings ?? 0,
            pendingBookings: data.pendingBookings ?? 0,
          };
          setCache("admin-stats", stats);
          return stats;
        }
      } catch {}

      // Fallback: compute from bookings
      const res = await apiFetch("/api/bookings");
      const bookings = res.ok ? await res.json() : [];
      const all = Array.isArray(bookings) ? bookings : [];
      const stats = {
        totalBookings: all.length,
        activeBookings: all.filter((b: any) => b.status === "confirmed").length,
        totalRevenue: all.reduce((sum: number, b: any) => sum + (b.amount ?? 0), 0),
        pendingBookings: all.filter((b: any) => b.status === "pending" || b.status === "pending_payment").length,
        totalUsers: 0,
        totalTransactions: 0,
      };
      setCache("admin-stats", stats);
      return stats;
    },
    refetchInterval: 60000,
    initialData: () => getCached("admin-stats"),
  });
}

export function useAdminCustomers(searchTerm: string) {
  return useQuery({
    queryKey: ["admin-customers", searchTerm],
    queryFn: async () => {
      const params = searchTerm.trim() ? `?search=${encodeURIComponent(searchTerm)}` : "";
      const res = await apiFetch(`/api/users${params}`);
      if (!res.ok) throw new Error("Failed to fetch users");
      const data = await res.json();
      console.log("USERS:", data);
      const users = Array.isArray(data) ? data : data.users || [];
      const mapped = users.map((c: any) => ({
        id: c._id || c.id,
        user_id: c._id || c.id || c.user_id,
        name: c.name || "",
        email: c.email || "",
        phone: c.phone || null,
        date_of_birth: c.dateOfBirth ?? c.date_of_birth ?? null,
        wallet_balance: c.walletBalance ?? c.wallet_balance ?? 0,
        reward_points: c.rewardPoints ?? c.reward_points ?? 0,
        total_spent: c.totalSpent ?? c.total_spent ?? 0,
        age_verified: c.ageVerified ?? c.age_verified ?? false,
        isVerified: c.isVerified ?? false,
        role: c.role ?? "user",
        created_at: c.createdAt ?? c.created_at ?? "",
      }));
      setCache("admin-customers", mapped);
      return mapped;
    },
    initialData: () => getCached("admin-customers") ?? [],
  });
}

export function useCustomerBookings(userId: string) {
  return useQuery({
    queryKey: ["admin-customer-bookings", userId],
    queryFn: async () => {
      const res = await apiFetch(`/api/admin/bookings/customers/${userId}/bookings`);
      if (!res.ok) throw new Error("Failed to fetch customer bookings");
      const data = await res.json();
      setCache(`customer-bookings-${userId}`, data);
      return data;
    },
    enabled: !!userId,
    initialData: () => userId ? getCached(`customer-bookings-${userId}`) : undefined,
  });
}

export function useCustomerWalletHistory(userId: string) {
  return useQuery({
    queryKey: ["admin-customer-wallet", userId],
    queryFn: async () => {
      const res = await apiFetch(`/api/admin/bookings/customers/${userId}/wallet`);
      if (!res.ok) throw new Error("Failed to fetch wallet history");
      const data = await res.json();
      setCache(`customer-wallet-${userId}`, data);
      return data;
    },
    enabled: !!userId,
    initialData: () => userId ? getCached(`customer-wallet-${userId}`) : undefined,
  });
}

export function useCustomerRewardHistory(userId: string) {
  return useQuery({
    queryKey: ["admin-customer-rewards", userId],
    queryFn: async () => {
      const res = await apiFetch(`/api/admin/bookings/customers/${userId}/rewards`);
      if (!res.ok) throw new Error("Failed to fetch reward history");
      const data = await res.json();
      setCache(`customer-rewards-${userId}`, data);
      return data;
    },
    enabled: !!userId,
    initialData: () => userId ? getCached(`customer-rewards-${userId}`) : undefined,
  });
}

export function useUpdateCustomerWallet() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      userId,
      walletBalance,
      walletDelta,
      points,
      pointsDelta,
    }: {
      userId: string;
      walletBalance?: number;
      walletDelta?: number;
      points?: number;
      pointsDelta?: number;
    }) => {
      const payload: Record<string, number> = {};
      if (walletBalance !== undefined) payload.walletBalance = walletBalance;
      if (walletDelta !== undefined) payload.walletDelta = walletDelta;
      if (points !== undefined) payload.points = points;
      if (pointsDelta !== undefined) payload.pointsDelta = pointsDelta;

      const res = await apiFetch(`/api/users/${userId}/wallet`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to update wallet");
      }
    },
    onSuccess: () => {
      toast({ title: "Customer updated" });
      queryClient.invalidateQueries({ queryKey: ["admin-customers"] });
      queryClient.invalidateQueries({ queryKey: ["admin-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["admin-activity-logs"] });
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
      const res = await apiFetch(`/api/users/${userId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete customer");
    },
    onSuccess: () => {
      toast({ title: "Customer deleted" });
      queryClient.invalidateQueries({ queryKey: ["admin-customers"] });
      queryClient.invalidateQueries({ queryKey: ["admin-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["admin-activity-logs"] });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });
}