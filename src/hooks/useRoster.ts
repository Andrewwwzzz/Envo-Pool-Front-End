import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

/** What the Telegram bot recorded for a shift (see Admin → Roster). */
export interface ShiftCheck {
  promptedAt?: string | null;
  response?: "coming" | "cant" | null;
  respondedAt?: string | null;
  escalatedAt?: string | null;
  noClockInAt?: string | null;
  notLinkedAt?: string | null;
}

export interface RosterShift {
  id: string;
  staffId: string;
  staffName: string;
  staffRole: string | null;
  startAt: string;
  endAt: string;
  note: string;
  status: "scheduled" | "cancelled";
  check: ShiftCheck;
  clockedInAt: string | null;
  clockedOutAt: string | null;
}

/** One clock-in from the Staff Dashboard, with the rostered shift it belongs to (if any). */
export interface ClockLog {
  id: string;
  staffId: string;
  staffName: string;
  clockInAt: string;
  clockOutAt: string | null;
  autoClockedOut?: boolean;
  shiftId: string | null;
  shiftStartAt: string | null;
  shiftEndAt: string | null;
}

export interface TeamMember {
  id: string;
  name: string;
  role: string;
}

export interface ShiftInput {
  staffId: string;
  startAt: string;
  endAt: string;
  note?: string;
}

async function fail(res: Response, fallback: string): Promise<never> {
  const json = await res.json().catch(() => null);
  throw new Error(json?.error || fallback);
}

/** Shifts starting in [from, to) — ISO strings. Refreshes every 30s so the bot's checks show up. */
export function useRosterShifts(from: string, to: string) {
  return useQuery({
    queryKey: ["roster", from, to],
    queryFn: async (): Promise<{ from: string; to: string; shifts: RosterShift[]; logs: ClockLog[] }> => {
      const res = await apiFetch(`/api/roster?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
      if (!res.ok) await fail(res, "Failed to load the roster");
      return res.json();
    },
    refetchInterval: 30_000,
  });
}

export function useRosterTeam() {
  return useQuery({
    queryKey: ["roster-team"],
    queryFn: async (): Promise<TeamMember[]> => {
      const res = await apiFetch("/api/roster/team");
      if (!res.ok) await fail(res, "Failed to load the team");
      return res.json();
    },
    staleTime: 5 * 60_000,
  });
}

export function useCreateShift() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ShiftInput) => {
      const res = await apiFetch("/api/roster", { method: "POST", body: JSON.stringify(input) });
      if (!res.ok) await fail(res, "Could not add the shift");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["roster"] }),
  });
}

export function useUpdateShift() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: ShiftInput & { id: string }) => {
      const res = await apiFetch(`/api/roster/${id}`, { method: "PUT", body: JSON.stringify(input) });
      if (!res.ok) await fail(res, "Could not change the shift");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["roster"] }),
  });
}

export function useCancelShift() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiFetch(`/api/roster/${id}`, { method: "DELETE" });
      if (!res.ok) await fail(res, "Could not remove the shift");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["roster"] }),
  });
}
