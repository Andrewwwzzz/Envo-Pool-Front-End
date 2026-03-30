import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { getCached, setCache } from "@/lib/queryCache";

export type TableStatus = "Available" | "Booked" | "Pending Payment" | "In Use" | "Maintenance";

export interface TableWithStatus {
  id: string;
  table_number: number;
  hardware_id: string | null;
  status: TableStatus;
}

const PENDING_LOCK_MINUTES = 5;

function calculateDurationHours(start: Date, end: Date): number {
  return (end.getTime() - start.getTime()) / (1000 * 60 * 60);
}

export function validateDuration(start: Date, end: Date): string | null {
  const diffMs = end.getTime() - start.getTime();
  const diffMinutes = diffMs / (1000 * 60);

  if (diffMinutes < 60) return "Minimum booking duration is 1 hour.";

  if (diffMinutes % 30 !== 0) {
    return "Duration must be in 30-minute intervals.";
  }

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
            : t.status === "maintenance"
            ? "Maintenance" as TableStatus
            : "Available" as TableStatus,
        }));
        setCache("tables-basic", result);
        return result;
      }

      // Fetch all bookings and filter by time overlap
      const availRes = await apiFetch("/api/bookings");
      const allBookings = availRes.ok ? await availRes.json() : [];
      const bookings = (allBookings || []).filter((b: any) => {
        const bStart = new Date(b.startTime);
        const bEnd = new Date(b.endTime);
        return bStart < endTime && bEnd > startTime;
      });

      const nowMs = Date.now();

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

        const hasPending = overlapping.some((b: any) => {
          if (b.status !== "pending_payment" && b.status !== "pending") return false;
          const createdAt = b.createdAt || b.created_at;
          return createdAt ? new Date(createdAt).getTime() > nowMs - PENDING_LOCK_MINUTES * 60 * 1000 : true;
        });
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

export interface CreateBookingParams {
  tableId: string;
  startTime: Date;
  endTime: Date;
  originalPrice: number;
  discountAmount: number;
  finalPrice: number;
  promoId: string | null;
  paymentMethod: "wallet" | "stripe";
}

export function useCreateBooking() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: CreateBookingParams) => {
      if (!user) throw new Error("Must be logged in");

      const { tableId, startTime, endTime, originalPrice, discountAmount, finalPrice, promoId, paymentMethod } = params;

      const durationError = validateDuration(startTime, endTime);
      if (durationError) throw new Error(durationError);

      const durationMinutes = Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60));

      const endpoint = paymentMethod === "wallet"
        ? "/api/bookings/create-with-wallet"
        : "/api/bookings/create-with-payment";

      const res = await apiFetch(endpoint, {
        method: "POST",
        body: JSON.stringify({
          userId: user.id,
          tableId,
          startTime: startTime.toISOString(),
          duration: durationMinutes,
          price: finalPrice,
          promoId,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || data.message || "Booking failed");
      }

      const data = await res.json();
      return {
        id: data.bookingId || data.id,
        status: data.status || (paymentMethod === "wallet" ? "confirmed" : "pending"),
        checkoutUrl: data.checkoutUrl,
      };
    },
    onSuccess: (_data, variables) => {
      const msg = variables.paymentMethod === "wallet"
        ? "Booking confirmed! Payment deducted from wallet."
        : "Booking created. Complete payment to confirm.";
      toast({ title: "Booking created", description: msg });
      queryClient.invalidateQueries({ queryKey: ["tables-with-status"] });
      queryClient.invalidateQueries({ queryKey: ["table-day-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["my-bookings"] });
    },
    onError: (err: Error) => {
      toast({ title: "Booking failed", description: err.message, variant: "destructive" });
    },
  });
}

export async function loadBookingsFromBackend() {
  const [bookingsRes, transactionsRes] = await Promise.all([
    apiFetch("/api/bookings"),
    apiFetch("/api/transactions").catch(() => null),
  ]);

  if (!bookingsRes.ok) throw new Error("Failed to fetch bookings");

  const bookings = await bookingsRes.json();
  const transactionsData = transactionsRes && transactionsRes.ok ? await transactionsRes.json().catch(() => null) : null;
  const walletTransactions = Array.isArray(transactionsData?.walletTransactions) ? transactionsData.walletTransactions : [];
  const stripePayments = Array.isArray(transactionsData?.stripePayments) ? transactionsData.stripePayments : [];

  const enriched = (bookings || []).map((booking: any) => {
    const bookingId = booking.id || booking._id;
    const walletMatch = walletTransactions.find((t: any) => t.reference === bookingId || t.relatedBookingId === bookingId || t.related_booking_id === bookingId);
    const stripeMatch = stripePayments.find((p: any) => (p.id || p._id) === bookingId || p.reference === bookingId);

    // Determine payment method: prioritize explicit fields, then transaction matches
    const explicit = booking.paymentMethod || booking.payment_method || booking.inferredPaymentMethod;
    let resolvedMethod = explicit || null;
    
    // If explicit method says "wallet_deduct" or "booking_payment", normalize to "wallet"
    if (resolvedMethod === "wallet_deduct" || resolvedMethod === "booking_payment") {
      resolvedMethod = "wallet";
    }
    
    // If no explicit method, check transaction matches
    if (!resolvedMethod && walletMatch) resolvedMethod = "wallet";
    if (!resolvedMethod && stripeMatch) resolvedMethod = "stripe";
    
    // Only fall back to paynow if payment is marked paid and no other match
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
