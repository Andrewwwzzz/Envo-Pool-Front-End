import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export type TableStatus = "Available" | "Booked" | "Pending Payment";

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

function validateDuration(start: Date, end: Date): string | null {
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
          status: "Available" as TableStatus,
        }));
      }

      // Fetch overlapping bookings for the selected time range
      const { data: bookings, error: bErr } = await supabase
        .from("bookings")
        .select("*")
        .in("status", ["pending", "confirmed"])
        .lt("start_time", endTime.toISOString())
        .gt("end_time", startTime.toISOString());

      if (bErr) throw bErr;

      const now = new Date();

      return tables.map((t) => {
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
    refetchInterval: 30000, // refresh every 30s
  });
}

export function useCreateBooking() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      tableId,
      startTime,
      endTime,
    }: {
      tableId: string;
      startTime: Date;
      endTime: Date;
    }) => {
      if (!user) throw new Error("Must be logged in");

      // Validate duration
      const durationError = validateDuration(startTime, endTime);
      if (durationError) throw new Error(durationError);

      const durationHours = calculateDurationHours(startTime, endTime);

      // Check table overlap (server-side via RLS + query)
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

      // Create booking
      const { data, error } = await supabase
        .from("bookings")
        .insert({
          user_id: user.id,
          table_id: tableId,
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString(),
          duration_hours: durationHours,
          price: 0, // placeholder - no payment logic yet
          payment_method: null,
          status: "pending",
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({ title: "Booking created", description: "Your booking is pending payment (5 min lock)." });
      queryClient.invalidateQueries({ queryKey: ["tables-with-status"] });
    },
    onError: (err: Error) => {
      toast({ title: "Booking failed", description: err.message, variant: "destructive" });
    },
  });
}
