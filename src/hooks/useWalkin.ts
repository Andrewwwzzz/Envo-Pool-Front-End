import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export interface WalkinSession {
  _id: string;
  id?: string;
  tableId: any;
  userId?: any;
  startTime?: string;
  startedAt?: string;
  status: string;
  runningCost?: number;
  amountCharged?: number;
  endTime?: string;
  walletBalanceAfter?: number;
  durationMinutes?: number;
  isDeleted?: boolean;
  deletedAt?: string;
  deletedReason?: string;
  deletedBy?: any;
}

export function useMyWalkinSession(enabled = true) {
  return useQuery<WalkinSession | null>({
    queryKey: ["walkin-my"],
    queryFn: async () => {
      const res = await apiFetch("/api/sessions/my");
      if (!res.ok) return null;
      const data = await res.json().catch(() => null);
      if (!data) return null;
      // Backend may return null, an object, or { session: ... }
      const session = data.session ?? data;
      if (!session || !session._id) return null;
      if (session.status && session.status !== "active") return null;
      return session;
    },
    enabled,
    refetchInterval: 30000,
    staleTime: 0,
  });
}

export function useActiveWalkinSessions(enabled = true) {
  return useQuery<WalkinSession[]>({
    queryKey: ["walkin-active"],
    queryFn: async () => {
      const res = await apiFetch("/api/sessions/active");
      if (!res.ok) return [];
      const data = await res.json().catch(() => []);
      return Array.isArray(data) ? data : data?.sessions ?? [];
    },
    enabled,
    refetchInterval: 30000,
    staleTime: 0,
  });
}

export function useStartWalkin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (tableId: string) => {
      const res = await apiFetch("/api/sessions/start", {
        method: "POST",
        body: JSON.stringify({ tableId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || data?.error || "Failed to start session");
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["walkin-my"] });
      qc.invalidateQueries({ queryKey: ["walkin-active"] });
      qc.invalidateQueries({ queryKey: ["tables-with-status"] });
    },
  });
}

export function useStopWalkin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await apiFetch("/api/sessions/stop", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || data?.error || "Failed to stop session");
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["walkin-my"] });
      qc.invalidateQueries({ queryKey: ["walkin-active"] });
      qc.invalidateQueries({ queryKey: ["walkin-stopped"] });
      qc.invalidateQueries({ queryKey: ["tables-with-status"] });
      qc.invalidateQueries({ queryKey: ["profile"] });
      qc.invalidateQueries({ queryKey: ["transaction-history"] });
      qc.invalidateQueries({ queryKey: ["admin-timer-sessions"] });
      qc.invalidateQueries({ queryKey: ["session-detail"] });
      qc.invalidateQueries({ queryKey: ["membership", "my-hours"] });
    },
  });
}

export function useForceStopWalkin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const res = await apiFetch(`/api/sessions/${id}/force-stop`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || data?.error || "Failed to force stop");
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["walkin-active"] });
      qc.invalidateQueries({ queryKey: ["walkin-my"] });
      qc.invalidateQueries({ queryKey: ["walkin-stopped"] });
      qc.invalidateQueries({ queryKey: ["tables-with-status"] });
      qc.invalidateQueries({ queryKey: ["admin-timer-sessions"] });
      qc.invalidateQueries({ queryKey: ["session-detail"] });
    },
  });
}

export function useStoppedWalkinSessions(enabled = true, showDeleted = false) {
  return useQuery<WalkinSession[]>({
    queryKey: ["walkin-stopped", showDeleted],
    queryFn: async () => {
      const res = await apiFetch(`/api/sessions?status=stopped${showDeleted ? "&showDeleted=true" : ""}`);
      if (!res.ok) return [];
      const data = await res.json().catch(() => []);
      return Array.isArray(data) ? data : data?.sessions ?? [];
    },
    enabled,
    refetchInterval: 60000,
    staleTime: 0,
  });
}

export function useMyWalkinHistory(enabled = true) {
  return useQuery<WalkinSession[]>({
    queryKey: ["walkin-my-history"],
    queryFn: async () => {
      const res = await apiFetch("/api/sessions/my/history");
      if (!res.ok) return [];
      const data = await res.json().catch(() => []);
      return Array.isArray(data) ? data : data?.sessions ?? [];
    },
    enabled,
    refetchInterval: 60000,
    staleTime: 0,
  });
}

export function useMyTimerHistory(enabled = true) {
  return useQuery<any[]>({
    queryKey: ["timer-my-history"],
    queryFn: async () => {
      const res = await apiFetch("/api/sessions/my/timer-history");
      if (!res.ok) return [];
      const data = await res.json().catch(() => []);
      return Array.isArray(data) ? data : [];
    },
    enabled,
    refetchInterval: 60000,
    staleTime: 0,
  });
}

