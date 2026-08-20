import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

export interface FnbProduct {
  _id: string;
  name: string;
  category: "soft_drinks" | "beer" | "finger_food" | "snacks";
  costPrice: number;
  sellingPrice: number;
  stock: number;
  lowStockThreshold: number;
  piecesPerUnit: number;
  isRedeemable: boolean;
  isAlcohol: boolean;
  isActive: boolean;
  sortOrder: number;
}

export interface FnbOrder {
  _id: string;
  productId: string;
  productName: string;
  productCategory: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  paymentMethod: "wallet" | "free_membership" | "free_reward";
  tableId: string | null;
  tableName: string | null;
  status: "pending" | "served" | "cancelled";
  operatingDay: string;
  createdAt: string;
  servedAt: string | null;
  userId?: any;
  servedBy?: any;
}

export interface RedemptionCheck {
  hasRedeemed: boolean;
  canRedeem: boolean;
  operatingDay: string;
}

export const CATEGORY_LABELS: Record<string, string> = {
  soft_drinks: "Soft Drink",
  beer: "Beer",
  finger_food: "Finger Food",
  snacks: "Snack",
};

export const CATEGORY_COLORS: Record<string, string> = {
  soft_drinks: "bg-blue-500/20 text-blue-400",
  beer: "bg-amber-500/20 text-amber-400",
  finger_food: "bg-orange-500/20 text-orange-400",
  snacks: "bg-green-500/20 text-green-400",
};

// ── Customer hooks ──────────────────────────────────────

export function useMenu() {
  return useQuery({
    queryKey: ["fnb-menu"],
    queryFn: async () => {
      const res = await apiFetch("/api/fnb/products");
      if (!res.ok) throw new Error("Failed to load menu");
      const data = await res.json();
      return (Array.isArray(data) ? data : []) as FnbProduct[];
    },
  });
}

export function useMyFnbOrders() {
  return useQuery({
    queryKey: ["fnb-orders-my"],
    queryFn: async () => {
      const res = await apiFetch("/api/fnb/orders/my");
      if (!res.ok) throw new Error("Failed to load orders");
      const data = await res.json();
      return (Array.isArray(data) ? data : []) as FnbOrder[];
    },
    refetchInterval: 15000,
  });
}

export function useRedemptionCheck() {
  return useQuery({
    queryKey: ["fnb-redemption-check"],
    queryFn: async () => {
      const res = await apiFetch("/api/fnb/redemption/check");
      if (!res.ok) throw new Error("Failed to check redemption");
      return res.json() as Promise<RedemptionCheck>;
    },
  });
}

export function usePlaceOrder() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (body: {
      productId: string;
      tableId?: string;
      tableName?: string;
      isFreeRedemption?: boolean;
    }) => {
      const res = await apiFetch("/api/fnb/orders", {
        method: "POST",
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to place order");
      return data;
    },
    onSuccess: () => {
      toast({ title: "Order received!", description: "We'll bring it to your table shortly." });
      qc.invalidateQueries({ queryKey: ["fnb-orders-my"] });
      qc.invalidateQueries({ queryKey: ["fnb-redemption-check"] });
      qc.invalidateQueries({ queryKey: ["fnb-menu"] });
    },
    onError: (err: Error) => {
      toast({ title: "Order failed", description: err.message, variant: "destructive" });
    },
  });
}

// ── Admin hooks ──────────────────────────────────────

export function useAdminFnbOrders(status?: string, day?: string) {
  return useQuery({
    queryKey: ["fnb-orders-admin", status, day],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (status && status !== "all") params.set("status", status);
      if (day) params.set("day", day);
      const qs = params.toString();
      const res = await apiFetch(qs ? `/api/fnb/orders?${qs}` : "/api/fnb/orders");
      if (!res.ok) throw new Error("Failed to load orders");
      const data = await res.json();
      return (Array.isArray(data) ? data : []) as FnbOrder[];
    },
    refetchInterval: 10000,
  });
}

export function useAdminMenu(includeDeleted = false) {
  return useQuery({
    queryKey: ["fnb-menu-admin", { includeDeleted }],
    queryFn: async () => {
      const qs = includeDeleted ? "?includeDeleted=1" : "";
      const res = await apiFetch(`/api/fnb/products/admin${qs}`);
      if (!res.ok) throw new Error("Failed to load products");
      const data = await res.json();
      return (Array.isArray(data) ? data : []) as FnbProduct[];
    },
  });
}

export function useServeOrder() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (orderId: string) => {
      const res = await apiFetch(`/api/fnb/orders/${orderId}/serve`, { method: "PATCH" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to mark as served");
      return data;
    },
    onSuccess: () => {
      toast({ title: "Order marked as served" });
      qc.invalidateQueries({ queryKey: ["fnb-orders-admin"] });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });
}

export function useCancelFnbOrder() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ orderId, reason, refund = false }: { orderId: string; reason?: string; refund?: boolean }) => {
      const res = await apiFetch(`/api/fnb/orders/${orderId}/cancel`, {
        method: "PATCH",
        body: JSON.stringify({ reason, refund }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to cancel order");
      return data;
    },
    onSuccess: () => {
      toast({ title: "Order cancelled and refunded" });
      qc.invalidateQueries({ queryKey: ["fnb-orders-admin"] });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });
}

export function useCreateProduct() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (body: Partial<FnbProduct>) => {
      const res = await apiFetch("/api/fnb/products", {
        method: "POST",
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create product");
      return data;
    },
    onSuccess: () => {
      toast({ title: "Product created" });
      qc.invalidateQueries({ queryKey: ["fnb-menu-admin"] });
      qc.invalidateQueries({ queryKey: ["fnb-menu"] });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });
}

export function useUpdateProduct() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id, ...body }: { id: string } & Partial<FnbProduct>) => {
      const res = await apiFetch(`/api/fnb/products/${id}`, {
        method: "PUT",
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update product");
      return data;
    },
    onSuccess: () => {
      toast({ title: "Product updated" });
      qc.invalidateQueries({ queryKey: ["fnb-menu-admin"] });
      qc.invalidateQueries({ queryKey: ["fnb-menu"] });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });
}

export function useDeleteProduct() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiFetch(`/api/fnb/products/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete product");
      return data;
    },
    onSuccess: () => {
      toast({ title: "Product deleted" });
      qc.invalidateQueries({ queryKey: ["fnb-menu-admin"] });
      qc.invalidateQueries({ queryKey: ["fnb-menu"] });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });
}

export function useRestockProduct() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id, quantity, description }: { id: string; quantity: number; description?: string }) => {
      const res = await apiFetch(`/api/fnb/products/${id}/restock`, {
        method: "POST",
        body: JSON.stringify({ quantity, description }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to restock");
      return data;
    },
    onSuccess: () => {
      toast({ title: "Stock updated" });
      qc.invalidateQueries({ queryKey: ["fnb-menu-admin"] });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });
}

// ─── F&B Status (pause / resume) ─────────────────────────────────────────────

export interface FnbStatus {
  isOpen: boolean;
  notice: string;
  resumeAt: string | null;
}

export function useFnbStatus() {
  return useQuery<FnbStatus>({
    queryKey: ["fnb-status"],
    queryFn: async () => {
      const r = await apiFetch("/api/fnb/status");
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    refetchInterval: 15000,
    refetchOnWindowFocus: true,
  });
}

export function useSetFnbStatus() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (data: { isOpen: boolean; notice?: string; resumeInMinutes?: number }) => {
      const r = await apiFetch("/api/fnb/admin/status", {
        method: "POST",
        body: JSON.stringify(data),
      });
      if (!r.ok) throw new Error(await r.text());
      return r.json() as Promise<FnbStatus>;
    },
    onSuccess: (_, vars) => {
      toast({ title: vars.isOpen ? "F&B reopened" : "F&B paused" });
      qc.invalidateQueries({ queryKey: ["fnb-status"] });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });
}

