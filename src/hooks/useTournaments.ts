import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

export interface TournamentField {
  key: string;
  label: string;
  type: "text" | "select";
  options: string[];
  required: boolean;
}

export type TournamentStatus = "draft" | "open" | "closed" | "cancelled";

export interface Tournament {
  _id: string;
  name: string;
  description: string;
  startsAt: string;
  registrationClosesAt: string;
  entryFee: number;
  maxEntries: number | null;
  teamSize: number;
  fields: TournamentField[];
  status: TournamentStatus;
  confirmedCount: number;
  spotsLeft: number | null;
  registrationOpen: boolean;
  cancelReason?: string | null;
  waitlistCount?: number;
}

export type EntryStatus = "confirmed" | "waitlisted" | "revoked" | "cancelled";

export interface MyEntry {
  _id: string;
  status: EntryStatus;
  teammates: string[];
  answers: { key: string; label: string; value: string }[];
  amountPaid: number;
  refundAmount: number;
  revokeReason?: string | null;
  waitlistPosition?: number | null;
}

export interface TournamentDetail {
  tournament: Tournament;
  players: { name: string; teammates: string[] }[];
  myEntry: MyEntry | null;
}

export interface MyTournamentEntry extends MyEntry {
  confirmedAt: string | null;
  createdAt: string;
  tournament: Tournament;
}

export interface AdminTournamentEntry {
  _id: string;
  status: EntryStatus;
  playerName: string;
  teammates: string[];
  answers: { key: string; label: string; value: string }[];
  amountPaid: number;
  refundAmount: number;
  confirmedAt: string | null;
  createdAt: string;
  revokedAt: string | null;
  revokeReason: string | null;
  userId: { _id: string; name?: string; email?: string; phone?: string } | null;
  revokedBy: { name?: string } | null;
}

export const feeLabel = (fee: number) => (fee > 0 ? `$${fee.toFixed(2)}` : "Free");
export const formatLabel = (teamSize: number) => (teamSize === 1 ? "Singles" : teamSize === 2 ? "Doubles" : `Teams of ${teamSize}`);

/** Error carrying the server's extra fields (insufficient, full …). */
export class TournamentError extends Error {
  data: { full?: boolean; insufficient?: boolean; shortBy?: number };
  constructor(message: string, data: TournamentError["data"]) {
    super(message);
    this.data = data;
  }
}

async function call(path: string, options: RequestInit = {}) {
  const res = await apiFetch(path, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new TournamentError(data.error || "Something went wrong", data);
  return data;
}

// ── Player ──────────────────────────────────────────────────

export function useTournaments() {
  return useQuery({
    queryKey: ["tournaments", "list"],
    queryFn: () => call("/api/tournaments") as Promise<{ upcoming: Tournament[]; past: Tournament[] }>,
  });
}

export function useTournament(id: string | undefined) {
  const { user } = useAuth();
  return useQuery({
    // The signed-in user is part of the key — the response includes their own entry.
    queryKey: ["tournaments", "detail", id, user?.id ?? null],
    queryFn: () => call(`/api/tournaments/${id}`) as Promise<TournamentDetail>,
    enabled: !!id,
  });
}

export function useMyTournaments() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["tournaments", "mine", user?.id],
    queryFn: () => call("/api/tournaments/mine") as Promise<MyTournamentEntry[]>,
    enabled: !!user,
  });
}

function useInvalidateTournaments() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["tournaments"] });
    qc.invalidateQueries({ queryKey: ["profile"] });
  };
}

export interface SignupPayload {
  teammates: string[];
  answers: Record<string, string>;
}

export function useRegisterTournament(id: string) {
  const invalidate = useInvalidateTournaments();
  return useMutation({
    mutationFn: (payload: SignupPayload | null) =>
      call(`/api/tournaments/${id}/register`, { method: "POST", body: JSON.stringify(payload ?? {}) }),
    onSettled: invalidate,
  });
}

export function useJoinWaitlist(id: string) {
  const invalidate = useInvalidateTournaments();
  return useMutation({
    mutationFn: (payload: SignupPayload) =>
      call(`/api/tournaments/${id}/waitlist`, { method: "POST", body: JSON.stringify(payload) }),
    onSettled: invalidate,
  });
}

export function useLeaveWaitlist(id: string) {
  const invalidate = useInvalidateTournaments();
  return useMutation({
    mutationFn: () => call(`/api/tournaments/${id}/waitlist`, { method: "DELETE" }),
    onSettled: invalidate,
  });
}

// ── Admin ───────────────────────────────────────────────────

export function useAdminTournaments() {
  return useQuery({
    queryKey: ["tournaments", "admin"],
    queryFn: () => call("/api/tournaments/admin/list") as Promise<Tournament[]>,
  });
}

export function useAdminTournamentEntries(id: string | null) {
  return useQuery({
    queryKey: ["tournaments", "admin", "entries", id],
    queryFn: () => call(`/api/tournaments/admin/${id}/entries`) as Promise<AdminTournamentEntry[]>,
    enabled: !!id,
  });
}

export function useSaveTournament() {
  const invalidate = useInvalidateTournaments();
  return useMutation({
    mutationFn: ({ id, data }: { id?: string; data: Record<string, unknown> }) =>
      call(id ? `/api/tournaments/admin/${id}` : "/api/tournaments/admin", {
        method: id ? "PUT" : "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: invalidate,
  });
}

export function useRevokeEntry() {
  const invalidate = useInvalidateTournaments();
  return useMutation({
    mutationFn: ({ entryId, refund, reason }: { entryId: string; refund: boolean; reason: string }) =>
      call(`/api/tournaments/admin/entries/${entryId}/revoke`, { method: "POST", body: JSON.stringify({ refund, reason }) }),
    onSuccess: invalidate,
  });
}

export function useCancelTournament() {
  const invalidate = useInvalidateTournaments();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      call(`/api/tournaments/admin/${id}/cancel`, { method: "POST", body: JSON.stringify({ reason }) }),
    onSuccess: invalidate,
  });
}

export function useDeleteTournament() {
  const invalidate = useInvalidateTournaments();
  return useMutation({
    mutationFn: (id: string) => call(`/api/tournaments/admin/${id}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });
}
