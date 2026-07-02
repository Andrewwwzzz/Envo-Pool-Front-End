import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export interface LockerUnit {
  id: string;
  number: string | number;
  status?: string;
  monthlyPrice?: number;
  notes?: string;
  currentRenterName?: string;
  currentRenterEmail?: string;
  rentalId?: string;
  renewalDate?: string;
  startDate?: string;
}

async function getJson(path: string) {
  const r = await apiFetch(path);
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json();
}

export function useLockerUnits(filter: "default" | "all" = "all") {
  return useQuery<LockerUnit[]>({
    queryKey: ["lockers", "units", { filter }],
    queryFn: async () => {
      const qs = filter === "default" ? "" : `?filter=${filter}`;
      const j = await getJson(`/api/lockers/units${qs}`);
      const arr = Array.isArray(j) ? j : j.units ?? [];
      return arr.map((u: any) => ({
        ...u,
        deleted: u.deleted === true || u.isDeleted === true || !!u.deletedAt,
        deletedAt: u.deletedAt || u.deleted_at,
        deletedBy: u.deletedBy || u.deleted_by,
        deleteReason: u.deleteReason || u.deletionReason || u.deleted_reason,
      }));
    },
  });
}

export function useDeleteLockerUnit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const r = await apiFetch(`/api/lockers/units/${id}`, {
        method: "DELETE",
        body: JSON.stringify({ reason }),
      });
      if (!r.ok) throw new Error(await r.text());
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lockers"] }),
  });
}


export function useLockerRentals() {
  return useQuery<any[]>({
    queryKey: ["lockers", "rentals"],
    queryFn: async () => {
      const j = await getJson("/api/lockers/rentals?includeAll=1");
      return Array.isArray(j) ? j : j.rentals ?? [];
    },
  });
}

export function useAvailableLockers() {
  return useQuery<LockerUnit[]>({
    queryKey: ["lockers", "available"],
    queryFn: async () => {
      const j = await getJson("/api/lockers/units/available");
      return Array.isArray(j) ? j : j.units ?? [];
    },
  });
}

export function useCreateLockerUnit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { number: string; monthlyPrice: number; pin?: string; notes?: string }) => {
      const payload = { lockerNumber: data.number, monthlyPrice: data.monthlyPrice, pin: data.pin, notes: data.notes };
      const r = await apiFetch("/api/lockers/units", { method: "POST", body: JSON.stringify(payload) });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lockers"] }),
  });
}

export function useAssignLocker() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { lockerId: string; customerId?: string; customerEmail?: string; startDate?: string }) => {
      const payload = {
        lockerUnitId: data.lockerId,
        userId: data.customerId,
        customerEmail: data.customerEmail,
        startDate: data.startDate,
      };
      const r = await apiFetch("/api/lockers/rentals/assign", { method: "POST", body: JSON.stringify(payload) });
      if (!r.ok) {
        const body = await r.json().catch(() => null);
        throw new Error(body?.error || body?.message || "Failed to assign locker");
      }
      return r.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lockers"] }),
  });
}

export function useRenewLocker() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rentalId: string) => {
      const r = await apiFetch(`/api/lockers/rentals/${rentalId}/renew`, { method: "POST" });
      if (!r.ok) throw new Error(await r.text());
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lockers"] }),
  });
}

export function useCancelLocker() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ rentalId, reason }: { rentalId: string; reason: string }) => {
      const r = await apiFetch(`/api/lockers/rentals/${rentalId}/cancel`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      });
      if (!r.ok) throw new Error(await r.text());
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lockers"] }),
  });
}

export function useDeleteLockerRental() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ rentalId, reason }: { rentalId: string; reason: string }) => {
      const r = await apiFetch(`/api/lockers/rentals/${rentalId}`, {
        method: "DELETE",
        body: JSON.stringify({ reason }),
      });
      if (!r.ok) throw new Error(await r.text());
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lockers"] }),
  });
}

export function useRegeneratePinLocker() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const r = await apiFetch(`/api/lockers/units/${id}/regenerate-pin`, { method: "POST" });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lockers"] }),
  });
}

export function useSeedLockerPins() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const r = await apiFetch("/api/lockers/units/seed-pins", { method: "POST" });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lockers"] }),
  });
}

export function useMyLocker() {
  return useQuery<any>({
    queryKey: ["lockers", "my"],
    queryFn: async () => {
      const r = await apiFetch("/api/lockers/my");
      if (r.status === 404) return null;
      if (!r.ok) throw new Error(`${r.status}`);
      return r.json();
    },
  });
}
