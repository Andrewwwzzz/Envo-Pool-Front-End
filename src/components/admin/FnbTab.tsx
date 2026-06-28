import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle2, XCircle, Clock, Plus, Pencil, Package, RotateCcw, AlertTriangle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import {
  useAdminFnbOrders, useAdminMenu, useServeOrder, useCancelFnbOrder,
  useCreateProduct, useUpdateProduct, useRestockProduct,
  FnbProduct, CATEGORY_LABELS, CATEGORY_COLORS,
} from "@/hooks/useFnb";

function useFnbAnalytics() {
  return useQuery({
    queryKey: ["fnb-analytics"],
    queryFn: async () => {
      const res = await apiFetch("/api/fnb/analytics");
      if (!res.ok) throw new Error("Failed to load analytics");
      return res.json();
    },
  });
}
import { fmtDateTimeSG } from "@/lib/sgTime";

const EMPTY_FORM = {
  name: "",
  category: "soft_drinks" as FnbProduct["category"],
  costPrice: "",
  sellingPrice: "",
  stock: "",
  lowStockThreshold: "5",
  isRedeemable: false,
  isActive: true,
  sortOrder: "0",
};

export function FnbTab() {
  const [orderFilter, setOrderFilter] = useState("all");
  const [cancelDialog, setCancelDialog] = useState<{ id: string; name: string; price: number } | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelRefund, setCancelRefund] = useState(false);
  const [productDialog, setProductDialog] = useState<"create" | "edit" | "restock" | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<FnbProduct | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [restockQty, setRestockQty] = useState("1");

  const { data: orders = [], isLoading: ordersLoading } = useAdminFnbOrders(orderFilter);
  const { data: analytics } = useFnbAnalytics();
  const { data: products = [] } = useAdminMenu();
  const serveOrder = useServeOrder();
  const cancelOrder = useCancelFnbOrder();
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const restockProduct = useRestockProduct();

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setSelectedProduct(null);
    setProductDialog("create");
  };

  const openEdit = (p: FnbProduct) => {
    setSelectedProduct(p);
    setForm({
      name: p.name,
      category: p.category,
      costPrice: String(p.costPrice),
      sellingPrice: String(p.sellingPrice),
      stock: String(p.stock),
      lowStockThreshold: String(p.lowStockThreshold),
      isRedeemable: p.isRedeemable,
      isActive: p.isActive,
      sortOrder: String(p.sortOrder),
    });
    setProductDialog("edit");
  };

  const openRestock = (p: FnbProduct) => {
    setSelectedProduct(p);
    setRestockQty("1");
    setProductDialog("restock");
  };

  const handleSaveProduct = () => {
    const payload = {
      name: form.name,
      category: form.category,
      costPrice: Number(form.costPrice),
      sellingPrice: Number(form.sellingPrice),
      stock: Number(form.stock),
      lowStockThreshold: Number(form.lowStockThreshold),
      isRedeemable: form.isRedeemable,
      isActive: form.isActive,
      sortOrder: Number(form.sortOrder),
    };

    if (productDialog === "create") {
      createProduct.mutate(payload, { onSuccess: () => setProductDialog(null) });
    } else if (productDialog === "edit" && selectedProduct) {
      updateProduct.mutate({ id: selectedProduct._id, ...payload }, { onSuccess: () => setProductDialog(null) });
    }
  };

  const handleRestock = () => {
    if (!selectedProduct) return;
    restockProduct.mutate(
      { id: selectedProduct._id, quantity: Number(restockQty) },
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

  return (
    <div className="space-y-4">
      {/* Analytics cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-border/50">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Today Revenue</p>
            <p className="text-xl font-bold text-accent mt-1">${(analytics?.revenue || 0).toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Orders Today</p>
            <p className="text-xl font-bold text-foreground mt-1">{analytics?.orderCount || 0}</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Stock Cost Value</p>
            <p className="text-xl font-bold text-foreground mt-1">${(analytics?.stockCostValue || 0).toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Stock Retail Value</p>
            <p className="text-xl font-bold text-foreground mt-1">${(analytics?.stockRetailValue || 0).toFixed(2)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Top items */}
      {analytics?.topItems?.length > 0 && (
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Top Items Today</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {analytics.topItems.map((item: any) => (
              <div key={item._id} className="flex items-center justify-between text-sm">
                <span className="text-foreground">{item.name}</span>
                <div className="flex items-center gap-3">
                  <span className="text-muted-foreground">{item.count} orders</span>
                  <span className="text-accent">${item.revenue.toFixed(2)}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="orders">
        <TabsList>
          <TabsTrigger value="orders">Live Orders</TabsTrigger>
          <TabsTrigger value="products">Products</TabsTrigger>
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
                        <p className="text-sm text-muted-foreground">
                          {order.paymentMethod === "free_membership" ? "Free — Membership" : `$${order.totalPrice?.toFixed(2)}`}
                          {" · "}{fmtDateTimeSG(order.createdAt)}
                        </p>
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
                            onClick={() => { setCancelDialog({ id: order._id, name: order.productName, price: order.totalPrice || 0 }); setCancelReason(""); setCancelRefund(false); }}
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

        {/* ── PRODUCTS ── */}
        <TabsContent value="products" className="space-y-4 mt-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">{products.length} products</p>
            <Button size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90" onClick={openCreate}>
              <Plus className="h-4 w-4 mr-1" /> Add Product
            </Button>
          </div>

          <div className="space-y-2">
            {products.map((p) => {
              const lowStock = p.stock <= p.lowStockThreshold;
              return (
                <Card key={p._id} className="border-border/50">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-foreground">{p.name}</p>
                          <Badge className={`text-xs ${CATEGORY_COLORS[p.category]}`}>{CATEGORY_LABELS[p.category]}</Badge>
                          {!p.isActive && <Badge variant="outline" className="text-muted-foreground text-xs">Inactive</Badge>}
                          {p.isRedeemable && <Badge className="bg-green-500/20 text-green-400 text-xs">Redeemable</Badge>}
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                          <span>Cost: ${p.costPrice.toFixed(2)}</span>
                          <span>Price: ${p.sellingPrice.toFixed(2)}</span>
                          <span className={lowStock ? "text-red-400 font-medium flex items-center gap-1" : ""}>
                            {lowStock && <AlertTriangle className="h-3 w-3" />}
                            Stock: {p.stock}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <Button size="sm" variant="outline" onClick={() => openRestock(p)}>
                          <RotateCcw className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => openEdit(p)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </div>
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

      {/* Cancel dialog */}
      <Dialog open={!!cancelDialog} onOpenChange={() => setCancelDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Cancel Order</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">Cancel order for <span className="text-foreground font-medium">{cancelDialog?.name}</span>? Wallet will be refunded.</p>
            <div className="space-y-1.5">
              <Label className="text-xs">Reason <span className="text-red-400">*</span></Label>
              <Input placeholder="e.g. Out of stock (required)" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} />
            </div>
            {cancelDialog && cancelDialog.price > 0 && (
              <div className="flex items-center justify-between rounded-lg border border-border/50 p-3">
                <div>
                  <p className="text-sm font-medium">Refund to wallet</p>
                  <p className="text-xs text-muted-foreground">${cancelDialog.price.toFixed(2)} back to customer wallet</p>
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

      {/* Create/Edit product dialog */}
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
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Stock</Label>
                <Input type="number" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Low Stock Alert</Label>
                <Input type="number" value={form.lowStockThreshold} onChange={(e) => setForm({ ...form, lowStockThreshold: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Sort Order</Label>
              <Input type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: e.target.value })} />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-sm">Free drink redeemable</Label>
              <Switch checked={form.isRedeemable} onCheckedChange={(v) => setForm({ ...form, isRedeemable: v })} />
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

      {/* Restock dialog */}
      <Dialog open={productDialog === "restock"} onOpenChange={() => setProductDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Restock — {selectedProduct?.name}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">Current stock: <span className="text-foreground font-medium">{selectedProduct?.stock}</span></p>
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
    </div>
  );
}
