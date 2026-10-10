import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api";
import { getCached, setCache } from "@/lib/queryCache";

// Every PayNow payment Gmail extracted, matched or not — used to cross-
// reference against paynow-paid bookings/invoices/F&B orders that often
// have no linked customer account (walk-ins), so amount+time is the only
// way to verify "did this transfer actually come in".
export function useAdminGmailPayments(enabled: boolean) {
  return useQuery({
    queryKey: ["admin-gmail-payments"],
    queryFn: async () => {
      const res = await apiFetch("/api/transactions/topup/admin/gmail-payments");
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : data?.payments ?? [];
    },
    enabled,
    refetchInterval: 15000,
  });
}

// Manual staff overrides for the PayNow verify icon — takes precedence
// over the automatic amount+time match when present.
export function useAdminPaynowOverrides(enabled: boolean) {
  return useQuery({
    queryKey: ["admin-paynow-overrides"],
    queryFn: async () => {
      const res = await apiFetch("/api/transactions/topup/admin/paynow-verifications");
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
    enabled,
    refetchInterval: 15000,
  });
}

export function useSetPaynowOverride() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { refType: "Booking" | "TimerSession" | "FnbOrder"; refId: string; status: "linked" | "confirmed_paid" | "flagged_unpaid"; gmailPaymentId?: string; note?: string }) => {
      const res = await apiFetch("/api/transactions/topup/admin/paynow-verify", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to save override");
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-paynow-overrides"] });
    },
  });
}

export function useClearPaynowOverride() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { refType: "Booking" | "TimerSession" | "FnbOrder"; refId: string }) => {
      const res = await apiFetch("/api/transactions/topup/admin/paynow-verify", {
        method: "DELETE",
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to clear override");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-paynow-overrides"] });
    },
  });
}

export function useAdminBookings(showDeleted = false) {
  const key = showDeleted ? "admin-bookings-deleted" : "admin-bookings";
  return useQuery({
    queryKey: ["admin-bookings", showDeleted],
    queryFn: async () => {
      const res = await apiFetch(`/api/bookings${showDeleted ? "?showDeleted=true" : ""}`);
      if (!res.ok) throw new Error("Failed to fetch bookings");
      const data = await res.json();
      setCache(key, data);
      return data;
    },
    refetchInterval: 10000,
    refetchOnWindowFocus: true,
    initialData: () => getCached(key),
  });
}

// Admin-controlled walk-in booking: pick a table + fixed duration, pay
// upfront (wallet/cash/paynow) — like a customer booking but staff-initiated.
export function useBookTableNow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      tableId,
      durationMinutes,
      customerId,
      paymentMethod,
      allowNegative,
      discountPercent,
      hourlyRate,
      applyMembershipDiscount,
      applyMembershipFreeMinutes,
      promoCode,
      pricingMode,
      discountReason,
    }: {
      tableId: string;
      durationMinutes: number;
      customerId: string | null;
      paymentMethod: "wallet" | "cash" | "paynow";
      allowNegative?: boolean;
      discountPercent?: number;
      hourlyRate?: number;
      applyMembershipDiscount?: boolean;
      applyMembershipFreeMinutes?: boolean;
      promoCode?: string | null;
      pricingMode: PricingMode;
      discountReason?: string;
    }) => {
      const res = await apiFetch(`/api/admin/tables/${tableId}/book-now`, {
        method: "POST",
        body: JSON.stringify({
          durationMinutes,
          customerId,
          paymentMethod,
          allowNegative: !!allowNegative,
          discountPercent: discountPercent || 0,
          discountReason: discountReason?.trim() || null,
          pricingMode,
          hourlyRate: pricingMode === "custom" ? hourlyRate || 0 : 0,
          applyMembershipDiscount: applyMembershipDiscount !== false,
          applyMembershipFreeMinutes: applyMembershipFreeMinutes !== false,
          promoCode: promoCode || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || err.message || "Failed to book table");
      }
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-tables"] });
      queryClient.invalidateQueries({ queryKey: ["admin-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["tables-with-status"] });
      queryClient.invalidateQueries({ queryKey: ["admin-customers"] });
      queryClient.invalidateQueries({ queryKey: ["admin-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["admin-activity-logs"] });
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
      queryClient.invalidateQueries({ queryKey: ["walletHistory"] });
      queryClient.invalidateQueries({ queryKey: ["membership", "admin-hours"] });
      queryClient.invalidateQueries({ queryKey: ["membership", "my-hours"] });
    },
  });
}

export function useDeleteBooking() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ bookingId, reason }: { bookingId: string; reason: string }) => {
      const res = await apiFetch(`/api/admin/bookings/${bookingId}`, {
        method: "DELETE",
        body: JSON.stringify({ reason }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || err.message || "Failed to delete booking");
      }
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

// Exact time-of-day segmented price for a running session, computed by the
// same function stop-timer bills with for real — used by the Close Table /
// Book Now dialogs so the amount shown to staff (and quoted to a PayNow
// customer) doesn't diverge from a flat-rate guess whenever the session
// crosses a peak/off-peak boundary. Query key buckets durationSeconds to
// the nearest 5s so the live elapsed-seconds ticker doesn't refetch every
// single second.
// mode "self_practice" prices with the configured self-practice codes
// (normal price wherever none applies) — uncoveredMinutes says how much.
export type PricingMode = "time_of_day" | "self_practice" | "custom";

export interface ClosePreview {
  mode: PricingMode;
  grossAmount: number;
  uncoveredMinutes: number;
  membershipDiscountPercent: number;
  membershipDiscountAmount: number;
  freeMinutesCredit: number;
  freeMinutesApplied: number;
  afterMembership: number;
  discountPct: number;
  discountAmount: number;
  timeCharge: number;
  fnbTotal: number;
  amountCharged: number;
}

// The exact bill Close Table would charge right now — the server works it out with the same
// function as the real close (member free minutes, then discount; staff discount; F&B; cash
// rounding), without charging anything. While the timer ticks the last bill stays on screen;
// any other change (customer, payment, discount, pricing) waits for the new figure.
export function useClosePreview(
  tableId: string | null,
  durationSeconds: number,
  params: { pricingMode: PricingMode; hourlyRate: number; paymentMethod: string; customerId: string; discountPercent: number; applyMembershipDiscount: boolean; applyMembershipFreeMinutes: boolean },
  enabled: boolean,
) {
  const bucket = Math.floor(durationSeconds / 5);
  const paramsKey = JSON.stringify(params);
  return useQuery({
    queryKey: ["close-preview", tableId, bucket, paramsKey],
    queryFn: async () => {
      const qs = new URLSearchParams({ durationSeconds: String(durationSeconds), ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])) });
      const res = await apiFetch(`/api/admin/tables/${tableId}/close-preview?${qs}`);
      if (!res.ok) return null;
      return res.json() as Promise<ClosePreview>;
    },
    enabled: enabled && !!tableId && durationSeconds > 0,
    placeholderData: (prev, prevQuery) => {
      const [, prevTable, prevBucket, prevParams] = (prevQuery?.queryKey ?? []) as [unknown, unknown, number, unknown];
      return prevTable === tableId && prevParams === paramsKey && Math.abs(bucket - prevBucket) <= 2 ? prev : undefined;
    },
  });
}

export interface BookNowPreview extends ClosePreview {
  promoCode: string | null;
  promoDiscount: number;
  promoNotUsed: string | null;
  error?: string;
}

// The exact bill Book Now would charge for a booking starting now — worked out by the server with
// the same function as the real booking (member free minutes, then discount, or a promo code when
// it saves more; staff discount; cash rounding), without booking anything or using free minutes.
// Refreshed every 30s since the booking starts "now"; any change to the inputs waits for the new figure.
export function useBookNowPreview(
  tableId: string | null,
  params: { durationMinutes: number; pricingMode: PricingMode; hourlyRate: number; paymentMethod: string; customerId: string; promoCode: string; discountPercent: number; applyMembershipDiscount: boolean; applyMembershipFreeMinutes: boolean },
  enabled: boolean,
) {
  return useQuery({
    queryKey: ["book-now-preview", tableId, JSON.stringify(params)],
    queryFn: async () => {
      const qs = new URLSearchParams(Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])));
      const res = await apiFetch(`/api/admin/tables/${tableId}/book-now-preview?${qs}`);
      const data = await res.json().catch(() => ({}));
      return (res.ok ? data : { error: data.error || "Couldn't work out the price" }) as BookNowPreview;
    },
    enabled: enabled && !!tableId && params.durationMinutes >= 15,
    refetchInterval: 30000,
  });
}

export function useSessionPreviewCost(startedAt: string | null, durationSeconds: number, enabled: boolean, mode: "time_of_day" | "self_practice" = "time_of_day") {
  const bucket = Math.floor(durationSeconds / 5);
  return useQuery({
    queryKey: ["session-preview-cost", startedAt, bucket, mode],
    queryFn: async () => {
      const res = await apiFetch(`/api/sessions/preview-cost?startedAt=${encodeURIComponent(startedAt!)}&durationSeconds=${durationSeconds}&mode=${mode}`);
      if (!res.ok) return null;
      return res.json() as Promise<{ segments: any[]; total: number; uncoveredMinutes?: number; codes?: string[] }>;
    },
    enabled: enabled && !!startedAt && durationSeconds > 0,
    // Keep showing the last price while the next one loads — the key changes every
    // few seconds as a session's timer ticks (or a booking's start moves), and an
    // empty price in between read as a $0 time charge. Only for the same pricing
    // mode: the same session a few seconds on, or the same duration from a moved
    // start — never a different booking length.
    placeholderData: (prev, prevQuery) => {
      const [, prevStart, prevBucket, prevMode] = (prevQuery?.queryKey ?? []) as [unknown, unknown, number, unknown];
      const ticked = prevStart === startedAt && Math.abs(bucket - prevBucket) <= 2;
      return prevMode === mode && (ticked || prevBucket === bucket) ? prev : undefined;
    },
  });
}

// An Error that keeps the server's JSON body — e.g. the list of bookings a
// maintenance change would affect (code "BOOKINGS_AFFECTED").
export class ApiError extends Error {
  data: any;
  constructor(message: string, data: any) {
    super(message);
    this.data = data;
  }
}
async function apiError(res: Response, fallback: string) {
  const data = await res.json().catch(() => ({}));
  return new ApiError(data.error || data.message || fallback, data);
}
export const isBookingsAffected = (e: unknown): e is ApiError =>
  e instanceof ApiError && e.data?.code === "BOOKINGS_AFFECTED";

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
        hourly_rate: t.timerHourlyRate ?? t.hourlyRate ?? t.hourly_rate ?? t.basePrice ?? 0,
        is_manual_rate: t.timerHourlyRateManual ?? false,
        // How a running session will be billed (older sessions: custom if a manual rate was typed)
        pricing_mode: (t.timerPricingMode ?? (t.timerHourlyRateManual ? "custom" : "time_of_day")) as PricingMode,
        status: t.liveStatus ?? t.status ?? "available",
        timer_started_at: t.timerStartedAt ?? t.timer_started_at ?? null,
        last_seen: t.lastSeen ?? t.last_seen ?? null,
        created_at: t.createdAt ?? t.created_at ?? "",
      }));
      setCache("admin-tables", mapped);
      return mapped;
    },
    initialData: () => getCached("admin-tables") ?? [],
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
    staleTime: 0,
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
    // pricingMode "custom" (with hourlyRate) is admin-only — the server refuses it from staff.
    mutationFn: async ({ tableId, pricingMode, hourlyRate }: { tableId: string; pricingMode: PricingMode; hourlyRate?: number }) => {
      const res = await apiFetch(`/api/admin/tables/${tableId}/start-timer`, {
        method: "POST",
        body: JSON.stringify({ pricingMode, hourlyRate: pricingMode === "custom" ? hourlyRate || 0 : 0 }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || err.message || "Failed to start timer");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-tables"] });
      queryClient.invalidateQueries({ queryKey: ["tables-with-status"] });
    },
    onError: (err: Error) => {
      toast({ title: "Cannot open table", description: err.message, variant: "destructive" });
    },
  });

  const stopTimer = useMutation({
    mutationFn: async ({
      tableId,
      durationSeconds,
      hourlyRate,
      discountPercent,
      startedAt,
      customerId,
      paymentMethod,
      allowNegative,
      applyMembershipDiscount,
      applyMembershipFreeMinutes,
      pricingMode,
      discountReason,
    }: {
      tableId: string;
      durationSeconds: number;
      hourlyRate: number;
      discountPercent?: number;
      startedAt: string;
      customerId?: string | null;
      paymentMethod?: "cash" | "paynow" | "wallet";
      allowNegative?: boolean;
      applyMembershipDiscount?: boolean;
      applyMembershipFreeMinutes?: boolean;
      pricingMode: PricingMode;
      discountReason?: string;
    }) => {
      const res = await apiFetch(`/api/admin/tables/${tableId}/stop-timer`, {
        method: "POST",
        body: JSON.stringify({
          durationSeconds,
          hourlyRate: pricingMode === "custom" ? hourlyRate : 0,
          pricingMode,
          discountReason: discountReason?.trim() || null,
          discountPercent: discountPercent || 0,
          startedAt,
          customerId: customerId || null,
          paymentMethod: paymentMethod || "cash",
          allowNegative: !!allowNegative,
          applyMembershipDiscount: applyMembershipDiscount !== false,
          applyMembershipFreeMinutes: applyMembershipFreeMinutes !== false,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || err.message || "Failed to stop timer");
      }
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-tables"] });
      queryClient.invalidateQueries({ queryKey: ["admin-timer-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["tables-with-status"] });
      queryClient.invalidateQueries({ queryKey: ["admin-customers"] });
      queryClient.invalidateQueries({ queryKey: ["admin-customer-wallet"] });
      queryClient.invalidateQueries({ queryKey: ["admin-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["admin-activity-logs"] });
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
      queryClient.invalidateQueries({ queryKey: ["walletHistory"] });
      // A closed table's playing time counts toward the customer's membership
      // hours (TimerSession.customerId) — without this the Membership tab's
      // hours column stays stale until its own 60s staleTime expires.
      queryClient.invalidateQueries({ queryKey: ["membership", "admin-hours"] });
      queryClient.invalidateQueries({ queryKey: ["membership", "my-hours"] });
    },
  });

  // Every status change needs a reason (logged). Putting a table with
  // upcoming bookings under maintenance fails with BOOKINGS_AFFECTED until
  // it's resent with acknowledgeBookings once staff have dealt with them.
  const setMaintenance = useMutation({
    mutationFn: async ({ tableId, maintenance, reason, acknowledgeBookings }: { tableId: string; maintenance: boolean; reason: string; acknowledgeBookings?: boolean }) => {
      const res = await apiFetch(`/api/admin/tables/${tableId}/status`, {
        method: "POST",
        body: JSON.stringify({ status: maintenance ? "maintenance" : "available", reason, acknowledgeBookings: !!acknowledgeBookings }),
      });
      if (!res.ok) throw await apiError(res, "Failed to update table status");
    },
    onSuccess: () => {
      toast({ title: "Table status updated" });
      queryClient.invalidateQueries({ queryKey: ["admin-tables"] });
      queryClient.invalidateQueries({ queryKey: ["tables-with-status"] });
    },
    onError: (e: Error) => {
      if (!isBookingsAffected(e)) toast({ title: "Couldn't change the table", description: e.message, variant: "destructive" });
    },
  });

  // One table at a time, so each result is known: tables with bookings come
  // back in `blocked` (with their bookings) to confirm separately.
  const setBulkMaintenance = useMutation({
    mutationFn: async ({ tableIds, maintenance, reason, acknowledgeBookings }: { tableIds: string[]; maintenance: boolean; reason: string; acknowledgeBookings?: boolean }) => {
      const status = maintenance ? "maintenance" : "available";
      const updated: string[] = [];
      const blocked: { tableId: string; bookings: any[] }[] = [];
      const failed: { tableId: string; error: string }[] = [];
      for (const tableId of tableIds) {
        const res = await apiFetch(`/api/admin/tables/${tableId}/status`, {
          method: "POST",
          body: JSON.stringify({ status, reason, acknowledgeBookings: !!acknowledgeBookings }),
        });
        if (res.ok) { updated.push(tableId); continue; }
        const e = await apiError(res, `Failed to update table ${tableId}`);
        if (e.data?.code === "BOOKINGS_AFFECTED") blocked.push({ tableId, bookings: e.data.bookings || [] });
        else failed.push({ tableId, error: e.message });
      }
      return { updated, blocked, failed };
    },
    onSuccess: (result, variables) => {
      const label = variables.maintenance ? "maintenance" : "available";
      if (result.updated.length) toast({ title: `${result.updated.length} table${result.updated.length > 1 ? "s" : ""} set to ${label}` });
      if (result.failed.length) toast({ title: `${result.failed.length} table${result.failed.length > 1 ? "s" : ""} not changed`, description: result.failed[0].error, variant: "destructive" });
      queryClient.invalidateQueries({ queryKey: ["admin-tables"] });
      queryClient.invalidateQueries({ queryKey: ["tables-with-status"] });
    },
  });

  return { ...tablesQuery, updateStatus, startTimer, stopTimer, setMaintenance, setBulkMaintenance };
}

export function useTableMaintenance(tableId: string | null | undefined, filter: "default" | "all" = "all") {
  return useQuery({
    queryKey: ["table-maintenance", tableId, { filter }],
    queryFn: async () => {
      if (!tableId) return [];
      const qs = filter === "default" ? "" : `?filter=${filter}`;
      const res = await apiFetch(`/api/admin/maintenance/${tableId}${qs}`);
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : (data?.maintenance || data?.windows || []);
    },
    enabled: !!tableId,
    refetchInterval: 10000,
    refetchOnWindowFocus: true,
  });
}


export function useScheduleMaintenance() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    // Bookings inside the window → BOOKINGS_AFFECTED; resend with acknowledgeBookings once handled.
    mutationFn: async ({ tableId, startTime, endTime, reason, acknowledgeBookings }: { tableId: string; startTime: string; endTime: string; reason: string; acknowledgeBookings?: boolean }) => {
      const trimmedReason = reason.trim();
      if (!trimmedReason) {
        throw new Error("Reason is required.");
      }
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      try {
        const res = await apiFetch(`/api/admin/maintenance`, {
          method: "POST",
          body: JSON.stringify({ tableId, startTime, endTime, reason: trimmedReason, acknowledgeBookings: !!acknowledgeBookings }),
          signal: controller.signal,
        });
        if (!res.ok) throw await apiError(res, "Failed to schedule maintenance");
        return await res.json().catch(() => ({}));
      } catch (e: any) {
        if (e?.name === "AbortError") {
          throw new Error("Request timed out — the backend /api/admin/maintenance endpoint is not responding after auth. Check that the backend POST route returns a response, validates tableId/startTime/endTime/reason, and that its database query is not hanging.");
        }
        throw e;
      } finally {
        clearTimeout(timeout);
      }
    },
    onSuccess: (_data, vars) => {
      toast({ title: "Maintenance scheduled" });
      queryClient.invalidateQueries({ queryKey: ["table-maintenance", vars.tableId] });
      queryClient.invalidateQueries({ queryKey: ["table-maintenance"] });
    },
    onError: (e: any) => {
      if (!isBookingsAffected(e)) toast({ title: "Failed to schedule", description: e.message, variant: "destructive" });
    },
  });
}

export function useDeleteMaintenance() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string; tableId?: string }) => {
      const res = await apiFetch(`/api/admin/maintenance/${id}`, {
        method: "DELETE",
        body: JSON.stringify({ reason }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || err.message || "Failed to remove maintenance");
      }
    },
    onSuccess: (_data, vars) => {
      toast({ title: "Maintenance removed" });
      queryClient.invalidateQueries({ queryKey: ["table-maintenance", vars.tableId] });
      queryClient.invalidateQueries({ queryKey: ["table-maintenance"] });
    },
    onError: (e: any) => {
      toast({ title: "Failed to remove", description: e.message, variant: "destructive" });
    },
  });
}


export function useBulkScheduleMaintenance() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    // One table at a time: tables with bookings in the window come back in
    // `blocked` (with their bookings) to confirm separately.
    mutationFn: async ({ tableIds, startTime, endTime, reason, acknowledgeBookings }: { tableIds: string[]; startTime: string; endTime: string; reason: string; acknowledgeBookings?: boolean }) => {
      const scheduled: string[] = [];
      const blocked: { tableId: string; bookings: any[]; inUseNow?: boolean }[] = [];
      const failed: { tableId: string; error: string }[] = [];
      for (const tableId of tableIds) {
        const res = await apiFetch("/api/admin/maintenance", {
          method: "POST",
          body: JSON.stringify({ tableId, startTime, endTime, reason, acknowledgeBookings: !!acknowledgeBookings }),
        });
        if (res.ok) { scheduled.push(tableId); continue; }
        const e = await apiError(res, `Failed to schedule table ${tableId}`);
        if (e.data?.code === "BOOKINGS_AFFECTED") blocked.push({ tableId, bookings: e.data.bookings || [], inUseNow: !!e.data.inUseNow });
        else failed.push({ tableId, error: e.message });
      }
      return { scheduled, blocked, failed };
    },
    onSuccess: (result) => {
      if (result.scheduled.length) toast({ title: `Maintenance scheduled for ${result.scheduled.length} table${result.scheduled.length > 1 ? "s" : ""}` });
      if (result.failed.length) toast({ title: `${result.failed.length} table${result.failed.length > 1 ? "s" : ""} not scheduled`, description: result.failed[0].error, variant: "destructive" });
      queryClient.invalidateQueries({ queryKey: ["table-maintenance"] });
    },
    onError: (e: any) => {
      toast({ title: "Failed to schedule", description: e.message, variant: "destructive" });
    },
  });
}

export function useAdminTimerSessions(showDeleted = false) {
  const key = showDeleted ? "admin-timer-sessions-deleted" : "admin-timer-sessions";
  return useQuery({
    queryKey: ["admin-timer-sessions", showDeleted],
    queryFn: async () => {
      const res = await apiFetch(`/api/admin/timer-sessions${showDeleted ? "?showDeleted=true" : ""}`);
      if (!res.ok) throw new Error("Failed to fetch timer sessions");
      const data = await res.json();
      setCache(key, data);
      return data;
    },
    initialData: () => getCached(key),
  });
}

function mapPricingRule(r: any) {
  return {
    id: r._id || r.id,
    name: r.name,
    start_time: r.startTime ?? r.start_time,
    end_time: r.endTime ?? r.end_time,
    hourly_rate: r.hourlyRate ?? r.hourly_rate,
    applies_to_weekdays: r.appliesToWeekdays ?? r.applies_to_weekdays ?? [],
    specific_date: r.specificDate ?? r.specific_date ?? null,
    applies_to_table_id: r.appliesToTableId ?? r.applies_to_table_id ?? null,
    priority: r.priority ?? 0,
    is_active: r.isActive ?? r.is_active ?? false,
  };
}

export function useAdminPricingRules(filter: "default" | "all" = "all") {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const cacheKey = `admin-pricing-rules-${filter}`;
  const query = useQuery({
    queryKey: ["admin-pricing-rules", { filter }],
    queryFn: async () => {
      const qs = filter === "default" ? "" : `?filter=${filter}`;
      const res = await apiFetch(`/api/admin/pricing-rules${qs}`);
      if (!res.ok) throw new Error("Failed to fetch pricing rules");
      const raw = await res.json();
      const list = Array.isArray(raw) ? raw : (raw?.pricingRules || raw?.rules || []);
      const data = list.map((r: any) => ({
        ...mapPricingRule(r),
        deleted: r.deleted === true || r.isDeleted === true || !!r.deletedAt,
        deletedAt: r.deletedAt || r.deleted_at,
        deletedBy: r.deletedBy || r.deleted_by,
        deleteReason: r.deleteReason || r.deletionReason || r.deleted_reason,
      }));
      setCache(cacheKey, data);
      return data;
    },
    initialData: () => getCached(cacheKey) ?? [],
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
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || err.error || "Failed to create pricing rule");
      }
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
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const res = await apiFetch(`/api/admin/pricing-rules/${id}`, {
        method: "DELETE",
        body: JSON.stringify({ reason }),
      });
      if (!res.ok) throw new Error("Failed to delete pricing rule");
    },
    onSuccess: () => {
      toast({ title: "Pricing rule deleted" });
      queryClient.invalidateQueries({ queryKey: ["admin-pricing-rules"] });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
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
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
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
        method: "PATCH",
        body: JSON.stringify(updates),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || err.error || "Failed to update pricing rule");
      }
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


export function useAdminPromoCodes(filter: "default" | "all" = "all") {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const cacheKey = `admin-promo-codes-${filter}`;
  const query = useQuery({
    queryKey: ["admin-promo-codes", { filter }],
    queryFn: async () => {
      const qs = filter === "default" ? "" : `?filter=${filter}`;
      const res = await apiFetch(`/api/admin/promo-codes${qs}`);
      if (!res.ok) throw new Error("Failed to fetch promo codes");
      const raw = await res.json();
      const list = Array.isArray(raw) ? raw : (raw?.promoCodes || raw?.promos || []);
      const data = list.map((p: any) => ({
        id: p._id || p.id,
        code: p.code,
        discount_type: p.discountType ?? p.discount_type,
        discount_value: p.discountValue ?? p.discount_value ?? 0,
        minimum_spend: p.minimumSpend ?? p.minimum_spend ?? null,
        max_discount_amount: p.maxDiscountAmount ?? p.max_discount_amount ?? null,
        usage_limit: p.usageLimit ?? p.usage_limit ?? null,
        usage_count: p.usageCount ?? p.usage_count ?? 0,
        per_user_limit: p.perUserLimit ?? p.per_user_limit ?? null,
        expiry_date: p.expiryDate ?? p.expiry_date ?? null,
        is_active: p.isActive ?? p.is_active ?? false,
        deleted: p.deleted === true || p.isDeleted === true || !!p.deletedAt,
        deletedAt: p.deletedAt || p.deleted_at,
        deletedBy: p.deletedBy || p.deleted_by,
        deleteReason: p.deleteReason || p.deletionReason || p.deleted_reason,
        valid_days: Array.isArray(p.valid_days) ? p.valid_days : [],
        valid_time_start: p.valid_time_start ?? null,
        valid_time_end: p.valid_time_end ?? null,
        minimum_hours: p.minimum_hours ?? null,
        exact_hours: p.exact_hours ?? null,
        staff_only: p.staff_only === true,
      }));
      setCache(cacheKey, data);
      return data;
    },
    initialData: () => getCached(cacheKey),
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
      valid_days?: number[];
      valid_time_start?: string | null;
      valid_time_end?: string | null;
      minimum_hours?: number | null;
      exact_hours?: number | null;
      staff_only?: boolean;
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
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const res = await apiFetch(`/api/admin/promo-codes/${id}`, {
        method: "DELETE",
        body: JSON.stringify({ reason }),
      });
      if (!res.ok) throw new Error("Failed to delete promo code");
    },
    onSuccess: () => {
      toast({ title: "Promo code deleted" });
      queryClient.invalidateQueries({ queryKey: ["admin-promo-codes"] });
    },
  });

  const update = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, any> }) => {
      const res = await apiFetch(`/api/admin/promo-codes/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update promo code");
    },
    onSuccess: () => {
      toast({ title: "Promo code updated" });
      queryClient.invalidateQueries({ queryKey: ["admin-promo-codes"] });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  return { ...query, create, toggle, remove, update };
}


export function useUpdateBookingStatus() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const allowedStatuses = new Set(["confirmed", "cancelled", "completed", "expired"]);

  return useMutation({
    mutationFn: async ({ bookingId, status, reason, refund, refundTo, overrideReason }: { bookingId: string; status: string; reason?: string; refund?: boolean; refundTo?: "original" | "wallet"; overrideReason?: string }) => {
      if (!bookingId) throw new Error("Missing booking ID");
      if (!allowedStatuses.has(status)) throw new Error("Invalid booking status");
      const endpoint = `/api/admin/bookings/${bookingId}/status`;
      const body: Record<string, unknown> = { status };
      if (reason) body.reason = reason;
      if (refund !== undefined) body.refund = refund;
      if (refundTo) body.refundTo = refundTo;
      if (overrideReason) body.overrideReason = overrideReason;
      const res = await apiFetch(endpoint, {
        method: "POST",
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || data.error || "Failed to update booking status");
      }
      return data as { message?: string };
    },
    onSuccess: (data, variables) => {
      // The server says exactly what happened, e.g. "Booking cancelled — $12.00 refunded to their wallet" (D109).
      toast({ title: data?.message || `Booking marked as ${variables.status}` });
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

export function useAdminStats(from?: string, to?: string) {
  const cacheKey = from || to ? `admin-stats:${from || ""}:${to || ""}` : "admin-stats";
  return useQuery({
    queryKey: ["admin-stats", from || null, to || null],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const qs = params.toString();
      const res = await apiFetch(`/api/admin/stats${qs ? `?${qs}` : ""}`);
      if (!res.ok) throw new Error("Failed to fetch admin stats");
      const data = await res.json();
      const stats = {
        totalUsers: data.totalUsers ?? 0,
        totalBookings: data.totalBookings ?? 0,
        totalRevenue: data.totalRevenue ?? 0,
        totalTransactions: data.totalTransactions ?? 0,
        walletTopups: data.walletTopups ?? data.totalTopups ?? null,
        cashTopups: data.cashTopups ?? null,
        paynowTopups: data.paynowTopups ?? null,
        cashCollected: data.cashCollected ?? data.totalCash ?? null,
        bankPaynowReceived: data.bankPaynowReceived ?? 0,
        avgBookingValue: data.avgBookingValue ?? 0,
        mostBookedTable: data.mostBookedTable ?? null,
        mostBookedTableCount: data.mostBookedTableCount ?? 0,
      };
      setCache(cacheKey, stats);
      return stats;
    },
    refetchInterval: 10000,
    refetchOnWindowFocus: true,
    initialData: () => getCached(cacheKey),
  });
}

// Correct the payment method on an already-closed timer-session invoice —
// e.g. PayNow failed due to a bad connection and it was actually settled
// in cash. Backend reconciles the wallet/Transaction records so the
// accounting overview stays accurate.
export function useChangeInvoicePaymentMethod() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      sessionId,
      newMethod,
      customerId,
      allowNegative,
      reason,
    }: {
      sessionId: string;
      newMethod: "cash" | "paynow" | "wallet";
      customerId?: string | null;
      allowNegative?: boolean;
      reason: string;
    }) => {
      const res = await apiFetch(`/api/admin/timer-sessions/${sessionId}/payment-method`, {
        method: "PATCH",
        body: JSON.stringify({ newMethod, customerId: customerId || null, allowNegative: !!allowNegative, reason }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || data.message || "Failed to change payment method");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-timer-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["admin-customers"] });
      queryClient.invalidateQueries({ queryKey: ["admin-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["admin-activity-logs"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
      queryClient.invalidateQueries({ queryKey: ["walletHistory"] });
    },
  });
}

// Correct a paid booking's payment method (e.g. a staff booking entered as
// PayNow that was paid in cash). Backend corrects the booking's payment line
// in place and gives back / takes any wallet charge; a reason is required.
export function useChangeBookingPaymentMethod() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      bookingId,
      newMethod,
      customerId,
      allowNegative,
      reason,
    }: {
      bookingId: string;
      newMethod: "cash" | "paynow" | "wallet";
      customerId?: string | null;
      allowNegative?: boolean;
      reason: string;
    }) => {
      const res = await apiFetch(`/api/admin/bookings/${bookingId}/payment-method`, {
        method: "PATCH",
        body: JSON.stringify({ newMethod, customerId: customerId || null, allowNegative: !!allowNegative, reason }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || data.message || "Failed to change payment method");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["admin-booking-logs"] });
      queryClient.invalidateQueries({ queryKey: ["admin-paynow-overrides"] });
      queryClient.invalidateQueries({ queryKey: ["admin-gmail-payments"] });
      queryClient.invalidateQueries({ queryKey: ["admin-customers"] });
      queryClient.invalidateQueries({ queryKey: ["admin-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["admin-activity-logs"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
      queryClient.invalidateQueries({ queryKey: ["walletHistory"] });
    },
  });
}

// Staff-assisted account creation for walk-in guests who can't/won't use
// Singpass — created pre-verified since staff do the ID check in person.
export function useAdminCreateCustomer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      legalName: string;
      email: string;
      password: string;
      phone?: string;
      dateOfBirth: string;
    }) => {
      const res = await apiFetch("/api/admin/create-customer", {
        method: "POST",
        body: JSON.stringify(input),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || data.message || "Failed to create customer account");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-customers"] });
    },
  });
}

export function useVerifyUser() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (userId: string) => {
      const res = await apiFetch("/api/admin/verify-user", {
        method: "POST",
        body: JSON.stringify({ userId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to verify user");
      }
    },
    onSuccess: () => {
      toast({ title: "User verified successfully" });
      queryClient.invalidateQueries({ queryKey: ["admin-customers"] });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });
}

export function useAdminCustomers(searchTerm: string, includeDeleted = false) {
  return useQuery({
    queryKey: ["admin-customers", searchTerm, includeDeleted],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchTerm.trim()) params.set("search", searchTerm);
      if (includeDeleted) params.set("includeDeleted", "true");
      const qs = params.toString() ? `?${params}` : "";
      const res = await apiFetch(`/api/users${qs}`);
      if (!res.ok) throw new Error("Failed to fetch users");
      const data = await res.json();
      const users = Array.isArray(data) ? data : data.users || [];
      const mapped = users.map((c: any) => ({
        id: c._id || c.id,
        user_id: c._id || c.id || c.user_id,
        shortId: c.shortId ?? null,
        name: c.name || "",
        legal_name: c.legalName ?? c.legal_name ?? c.kyc?.name ?? "",
        kyc_source: c.kyc?.source ?? null,
        email: c.email || "",
        phone: c.phone || null,
        date_of_birth: c.dateOfBirth ?? c.date_of_birth ?? null,
        wallet_balance: c.walletBalance ?? c.wallet_balance ?? 0,
        reward_points: c.rewardPoints ?? c.reward_points ?? 0,
        allow_negative_balance: c.allowNegativeBalance ?? false,
        total_spent: c.totalSpent ?? c.total_spent ?? 0,
        age_verified: c.ageVerified ?? c.age_verified ?? false,
        isVerified: c.isVerified ?? false,
        role: c.role ?? "user",
        created_at: c.createdAt ?? c.created_at ?? "",
        verified_by: c.verifiedBy?.name ?? c.verifiedBy?.email ?? c.verifiedBy ?? c.verified_by ?? null,
        verified_at: c.verifiedAt ?? c.verified_at ?? null,
        isDeleted: c.isDeleted ?? false,
        deletedAt: c.deletedAt ?? null,
        deleteReason: c.deleteReason ?? null,
      }));
      mapped.sort((a, b) => a.name.localeCompare(b.name));
      // The cache holds the full list only — a search must never show it
      // (D26: no customer list on screen before the search results arrive).
      if (!includeDeleted && !searchTerm.trim()) setCache("admin-customers", mapped);
      return mapped;
    },
    initialData: () => includeDeleted || searchTerm.trim() ? undefined : (getCached("admin-customers") ?? []),
    refetchOnWindowFocus: true,
    staleTime: 0,
  });
}

// Fetches a single user by id — used where only a userId is on hand (e.g. an
// active walk-in session row) and up-to-date fields like allowNegativeBalance
// are needed before charging their wallet, without relying on whatever
// (possibly stale/partial) object the caller happens to have around.
export function useAdminUser(userId: string, enabled = true) {
  return useQuery({
    queryKey: ["admin-user", userId],
    queryFn: async () => {
      const res = await apiFetch(`/api/users/${userId}`);
      if (!res.ok) throw new Error("Failed to fetch user");
      return res.json();
    },
    enabled: enabled && !!userId,
    staleTime: 0,
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
      expectedWalletBalance,
      expectedPoints,
      reason,
    }: {
      userId: string;
      walletBalance?: number;
      walletDelta?: number;
      points?: number;
      pointsDelta?: number;
      expectedWalletBalance?: number;
      expectedPoints?: number;
      reason: string;
    }) => {
      const payload: Record<string, number | string> = { reason };
      if (walletBalance !== undefined) { payload.walletBalance = walletBalance; payload.expectedWalletBalance = expectedWalletBalance as number; }
      if (walletDelta !== undefined) payload.walletDelta = walletDelta;
      if (points !== undefined) { payload.points = points; payload.expectedPoints = expectedPoints as number; }
      if (pointsDelta !== undefined) payload.pointsDelta = pointsDelta;

      const res = await apiFetch(`/api/users/${userId}/wallet`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || err.message || "Failed to update wallet");
      }
    },
    onSuccess: () => {
      toast({ title: "Customer updated" });
      queryClient.invalidateQueries({ queryKey: ["admin-customers"] });
      queryClient.invalidateQueries({ queryKey: ["admin-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["admin-activity-logs"] });
      queryClient.invalidateQueries({ queryKey: ["points-history"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });
}

export type ChargeWalletCategory =
  | "manual_timer"
  | "fnb"
  | "locker"
  | "merchandise"
  | "other";

export function useChargeWallet() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      userId,
      amount,
      category,
      description,
      allowNegative,
      fnbItems,
      tableId,
      tableName,
    }: {
      userId: string;
      amount: number;
      category: ChargeWalletCategory;
      description: string;
      allowNegative?: boolean;
      fnbItems?: Array<{ productId: string; productName: string; quantity: number; price: number }>;
      tableId?: string | null;
      tableName?: string | null;
    }) => {
      const res = await apiFetch(`/api/admin/charge-wallet`, {
        method: "POST",
        body: JSON.stringify({ userId, amount, category, description, allowNegative: !!allowNegative, fnbItems, tableId, tableName }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || err.message || "Failed to charge wallet");
      }
      return res.json().catch(() => ({}));
    },
    onSuccess: () => {
      toast({ title: "Wallet charged" });
      queryClient.invalidateQueries({ queryKey: ["admin-customers"] });
      queryClient.invalidateQueries({ queryKey: ["admin-customer-wallet"] });
      queryClient.invalidateQueries({ queryKey: ["admin-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["admin-activity-logs"] });
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
      queryClient.invalidateQueries({ queryKey: ["walletHistory"] });
      // Refresh FnB tab so new orders appear immediately
      queryClient.invalidateQueries({ queryKey: ["fnb-orders"] });
      queryClient.invalidateQueries({ queryKey: ["fnb-orders-admin"] });
      queryClient.invalidateQueries({ queryKey: ["transaction-history"] });
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
    mutationFn: async ({ userId, reason }: { userId: string; reason: string }) => {
      const res = await apiFetch(`/api/users/${userId}`, {
        method: "DELETE",
        body: JSON.stringify({ reason }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed to delete customer");
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

export function useUpdateCustomerProfile() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      userId,
      name,
      email,
      phone,
      dateOfBirth,
      allowNegativeBalance,
    }: {
      userId: string;
      name?: string;
      email?: string;
      phone?: string;
      dateOfBirth?: string;
      allowNegativeBalance?: boolean;
    }) => {
      const payload: Record<string, string | boolean> = {};
      if (name !== undefined) payload.name = name;
      if (email !== undefined) payload.email = email;
      if (phone !== undefined) payload.phone = phone;
      if (dateOfBirth !== undefined) payload.dateOfBirth = dateOfBirth;
      if (allowNegativeBalance !== undefined) payload.allowNegativeBalance = allowNegativeBalance;

      const res = await apiFetch(`/api/users/${userId}/profile`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const raw = err.message || err.error || "Failed to update customer details";
        const cleaned = String(raw).replace(/Singpass-verified/gi, "verified");
        throw new Error(cleaned);
      }
    },
    onSuccess: () => {
      toast({ title: "Customer details updated" });
      queryClient.invalidateQueries({ queryKey: ["admin-customers"] });
      queryClient.invalidateQueries({ queryKey: ["admin-activity-logs"] });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });
}

export function useUpdateCustomerEmail() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ userId, email, reason }: { userId: string; email: string; reason: string }) => {
      const res = await apiFetch(`/api/users/${userId}/email`, {
        method: "PATCH",
        body: JSON.stringify({ email, reason }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to update email");
      }
    },
    onSuccess: () => {
      toast({ title: "Email updated" });
      queryClient.invalidateQueries({ queryKey: ["admin-customers"] });
      queryClient.invalidateQueries({ queryKey: ["admin-activity-logs"] });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });
}

// ── Staff management (master only) ───────────────────────────

export const ALL_PERMISSIONS = [
  { key: "overview", label: "Overview" },
  { key: "tables", label: "Tables" },
  { key: "fnb", label: "F&B" },
  { key: "topups", label: "Top Ups" },
  { key: "customers", label: "Customers" },
  { key: "invoices", label: "Invoices" },
  { key: "bookings", label: "Bookings" },
  { key: "membership", label: "Membership" },
  { key: "rewards", label: "Rewards" },
  { key: "pricing", label: "Pricing" },
  { key: "promos", label: "Promos" },
  { key: "lockers", label: "Lockers" },
  { key: "cashcount", label: "Cash Count" },
  { key: "tournaments", label: "Tournaments" },
  { key: "logs", label: "Logs" },
] as const;

export function useStaffList() {
  return useQuery({
    queryKey: ["admin-staff"],
    queryFn: async () => {
      const res = await apiFetch("/api/admin/staff");
      if (!res.ok) throw new Error("Failed to fetch staff");
      return res.json() as Promise<any[]>;
    },
  });
}

export function usePromoteStaff() {
  const { toast } = useToast();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { userId: string; permissions: string[] }) => {
      const res = await apiFetch("/api/admin/staff", { method: "POST", body: JSON.stringify(data) });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to promote user");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "User promoted to staff" });
      qc.invalidateQueries({ queryKey: ["admin-staff"] });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });
}

export function useUpdateStaffPermissions() {
  const { toast } = useToast();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, permissions }: { id: string; permissions: string[] }) => {
      const res = await apiFetch(`/api/admin/staff/${id}/permissions`, {
        method: "PATCH", body: JSON.stringify({ permissions }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to update permissions");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Permissions updated" });
      qc.invalidateQueries({ queryKey: ["admin-staff"] });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });
}

export function useRemoveStaff() {
  const { toast } = useToast();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiFetch(`/api/admin/staff/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to remove staff");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Staff removed" });
      qc.invalidateQueries({ queryKey: ["admin-staff"] });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });
}

export function useRestoreRecord() {
  const { toast } = useToast();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ type, id }: { type: string; id: string }) => {
      const res = await apiFetch(`/api/admin/restore/${type}/${id}`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to restore");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Record restored" });
      qc.invalidateQueries({ queryKey: ["admin-customers"] });
      qc.invalidateQueries({ queryKey: ["admin-bookings"] });
      qc.invalidateQueries({ queryKey: ["fnb-menu-admin"] });
      qc.invalidateQueries({ queryKey: ["membership", "plans"] });
      qc.invalidateQueries({ queryKey: ["membership", "subscriptions"] });
      qc.invalidateQueries({ queryKey: ["lockers"] });
      qc.invalidateQueries({ queryKey: ["admin-timer-sessions"] });
      qc.invalidateQueries({ queryKey: ["multipliers-admin"] });
      qc.invalidateQueries({ queryKey: ["reward-catalog-admin"] });
      qc.invalidateQueries({ queryKey: ["admin-promos"] });
    },
    onError: (err: Error) => toast({ title: "Restore failed", description: err.message, variant: "destructive" }),
  });
}

export function useSetMasterPin() {
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (pin: string) => {
      const res = await apiFetch("/api/admin/master/set-pin", {
        method: "POST",
        body: JSON.stringify({ pin }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Failed to set PIN");
      return body;
    },
    onSuccess: () => toast({ title: "Master PIN set" }),
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });
}

export function useHardDelete() {
  const { toast } = useToast();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ type, id, pin }: { type: string; id: string; pin: string }) => {
      const res = await apiFetch(`/api/admin/master/hard-delete/${type}/${id}`, {
        method: "DELETE",
        body: JSON.stringify({ pin }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Failed to hard delete");
      return body;
    },
    onSuccess: () => {
      toast({ title: "Permanently deleted" });
      qc.invalidateQueries({ queryKey: ["admin-customers"] });
      qc.invalidateQueries({ queryKey: ["admin-bookings"] });
      qc.invalidateQueries({ queryKey: ["fnb-menu-admin"] });
      qc.invalidateQueries({ queryKey: ["membership", "plans"] });
      qc.invalidateQueries({ queryKey: ["membership", "subscriptions"] });
      qc.invalidateQueries({ queryKey: ["lockers"] });
      qc.invalidateQueries({ queryKey: ["admin-timer-sessions"] });
      qc.invalidateQueries({ queryKey: ["multipliers-admin"] });
      qc.invalidateQueries({ queryKey: ["reward-catalog-admin"] });
      qc.invalidateQueries({ queryKey: ["admin-promos"] });
    },
    onError: (err: Error) => toast({ title: "Hard delete failed", description: err.message, variant: "destructive" }),
  });
}