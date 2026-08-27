import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ShoppingBag, Clock, CheckCircle2, XCircle, Gift, Minus, Plus, X } from "lucide-react";
import { useProfile } from "@/hooks/useProfile";
import {
  useMenu, useMyFnbOrders, useRedemptionCheck, usePlaceOrder,
  useFnbStatus,
  FnbProduct, CATEGORY_LABELS, CATEGORY_COLORS,
} from "@/hooks/useFnb";
import { fmtDateTimeSG } from "@/lib/sgTime";
import { useToast } from "@/hooks/use-toast";

function useCountdown(resumeAt: string | null | undefined) {
  const [label, setLabel] = useState("");
  useEffect(() => {
    if (!resumeAt) { setLabel(""); return; }
    const tick = () => {
      const diff = new Date(resumeAt).getTime() - Date.now();
      if (diff <= 0) { setLabel(""); return; }
      const m = Math.floor(diff / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setLabel(`${m}:${String(s).padStart(2, "0")}`);
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [resumeAt]);
  return label;
}

type Category = "all" | "drinks" | "food" | "snacks" | "others";

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
  if (cat === "others") return "others";
  return "all";
}

type CartLine = { product: FnbProduct; qty: number };

export default function DashboardFnb() {
  const { toast } = useToast();
  const { data: profile } = useProfile();
  const { data: menu = [] } = useMenu();
  const { data: orders = [] } = useMyFnbOrders();
  const { data: redemption } = useRedemptionCheck();
  const { data: fnbStatus } = useFnbStatus();
  const placeOrder = usePlaceOrder();
  const countdown = useCountdown(fnbStatus?.resumeAt);

  const [activeTab, setActiveTab] = useState<Category>("all");
  const [tableInput, setTableInput] = useState("");
  const [confirm, setConfirm] = useState<{ product: FnbProduct; isFree: boolean } | null>(null);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [placingCart, setPlacingCart] = useState(false);
  const [cartConfirmOpen, setCartConfirmOpen] = useState(false);

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

  const cartTotal = cart.reduce((s, l) => s + l.product.sellingPrice * l.qty, 0);

  const addToCart = (product: FnbProduct) => {
    setCart((prev) => {
      const existing = prev.find((l) => l.product._id === product._id);
      if (existing) return prev.map((l) => (l.product._id === product._id ? { ...l, qty: l.qty + 1 } : l));
      return [...prev, { product, qty: 1 }];
    });
  };
  const changeCartQty = (productId: string, delta: number) => {
    setCart((prev) => prev
      .map((l) => (l.product._id === productId ? { ...l, qty: l.qty + delta } : l))
      .filter((l) => l.qty > 0));
  };

  const handlePlaceCart = async () => {
    if (cart.length === 0 || !isValidTable(tableInput)) return;
    setCartConfirmOpen(false);
    setPlacingCart(true);
    let succeeded = 0;
    let failed = 0;
    const remaining: CartLine[] = [];
    for (const line of cart) {
      let lineFailed = 0;
      for (let i = 0; i < line.qty; i++) {
        try {
          await placeOrder.mutateAsync({
            productId: line.product._id,
            tableId: normalizeTableName(tableInput),
            tableName: normalizeTableName(tableInput),
            isFreeRedemption: false,
            silent: true,
          });
          succeeded++;
        } catch {
          failed++;
          lineFailed++;
        }
      }
      // Keep only the units that didn't go through, so a stock-related
      // failure leaves the cart ready to retry instead of vanishing.
      if (lineFailed > 0) remaining.push({ product: line.product, qty: lineFailed });
    }
    setPlacingCart(false);
    setCart(remaining);
    if (failed === 0) {
      toast({ title: `${succeeded} item${succeeded === 1 ? "" : "s"} ordered!`, description: "We'll bring it to your table shortly." });
    } else {
      toast({ title: `${succeeded} ordered, ${failed} failed`, description: "An item may have gone out of stock — remaining items are still in your cart.", variant: "destructive" });
    }
  };

  const statusBadge = (status: string) => {
    if (status === "pending") return <Badge className="bg-yellow-500/20 text-yellow-400">Preparing...</Badge>;
    if (status === "served") return <Badge className="bg-green-500/20 text-green-400">Served ✓</Badge>;
    return <Badge className="bg-red-500/20 text-red-400">Cancelled</Badge>;
  };

  // Closed notice — show full-screen overlay when F&B is paused
  if (fnbStatus?.isOpen === false) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 px-4">
        <div className="text-center space-y-3">
          <div className="text-5xl">🚽</div>
          <h2 className="text-xl font-bold">F&B Temporarily Unavailable</h2>
          <p className="text-muted-foreground text-sm max-w-xs">
            {fnbStatus.notice || "We'll be back shortly!"}
          </p>
          {countdown && (
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-orange-500/10 border border-orange-500/30">
              <Clock className="h-4 w-4 text-orange-400" />
              <span className="text-orange-400 font-mono font-semibold">{countdown}</span>
              <span className="text-xs text-muted-foreground">until reopening</span>
            </div>
          )}
        </div>
        <p className="text-xs text-muted-foreground">Check back soon or order from a staff member.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
            <ShoppingBag className="h-6 w-6 text-accent" /> F&B & Others
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">Order food, drinks & more, delivered to your table</p>
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
        {(["all", "drinks", "food", "snacks", "others"] as Category[]).map((tab) => (
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
                      disabled={!isValidTable(tableInput)}
                      onClick={() => addToCart(product)}
                    >
                      {!isValidTable(tableInput) ? "Enter valid table" : `Add to Cart — $${product.sellingPrice.toFixed(2)}`}
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

      {/* Cart */}
      {cart.length > 0 && (
        <Card className="border-accent/40 bg-background sticky bottom-2 z-10 shadow-lg">
          <CardContent className="p-4 space-y-3">
            <h3 className="font-semibold text-sm text-foreground flex items-center gap-1.5">
              <ShoppingBag className="h-4 w-4" /> Your Cart
            </h3>
            <div className="space-y-1.5">
              {cart.map((l) => (
                <div key={l.product._id} className="flex items-center justify-between text-sm">
                  <span className="flex-1 truncate pr-2">{l.product.name}</span>
                  <div className="flex items-center gap-2">
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => changeCartQty(l.product._id, -1)}><Minus className="h-3 w-3" /></Button>
                    <span className="w-5 text-center">{l.qty}</span>
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => changeCartQty(l.product._id, 1)}><Plus className="h-3 w-3" /></Button>
                    <span className="w-14 text-right text-muted-foreground">${(l.product.sellingPrice * l.qty).toFixed(2)}</span>
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => changeCartQty(l.product._id, -l.qty)}><X className="h-3 w-3 text-destructive" /></Button>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-border/50">
              <span className="font-semibold text-sm">Total: ${cartTotal.toFixed(2)}</span>
              <Button
                size="sm"
                className="bg-accent text-accent-foreground hover:bg-accent/90"
                disabled={placingCart || !isValidTable(tableInput) || cartTotal > walletBalance}
                onClick={() => setCartConfirmOpen(true)}
              >
                {placingCart ? "Placing..." : cartTotal > walletBalance ? "Insufficient Balance" : "Place Order"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

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

      {/* Confirm cart order */}
      <Dialog open={cartConfirmOpen} onOpenChange={setCartConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Order</DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-2">
            {cart.map((l) => (
              <div key={l.product._id} className="flex justify-between text-sm">
                <span>{l.qty} × {l.product.name}</span>
                <span className="text-muted-foreground">${(l.product.sellingPrice * l.qty).toFixed(2)}</span>
              </div>
            ))}
            <div className="flex justify-between text-sm font-semibold pt-2 border-t border-border/50">
              <span>Total</span>
              <span>${cartTotal.toFixed(2)}</span>
            </div>
            <p className="text-sm text-muted-foreground pt-1">
              ${cartTotal.toFixed(2)} will be deducted from your wallet. Deliver to: <span className="text-foreground">{tableInput}</span>
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCartConfirmOpen(false)}>Cancel</Button>
            <Button
              className="bg-accent text-accent-foreground hover:bg-accent/90"
              onClick={handlePlaceCart}
              disabled={placingCart}
            >
              {placingCart ? "Placing..." : "Confirm Order"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
