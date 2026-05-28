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

export function useLockerUnits(includeDeleted: boolean = true) {
  return useQuery<LockerUnit[]>({
    queryKey: ["lockers", "units", { includeDeleted }],
    queryFn: async () => {
      const j = await getJson(`/api/lockers/units${includeDeleted ? "?includeDeleted=1" : ""}`);
      return Array.isArray(j) ? j : j.units ?? [];
    },
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
    mutationFn: async (data: { number: string; monthlyPrice: number; notes?: string }) => {
      const r = await apiFetch("/api/lockers/units", { method: "POST", body: JSON.stringify(data) });
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
      const r = await apiFetch("/api/lockers/rentals/assign", { method: "POST", body: JSON.stringify(data) });
      if (!r.ok) throw new Error(await r.text());
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
