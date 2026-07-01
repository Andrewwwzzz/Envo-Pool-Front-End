import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ShoppingBag, Clock, CheckCircle2, XCircle, Gift } from "lucide-react";
import { useProfile } from "@/hooks/useProfile";
import {
  useMenu, useMyFnbOrders, useRedemptionCheck, usePlaceOrder,
  FnbProduct, CATEGORY_LABELS, CATEGORY_COLORS,
} from "@/hooks/useFnb";
import { fmtDateTimeSG } from "@/lib/sgTime";

type Category = "all" | "drinks" | "food" | "snacks";

const MAX_TABLE = 14;

function normalizeTableName(input: string): string {
  const v = input.trim();
  if (!v) return v;
  if (/^[Tt]\d+$/.test(v)) return `Table ${v.replace(/^[Tt]/, "")}`;
  if (/^\d+$/.test(v)) return `Table ${v}`;
  return v;
}

function extractTableNumber(input: string): number | null {
  const m = input.trim().match(/^(?:[Tt]able\s*)?(\d+)$/i);
  return m ? parseInt(m[1]) : null;
}

function isValidTable(input: string): boolean {
  const n = extractTableNumber(input);
  return n !== null && n >= 1 && n <= MAX_TABLE;
}

function getCategoryGroup(cat: string): Category {
  if (cat === "soft_drinks" || cat === "beer") return "drinks";
  if (cat === "finger_food") return "food";
  if (cat === "snacks") return "snacks";
  return "all";
}

export default function DashboardFnb() {
  const { data: profile } = useProfile();
  const { data: menu = [] } = useMenu();
  const { data: orders = [] } = useMyFnbOrders();
  const { data: redemption } = useRedemptionCheck();
  const placeOrder = usePlaceOrder();

  const [activeTab, setActiveTab] = useState<Category>("all");
  const [tableInput, setTableInput] = useState("");
  const [confirm, setConfirm] = useState<{ product: FnbProduct; isFree: boolean } | null>(null);

  const walletBalance = profile?.walletBalance ?? 0;

  const filteredMenu = menu.filter((p) => {
    if (activeTab === "all") return true;
    return getCategoryGroup(p.category) === activeTab;
  });

  const handleConfirm = () => {
    if (!confirm) return;
    placeOrder.mutate(
      {
        productId: confirm.product._id,
        tableId: normalizeTableName(tableInput),
        tableName: normalizeTableName(tableInput),
        isFreeRedemption: confirm.isFree,
      },
      { onSettled: () => setConfirm(null) }
    );
  };

  const statusBadge = (status: string) => {
    if (status === "pending") return <Badge className="bg-yellow-500/20 text-yellow-400">Preparing...</Badge>;
    if (status === "served") return <Badge className="bg-green-500/20 text-green-400">Served ✓</Badge>;
    return <Badge className="bg-red-500/20 text-red-400">Cancelled</Badge>;
  };

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
            <ShoppingBag className="h-6 w-6 text-accent" /> F&B
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">Order food & drinks, delivered to your table</p>
        </div>
        <Badge className="bg-accent/10 text-accent text-sm px-3 py-1">
          Wallet: ${walletBalance.toFixed(2)}
        </Badge>
      </div>

      {/* Free drink banner */}
      {redemption?.canRedeem && (
        <div className="rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 flex items-center gap-2">
          <Gift className="h-4 w-4 text-green-400 flex-shrink-0" />
          <p className="text-sm text-green-400">
            <span className="font-medium">Free drink available today!</span> Tap "Redeem Free" on any eligible item.
          </p>
        </div>
      )}

      {/* Table input */}
      <div className="space-y-1.5">
        <label className="text-xs text-muted-foreground uppercase tracking-wider">
          Your Table <span className="text-red-400">*</span>
        </label>
        <Input
          placeholder="e.g. 1, T3, Table 5"
          value={tableInput}
          onChange={(e) => setTableInput(e.target.value)}
          className={`w-full sm:max-w-xs ${tableInput.trim() && !isValidTable(tableInput) ? "border-red-500/50" : !tableInput.trim() ? "border-red-500/50" : ""}`}
        />
        {!tableInput.trim() && (
          <p className="text-xs text-red-400">Enter your table number to order</p>
        )}
        {tableInput.trim() && !isValidTable(tableInput) && (
          <p className="text-xs text-red-400">Invalid table — must be between 1 and {MAX_TABLE}</p>
        )}
      </div>

      {/* Category tabs */}
      <div className="flex gap-2 flex-wrap">
        {(["all", "drinks", "food", "snacks"] as Category[]).map((tab) => (
          <Button
            key={tab}
            variant={activeTab === tab ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab(tab)}
            className={activeTab === tab ? "bg-accent text-accent-foreground" : ""}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </Button>
        ))}
      </div>

      {/* Menu grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {filteredMenu.map((product) => {
          const outOfStock = product.stock <= 0;
          const canRedeem = redemption?.canRedeem && product.isRedeemable;
          const canAfford = walletBalance >= product.sellingPrice;

          return (
            <Card key={product._id} className={`border-border/50 ${outOfStock ? "opacity-50" : ""}`}>
              <CardContent className="p-4 space-y-3">
                <div>
                  <p className="font-semibold text-sm text-foreground">{product.name}</p>
                  <Badge className={`text-xs mt-1 ${CATEGORY_COLORS[product.category]}`}>
                    {CATEGORY_LABELS[product.category]}
                  </Badge>
                </div>
                <p className="text-accent font-bold">${product.sellingPrice.toFixed(2)}</p>
                {outOfStock ? (
                  <Badge variant="outline" className="text-muted-foreground w-full justify-center">Out of Stock</Badge>
                ) : (
                  <div className="space-y-2">
                    {canRedeem && (
                      <Button
                        size="sm"
                        className="w-full bg-green-600 hover:bg-green-700 text-white text-xs"
                        disabled={!isValidTable(tableInput)}
                        onClick={() => setConfirm({ product, isFree: true })}
                      >
                        Redeem Free
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full text-xs"
                      disabled={!canAfford || !isValidTable(tableInput)}
                      onClick={() => setConfirm({ product, isFree: false })}
                    >
                      {!isValidTable(tableInput) ? "Enter valid table" : canAfford ? `Order $${product.sellingPrice.toFixed(2)}` : "Insufficient Balance"}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
        {filteredMenu.length === 0 && (
          <div className="col-span-full text-center py-10 text-muted-foreground text-sm">
            No items available in this category.
          </div>
        )}
      </div>

      {/* Today's Orders */}
      <div className="space-y-3">
        <h2 className="font-semibold text-foreground">Today's Orders</h2>
        {orders.length === 0 ? (
          <p className="text-sm text-muted-foreground">No orders yet today.</p>
        ) : (
          <div className="space-y-2">
            {orders.map((order) => (
              <Card key={order._id} className="border-border/50">
                <CardContent className="p-4 flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-foreground">{order.productName}</p>
                    <p className="text-xs text-muted-foreground">
                      {order.paymentMethod === "free_membership"
                        ? "Free — Membership"
                        : order.paymentMethod === "free_reward"
                        ? "Free — Reward"
                        : `$${order.totalPrice.toFixed(2)}`}
                      {order.tableName ? ` · ${order.tableName}` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <Clock className="h-3 w-3" />
                      {fmtDateTimeSG(order.createdAt)}
                    </p>
                  </div>
                  {statusBadge(order.status)}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Confirm dialog */}
      <Dialog open={!!confirm} onOpenChange={() => setConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Order</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <p className="text-foreground font-medium">{confirm?.product.name}</p>
            <p className="text-sm text-muted-foreground mt-1">
              {confirm?.isFree
                ? "FREE — membership benefit"
                : `$${confirm?.product.sellingPrice.toFixed(2)} will be deducted from your wallet`}
            </p>
            {tableInput && (
              <p className="text-sm text-muted-foreground mt-1">Deliver to: <span className="text-foreground">{tableInput}</span></p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(null)}>Cancel</Button>
            <Button
              className="bg-accent text-accent-foreground hover:bg-accent/90"
              onClick={handleConfirm}
              disabled={placeOrder.isPending}
            >
              {placeOrder.isPending ? "Placing..." : "Confirm Order"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
