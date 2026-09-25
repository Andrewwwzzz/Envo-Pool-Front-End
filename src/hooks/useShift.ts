import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

export interface ShiftLog {
  _id: string;
  staffId: string | { _id: string; name: string; email: string; role: string };
  clockInAt: string;
  clockOutAt: string | null;
}

export interface ShiftStatus {
  onShift: boolean;
  shift: ShiftLog | null;
  maxShiftHours: number;
}

export function useShiftStatus() {
  return useQuery({
    queryKey: ["shift-status"],
    queryFn: async () => {
      const res = await apiFetch("/api/shift/status");
      if (!res.ok) throw new Error("Failed to load shift status");
      return res.json() as Promise<ShiftStatus>;
    },
    refetchInterval: 60000,
  });
}

export function useOnShiftStaff() {
  return useQuery({
    queryKey: ["shift-on-shift"],
    queryFn: async () => {
      const res = await apiFetch("/api/shift/on-shift");
      if (!res.ok) throw new Error("Failed to load on-shift staff");
      const data = await res.json();
      return (Array.isArray(data) ? data : []) as ShiftLog[];
    },
    refetchInterval: 60000,
  });
}

export function useClockIn() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async () => {
      const res = await apiFetch("/api/shift/clock-in", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to clock in");
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shift-status"] });
      qc.invalidateQueries({ queryKey: ["shift-on-shift"] });
      toast({ title: "Clocked in", description: "Staff Membership benefits are now active." });
    },
    onError: (err: Error) => {
      toast({ title: "Clock in failed", description: err.message, variant: "destructive" });
    },
  });
}

export function useClockOut() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async () => {
      const res = await apiFetch("/api/shift/clock-out", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to clock out");
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shift-status"] });
      qc.invalidateQueries({ queryKey: ["shift-on-shift"] });
      toast({ title: "Clocked out", description: "See you next shift." });
    },
    onError: (err: Error) => {
      toast({ title: "Clock out failed", description: err.message, variant: "destructive" });
    },
  });
}
