import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch, BASE_URL } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import type { FoodBundleConfig } from "@/lib/fnbBundle";

export interface FnbProduct {
  _id: string;
  name: string;
  category: "soft_drinks" | "beer" | "finger_food" | "snacks" | "others";
  costPrice: number;
  sellingPrice: number;
  // Price inside the daily happy hour (null = none); the server sends the
  // price that applies right now as currentPrice.
  happyHourPrice?: number | null;
  currentPrice?: number;
  happyHourActive?: boolean;
  stock: number;
  lowStockThreshold: number;
  piecesPerUnit: number;
  // Bundles (e.g. "Tiger bucket of 5") take piecesPerUnit from this product's
  // stock; the API then reports that product's stock as `stock`.
  stockFromProductId?: string | null;
  stockFromName?: string | null;
  isRedeemable: boolean;
  isAlcohol: boolean;
  isSignature: boolean;
  hasSauceOptions: boolean;
  isActive: boolean;
  sortOrder: number;
  imageUrl: string | null;
}


/** What one unit costs right now (happy-hour price inside the window). */
export const priceOf = (p: Pick<FnbProduct, "sellingPrice" | "currentPrice">) => Number(p.currentPrice ?? p.sellingPrice ?? 0);

export function productImageSrc(p: Pick<FnbProduct, "imageUrl">): string | null {
  return p.imageUrl ? `${BASE_URL}${p.imageUrl}` : null;
}

// Center-crops to a square and re-encodes as ~600px WebP, so a multi-MB phone
// photo uploads as ~50 KB and the menu stays fast.
export async function shrinkProductPhoto(file: File, size = 600): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const out = Math.min(size, side);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = out;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, out, out);
  bitmap.close();
  const blob = await new Promise<Blob | null>(r => canvas.toBlob(r, "image/webp", 0.82));
  // Older Safari can't encode WebP and silently returns PNG — fall back to JPEG
  if (blob && blob.type === "image/webp") return blob;
  const jpeg = await new Promise<Blob | null>(r => canvas.toBlob(r, "image/jpeg", 0.85));
  if (!jpeg) throw new Error("Couldn't process that image");
  return jpeg;
}

export interface FnbOrder {
  _id: string;
  productId: string;
  productName: string;
  productCategory: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  /** Set on the items of one food bundle (they share it); listPrice is the normal price. */
  bundleId?: string | null;
  listPrice?: number | null;
  paymentMethod: "wallet" | "cash" | "paynow" | "free_membership" | "free_reward" | "charge_to_table";
  selectedSauce: "chilli" | "ketchup" | null;
  nachoCheeseAddOn: boolean;
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
  eligibleProductIds: string[];
  eligibleCategories: string[];
  operatingDay: string;
}

export const CATEGORY_LABELS: Record<string, string> = {
  soft_drinks: "Soft Drink",
  beer: "Alcohol", // beers and soju (owner, 17 Nov 2026)
  finger_food: "Finger Food",
  snacks: "Snack",
  others: "Other",
};

export const CATEGORY_COLORS: Record<string, string> = {
  soft_drinks: "bg-blue-500/20 text-blue-400",
  beer: "bg-amber-500/20 text-amber-400",
  finger_food: "bg-orange-500/20 text-orange-400",
  snacks: "bg-green-500/20 text-green-400",
  others: "bg-purple-500/20 text-purple-400",
};

// Menu filter tabs (owner, 24 Nov 2026): alcohol has its own tab; snacks sit under Food.
export type CategoryGroup = "drinks" | "alcohol" | "food" | "others";

export const CATEGORY_GROUP_TABS: { value: "all" | CategoryGroup; label: string }[] = [
  { value: "all", label: "All" },
  { value: "drinks", label: "Drinks" },
  { value: "alcohol", label: "Alcohol" },
  { value: "food", label: "Food" },
  { value: "others", label: "Others" },
];

export function getCategoryGroup(cat: string): CategoryGroup {
  if (cat === "soft_drinks") return "drinks";
  if (cat === "beer") return "alcohol";
  if (cat === "finger_food" || cat === "snacks") return "food";
  return "others";
}

// ── Customer hooks ──────────────────────────────────────

export function useMenu() {
  return useQuery({
    queryKey: ["fnb-menu"],
    refetchInterval: 60_000, // happy-hour prices change on the clock
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
      selectedSauce?: "chilli" | "ketchup";
      nachoCheeseAddOn?: boolean;
      // Skips the built-in success/error toast — used when placing several
      // items in a row (cart checkout), where one combined summary toast at
      // the end reads better than one popup per item.
      silent?: boolean;
    }) => {
      const { silent, ...payload } = body;
      const res = await apiFetch("/api/fnb/orders", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to place order");
      return data;
    },
    onSuccess: (_data, variables) => {
      if (!variables?.silent) {
        toast({ title: "Order received!", description: "We'll bring it to your table shortly." });
      }
      qc.invalidateQueries({ queryKey: ["fnb-orders-my"] });
      qc.invalidateQueries({ queryKey: ["fnb-redemption-check"] });
      qc.invalidateQueries({ queryKey: ["fnb-menu"] });
    },
    onError: (err: Error, variables) => {
      if (!variables?.silent) {
        toast({ title: "Order failed", description: err.message, variant: "destructive" });
      }
    },
  });
}

export type CartItem = { productId: string; quantity: number; selectedSauce?: "chilli" | "ketchup" };

/** The customer's whole cart in one go, paid from the wallet — all or nothing; the server applies food bundles. */
export function usePlaceCart() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { items: CartItem[]; tableId?: string; tableName?: string }) => {
      const res = await apiFetch("/api/fnb/orders/cart", { method: "POST", body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to place order");
      return data as { message: string; count: number; total: number; savings: number; walletBalance: number };
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["fnb-orders-my"] });
      qc.invalidateQueries({ queryKey: ["fnb-menu"] });
      qc.invalidateQueries({ queryKey: ["profile"] });
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

// F&B orders charged to a specific table's tab, still awaiting settlement
// when that table closes out — powers both the staff "Place Order" dialog
// (what's already on this tab) and the Close Table bill preview.
export function useTablePendingFnb(tableRefId: string | null) {
  return useQuery({
    queryKey: ["fnb-orders-table-pending", tableRefId],
    queryFn: async () => {
      const res = await apiFetch(`/api/fnb/orders?tableRefId=${tableRefId}&paymentMethod=charge_to_table`);
      if (!res.ok) throw new Error("Failed to load table's F&B charges");
      const data = await res.json();
      return (Array.isArray(data) ? data : []) as FnbOrder[];
    },
    enabled: !!tableRefId,
    refetchInterval: 10000,
  });
}

export function usePlaceStaffOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      productId: string;
      userId?: string;
      tableId?: string;
      tableName?: string;
      isFreeRedemption?: boolean;
      paymentMethod?: "wallet" | "cash" | "paynow";
      chargeToTable?: boolean;
      tableRefId?: string;
      selectedSauce?: "chilli" | "ketchup";
      nachoCheeseAddOn?: boolean;
    }) => {
      const res = await apiFetch("/api/fnb/orders/staff", { method: "POST", body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw Object.assign(new Error(data.error || "Failed to place order"), { data });
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fnb-orders-admin"] });
      qc.invalidateQueries({ queryKey: ["fnb-menu-admin"] });
      qc.invalidateQueries({ queryKey: ["fnb-orders-table-pending"] });
    },
  });
}

/** Staff cart in one go (F&B tab Place Order) — all or nothing; the server applies food bundles. */
export function usePlaceStaffCart() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      items: CartItem[];
      userId?: string;
      tableId?: string;
      tableName?: string;
      paymentMethod: "wallet" | "cash" | "paynow" | "charge_to_table";
      tableRefId?: string;
    }) => {
      const res = await apiFetch("/api/fnb/orders/staff/batch", { method: "POST", body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to place order");
      return data as { message: string; total: number; savings: number };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fnb-orders-admin"] });
      qc.invalidateQueries({ queryKey: ["fnb-menu-admin"] });
      qc.invalidateQueries({ queryKey: ["fnb-orders-table-pending"] });
    },
  });
}

export function useAdminMenu(includeDeleted = false) {
  return useQuery({
    queryKey: ["fnb-menu-admin", { includeDeleted }],
    refetchInterval: 60_000, // happy-hour prices change on the clock
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

export function useEditFnbOrderPaymentMethod() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({
      orderId,
      paymentMethod,
      tableRefId,
      tableName,
      allowNegative,
      reason,
    }: {
      orderId: string;
      paymentMethod: "wallet" | "cash" | "paynow" | "charge_to_table";
      tableRefId?: string;
      tableName?: string;
      allowNegative?: boolean;
      reason: string;
    }) => {
      const res = await apiFetch(`/api/fnb/orders/${orderId}/payment-method`, {
        method: "PATCH",
        body: JSON.stringify({ paymentMethod, tableRefId, tableName, allowNegative, reason }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw Object.assign(new Error(data.error || "Failed to update payment method"), { data });
      return data;
    },
    onSuccess: () => {
      toast({ title: "Payment method updated" });
      qc.invalidateQueries({ queryKey: ["fnb-orders-admin"] });
      qc.invalidateQueries({ queryKey: ["fnb-orders-table-pending"] });
      qc.invalidateQueries({ queryKey: ["admin-customers"] });
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

export function useSetProductImage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id, file }: { id: string; file: File | null }) => {
      let res: Response;
      if (file) {
        const blob = await shrinkProductPhoto(file);
        const form = new FormData();
        form.append("image", blob, blob.type === "image/webp" ? "photo.webp" : "photo.jpg");
        res = await apiFetch(`/api/fnb/products/${id}/image`, { method: "POST", body: form });
      } else {
        res = await apiFetch(`/api/fnb/products/${id}/image`, { method: "DELETE" });
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update photo");
      return data.product as FnbProduct;
    },
    onSuccess: (_data, { file }) => {
      toast({ title: file ? "Photo updated" : "Photo removed" });
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
  foodBundle?: FoodBundleConfig;
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

/** Any N Finger Food items for a fixed price — on/off, N and price (admins only). */
export function useSaveFoodBundle() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (data: { enabled: boolean; size: number; price: number }) => {
      const r = await apiFetch("/api/fnb/admin/food-bundle", { method: "PUT", body: JSON.stringify(data) });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(body.error || "Couldn't save the food bundle");
      return body as { message: string };
    },
    onSuccess: (data) => {
      toast({ title: data.message });
      qc.invalidateQueries({ queryKey: ["fnb-status"] });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });
}
