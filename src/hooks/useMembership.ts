import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export interface MembershipPlan {
  id: string;
  name: string;
  description?: string;
  price: number;
  billingCycle: "monthly" | "annual";
  bookingDiscountPct?: number;
  freeMinutesPerVisit?: number;
  freeDrinkPerVisit?: boolean;
  lockerIncluded?: boolean;
  guestPassesPerMonth?: number;
  sortOrder?: number;
}

export interface Subscription {
  id: string;
  customerName?: string;
  customerEmail?: string;
  planName?: string;
  price?: number;
  startDate?: string;
  renewalDate?: string;
  status?: string;
  lockerNumber?: string | number;
}

async function getJson(path: string) {
  const r = await apiFetch(path);
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json();
}

export function useMembershipPlans() {
  return useQuery<MembershipPlan[]>({
    queryKey: ["membership", "plans"],
    queryFn: async () => {
      const j = await getJson("/api/membership/plans");
      const arr = Array.isArray(j) ? j : j.plans ?? [];
      return arr.map((p: any) => ({ ...p, id: p.id ?? p._id }));
    },
  });
}

export function useCreateMembershipPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<MembershipPlan>) => {
      const r = await apiFetch("/api/membership/plans", { method: "POST", body: JSON.stringify(data) });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["membership", "plans"] }),
  });
}

export function useUpdateMembershipPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<MembershipPlan> }) => {
      const r = await apiFetch(`/api/membership/plans/${id}`, { method: "PUT", body: JSON.stringify(data) });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["membership", "plans"] }),
  });
}

export function useDeleteMembershipPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const r = await apiFetch(`/api/membership/plans/${id}`, { method: "DELETE" });
      if (!r.ok) throw new Error(await r.text());
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["membership", "plans"] }),
  });
}

export function useAdminSubscriptions() {
  return useQuery<Subscription[]>({
    queryKey: ["membership", "subscriptions"],
    queryFn: async () => {
      const j = await getJson("/api/membership/admin/subscriptions");
      return Array.isArray(j) ? j : j.subscriptions ?? [];
    },
  });
}

export function useAssignMembership() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { userId: string; planId: string; startDate?: string }) => {
      const r = await apiFetch("/api/membership/admin/assign", { method: "POST", body: JSON.stringify(data) });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["membership", "subscriptions"] });
      qc.invalidateQueries({ queryKey: ["lockers"] });
    },
  });
}

export function useCancelMembership() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const r = await apiFetch(`/api/membership/admin/cancel/${id}`, { method: "POST" });
      if (!r.ok) throw new Error(await r.text());
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["membership", "subscriptions"] }),
  });
}

export function useMyMembership() {
  return useQuery<any>({
    queryKey: ["membership", "my"],
    queryFn: async () => {
      const r = await apiFetch("/api/membership/my");
      if (r.status === 404) return null;
      if (!r.ok) throw new Error(`${r.status}`);
      return r.json();
    },
  });
}
