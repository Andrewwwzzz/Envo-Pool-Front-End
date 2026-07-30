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
  freeMinutesDays?: number[];
  freeMinutesExcludePH?: boolean;
  freeDrinkPerVisit?: boolean;
  lockerIncluded?: boolean;
  guestPassesPerMonth?: number;
  sortOrder?: number;
  isPrivate?: boolean;
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

export function useMembershipPlans(filter: "default" | "all" = "default") {
  return useQuery<MembershipPlan[]>({
    queryKey: ["membership", "plans", { filter }],
    queryFn: async () => {
      const qs = filter === "default" ? "" : `?filter=${filter}`;
      const j = await getJson(`/api/membership/plans${qs}`);
      const arr = Array.isArray(j) ? j : j.plans ?? [];
      return arr.map((p: any) => ({
        ...p,
        id: p.id ?? p._id,
        deleted: p.deleted === true || p.isDeleted === true || !!p.deletedAt,
        deletedAt: p.deletedAt || p.deleted_at,
        deletedBy: p.deletedBy || p.deleted_by,
        deleteReason: p.deleteReason || p.deletionReason || p.deleted_reason,
      }));
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

export function useToggleMembershipPlanActive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, activate }: { id: string; activate: boolean }) => {
      const action = activate ? "activate" : "deactivate";
      const r = await apiFetch(`/api/membership/plans/${id}/${action}`, { method: "PATCH" });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["membership", "plans"] }),
  });
}

export function useDeleteMembershipPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const r = await apiFetch(`/api/membership/plans/${id}`, {
        method: "DELETE",
        body: JSON.stringify({ reason }),
      });
      if (!r.ok) throw new Error(await r.text());
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["membership", "plans"] }),
  });
}


export function useAdminSubscriptions(filter: "default" | "deleted" | "all" = "default") {
  return useQuery<any[]>({
    queryKey: ["membership", "subscriptions", { filter }],
    queryFn: async () => {
      const qs = filter === "default" ? "" : `?filter=${filter}`;
      const j = await getJson(`/api/membership/admin/subscriptions${qs}`);
      const arr = Array.isArray(j) ? j : j.subscriptions ?? [];
      return arr.map((s: any) => ({ ...s, id: s.id ?? s._id }));
    },
  });
}

export function useAdminMembershipHours() {
  return useQuery<{ membershipId: string; hoursThisMonth: number; requiredHours: number; cycleStart: string; renewalDate: string }[]>({
    queryKey: ["membership", "admin-hours"],
    queryFn: async () => {
      const j = await getJson("/api/membership/admin/all-hours");
      return Array.isArray(j) ? j : [];
    },
    staleTime: 60_000,
    refetchOnWindowFocus: false,
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

export function useDeleteMembership() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const r = await apiFetch(`/api/membership/admin/delete/${id}`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      });
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
      const r = await apiFetch("/api/membership/renew", {
        method: "POST",
        body: JSON.stringify(membershipId ? { membershipId } : {}),
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

export function useRegenerateMembershipPin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (membershipId: string) => {
      const r = await apiFetch(`/api/membership/admin/memberships/${membershipId}/regenerate-pin`, { method: "POST" });
      if (!r.ok) throw new Error(await r.text());
      return r.json() as Promise<{ pin: string }>;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["membership", "subscriptions"] }),
  });
}

// ── Public Holidays (used to gate day-restricted membership benefits) ──

export interface PublicHoliday {
  _id: string;
  date: string; // "YYYY-MM-DD"
  name: string;
}

export function usePublicHolidays() {
  return useQuery<PublicHoliday[]>({
    queryKey: ["membership", "public-holidays"],
    queryFn: () => getJson("/api/membership/public-holidays"),
  });
}

export function useCreatePublicHoliday() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { date: string; name: string }) => {
      const r = await apiFetch("/api/membership/public-holidays", { method: "POST", body: JSON.stringify(data) });
      const text = await r.text();
      let body: any = null;
      try { body = text ? JSON.parse(text) : null; } catch { body = { error: text }; }
      if (!r.ok) throw new Error(body?.error || text || `${r.status}`);
      return body;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["membership", "public-holidays"] }),
  });
}

export interface MembershipHours {
  membershipId: string;
  planName: string;
  hoursThisMonth: number;
  requiredHours: number;
  renewalDate: string;
  cycleStart: string;
}

export function useMyMembershipHours() {
  return useQuery<MembershipHours[]>({
    queryKey: ["membership", "my-hours"],
    queryFn: () => getJson("/api/membership/my-hours"),
    refetchInterval: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
  });
}

export function useDeletePublicHoliday() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const r = await apiFetch(`/api/membership/public-holidays/${id}`, { method: "DELETE" });
      if (!r.ok) throw new Error(await r.text());
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["membership", "public-holidays"] }),
  });
}

