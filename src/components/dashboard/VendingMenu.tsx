import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { CheckCircle2, Clock, CupSoda, Gift, Loader2, Star, Wifi, WifiOff, XCircle, AlertTriangle } from "lucide-react";
import { fmtDateTimeSG } from "@/lib/sgTime";
import { CATEGORY_COLORS, CATEGORY_LABELS } from "@/hooks/useFnb";
import {
  useVendingMenu, useMyVendingOrders, useVendingOrder, useVendingPurchase,
  fmtCents, isOrderFinal, vendingImageSrc,
  VendingItem, VendingOrder, ORDER_STATUS_COLORS, ORDER_STATUS_LABELS,
} from "@/hooks/useVending";

function ItemPhoto({ item }: { item: VendingItem }) {
  const [failed, setFailed] = useState(false);
  const src = vendingImageSrc(item);
  return (
    <div className="aspect-square w-full overflow-hidden rounded-t-lg bg-muted/30 flex items-center justify-center">
      {src && !failed
        ? <img src={src} alt={item.name} className="h-full w-full object-cover" loading="lazy" onError={() => setFailed(true)} />
        : <CupSoda className="h-10 w-10 text-muted-foreground/40" />}
    </div>
  );
}

// Follows one order while the machine works on it: the server moves it
// queued → sent → dispensed (or refunds it), and this polls every 2 s until
// it settles. The member can close it any time; the list below keeps updating.
function OrderProgressDialog({ orderId, onClose }: { orderId: string | null; onClose: () => void }) {
  const { data: order } = useVendingOrder(orderId);
  const status = order?.status;
  const final = isOrderFinal(status);

  const icon = !final
    ? <Loader2 className="h-10 w-10 text-accent animate-spin" />
    : status === "dispensed"
      ? <CheckCircle2 className="h-10 w-10 text-green-500" />
      : status === "needs_review"
        ? <AlertTriangle className="h-10 w-10 text-orange-400" />
        : <XCircle className="h-10 w-10 text-muted-foreground" />;

  const detail = !order ? "Starting…"
    : status === "dispensed" ? "Collect your drink from the machine. Enjoy!"
    : status === "refunded" ? (order.paymentMethod === "free_membership" ? "Your free drink for today has been given back to you." : `${fmtCents(order.priceCents)} has been returned to your wallet.`)
    : status === "needs_review" ? "The machine didn't confirm the drop. Our staff have been notified and will sort it out — you won't lose your money."
    : status === "sent" ? "The machine is dispensing your drink…"
    : "Sending your order to the machine…";

  return (
    <Dialog open={!!orderId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{order?.productName || "Vending machine"}</DialogTitle>
        </DialogHeader>
        <div className="py-4 flex flex-col items-center text-center gap-3">
          {icon}
          <p className="font-medium text-foreground">{order?.message || "Please wait"}</p>
          <p className="text-sm text-muted-foreground max-w-xs">{detail}</p>
        </div>
        <DialogFooter>
          <Button variant={final ? "default" : "outline"} className={final ? "bg-accent text-accent-foreground hover:bg-accent/90" : ""} onClick={onClose}>
            {final ? "Done" : "Close"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function OrderRow({ order, onOpen }: { order: VendingOrder; onOpen: () => void }) {
  return (
    <Card className="border-border/50 cursor-pointer" onClick={onOpen}>
      <CardContent className="p-4 flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm text-foreground">{order.productName}</p>
          <p className="text-xs text-muted-foreground">
            {order.paymentMethod === "free_membership" ? "Free — Membership" : fmtCents(order.priceCents)} · Vending machine
          </p>
          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
            <Clock className="h-3 w-3" />{fmtDateTimeSG(order.createdAt)}
          </p>
        </div>
        <Badge className={ORDER_STATUS_COLORS[order.status]}>{ORDER_STATUS_LABELS[order.status]}</Badge>
      </CardContent>
    </Card>
  );
}

export function VendingMenu({ walletBalance }: { walletBalance: number }) {
  const { data: menu, isLoading } = useVendingMenu();
  const { data: orders = [] } = useMyVendingOrders();
  const purchase = useVendingPurchase();
  const [confirm, setConfirm] = useState<{ item: VendingItem; isFree: boolean } | null>(null);
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);

  const items = menu?.items ?? [];
  const anyOnline = (menu?.machines ?? []).some((m) => m.online);
  const freeDrink = menu?.freeDrink;
  // A drink still on its way blocks a second purchase server-side; say so up front.
  const inFlight = orders.find((o) => o.status === "queued" || o.status === "sent");

  const handleConfirm = () => {
    if (!confirm) return;
    purchase.mutate(
      { machineId: confirm.item.machineId, slotNo: confirm.item.slotNo, mode: "remote", isFreeRedemption: confirm.isFree },
      {
        onSuccess: (data) => setActiveOrderId(data.order._id),
        onSettled: () => setConfirm(null),
      }
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm">
        {anyOnline
          ? <Badge className="bg-green-500/20 text-green-400 gap-1"><Wifi className="h-3 w-3" /> Machine online</Badge>
          : <Badge className="bg-red-500/20 text-red-400 gap-1"><WifiOff className="h-3 w-3" /> Machine offline</Badge>}
        <span className="text-muted-foreground">Pay from your wallet — the drink drops a few seconds after you confirm.</span>
      </div>

      {freeDrink?.hasBenefit && !freeDrink.redeemedToday && (
        <div className="rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 flex items-center gap-2">
          <Gift className="h-4 w-4 text-green-400 flex-shrink-0" />
          <p className="text-sm text-green-400"><span className="font-medium">Free drink available today!</span> Tap "Redeem Free" on an eligible item.</p>
        </div>
      )}

      {inFlight && (
        <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 px-4 py-3 flex items-center justify-between gap-2">
          <p className="text-sm text-blue-300">Your {inFlight.productName} is on its way — wait for it before buying another.</p>
          <Button size="sm" variant="outline" onClick={() => setActiveOrderId(inFlight._id)}>Track</Button>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {items.map((item) => {
          const unavailable = !item.inStock || !item.machineOnline;
          const price = fmtCents(item.priceCents);
          return (
            <Card key={`${item.machineId}-${item.slotNo}`} className={`relative border-border/50 ${unavailable ? "opacity-50" : ""}`}>
              {item.isSignature && (
                <div className="absolute -top-2.5 -right-2.5 h-8 w-8 rounded-full bg-amber-400 flex items-center justify-center shadow-md ring-2 ring-background z-10">
                  <Star className="h-5 w-5 text-amber-950 fill-amber-950" />
                </div>
              )}
              <ItemPhoto item={item} />
              <CardContent className="p-4 space-y-3">
                <div>
                  <p className="font-semibold text-sm text-foreground">{item.name}</p>
                  <Badge className={`text-xs mt-1 ${CATEGORY_COLORS[item.category] ?? ""}`}>{CATEGORY_LABELS[item.category] ?? item.category}</Badge>
                </div>
                <p className="text-accent font-bold">{price}</p>
                {!item.inStock ? (
                  <Badge variant="outline" className="text-muted-foreground w-full justify-center">Sold Out</Badge>
                ) : !item.machineOnline ? (
                  <Badge variant="outline" className="text-muted-foreground w-full justify-center">Machine offline</Badge>
                ) : (
                  <div className="space-y-2">
                    {item.freeDrinkEligible && (
                      <Button size="sm" className="w-full bg-green-600 hover:bg-green-700 text-white text-xs" disabled={!!inFlight} onClick={() => setConfirm({ item, isFree: true })}>
                        Redeem Free
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full text-xs"
                      disabled={!!inFlight || item.priceCents > Math.round(walletBalance * 100)}
                      onClick={() => setConfirm({ item, isFree: false })}
                    >
                      {item.priceCents > Math.round(walletBalance * 100) ? "Insufficient balance" : `Buy — ${price}`}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
        {!isLoading && items.length === 0 && (
          <div className="col-span-full text-center py-10 text-muted-foreground text-sm">Nothing in the vending machine yet.</div>
        )}
      </div>

      <div className="space-y-3">
        <h2 className="font-semibold text-foreground">Vending Orders</h2>
        {orders.length === 0
          ? <p className="text-sm text-muted-foreground">No vending orders yet.</p>
          : <div className="space-y-2">{orders.map((o) => <OrderRow key={o._id} order={o} onOpen={() => setActiveOrderId(o._id)} />)}</div>}
      </div>

      <Dialog open={!!confirm} onOpenChange={() => setConfirm(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Confirm Purchase</DialogTitle></DialogHeader>
          <div className="py-2">
            <p className="text-foreground font-medium">{confirm?.item.name}</p>
            <p className="text-sm text-muted-foreground mt-1">
              {confirm?.isFree ? "FREE — membership benefit" : `${confirm ? fmtCents(confirm.item.priceCents) : ""} will be deducted from your wallet`}
            </p>
            <p className="text-sm text-muted-foreground mt-1">Stand by the machine — it dispenses right after you confirm. If it can't, you're refunded automatically.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(null)}>Cancel</Button>
            <Button className="bg-accent text-accent-foreground hover:bg-accent/90" onClick={handleConfirm} disabled={purchase.isPending}>
              {purchase.isPending ? "Sending…" : "Confirm & Dispense"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <OrderProgressDialog orderId={activeOrderId} onClose={() => setActiveOrderId(null)} />
    </div>
  );
}
