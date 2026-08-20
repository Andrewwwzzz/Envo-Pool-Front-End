import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CheckCircle2, XCircle, Clock, Plus, Pencil, RotateCcw, AlertTriangle,
  Gift, TrendingUp, Package, History, ChevronDown, ChevronUp, DollarSign,
  ShoppingBag, BarChart3, ArrowUpCircle, ArrowDownCircle, Eye, EyeOff, Trash2,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import {
  useAdminFnbOrders, useAdminMenu, useServeOrder, useCancelFnbOrder,
  useCreateProduct, useUpdateProduct, useRestockProduct, useDeleteProduct,
  useFnbStatus, useSetFnbStatus,
  FnbProduct, CATEGORY_LABELS, CATEGORY_COLORS,
} from "@/hooks/useFnb";
import { fmtDateTimeSG, getSGDateStr, nowSG } from "@/lib/sgTime";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useRestoreRecord, useHardDelete } from "@/hooks/useAdmin";
import { PinDialog } from "@/components/admin/PinDialog";

// ─── Analytics hook (enhanced) ───────────────────────────────────────────────
function useFnbAnalytics(day?: string) {
  return useQuery({
    queryKey: ["fnb-analytics", day],
    queryFn: async () => {
      const url = day ? `/api/fnb/analytics?day=${day}` : "/api/fnb/analytics";
      const res = await apiFetch(url);
      if (!res.ok) throw new Error("Failed to load analytics");
      return res.json();
    },
  });
}

// ─── Stock log hook ───────────────────────────────────────────────────────────
function useStockLogs(productId: string | null) {
  return useQuery({
    queryKey: ["fnb-stock-logs", productId],
    queryFn: async () => {
      const res = await apiFetch(`/api/fnb/stock/logs/${productId}`);
      if (!res.ok) throw new Error("Failed to load logs");
      return res.json();
    },
    enabled: !!productId,
  });
}

// ─── Adjust stock hook ────────────────────────────────────────────────────────
function useAdjustStock() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id, quantity, description }: { id: string; quantity: number; description?: string }) => {
      const res = await apiFetch(`/api/fnb/products/${id}/adjust`, {
        method: "POST",
        body: JSON.stringify({ quantity, description }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to adjust stock");
      return data;
    },
    onSuccess: () => {
      toast({ title: "Stock adjusted" });
      qc.invalidateQueries({ queryKey: ["fnb-menu-admin"] });
      qc.invalidateQueries({ queryKey: ["fnb-stock-logs"] });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });
}

const EMPTY_FORM = {
  name: "",
  category: "soft_drinks" as FnbProduct["category"],
  costPrice: "",
  sellingPrice: "",
  stock: "",
  lowStockThreshold: "5",
  piecesPerUnit: "1",
  isRedeemable: false,
  isAlcohol: false,
  isActive: true,
  sortOrder: "0",
};

const LOG_TYPE_STYLES: Record<string, { label: string; color: string; icon: any }> = {
  restock:        { label: "Restock",         color: "text-green-400",  icon: ArrowUpCircle },
  sale:           { label: "Sold",             color: "text-blue-400",   icon: ShoppingBag },
  free_redemption:{ label: "Free (Membership)",color: "text-amber-400",  icon: Gift },
  adjustment:     { label: "Adjustment",       color: "text-purple-400", icon: BarChart3 },
  cancelled_order:{ label: "Cancelled",        color: "text-red-400",    icon: XCircle },
};

function FnbCountdown({ resumeAt }: { resumeAt: string }) {
  const [remaining, setRemaining] = useState("");
  useEffect(() => {
    const tick = () => {
      const diff = new Date(resumeAt).getTime() - Date.now();
      if (diff <= 0) { setRemaining(""); return; }
      const m = Math.floor(diff / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setRemaining(` · reopens in ${m}:${String(s).padStart(2, "0")}`);
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [resumeAt]);
  return <span className="text-orange-400 font-mono">{remaining}</span>;
}

export function FnbTab() {
  const { user } = useAuth();
  const isMaster = (user as any)?.isMaster === true;
  const restore = useRestoreRecord();
  const hardDelete = useHardDelete();
  const [hardDeleteTarget, setHardDeleteTarget] = useState<{ type: string; id: string } | null>(null);
  const today = getSGDateStr(nowSG());
  const [viewDay, setViewDay] = useState(today);
  const [orderFilter, setOrderFilter] = useState("all");
  const [cancelDialog, setCancelDialog] = useState<{ id: string; name: string; price: number; paymentMethod: string } | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelRefund, setCancelRefund] = useState(false);
  const [hideDeleted, setHideDeleted] = useState(true);
  const [productDialog, setProductDialog] = useState<"create" | "edit" | "restock" | "adjust" | "logs" | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<FnbProduct | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [restockQty, setRestockQty] = useState("1");
  const [adjustQty, setAdjustQty] = useState("0");
  const [adjustNote, setAdjustNote] = useState("");

  // F&B status
  const { data: fnbStatus } = useFnbStatus();
  const setFnbStatus = useSetFnbStatus();
  const [pauseOpen, setPauseOpen] = useState(false);
  const [pauseNotice, setPauseNotice] = useState("Back in a moment — toilet break!");
  const [pauseMins, setPauseMins] = useState<number | "">(15);

  const { data: orders = [], isLoading: ordersLoading } = useAdminFnbOrders(orderFilter, viewDay);
  const { data: analytics } = useFnbAnalytics(viewDay);
  const { data: allProducts = [] } = useAdminMenu(!hideDeleted);
  const products = hideDeleted ? allProducts.filter((p) => !(p as any).isDeleted) : allProducts;
  const { data: stockLogs = [] } = useStockLogs(productDialog === "logs" ? selectedProduct?._id ?? null : null);

  const serveOrder = useServeOrder();
  const cancelOrder = useCancelFnbOrder();
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const restockProduct = useRestockProduct();
  const deleteProduct = useDeleteProduct();
  const [deleteProductTarget, setDeleteProductTarget] = useState<FnbProduct | null>(null);
  const adjustStock = useAdjustStock();

  const openCreate = () => { setForm(EMPTY_FORM); setSelectedProduct(null); setProductDialog("create"); };
  const openEdit = (p: FnbProduct) => {
    setSelectedProduct(p);
    setForm({
      name: p.name, category: p.category,
      costPrice: String(p.costPrice), sellingPrice: String(p.sellingPrice),
      stock: String(p.stock), lowStockThreshold: String(p.lowStockThreshold),
      piecesPerUnit: String(p.piecesPerUnit ?? 1),
      isRedeemable: p.isRedeemable, isAlcohol: p.isAlcohol, isActive: p.isActive, sortOrder: String(p.sortOrder),
    });
    setProductDialog("edit");
  };
  const openRestock = (p: FnbProduct) => { setSelectedProduct(p); setRestockQty("1"); setProductDialog("restock"); };
  const openAdjust = (p: FnbProduct) => { setSelectedProduct(p); setAdjustQty("0"); setAdjustNote(""); setProductDialog("adjust"); };
  const openLogs = (p: FnbProduct) => { setSelectedProduct(p); setProductDialog("logs"); };

  const handleSaveProduct = () => {
    const payload = {
      name: form.name, category: form.category,
      costPrice: Number(form.costPrice), sellingPrice: Number(form.sellingPrice),
      stock: Number(form.stock), lowStockThreshold: Number(form.lowStockThreshold),
      piecesPerUnit: Math.max(1, Number(form.piecesPerUnit) || 1),
      isRedeemable: form.isRedeemable, isAlcohol: form.isAlcohol, isActive: form.isActive, sortOrder: Number(form.sortOrder),
    };
    if (productDialog === "create") {
      createProduct.mutate(payload, { onSuccess: () => setProductDialog(null) });
    } else if (productDialog === "edit" && selectedProduct) {
      updateProduct.mutate({ id: selectedProduct._id, ...payload }, { onSuccess: () => setProductDialog(null) });
    }
  };

  const handleRestock = () => {
    if (!selectedProduct) return;
    restockProduct.mutate({ id: selectedProduct._id, quantity: Number(restockQty) }, { onSuccess: () => setProductDialog(null) });
  };

  const handleAdjust = () => {
    if (!selectedProduct) return;
    adjustStock.mutate(
      { id: selectedProduct._id, quantity: Number(adjustQty), description: adjustNote || undefined },
      { onSuccess: () => setProductDialog(null) }
    );
  };

  const handleCancel = () => {
    if (!cancelDialog) return;
    cancelOrder.mutate(
      { orderId: cancelDialog.id, reason: cancelReason, refund: cancelRefund },
      { onSettled: () => { setCancelDialog(null); setCancelReason(""); setCancelRefund(false); } }
    );
  };

  const statusBadge = (status: string) => {
    if (status === "pending") return <Badge className="bg-yellow-500/20 text-yellow-400"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
    if (status === "served") return <Badge className="bg-green-500/20 text-green-400"><CheckCircle2 className="h-3 w-3 mr-1" />Served</Badge>;
    return <Badge className="bg-red-500/20 text-red-400"><XCircle className="h-3 w-3 mr-1" />Cancelled</Badge>;
  };

  const paymentBadge = (method: string, price: number) => {
    if (method === "free_membership") return (
      <span className="inline-flex items-center gap-1 text-amber-400 text-xs font-medium">
        <Gift className="h-3 w-3" /> Free — Membership
      </span>
    );
    if (method === "free_reward") return (
      <span className="inline-flex items-center gap-1 text-purple-400 text-xs font-medium">
        <Gift className="h-3 w-3" /> Free — Reward
      </span>
    );
    return <span className="text-green-400 text-xs font-medium">${price?.toFixed(2)}</span>;
  };

  // derived analytics
  const paidRevenue = analytics?.paidRevenue ?? analytics?.revenue ?? 0;
  const freeCount = analytics?.freeCount ?? 0;
  const freeCostValue = analytics?.freeCostValue ?? 0;
  const paidCount = analytics?.paidCount ?? analytics?.orderCount ?? 0;
  const totalOrders = analytics?.orderCount ?? paidCount + freeCount;

  return (
    <div className="space-y-4">

      {/* ── F&B Status banner + controls ── */}
      <Card className={fnbStatus?.isOpen === false ? "border-orange-500/60 bg-orange-950/20" : "border-green-600/40 bg-green-950/10"}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <div className={`h-3 w-3 rounded-full ${fnbStatus?.isOpen === false ? "bg-orange-400 animate-pulse" : "bg-green-400"}`} />
              <div>
                <p className="font-semibold text-sm">
                  F&B Counter — {fnbStatus?.isOpen === false ? "Paused" : "Open"}
                </p>
                {fnbStatus?.isOpen === false && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {fnbStatus.notice || "Temporarily unavailable"}
                    {fnbStatus.resumeAt && (
                      <FnbCountdown resumeAt={fnbStatus.resumeAt} />
                    )}
                  </p>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              {fnbStatus?.isOpen === false ? (
                <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => setFnbStatus.mutate({ isOpen: true })} disabled={setFnbStatus.isPending}>
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Reopen F&B
                </Button>
              ) : (
                <Button size="sm" variant="outline" className="border-orange-500 text-orange-400 hover:bg-orange-950/30" onClick={() => { setPauseNotice("Back in a moment — toilet break!"); setPauseMins(15); setPauseOpen(true); }}>
                  <Clock className="h-3.5 w-3.5 mr-1" /> Pause F&B
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pause dialog */}
      <Dialog open={pauseOpen} onOpenChange={setPauseOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Pause F&B Counter</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <Label>Notice shown to customers</Label>
              <Input value={pauseNotice} onChange={e => setPauseNotice(e.target.value)} placeholder="e.g. Back in 15 mins — toilet break!" />
            </div>
            <div className="space-y-1.5">
              <Label>Auto-resume after</Label>
              <div className="flex gap-2 flex-wrap">
                {[5, 10, 15, 30].map(m => (
                  <Button key={m} size="sm" variant={pauseMins === m ? "default" : "outline"} className="h-7 text-xs" onClick={() => setPauseMins(m)}>
                    {m} min
                  </Button>
                ))}
                <Button size="sm" variant={pauseMins === "" ? "default" : "outline"} className="h-7 text-xs" onClick={() => setPauseMins("")}>
                  Manual
                </Button>
              </div>
              {pauseMins !== "" && (
                <p className="text-xs text-muted-foreground">Counter reopens automatically after {pauseMins} minutes.</p>
              )}
              {pauseMins === "" && (
                <p className="text-xs text-muted-foreground">You will need to reopen manually.</p>
              )}
            </div>
          </div>
          <DialogFooter className="gap-2 mt-2">
            <Button variant="ghost" onClick={() => setPauseOpen(false)}>Cancel</Button>
            <Button
              className="bg-orange-500 hover:bg-orange-600 text-white"
              disabled={setFnbStatus.isPending}
              onClick={() => {
                setFnbStatus.mutate({ isOpen: false, notice: pauseNotice, resumeInMinutes: pauseMins === "" ? 0 : Number(pauseMins) });
                setPauseOpen(false);
              }}
            >
              <Clock className="h-3.5 w-3.5 mr-1" /> Pause Now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Day selector ── */}
      <div className="flex items-center gap-2">
        <Label className="text-xs text-muted-foreground whitespace-nowrap">Viewing day:</Label>
        <Input
          type="date"
          value={viewDay}
          onChange={(e) => setViewDay(e.target.value)}
          className="w-40 h-8 text-xs"
          max={today}
        />
        {viewDay !== today && (
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setViewDay(today)}>
            Back to Today
          </Button>
        )}
      </div>

      {/* ── Analytics cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-1.5 mb-1">
              <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Paid Revenue</p>
            </div>
            <p className="text-xl font-bold text-accent">${paidRevenue.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground mt-1">{paidCount} paid orders</p>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-1.5 mb-1">
              <Gift className="h-3.5 w-3.5 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Free Given</p>
            </div>
            <p className="text-xl font-bold text-amber-400">{freeCount}</p>
            <p className="text-xs text-muted-foreground mt-1">Cost: ${freeCostValue.toFixed(2)}</p>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-1.5 mb-1">
              <Package className="h-3.5 w-3.5 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Stock Cost</p>
            </div>
            <p className="text-xl font-bold text-foreground">${(analytics?.stockCostValue || 0).toFixed(2)}</p>
            <p className="text-xs text-muted-foreground mt-1">on hand</p>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-1.5 mb-1">
              <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Stock Retail</p>
            </div>
            <p className="text-xl font-bold text-foreground">${(analytics?.stockRetailValue || 0).toFixed(2)}</p>
            <p className="text-xs text-muted-foreground mt-1">{totalOrders} total orders</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Top items breakdown ── */}
      {analytics?.topItems?.length > 0 && (
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Top Items — {viewDay === today ? "Today" : viewDay}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="grid grid-cols-4 text-xs text-muted-foreground pb-1 border-b border-border/30">
              <span>Item</span>
              <span className="text-right">Sold (paid)</span>
              <span className="text-right text-amber-400/80">Free</span>
              <span className="text-right">Revenue</span>
            </div>
            {analytics.topItems.map((item: any) => (
              <div key={item._id} className="grid grid-cols-4 items-center text-sm">
                <span className="text-foreground truncate pr-2">{item.name}</span>
                <span className="text-right text-muted-foreground">{item.paidCount ?? item.count}</span>
                <span className="text-right text-amber-400">{item.freeCount ?? 0}</span>
                <span className="text-right text-accent">${item.revenue.toFixed(2)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="orders">
        <TabsList>
          <TabsTrigger value="orders">Live Orders</TabsTrigger>
          <TabsTrigger value="products">Products & Stock</TabsTrigger>
        </TabsList>

        {/* ── LIVE ORDERS ── */}
        <TabsContent value="orders" className="space-y-4 mt-4">
          <div className="flex gap-2 flex-wrap">
            {["all", "pending", "served", "cancelled"].map((f) => (
              <Button
                key={f}
                size="sm"
                variant={orderFilter === f ? "default" : "outline"}
                className={orderFilter === f ? "bg-accent text-accent-foreground" : ""}
                onClick={() => setOrderFilter(f)}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </Button>
            ))}
          </div>

          {ordersLoading ? (
            <p className="text-muted-foreground text-sm">Loading orders...</p>
          ) : orders.length === 0 ? (
            <p className="text-muted-foreground text-sm">No orders found.</p>
          ) : (
            <div className="space-y-2">
              {orders.map((order: any) => (
                <Card key={order._id} className="border-border/50">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-foreground">{order.productName}</p>
                          {statusBadge(order.status)}
                        </div>
                        <p className="text-sm text-muted-foreground mt-0.5">
                          {order.userId?.name || "Unknown"} · {order.tableName || "No table"}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {paymentBadge(order.paymentMethod, order.totalPrice)}
                          <span className="text-xs text-muted-foreground">· {fmtDateTimeSG(order.createdAt)}</span>
                        </div>
                      </div>
                      {order.status === "pending" && (
                        <div className="flex gap-2 flex-shrink-0">
                          <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700 text-white"
                            onClick={() => serveOrder.mutate(order._id)}
                            disabled={serveOrder.isPending}
                          >
                            <CheckCircle2 className="h-4 w-4 mr-1" /> Served
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => { setCancelDialog({ id: order._id, name: order.productName, price: order.totalPrice || 0, paymentMethod: order.paymentMethod }); setCancelReason(""); setCancelRefund(false); }}
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── PRODUCTS & STOCK ── */}
        <TabsContent value="products" className="space-y-4 mt-4">
          <div className="flex justify-between items-center gap-2 flex-wrap">
            <p className="text-sm text-muted-foreground">{products.length} products</p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={hideDeleted ? "outline" : "secondary"}
                onClick={() => setHideDeleted((v) => !v)}
              >
                {hideDeleted ? <EyeOff className="h-4 w-4 mr-1" /> : <Eye className="h-4 w-4 mr-1" />}
                {hideDeleted ? "Show Deleted" : "Hide Deleted"}
              </Button>
              <Button size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90" onClick={openCreate}>
                <Plus className="h-4 w-4 mr-1" /> Add Product
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            {products.map((p) => {
              const lowStock = p.stock <= p.lowStockThreshold;
              const margin = p.sellingPrice > 0 ? ((p.sellingPrice - p.costPrice) / p.sellingPrice * 100) : 0;
              const deleted = !!(p as any).isDeleted;
              return (
                <Card key={p._id} className={`border-border/50 ${deleted ? "opacity-50" : lowStock ? "border-red-500/30" : ""}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className={`font-semibold ${deleted ? "line-through text-muted-foreground" : "text-foreground"}`}>{p.name}</p>
                          {deleted && <Badge variant="outline" className="text-xs text-destructive border-destructive/40">Deleted</Badge>}
                          {!deleted && <Badge className={`text-xs ${CATEGORY_COLORS[p.category]}`}>{CATEGORY_LABELS[p.category]}</Badge>}
                          {!deleted && !p.isActive && <Badge variant="outline" className="text-muted-foreground text-xs">Inactive</Badge>}
                          {!deleted && p.isRedeemable && <Badge className="bg-amber-500/20 text-amber-400 text-xs"><Gift className="h-2.5 w-2.5 mr-0.5" />Redeemable</Badge>}
                          {!deleted && p.isAlcohol && <Badge className="bg-red-500/20 text-red-400 text-xs">18+ Alcohol</Badge>}
                        </div>

                        {/* Price + margin row */}
                        <div className="flex items-center gap-4 mt-1.5 text-xs">
                          <span className="text-muted-foreground">Cost <span className="text-foreground font-medium">${p.costPrice.toFixed(2)}</span></span>
                          <span className="text-muted-foreground">Sell <span className="text-accent font-medium">${p.sellingPrice.toFixed(2)}</span></span>
                          <span className="text-muted-foreground">Margin <span className={`font-medium ${margin >= 40 ? "text-green-400" : margin >= 20 ? "text-yellow-400" : "text-red-400"}`}>{margin.toFixed(0)}%</span></span>
                        </div>

                        {/* Stock row */}
                        <div className="flex items-center gap-3 mt-1 text-xs">
                          <span className={`flex items-center gap-1 font-medium ${lowStock ? "text-red-400" : "text-foreground"}`}>
                            {lowStock && <AlertTriangle className="h-3 w-3" />}
                            Stock: {p.stock}
                          </span>
                          <span className="text-muted-foreground">Alert at ≤{p.lowStockThreshold}</span>
                          <span className="text-muted-foreground">On-hand value: <span className="text-foreground">${(p.stock * p.costPrice).toFixed(2)}</span></span>
                          {p.piecesPerUnit > 1 && (
                            <span className="text-muted-foreground">−{p.piecesPerUnit} pcs/sale</span>
                          )}
                        </div>
                      </div>

                      {deleted && isMaster && (
                        <div className="flex gap-1.5 flex-shrink-0">
                          <Button size="sm" variant="outline" className="border-green-500/50 text-green-400 hover:bg-green-500/10" onClick={() => restore.mutate({ type: "fnb-product", id: p._id })} disabled={restore.isPending}>
                            <RotateCcw className="h-3.5 w-3.5 mr-1" /> Restore
                          </Button>
                          <Button size="sm" variant="outline" className="border-destructive/50 text-destructive hover:bg-destructive/10" onClick={() => setHardDeleteTarget({ type: "fnb-product", id: p._id })} disabled={hardDelete.isPending}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                      {!deleted && (
                        <div className="flex gap-1.5 flex-shrink-0 flex-wrap justify-end">
                          <Button size="sm" variant="outline" title="Stock history" onClick={() => openLogs(p)}>
                            <History className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="outline" title="Restock" onClick={() => openRestock(p)}>
                            <RotateCcw className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="outline" title="Adjust stock" onClick={() => openAdjust(p)}>
                            <BarChart3 className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="outline" title="Edit" onClick={() => openEdit(p)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="outline" title="Delete" onClick={() => setDeleteProductTarget(p)}>
                            <XCircle className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            {products.length === 0 && (
              <p className="text-muted-foreground text-sm text-center py-8">No products yet. Add your first item.</p>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* ── Delete product dialog ── */}
      <Dialog open={!!deleteProductTarget} onOpenChange={(o) => !o && setDeleteProductTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Product</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            Delete <span className="font-medium text-foreground">{deleteProductTarget?.name}</span>? It will be hidden from the menu immediately. This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteProductTarget(null)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={deleteProduct.isPending}
              onClick={async () => {
                if (!deleteProductTarget?._id) return;
                await deleteProduct.mutateAsync(deleteProductTarget._id);
                setDeleteProductTarget(null);
              }}
            >
              {deleteProduct.isPending ? <RotateCcw className="h-4 w-4 animate-spin mr-2" /> : null}
              Delete Product
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Cancel dialog ── */}
      <Dialog open={!!cancelDialog} onOpenChange={() => setCancelDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Cancel Order</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">Cancel <span className="text-foreground font-medium">{cancelDialog?.name}</span>? Stock will be restored.</p>
            <div className="space-y-1.5">
              <Label className="text-xs">Reason <span className="text-red-400">*</span></Label>
              <Input placeholder="e.g. Out of stock" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} />
            </div>
            {cancelDialog && cancelDialog.price > 0 && (
              <div className="flex items-center justify-between rounded-lg border border-border/50 p-3">
                <div>
                  <p className="text-sm font-medium">
                    {cancelDialog.paymentMethod === "wallet" ? "Refund to wallet" : "Mark as refunded"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {cancelDialog.paymentMethod === "wallet"
                      ? `$${cancelDialog.price.toFixed(2)} credited back to customer's wallet`
                      : `$${cancelDialog.price.toFixed(2)} paid in ${cancelDialog.paymentMethod === "paynow" ? "PayNow" : "cash"} — hand it back to the customer, this just corrects the accounting`}
                  </p>
                </div>
                <Switch checked={cancelRefund} onCheckedChange={setCancelRefund} />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelDialog(null)}>Back</Button>
            <Button variant="destructive" onClick={handleCancel} disabled={cancelOrder.isPending || !cancelReason.trim()}>
              {cancelOrder.isPending ? "Cancelling..." : "Cancel Order"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Create/Edit product dialog ── */}
      <Dialog open={productDialog === "create" || productDialog === "edit"} onOpenChange={() => setProductDialog(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{productDialog === "create" ? "Add Product" : "Edit Product"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Coca Cola" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Category</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v as any })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="soft_drinks">Soft Drinks</SelectItem>
                  <SelectItem value="beer">Beer</SelectItem>
                  <SelectItem value="finger_food">Finger Food</SelectItem>
                  <SelectItem value="snacks">Snacks</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Cost Price ($)</Label>
                <Input type="number" value={form.costPrice} onChange={(e) => setForm({ ...form, costPrice: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Selling Price ($)</Label>
                <Input type="number" value={form.sellingPrice} onChange={(e) => setForm({ ...form, sellingPrice: e.target.value })} />
              </div>
            </div>
            {/* Live margin preview */}
            {form.costPrice && form.sellingPrice && Number(form.sellingPrice) > 0 && (
              <p className="text-xs text-muted-foreground">
                Gross margin:{" "}
                <span className="text-accent font-medium">
                  {(((Number(form.sellingPrice) - Number(form.costPrice)) / Number(form.sellingPrice)) * 100).toFixed(1)}%
                </span>
                {" "}· Profit per unit:{" "}
                <span className="text-accent font-medium">
                  ${(Number(form.sellingPrice) - Number(form.costPrice)).toFixed(2)}
                </span>
              </p>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Opening Stock</Label>
                <Input type="number" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Low Stock Alert At</Label>
                <Input type="number" value={form.lowStockThreshold} onChange={(e) => setForm({ ...form, lowStockThreshold: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Pieces Per Unit Sold</Label>
              <Input type="number" min={1} value={form.piecesPerUnit} onChange={(e) => setForm({ ...form, piecesPerUnit: e.target.value })} />
              <p className="text-xs text-muted-foreground">
                How many stock pieces one sale deducts — e.g. a "Beer Bucket" sold as 1 unit but tracked as 5 bottles in stock.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Sort Order</Label>
              <Input type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: e.target.value })} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm">Free drink redeemable</Label>
                <p className="text-xs text-muted-foreground">Membership perk eligible</p>
              </div>
              <Switch checked={form.isRedeemable} onCheckedChange={(v) => setForm({ ...form, isRedeemable: v })} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm">Age-restricted (alcohol)</Label>
                <p className="text-xs text-muted-foreground">Requires buyer to be 18+</p>
              </div>
              <Switch checked={form.isAlcohol} onCheckedChange={(v) => setForm({ ...form, isAlcohol: v })} />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-sm">Active (show on menu)</Label>
              <Switch checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProductDialog(null)}>Cancel</Button>
            <Button
              className="bg-accent text-accent-foreground hover:bg-accent/90"
              onClick={handleSaveProduct}
              disabled={createProduct.isPending || updateProduct.isPending}
            >
              {productDialog === "create" ? "Create" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Restock dialog ── */}
      <Dialog open={productDialog === "restock"} onOpenChange={() => setProductDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Restock — {selectedProduct?.name}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="rounded-lg bg-muted/30 p-3 text-sm">
              Current stock: <span className="font-bold text-foreground">{selectedProduct?.stock}</span>
              {selectedProduct && Number(restockQty) > 0 && (
                <span className="text-muted-foreground"> → <span className="text-green-400 font-bold">{selectedProduct.stock + Number(restockQty)}</span></span>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Quantity to add</Label>
              <Input type="number" min="1" value={restockQty} onChange={(e) => setRestockQty(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProductDialog(null)}>Cancel</Button>
            <Button
              className="bg-accent text-accent-foreground hover:bg-accent/90"
              onClick={handleRestock}
              disabled={restockProduct.isPending}
            >
              {restockProduct.isPending ? "Restocking..." : "Add Stock"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Manual adjust dialog ── */}
      <Dialog open={productDialog === "adjust"} onOpenChange={() => setProductDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Adjust Stock — {selectedProduct?.name}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="rounded-lg bg-muted/30 p-3 text-sm">
              Current stock: <span className="font-bold text-foreground">{selectedProduct?.stock}</span>
              {selectedProduct && adjustQty !== "" && adjustQty !== "0" && (
                <span className="text-muted-foreground"> → <span className={`font-bold ${Number(adjustQty) < 0 ? "text-red-400" : "text-green-400"}`}>{Math.max(0, selectedProduct.stock + Number(adjustQty))}</span></span>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Quantity (use negative to remove, e.g. -2 for wastage)</Label>
              <Input
                type="number"
                value={adjustQty}
                onChange={(e) => setAdjustQty(e.target.value)}
                placeholder="e.g. -2 for wastage, 5 for found items"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Note (optional)</Label>
              <Input value={adjustNote} onChange={(e) => setAdjustNote(e.target.value)} placeholder="e.g. Damaged, stock count correction..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProductDialog(null)}>Cancel</Button>
            <Button
              className="bg-accent text-accent-foreground hover:bg-accent/90"
              onClick={handleAdjust}
              disabled={adjustStock.isPending || adjustQty === "" || adjustQty === "0"}
            >
              {adjustStock.isPending ? "Saving..." : "Save Adjustment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Stock log dialog ── */}
      <Dialog open={productDialog === "logs"} onOpenChange={() => setProductDialog(null)}>
        <DialogContent className="max-h-[80vh] overflow-y-auto max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-4 w-4" /> Stock History — {selectedProduct?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            {stockLogs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No stock movements recorded.</p>
            ) : stockLogs.map((log: any) => {
              const meta = LOG_TYPE_STYLES[log.type] ?? { label: log.type, color: "text-muted-foreground", icon: BarChart3 };
              const Icon = meta.icon;
              const isIn = log.quantity > 0;
              return (
                <div key={log._id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/20 border border-border/30">
                  <Icon className={`h-4 w-4 mt-0.5 flex-shrink-0 ${meta.color}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-xs font-medium ${meta.color}`}>{meta.label}</span>
                      <span className={`text-sm font-bold ${isIn ? "text-green-400" : "text-red-400"}`}>
                        {isIn ? "+" : ""}{log.quantity}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{log.description}</p>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs text-muted-foreground">
                        After: <span className="text-foreground font-medium">{log.stockAfter}</span>
                      </span>
                      <span className="text-xs text-muted-foreground">{fmtDateTimeSG(log.createdAt)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProductDialog(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PinDialog
        open={!!hardDeleteTarget}
        onOpenChange={(v) => { if (!v) setHardDeleteTarget(null); }}
        title="Permanently Delete"
        description="This will irreversibly remove the record from the database. Enter your master PIN to confirm."
        confirmLabel="Delete Forever"
        loading={hardDelete.isPending}
        onConfirm={(pin) => {
          if (!hardDeleteTarget) return;
          hardDelete.mutate({ ...hardDeleteTarget, pin }, {
            onSuccess: () => setHardDeleteTarget(null),
          });
        }}
      />
    </div>
  );
}
