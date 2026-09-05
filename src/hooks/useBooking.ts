import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { getCached, setCache } from "@/lib/queryCache";

export type TableStatus = "Available" | "Booked" | "Pending Payment" | "In Use" | "Maintenance";

export interface TableWithStatus {
  id: string;
  table_number: number;
  hardware_id: string | null;
  status: TableStatus;
}

export function validateDuration(start: Date, end: Date): string | null {
  const diffMs = end.getTime() - start.getTime();
  const diffMinutes = diffMs / (1000 * 60);
  if (diffMinutes < 60) return "Minimum booking duration is 1 hour.";
  if (diffMinutes % 30 !== 0) return "Duration must be in 30-minute intervals.";
  return null;
}

async function fetchActiveWalkinHardwareIds(): Promise<Set<string>> {
  const ids = new Set<string>();
  const extract = (s: any) => {
    if (!s) return;
    const t = s.tableId;
    if (t && typeof t === "object") {
      const hw = t.hardwareId ?? t.hardware_id;
      if (hw) ids.add(String(hw));
    } else if (typeof t === "string") {
      ids.add(t);
    }
  };

  // /api/sessions/active is admin-only — silently ignore failures
  try {
    const res = await apiFetch("/api/sessions/active");
    if (res.ok) {
      const data = await res.json().catch(() => null);
      const list = Array.isArray(data) ? data : data?.sessions ?? [];
      list.forEach(extract);
    }
  } catch { /* ignore */ }

  // /api/sessions/my — current user's own session
  try {
    const res = await apiFetch("/api/sessions/my");
    if (res.ok) {
      const data = await res.json().catch(() => null);
      const session = data?.session ?? data;
      if (session && session._id && (!session.status || session.status === "active")) {
        extract(session);
      }
    }
  } catch { /* ignore */ }

  return ids;
}

export function useTables(startTime: Date | null, endTime: Date | null) {
  return useQuery({
    queryKey: ["tables-with-status", startTime?.toISOString(), endTime?.toISOString()],
    queryFn: async (): Promise<TableWithStatus[]> => {
      const [tablesRes, walkinHardwareIds] = await Promise.all([
        apiFetch("/api/tables"),
        fetchActiveWalkinHardwareIds(),
      ]);
      if (!tablesRes.ok) throw new Error("Failed to fetch tables");
      const tables = await tablesRes.json();

      const hasActiveWalkin = (hardwareId: string | null) =>
        !!hardwareId && walkinHardwareIds.has(String(hardwareId));

      if (!startTime || !endTime) {
        const result = (tables || []).map((t: any) => {
          const hardwareId = t.hardwareId ?? t.hardware_id ?? null;
          const liveStatus = t.liveStatus ?? t.status ?? "available";
          // permanentMaintenance is the indefinite admin flag, not a
          // scheduled MaintenanceWindow that merely happens to be active
          // right now — a table shouldn't look unbookable-for-every-date
          // just because a time-boxed window is in progress at this moment.
          // The actual date/time being booked is checked separately (per
          // time slot, and again server-side on booking creation).
          const permanentMaintenance = t.permanentMaintenance ?? (t.status === "maintenance");
          let status: TableStatus;
          if (permanentMaintenance || t.isActive === false) {
            status = "Maintenance";
          } else if (liveStatus === "in_use" || t.timerStartedAt || t.timer_started_at || hasActiveWalkin(hardwareId)) {
            status = "In Use";
          } else {
            status = "Available";
          }
          return {
            id: t._id || t.id,
            table_number: t.tableNumber ?? t.table_number,
            hardware_id: hardwareId,
            status,
          };
        });
        setCache("tables-basic", result);
        return result;
      }

      // Fetch all bookings and filter by time overlap
      const availRes = await apiFetch("/api/bookings");
      const allBookings = availRes.ok ? await availRes.json() : [];

      // Backend is source of truth — display whatever status backend says
      const bookings = (allBookings || []).filter((b: any) => {
        // Only show active bookings (not cancelled — expired are deleted by backend)
        if (b.status === "cancelled") return false;
        const bStart = new Date(b.startTime);
        const bEnd = new Date(b.endTime);
        return bStart < endTime && bEnd > startTime;
      });

      const result = (tables || []).map((t: any) => {
        const tableId = t._id || t.id;
        const hardwareId = t.hardwareId ?? t.hardware_id ?? null;

        const permanentMaintenance = t.permanentMaintenance ?? (t.status === "maintenance");
        if (permanentMaintenance || t.isActive === false) {
          return { id: tableId, table_number: t.tableNumber ?? t.table_number, hardware_id: hardwareId, status: "Maintenance" as TableStatus };
        }
        if (t.timerStartedAt || t.timer_started_at || hasActiveWalkin(hardwareId)) {
          return { id: tableId, table_number: t.tableNumber ?? t.table_number, hardware_id: hardwareId, status: "In Use" as TableStatus };
        }

        const overlapping = (bookings || []).filter((b: any) => {
          const bTableId = typeof b.tableId === "object" ? b.tableId?.hardware_id : b.tableId;
          return bTableId === hardwareId;
        });

        const hasConfirmed = overlapping.some((b: any) => b.status === "confirmed");
        if (hasConfirmed) {
          return { id: tableId, table_number: t.tableNumber ?? t.table_number, hardware_id: hardwareId, status: "Booked" as TableStatus };
        }

        const hasPending = overlapping.some((b: any) => b.status === "pending_payment" || b.status === "pending");
        if (hasPending) {
          return { id: tableId, table_number: t.tableNumber ?? t.table_number, hardware_id: hardwareId, status: "Pending Payment" as TableStatus };
        }

        return { id: tableId, table_number: t.tableNumber ?? t.table_number, hardware_id: hardwareId, status: "Available" as TableStatus };
      });
      setCache("tables-with-status", result);
      return result;
    },
    enabled: true,
    refetchInterval: 30000,
    initialData: () => getCached<TableWithStatus[]>("tables-with-status") ?? getCached<TableWithStatus[]>("tables-basic") ?? [],
  });
}

export async function loadBookingsFromBackend() {
  const [bookingsRes, transactionsRes] = await Promise.all([
    apiFetch("/api/bookings/my"),
    apiFetch("/api/transactions").catch(() => null),
  ]);

  if (!bookingsRes.ok) throw new Error("Failed to fetch bookings");

  const allBookings = await bookingsRes.json();

  // NO frontend expiry cancellation — backend handles all status changes
  const bookings = allBookings || [];

  const transactionsData = transactionsRes && transactionsRes.ok ? await transactionsRes.json().catch(() => null) : null;
  const walletTransactions = Array.isArray(transactionsData?.walletTransactions) ? transactionsData.walletTransactions : [];
  const stripePayments = Array.isArray(transactionsData?.stripePayments) ? transactionsData.stripePayments : [];

  const enriched = (bookings || []).map((booking: any) => {
    const bookingId = booking.id || booking._id;
    const walletMatch = walletTransactions.find((t: any) => t.reference === bookingId || t.relatedBookingId === bookingId || t.related_booking_id === bookingId);
    const stripeMatch = stripePayments.find((p: any) => (p.id || p._id) === bookingId || p.reference === bookingId);

    const explicit = booking.paymentMethod || booking.payment_method || booking.inferredPaymentMethod;
    let resolvedMethod = explicit || null;

    if (resolvedMethod === "wallet_deduct" || resolvedMethod === "booking_payment") {
      resolvedMethod = "wallet";
    }

    if (!resolvedMethod && walletMatch) resolvedMethod = "wallet";
    if (!resolvedMethod && stripeMatch) resolvedMethod = "stripe";
    if (!resolvedMethod && booking.paymentStatus === "paid") resolvedMethod = "paynow";

    return {
      ...booking,
      paymentMethod: resolvedMethod,
    };
  });

  return enriched;
}

export function useMyBookings() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["my-bookings", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const data = await loadBookingsFromBackend();
      const result = data || [];
      setCache(`my-bookings-${user.id}`, result);
      return result;
    },
    enabled: !!user,
    staleTime: 0,
    gcTime: 0,
    initialData: () => user ? getCached(`my-bookings-${user.id}`) ?? [] : [],
  });
}