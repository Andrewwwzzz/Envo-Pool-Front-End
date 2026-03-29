import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

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
      const { data: tables, error } = await supabase
        .from("tables")
        .select("*")
        .order("table_number");

      if (error) throw error;

      if (!startTime || !endTime) {
        return tables.map((t) => ({
          id: t.id,
          table_number: t.table_number,
          hardware_id: t.hardware_id,
          status: t.timer_started_at ? "In Use" as TableStatus : t.status === "maintenance" ? "Maintenance" as TableStatus : "Available" as TableStatus,
        }));
      }

      const { data: bookings, error: bErr } = await supabase
        .from("bookings")
        .select("*")
        .in("status", ["pending", "confirmed"])
        .lt("start_time", endTime.toISOString())
        .gt("end_time", startTime.toISOString());

      if (bErr) throw bErr;

      const nowMs = Date.now();

      return tables.map((t) => {
        // If table is under maintenance
        if (t.status === "maintenance") {
          return { ...t, hardware_id: t.hardware_id, status: "Maintenance" as TableStatus };
        }
        // If table has an active timer, it's in use by admin
        if (t.timer_started_at) {
          return { ...t, hardware_id: t.hardware_id, status: "In Use" as TableStatus };
        }

        const overlapping = (bookings || []).filter((b) => b.table_id === t.id);

        const hasConfirmed = overlapping.some((b) => b.status === "confirmed");
        if (hasConfirmed) {
          return { ...t, hardware_id: t.hardware_id, status: "Booked" as TableStatus };
        }

        const hasPending = overlapping.some((b) => {
          if (b.status !== "pending") return false;
          return new Date(b.created_at).getTime() > nowMs - PENDING_LOCK_MINUTES * 60 * 1000;
        });
        if (hasPending) {
          return { ...t, hardware_id: t.hardware_id, status: "Pending Payment" as TableStatus };
        }

        return { ...t, hardware_id: t.hardware_id, status: "Available" as TableStatus };
      });
    },
    enabled: true,
    refetchInterval: 30000,
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

      // Validate duration client-side (server also validates via constraints)
      const durationError = validateDuration(startTime, endTime);
      if (durationError) throw new Error(durationError);

      const durationHours = calculateDurationHours(startTime, endTime);

      // Call atomic server-side function that handles all checks and mutations
      const { data, error } = await supabase.rpc("create_booking_atomic", {
        p_table_id: tableId,
        p_start_time: startTime.toISOString(),
        p_end_time: endTime.toISOString(),
        p_duration_hours: durationHours,
        p_original_price: originalPrice,
        p_discount_amount: discountAmount,
        p_final_price: finalPrice,
        p_promo_id: promoId,
        p_payment_method: paymentMethod,
      });

      if (error) throw new Error(error.message);

      const result = data as unknown as { success?: boolean; error?: string; booking_id?: string; status?: string };

      if (result.error) {
        throw new Error(result.error);
      }

      return {
        id: result.booking_id,
        status: result.status,
      };
    },
    onSuccess: (_data, variables) => {
      const msg = variables.paymentMethod === "wallet"
        ? "Booking confirmed! Payment deducted from wallet."
        : "Booking created. Complete Stripe payment to confirm.";
      toast({ title: "Booking created", description: msg });
      queryClient.invalidateQueries({ queryKey: ["tables-with-status"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["my-bookings"] });
    },
    onError: (err: Error) => {
      toast({ title: "Booking failed", description: err.message, variant: "destructive" });
    },
  });
}

const BACKEND_URL = "https://api.envopoolsg.com";

export async function loadBookingsFromBackend() {
  const res = await fetch(`${BACKEND_URL}/api/bookings`);
  if (!res.ok) throw new Error("Failed to fetch bookings");
  const data = await res.json();
  console.log("Bookings from backend:", data);
  return data;
}

export function useMyBookings() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["my-bookings", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const data = await loadBookingsFromBackend();
      return data || [];
    },
    enabled: !!user,
    staleTime: 0,
    gcTime: 0,
  });
}
