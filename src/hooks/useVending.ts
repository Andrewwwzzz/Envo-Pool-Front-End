import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch, BASE_URL } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

// ── Types (mirror the backend's presenters) ───────────────────────────────

export interface VendingItem {
  machineId: string;
  slotNo: number;
  productId: string;
  name: string;
  category: string;
  imageUrl: string | null;
  priceCents: number;
  inStock: boolean;
  faulty: boolean;      // the machine has flagged the slot; it won't vend from it
  isAlcohol: boolean;
  isSignature: boolean;
  freeDrinkEligible: boolean;
  machineOnline: boolean;
}

export interface VendingMenuData {
  machines: { machineId: string; online: boolean }[];
  items: VendingItem[];
  freeDrink: { hasBenefit: boolean; redeemedToday: boolean };
  pickupCodeMinutes: number;
}

export type VendingOrderStatus = "queued" | "sent" | "dispensed" | "failed" | "refunded" | "expired" | "needs_review";

export interface VendingOrder {
  _id: string;
  status: VendingOrderStatus;
  message: string;
  mode: "remote" | "pickup";
  machineId: string;
  slotNo: number;
  productName: string;
  priceCents: number;
  paymentMethod: "wallet" | "free_membership";
  pickupCode?: string;
  pickupExpiresAt?: string;
  createdAt: string;
  dispensedAt: string | null;
  refundedAt: string | null;
  failureReason: string | null;
}

// Admin shapes — raw documents, lightly typed
export interface VendingMachineStatus {
  machineId: string;
  online: boolean;
  lastPollAt: string | null;
  lastIp: string | null;
  temp: string | null;
  signal: string | null;
  dropSensor: string | null;
  shipFailCode: string | null;
}

export interface VendingSlot {
  _id: string;
  machineId: string;
  slotNo: number;
  productRef: { _id: string; name: string; category: string; sellingPrice: number; isActive?: boolean; isDeleted?: boolean } | null;
  displayName: string | null;
  imageUrl: string | null;
  priceCents: number | null;
  enabled: boolean;
  reservedCount: number;
  status: string | null;
  quantity: number | null;
  capacity: number | null;
  name: string | null;
  machinePrice: string | null;
  lastReportAt: string | null;
}

export interface VendingCommand {
  _id: string;
  machineId: string;
  type: "dispense" | "report_slots";
  slotNo: number | null;
  tradeNo: string;
  status: string;
  isTest: boolean;
  orderId: string | null;
  createdAt: string;
  sentAt: string | null;
  completedAt: string | null;
  cancelReason: string | null;
  result?: { status: string | null; payType?: string | null };
}

export interface VendingAdminStatus {
  config: { machineIds: string[]; tokenCheck: boolean; logEmptyPolls: boolean; pickupCodeMinutes: number };
  machines: VendingMachineStatus[];
  slots: VendingSlot[];
  commands: VendingCommand[];
  openOrders: { queued: number; sent: number; needs_review: number };
}

export interface VendingAdminOrder {
  _id: string;
  userId: { _id: string; name?: string; email?: string; phone?: string } | null;
  machineId: string;
  slotNo: number;
  productName: string;
  priceCents: number;
  mode: "remote" | "pickup";
  status: VendingOrderStatus;
  paymentMethod: "wallet" | "free_membership";
  tradeNo: string;
  machinePayType: string | null;
  failure?: { reason: string | null; at: string | null };
  refund?: { reason: string | null; by: { name?: string } | null; at: string | null };
  review?: { note: string | null; outcome: string | null; by: { name?: string } | null; at: string | null };
  createdAt: string;
  sentAt: string | null;
  dispensedAt: string | null;
  refundedAt: string | null;
}

export interface VendingExternalSale {
  _id: string;
  machineId: string;
  tradeNo: string;
  payType: string | null;
  slotNo: number | null;
  amount: string | null;
  name: string | null;
  status: string | null;
  machineTime: string | null;
  createdAt: string;
}

export interface VendingLogEntry {
  _id: string;
  funCode: string | null;
  machineId: string | null;
  ip: string | null;
  note: string | null;
  isEmptyPoll: boolean;
  rawBody: string;
  response: Record<string, string> | null;
  createdAt: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────

export const fmtCents = (cents: number) => `$${(cents / 100).toFixed(2)}`;

const FINAL_STATUSES: VendingOrderStatus[] = ["dispensed", "failed", "refunded", "expired", "needs_review"];
export const isOrderFinal = (status: VendingOrderStatus | undefined) => !!status && FINAL_STATUSES.includes(status);

/** Product photos come as a backend-relative path; an admin override may be a full URL. */
export function vendingImageSrc(item: Pick<VendingItem, "imageUrl">): string | null {
  if (!item.imageUrl) return null;
  return /^https?:\/\//.test(item.imageUrl) ? item.imageUrl : `${BASE_URL}${item.imageUrl}`;
}

export const ORDER_STATUS_LABELS: Record<VendingOrderStatus, string> = {
  queued: "Queued",
  sent: "Dispensing",
  dispensed: "Dispensed",
  failed: "Failed",
  refunded: "Refunded",
  expired: "Expired",
  needs_review: "Needs review",
};

export const ORDER_STATUS_COLORS: Record<VendingOrderStatus, string> = {
  queued: "bg-yellow-500/20 text-yellow-400",
  sent: "bg-blue-500/20 text-blue-400",
  dispensed: "bg-green-500/20 text-green-400",
  failed: "bg-red-500/20 text-red-400",
  refunded: "bg-muted text-muted-foreground",
  expired: "bg-muted text-muted-foreground",
  needs_review: "bg-orange-500/20 text-orange-400",
};

// A 5000's PayType, for the external-sales list
export const PAY_TYPE_LABELS: Record<string, string> = {
  "6": "Cash", "7": "WeChat", "8": "Alipay", "9": "Gift", "10": "Remote", "11": "Pickup code",
  "12": "Bank card", "13": "Bank card", "14": "IC card", "15": "IC card", "16": "Other",
};

async function readJson(res: Response, fallback: string) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || fallback);
  return data;
}

// ── Member hooks ──────────────────────────────────────────────────────────

export function useVendingMenu(enabled = true) {
  return useQuery({
    queryKey: ["vending-menu"],
    queryFn: async () => readJson(await apiFetch("/api/vending/products"), "Failed to load the vending menu") as Promise<VendingMenuData>,
    enabled,
    refetchInterval: 10000,
  });
}

export function useMyVendingOrders(enabled = true) {
  return useQuery({
    queryKey: ["vending-orders-my"],
    queryFn: async () => {
      const data = await readJson(await apiFetch("/api/vending/orders/me"), "Failed to load vending orders");
      return (data.orders || []) as VendingOrder[];
    },
    enabled,
    refetchInterval: 15000,
  });
}

/** One order, polled every 2 s until it reaches a final state. */
export function useVendingOrder(orderId: string | null) {
  return useQuery({
    queryKey: ["vending-order", orderId],
    queryFn: async () => {
      const data = await readJson(await apiFetch(`/api/vending/orders/${orderId}`), "Failed to load the order");
      return data.order as VendingOrder;
    },
    enabled: !!orderId,
    refetchInterval: (query) => (isOrderFinal(query.state.data?.status) ? false : 2000),
  });
}

export function useVendingPurchase() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (body: { machineId: string; slotNo: number; mode: "remote" | "pickup"; isFreeRedemption?: boolean }) => {
      const data = await readJson(
        await apiFetch("/api/vending/purchase", { method: "POST", body: JSON.stringify(body) }),
        "Purchase failed"
      );
      return data as { message: string; order: VendingOrder };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vending-menu"] });
      qc.invalidateQueries({ queryKey: ["vending-orders-my"] });
      qc.invalidateQueries({ queryKey: ["profile"] });
      qc.invalidateQueries({ queryKey: ["fnb-redemption-check"] });
    },
    onError: (err: Error) => {
      toast({ title: "Couldn't buy that", description: err.message, variant: "destructive" });
    },
  });
}

// ── Admin hooks ───────────────────────────────────────────────────────────

const ADMIN = "/api/admin/vending";

export function useVendingStatus(enabled = true) {
  return useQuery({
    queryKey: ["vending-admin-status"],
    queryFn: async () => readJson(await apiFetch(`${ADMIN}/status`), "Failed to load vending status") as Promise<VendingAdminStatus>,
    enabled,
    refetchInterval: 5000,
  });
}

export function useVendingAdminOrders(status: string, enabled = true) {
  return useQuery({
    queryKey: ["vending-admin-orders", status],
    queryFn: async () => {
      const qs = status && status !== "all" ? `?status=${encodeURIComponent(status)}&limit=100` : "?limit=100";
      const data = await readJson(await apiFetch(`${ADMIN}/orders${qs}`), "Failed to load vending orders");
      return (data.orders || []) as VendingAdminOrder[];
    },
    enabled,
    refetchInterval: 10000,
  });
}

export function useVendingExternalSales(enabled = true) {
  return useQuery({
    queryKey: ["vending-admin-external-sales"],
    queryFn: async () => {
      const data = await readJson(await apiFetch(`${ADMIN}/external-sales?limit=100`), "Failed to load machine sales");
      return (data.sales || []) as VendingExternalSale[];
    },
    enabled,
  });
}

export function useVendingLogs(includeEmptyPolls: boolean, enabled = true) {
  return useQuery({
    queryKey: ["vending-admin-logs", includeEmptyPolls],
    queryFn: async () => {
      const qs = `?limit=100${includeEmptyPolls ? "" : "&excludeEmptyPolls=1"}`;
      const data = await readJson(await apiFetch(`${ADMIN}/logs${qs}`), "Failed to load vending logs");
      return (data.logs || []) as VendingLogEntry[];
    },
    enabled,
    refetchInterval: 10000,
  });
}

type AdminResult = { message?: string } & Record<string, unknown>;

function useAdminMutation<TArgs>(run: (args: TArgs) => Promise<Response>, fallback: string, successTitle: string | ((data: AdminResult) => string), keys: string[][]) {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (args: TArgs) => readJson(await run(args), fallback) as Promise<AdminResult>,
    onSuccess: (data) => {
      toast({ title: typeof successTitle === "function" ? successTitle(data) : successTitle, description: data?.message });
      for (const key of keys) qc.invalidateQueries({ queryKey: key });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });
}

const STATUS_KEYS = [["vending-admin-status"]];
const ORDER_KEYS = [["vending-admin-status"], ["vending-admin-orders"]];

export function useVendingTestVend() {
  return useAdminMutation(
    (a: { machineId: string; slotNo: number }) => apiFetch(`${ADMIN}/test-vend`, { method: "POST", body: JSON.stringify(a) }),
    "Test vend failed", "Test vend queued", STATUS_KEYS
  );
}

export function useVendingRequestReport() {
  return useAdminMutation(
    (a: { machineId: string }) => apiFetch(`${ADMIN}/request-report`, { method: "POST", body: JSON.stringify(a) }),
    "Request failed", "Slot report requested", STATUS_KEYS
  );
}

export function useVendingCancelCommand() {
  return useAdminMutation(
    (a: { id: string; reason?: string }) => apiFetch(`${ADMIN}/commands/${a.id}/cancel`, { method: "POST", body: JSON.stringify({ reason: a.reason }) }),
    "Cancel failed", "Command cancelled", STATUS_KEYS
  );
}

export interface SlotUpdate {
  machineId: string;
  slotNo: number;
  productRef?: string | null;
  displayName?: string | null;
  imageUrl?: string | null;
  priceCents?: number | null;
  enabled?: boolean;
}

export function useVendingUpdateSlot() {
  return useAdminMutation(
    ({ slotNo, ...body }: SlotUpdate) => apiFetch(`${ADMIN}/slots/${slotNo}`, { method: "PUT", body: JSON.stringify(body) }),
    "Slot update failed", "Slot updated", [...STATUS_KEYS, ["vending-menu"]]
  );
}

export function useVendingRefundOrder() {
  return useAdminMutation(
    (a: { id: string; reason: string }) => apiFetch(`${ADMIN}/orders/${a.id}/refund`, { method: "POST", body: JSON.stringify({ reason: a.reason }) }),
    "Refund failed", "Order refunded", ORDER_KEYS
  );
}

export function useVendingResolveOrder() {
  return useAdminMutation(
    (a: { id: string; outcome: "dispensed" | "refunded"; note?: string }) =>
      apiFetch(`${ADMIN}/orders/${a.id}/resolve`, { method: "POST", body: JSON.stringify({ outcome: a.outcome, note: a.note }) }),
    "Resolve failed", (d) => d?.message || "Order resolved", ORDER_KEYS
  );
}
