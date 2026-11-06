import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api";

export type CatalogCategory = "food_drinks" | "store_credit" | "booking_discount" | "merchandise";
export type CatalogType = "milestone" | "points_exchange";

export interface CatalogItem {
  _id?: string;
  id?: string;
  name: string;
  description: string;
  category: CatalogCategory;
  type: CatalogType;
  milestoneThreshold?: number | null;
  pointCost?: number | null;
  tangible: boolean;
  expiryDays?: number | null;
  fnbProductId?: string | null;
  isActive: boolean;
  discountValue?: number | null;
  creditValue?: number | null;
}

export interface MilestoneProgress {
  _id?: string;
  id?: string;
  catalogId: string;
  name: string;
  description?: string;
  category?: CatalogCategory;
  milestoneThreshold: number;
  tangible?: boolean;
  claimed: boolean;
  claimedAt?: string | null;
}

export interface MultiplierEvent {
  _id?: string;
  id?: string;
  name: string;
  multiplier: number;
  startDate: string;
  endDate: string;
  isActive: boolean;
}

export interface PointsLedgerEntry {
  _id?: string;
  id?: string;
  createdAt: string;
  description: string;
  points: number;
  balance: number;
  source: string;
}

const arr = <T,>(data: any): T[] =>
  Array.isArray(data) ? data : (data?.items ?? data?.catalog ?? data?.history ?? data?.transactions ?? data?.rewards ?? data?.events ?? data?.milestones ?? []);

// ---------- Catalog ----------
export function useRewardCatalog() {
  return useQuery({
    queryKey: ["reward-catalog"],
    queryFn: async () => {
      const res = await apiFetch("/api/rewards/catalog");
      if (!res.ok) return [] as CatalogItem[];
      return arr<CatalogItem>(await res.json().catch(() => []));
    },
  });
}

export function useAdminRewardCatalog() {
  return useQuery({
    queryKey: ["admin-reward-catalog"],
    queryFn: async () => {
      const res = await apiFetch("/api/rewards/catalog/admin");
      if (!res.ok) throw new Error("Failed to load catalog");
      return arr<CatalogItem>(await res.json());
    },
  });
}

export function useCreateCatalogItem() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (payload: Partial<CatalogItem>) => {
      const res = await apiFetch("/api/rewards/catalog", { method: "POST", body: JSON.stringify(payload) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to create");
      return data;
    },
    onSuccess: () => {
      toast({ title: "Reward created" });
      qc.invalidateQueries({ queryKey: ["admin-reward-catalog"] });
      qc.invalidateQueries({ queryKey: ["reward-catalog"] });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
}

export function useUpdateCatalogItem() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id, ...payload }: { id: string } & Partial<CatalogItem>) => {
      const res = await apiFetch(`/api/rewards/catalog/${id}`, { method: "PUT", body: JSON.stringify(payload) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to update");
      return data;
    },
    onSuccess: () => {
      toast({ title: "Reward updated" });
      qc.invalidateQueries({ queryKey: ["admin-reward-catalog"] });
      qc.invalidateQueries({ queryKey: ["reward-catalog"] });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
}

export function useToggleCatalogItem() {
  const update = useUpdateCatalogItem();
  return {
    ...update,
    toggle: (item: CatalogItem) => update.mutate({ id: (item._id || item.id)!, isActive: !item.isActive }),
  };
}

export function useDeleteCatalogItem() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiFetch(`/api/rewards/catalog/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      return res.json().catch(() => ({}));
    },
    onSuccess: () => {
      toast({ title: "Reward deleted" });
      qc.invalidateQueries({ queryKey: ["admin-reward-catalog"] });
      qc.invalidateQueries({ queryKey: ["reward-catalog"] });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
}

// ---------- Milestones ----------
export function useMyMilestones() {
  return useQuery({
    queryKey: ["my-milestones"],
    queryFn: async () => {
      const res = await apiFetch("/api/rewards/milestones");
      if (!res.ok) return [] as MilestoneProgress[];
      const data = await res.json().catch(() => ({}));
      // Backend returns { lifetimePoints, currentPoints, milestones: [...], nextMilestone }
      const list = Array.isArray(data) ? data : (data?.milestones ?? data?.items ?? []);
      return list as MilestoneProgress[];
    },
  });
}

export function useClaimMilestone() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (catalogId: string) => {
      const res = await apiFetch(`/api/rewards/claim-milestone/${catalogId}`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to claim");
      return data;
    },
    onSuccess: () => {
      toast({ title: "Milestone claimed!" });
      qc.invalidateQueries({ queryKey: ["my-milestones"] });
      qc.invalidateQueries({ queryKey: ["my-rewards"] });
      qc.invalidateQueries({ queryKey: ["points-history"] });
      qc.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (e: Error) => toast({ title: "Cannot claim", description: e.message, variant: "destructive" }),
  });
}

// ---------- Exchange ----------
export function useExchangeReward() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ catalogId, tableId, tableName }: { catalogId: string; tableId?: string; tableName?: string }) => {
      const res = await apiFetch(`/api/rewards/exchange/${catalogId}`, {
        method: "POST",
        body: JSON.stringify({ tableId, tableName }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to redeem");
      return data as { isFnbOrder?: boolean; message?: string; [key: string]: any };
    },
    onSuccess: (data) => {
      if (data?.isFnbOrder) {
        toast({ title: "Order placed!", description: data.message || "Your item will be delivered to your table." });
        qc.invalidateQueries({ queryKey: ["fnb-orders-my"] });
      } else {
        toast({ title: "Reward redeemed!", description: "Your code is now in My Reward Codes." });
        qc.invalidateQueries({ queryKey: ["my-rewards"] });
      }
      qc.invalidateQueries({ queryKey: ["points-history"] });
      qc.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (e: Error) => toast({ title: "Cannot redeem", description: e.message, variant: "destructive" }),
  });
}

// ---------- Points History ----------
export function usePointsHistory(userId?: string) {
  return useQuery({
    queryKey: ["points-history", userId || "me"],
    queryFn: async () => {
      const path = userId ? `/api/rewards/points/history/${userId}` : "/api/rewards/points/history";
      const res = await apiFetch(path);
      if (!res.ok) return [] as PointsLedgerEntry[];
      const data = await res.json().catch(() => ({}));
      // Backend returns { transactions, history (alias), pagination }
      const raw: any[] = Array.isArray(data) ? data : (data?.history ?? data?.transactions ?? []);
      // Backend stores balance as `balanceAfter`; normalise to `balance`
      const list = raw.map((entry: any) => ({
        ...entry,
        balance: entry.balance ?? entry.balanceAfter ?? 0,
      }));
      return list as PointsLedgerEntry[];
    },
  });
}

// ---------- Multipliers ----------
export function useMultiplierEvents() {
  return useQuery({
    queryKey: ["multiplier-events", "active"],
    queryFn: async () => {
      const res = await apiFetch("/api/rewards/multipliers");
      if (!res.ok) throw new Error("Failed to load multipliers");
      return arr<MultiplierEvent>(await res.json());
    },
    refetchInterval: 60_000,
  });
}

export function useAdminMultipliers() {
  return useQuery({
    queryKey: ["multiplier-events", "admin"],
    queryFn: async () => {
      const res = await apiFetch("/api/rewards/multipliers/admin");
      if (!res.ok) throw new Error("Failed to load multipliers");
      return arr<MultiplierEvent>(await res.json());
    },
  });
}

export function useCreateMultiplier() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (payload: Partial<MultiplierEvent>) => {
      const res = await apiFetch("/api/rewards/multipliers", { method: "POST", body: JSON.stringify(payload) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to create event");
      return data;
    },
    onSuccess: () => {
      toast({ title: "Event created" });
      qc.invalidateQueries({ queryKey: ["multiplier-events"] });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
}

export function useUpdateMultiplier() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id, ...payload }: { id: string } & Partial<MultiplierEvent>) => {
      const res = await apiFetch(`/api/rewards/multipliers/${id}`, { method: "PUT", body: JSON.stringify(payload) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to update");
      return data;
    },
    onSuccess: () => {
      toast({ title: "Event updated" });
      qc.invalidateQueries({ queryKey: ["multiplier-events"] });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
}

export function useToggleMultiplier() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiFetch(`/api/rewards/multipliers/${id}/toggle`, { method: "PATCH" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to toggle");
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["multiplier-events"] });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
}

// ---------- Mark redeemed ----------
export function useMarkRedeemed() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (rewardId: string) => {
      const res = await apiFetch(`/api/rewards/mark-redeemed/${rewardId}`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed");
      return data;
    },
    onSuccess: () => {
      toast({ title: "Marked as redeemed" });
      qc.invalidateQueries({ queryKey: ["my-rewards"] });
      qc.invalidateQueries({ queryKey: ["admin-rewards"] });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
}

// ---------- Helpers ----------
export const CATEGORY_LABELS: Record<CatalogCategory, string> = {
  food_drinks: "Food & Drinks",
  store_credit: "Store Credit",
  booking_discount: "Booking Discount",
  merchandise: "Merchandise",
};

export const CATEGORY_BADGE: Record<CatalogCategory, string> = {
  food_drinks: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  store_credit: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  booking_discount: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  merchandise: "bg-purple-500/15 text-purple-400 border-purple-500/30",
};

export function isMultiplierLive(e: MultiplierEvent): boolean {
  if (!e.isActive) return false;
  const now = Date.now();
  const start = new Date(e.startDate).getTime();
  const end = new Date(e.endDate).getTime();
  return start <= now && now <= end;
}
