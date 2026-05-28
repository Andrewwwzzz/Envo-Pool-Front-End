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
  return useQuery<any[]>({
    queryKey: ["membership", "subscriptions"],
    queryFn: async () => {
      const j = await getJson("/api/membership/admin/subscriptions");
      const arr = Array.isArray(j) ? j : j.subscriptions ?? [];
      return arr.map((s: any) => ({ ...s, id: s.id ?? s._id }));
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

export function useCancelMyMembership() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (membershipId?: string) => {
      const r = await apiFetch("/api/membership/cancel", {
        method: "POST",
        body: JSON.stringify(membershipId ? { membershipId } : {}),
      });
      const text = await r.text();
      if (!r.ok) throw new Error(text || `${r.status}`);
      try { return text ? JSON.parse(text) : null; } catch { return null; }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["membership", "my"] });
      qc.invalidateQueries({ queryKey: ["profile"] });
    },
  });
}

export function useMyMembership() {
  return useQuery<{ memberships: any[]; totalSaved: number }>({
    queryKey: ["membership", "my"],
    enabled: typeof window !== "undefined" && !!localStorage.getItem("token"),
    queryFn: async () => {
      const token = localStorage.getItem("token");
      const r = await apiFetch("/api/membership/my", {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      if (r.status === 404 || r.status === 401) return { memberships: [], totalSaved: 0 };
      if (!r.ok) throw new Error(`${r.status}`);
      const j = await r.json();
      // New shape: { memberships: [...], totalSaved }
      if (j && Array.isArray(j.memberships)) {
        return { memberships: j.memberships, totalSaved: Number(j.totalSaved ?? 0) };
      }
      // Legacy shape: single membership object
      if (j && (j.status || j.plan || j.active)) {
        return { memberships: [j], totalSaved: Number(j.totalSaved ?? 0) };
      }
      return { memberships: [], totalSaved: Number(j?.totalSaved ?? 0) };
    },
  });
}

export function useSubscribeMembership() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (planId: string) => {
      const r = await apiFetch("/api/membership/subscribe", {
        method: "POST",
        body: JSON.stringify({ planId }),
      });
      const text = await r.text();
      let body: any = null;
      try { body = text ? JSON.parse(text) : null; } catch { body = { message: text }; }
      if (!r.ok) throw new Error(body?.message || body?.error || text || `${r.status}`);
      return body;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["membership", "my"] });
      qc.invalidateQueries({ queryKey: ["profile"] });
      qc.invalidateQueries({ queryKey: ["lockers"] });
    },
  });
}

export function useRenewMembership() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (membershipId?: string) => {
      const path = membershipId ? `/api/membership/renew/${membershipId}` : `/api/membership/renew`;
      const r = await apiFetch(path, {
        method: "POST",
        body: membershipId ? JSON.stringify({ membershipId }) : undefined,
      });
      const text = await r.text();
      let body: any = null;
      try { body = text ? JSON.parse(text) : null; } catch { body = { message: text }; }
      if (!r.ok) throw new Error(body?.message || body?.error || text || `${r.status}`);
      return body;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["membership", "my"] });
      qc.invalidateQueries({ queryKey: ["profile"] });
      qc.invalidateQueries({ queryKey: ["lockers"] });
    },
  });
}

export function useAssignMembershipLocker() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ membershipId, lockerUnitId, pin }: { membershipId: string; lockerUnitId: string; pin?: string }) => {
      const r = await apiFetch(`/api/membership/admin/assign-locker/${membershipId}`, {
        method: "POST",
        body: JSON.stringify({ lockerUnitId, pin }),
      });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["membership", "subscriptions"] });
      qc.invalidateQueries({ queryKey: ["lockers"] });
    },
  });
}

export function useUpdateLockerPin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ rentalId, pin }: { rentalId: string; pin: string }) => {
      const r = await apiFetch(`/api/membership/admin/locker-pin/${rentalId}`, {
        method: "PATCH",
        body: JSON.stringify({ pin }),
      });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["membership", "subscriptions"] });
      qc.invalidateQueries({ queryKey: ["lockers"] });
    },
  });
}

