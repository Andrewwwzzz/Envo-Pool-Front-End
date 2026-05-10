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

export function useTables(startTime: Date | null, endTime: Date | null) {
  return useQuery({
    queryKey: ["tables-with-status", startTime?.toISOString(), endTime?.toISOString()],
    queryFn: async (): Promise<TableWithStatus[]> => {
      const res = await apiFetch("/api/tables");
      if (!res.ok) throw new Error("Failed to fetch tables");
      const tables = await res.json();

      if (!startTime || !endTime) {
        const result = (tables || []).map((t: any) => ({
          id: t._id || t.id,
          table_number: t.tableNumber ?? t.table_number,
          hardware_id: t.hardwareId ?? t.hardware_id ?? null,
          status: t.timerStartedAt || t.timer_started_at
            ? "In Use" as TableStatus
            : (t.status === "maintenance" || t.isActive === false)
            ? "Maintenance" as TableStatus
            : "Available" as TableStatus,
        }));
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

        if (t.status === "maintenance") {
          return { id: tableId, table_number: t.tableNumber ?? t.table_number, hardware_id: hardwareId, status: "Maintenance" as TableStatus };
        }
        if (t.timerStartedAt || t.timer_started_at) {
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
    apiFetch("/api/bookings"),
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

  console.log("Bookings from backend:", enriched);
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