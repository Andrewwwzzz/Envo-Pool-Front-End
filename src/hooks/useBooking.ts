import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export type TableStatus = "Available" | "Booked" | "Pending Payment" | "In Use";

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

  const minutesBeyondFirstHour = diffMinutes - 60;
  if (minutesBeyondFirstHour % 15 !== 0) {
    return "After the first hour, duration must increase in 15-minute intervals.";
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
          status: t.timer_started_at ? "In Use" as TableStatus : "Available" as TableStatus,
        }));
      }

      const { data: bookings, error: bErr } = await supabase
        .from("bookings")
        .select("*")
        .in("status", ["pending", "confirmed"])
        .lt("start_time", endTime.toISOString())
        .gt("end_time", startTime.toISOString());

      if (bErr) throw bErr;

      const now = new Date();

      return tables.map((t) => {
        // If table has an active timer, it's in use by admin
        if (t.timer_started_at) {
          return { ...t, hardware_id: t.hardware_id, status: "In Use" as TableStatus };
        }

        const overlapping = (bookings || []).filter((b) => b.table_id === t.id);

        const hasConfirmed = overlapping.some((b) => b.status === "confirmed");
        if (hasConfirmed) {
          return { ...t, hardware_id: t.hardware_id, status: "Booked" as TableStatus };
        }

        const hasActivePending = overlapping.some((b) => {
          if (b.status !== "pending") return false;
          const createdAt = new Date(b.created_at);
          const elapsed = (now.getTime() - createdAt.getTime()) / (1000 * 60);
          return elapsed <= PENDING_LOCK_MINUTES;
        });

        if (hasActivePending) {
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

      // Validate duration
      const durationError = validateDuration(startTime, endTime);
      if (durationError) throw new Error(durationError);

      const durationHours = calculateDurationHours(startTime, endTime);

      // Check table overlap
      const { data: tableConflicts } = await supabase
        .from("bookings")
        .select("id, status, created_at")
        .eq("table_id", tableId)
        .in("status", ["pending", "confirmed"])
        .lt("start_time", endTime.toISOString())
        .gt("end_time", startTime.toISOString());

      const now = new Date();
      const activeConflicts = (tableConflicts || []).filter((b) => {
        if (b.status === "confirmed") return true;
        const created = new Date(b.created_at);
        return (now.getTime() - created.getTime()) / (1000 * 60) <= PENDING_LOCK_MINUTES;
      });

      if (activeConflicts.length > 0) {
        throw new Error("This table is already booked or locked for that time slot.");
      }

      // Check user overlap
      const { data: userConflicts } = await supabase
        .from("bookings")
        .select("id, status, created_at")
        .eq("user_id", user.id)
        .in("status", ["pending", "confirmed"])
        .lt("start_time", endTime.toISOString())
        .gt("end_time", startTime.toISOString());

      const activeUserConflicts = (userConflicts || []).filter((b) => {
        if (b.status === "confirmed") return true;
        const created = new Date(b.created_at);
        return (now.getTime() - created.getTime()) / (1000 * 60) <= PENDING_LOCK_MINUTES;
      });

      if (activeUserConflicts.length > 0) {
        throw new Error("You already have a booking that overlaps this time.");
      }

      // Handle wallet payment
      if (paymentMethod === "wallet") {
        const { data: profile } = await supabase
          .from("profiles")
          .select("wallet_balance")
          .eq("user_id", user.id)
          .single();

        if (!profile || profile.wallet_balance < finalPrice) {
          throw new Error("Insufficient wallet balance.");
        }

        const newBalance = profile.wallet_balance - finalPrice;

        // Deduct wallet
        const { error: walletErr } = await supabase
          .from("profiles")
          .update({ 
            wallet_balance: newBalance,
          })
          .eq("user_id", user.id);

        if (walletErr) throw walletErr;

        // Create confirmed booking
        const { data: booking, error: bookingErr } = await supabase
          .from("bookings")
          .insert({
            user_id: user.id,
            table_id: tableId,
            start_time: startTime.toISOString(),
            end_time: endTime.toISOString(),
            duration_hours: durationHours,
            price: finalPrice,
            original_price: originalPrice,
            discount_amount: discountAmount,
            final_price: finalPrice,
            promo_id: promoId,
            payment_method: "wallet",
            status: "confirmed",
          })
          .select()
          .single();

        if (bookingErr) throw bookingErr;

        // Record wallet transaction
        await supabase.from("wallet_transactions").insert({
          user_id: user.id,
          type: "booking_payment",
          amount: -finalPrice,
          balance_after: newBalance,
          related_booking_id: booking.id,
        });

        // Update total_spent by finalPrice (net amount)
        const { data: currentProfile } = await supabase
          .from("profiles")
          .select("total_spent")
          .eq("user_id", user.id)
          .single();
        
        if (currentProfile) {
          await supabase
            .from("profiles")
            .update({ total_spent: currentProfile.total_spent + finalPrice })
            .eq("user_id", user.id);
        }

        // Award reward points based on finalPrice (net amount, 10 per $1)
        const rewardPoints = Math.floor(finalPrice * 10);
        if (rewardPoints > 0) {
          const { data: rpProfile } = await supabase
            .from("profiles")
            .select("reward_points")
            .eq("user_id", user.id)
            .single();

          if (rpProfile) {
            await supabase
              .from("profiles")
              .update({ reward_points: rpProfile.reward_points + rewardPoints })
              .eq("user_id", user.id);

            await supabase.from("reward_transactions").insert({
              user_id: user.id,
              type: "earn",
              points: rewardPoints,
              related_booking_id: booking.id,
            });
          }
        }

        // Record promo usage
        if (promoId && discountAmount > 0) {
          await supabase.from("promo_usage").insert({
            promo_id: promoId,
            user_id: user.id,
            booking_id: booking.id,
            discount_amount: discountAmount,
          });
        }

        return booking;
      }

      // STRIPE: create pending booking, payment handled separately
      const { data: booking, error: bookingErr } = await supabase
        .from("bookings")
        .insert({
          user_id: user.id,
          table_id: tableId,
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString(),
          duration_hours: durationHours,
          price: finalPrice,
          original_price: originalPrice,
          discount_amount: discountAmount,
          final_price: finalPrice,
          promo_id: promoId,
          payment_method: "stripe",
          status: "pending",
        })
        .select()
        .single();

      if (bookingErr) throw bookingErr;

      // Record promo usage for stripe too
      if (promoId && discountAmount > 0) {
        await supabase.from("promo_usage").insert({
          promo_id: promoId,
          user_id: user.id,
          booking_id: booking.id,
          discount_amount: discountAmount,
        });
      }

      return booking;
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

export function useMyBookings() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["my-bookings", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("bookings")
        .select("*, tables(table_number)")
        .eq("user_id", user.id)
        .order("start_time", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });
}
