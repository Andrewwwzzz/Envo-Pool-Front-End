import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { fmtDateSG, fmtTimeSG, fmtDateTimeSG } from "@/lib/sgTime";
import { useUpdateBookingStatus } from "@/hooks/useAdmin";

interface Props {
  booking: any | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const statusStyles: Record<string, string> = {
  confirmed: "bg-green-500/10 text-green-400 border-green-500/30",
  completed: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  pending: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  pending_payment: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  cancelled: "bg-destructive/10 text-destructive border-destructive/30",
  expired: "bg-muted text-muted-foreground border-border",
  refunded: "bg-orange-500/10 text-orange-500 border-orange-500/30",
  no_show: "bg-destructive/10 text-destructive border-destructive/30",
};

const statusLabel: Record<string, string> = {
  confirmed: "Confirmed",
  completed: "Completed",
  pending: "Pending Payment",
  pending_payment: "Pending Payment",
  cancelled: "Cancelled",
  expired: "Expired",
  refunded: "Refunded",
  no_show: "No Show",
};

const paymentStyles: Record<string, string> = {
  wallet: "bg-green-500/10 text-green-400 border-green-500/30",
  paynow: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  stripe: "bg-blue-500/10 text-blue-400 border-blue-500/30",
};

const paymentLabel: Record<string, string> = {
  wallet: "Wallet",
  paynow: "PayNow",
  stripe: "PayNow",
  booking_payment: "Wallet",
  wallet_deduct: "Wallet",
};

const AdminBookingDetailDialog = ({ booking, open, onOpenChange }: Props) => {
  const updateStatus = useUpdateBookingStatus();
  const [confirmCancel, setConfirmCancel] = useState(false);

  if (!booking) return null;
  const b = booking;
  const id: string = b._id || b.id || "";
  const shortId = id ? id.slice(-8) : "—";
  const startTime = b.startTime || b.start_time;
  const endTime = b.endTime || b.end_time;
  const createdAt = b.createdAt || b.created_at;
  const status: string = b.status || "pending";

  const mins =
    startTime && endTime
      ? Math.round((new Date(endTime).getTime() - new Date(startTime).getTime()) / 60000)
      : 0;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const duration = mins > 0 ? `${h}h ${m}m` : "—";

  const tableName =
    typeof b.tableId === "string"
      ? `Table ${b.tableId.replace("T", "")}`
      : b.tableId?.name ||
        (b.tableId?.tableNumber ? `Table ${b.tableId.tableNumber}` : null) ||
        (b.tables?.table_number ? `Table ${b.tables.table_number}` : "—");

  const customer = (() => {
    const u = b.user || b.userId || {};
    if (!u || typeof u === "string") {
      return { name: b.customerName || "—", email: b.customerEmail || "—", shortId: b.shortId || null };
    }
    return {
      name: u.name || b.customerName || "—",
      email: u.email || b.customerEmail || "—",
      shortId: u.shortId || b.shortId || null,
    };
  })();

  const finalAmount = Number(
    b.amount ?? b.finalPrice ?? b.final_price ?? b.totalPrice ?? b.price ?? 0,
  );
  const originalPrice = Number(b.originalPrice ?? b.original_price ?? 0);
  const discountAmount = Number(b.discountAmount ?? b.discount_amount ?? 0);
  const promoObj = b.appliedPromo || b.promo || null;
  const promoCode =
    (typeof promoObj === "object" && promoObj?.code) ||
    b.promoCode ||
    b.promo_code ||
    null;
  const hasPromo = !!promoCode || discountAmount > 0;

  const paymentMethodRaw =
    b.paymentMethod ||
    b.payment_method ||
    b.inferredPaymentMethod ||
    (b.paymentStatus === "paid" ? "paynow" : null);
  const paymentKey = paymentMethodRaw ? String(paymentMethodRaw).toLowerCase() : null;
  const paidAt = b.paidAt || b.paid_at;

  const canMarkCompleted = status === "confirmed";
  const canCancel = status === "confirmed" || status === "pending" || status === "pending_payment";
  const hasActions = canMarkCompleted || canCancel;

  const close = () => {
    onOpenChange(false);
    setConfirmCancel(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setConfirmCancel(false); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-lg gold-gradient">Booking Details</DialogTitle>
          <DialogDescription className="sr-only">Full booking information for admin</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 pt-2">
          {/* Booking Information */}
          <section className="space-y-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Booking Information</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-muted-foreground">Booking ID</div>
                <div className="font-mono font-medium">…{shortId}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Status</div>
                <Badge variant="outline" className={statusStyles[status] || ""}>
                  {statusLabel[status] || status}
                </Badge>
              </div>
              <div className="col-span-2">
                <div className="text-muted-foreground">Created</div>
                <div className="font-medium">{createdAt ? fmtDateTimeSG(createdAt) : "—"}</div>
              </div>
            </div>
          </section>

          <Separator className="bg-border/50" />

          {/* Table & Time */}
          <section className="space-y-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Table &amp; Time</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-muted-foreground">Table</div>
                <div className="font-medium">{tableName}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Date</div>
                <div className="font-medium">{startTime ? fmtDateSG(startTime) : "—"}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Time</div>
                <div className="font-medium">
                  {startTime ? fmtTimeSG(startTime) : "—"} — {endTime ? fmtTimeSG(endTime) : "—"}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Duration</div>
                <div className="font-medium">{duration}</div>
              </div>
            </div>
          </section>

          <Separator className="bg-border/50" />

          {/* Customer */}
          <section className="space-y-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Customer Details</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-muted-foreground">Name</div>
                <div className="font-medium">{customer.name}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Email</div>
                <div className="font-medium break-all">{customer.email}</div>
              </div>
              {customer.shortId && (
                <div>
                  <div className="text-muted-foreground">Short ID</div>
                  <div className="font-mono font-medium">{customer.shortId}</div>
                </div>
              )}
            </div>
            {customer.shortId && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigator.clipboard.writeText(String(customer.shortId))}
              >
                Copy Short ID to find in Customers
              </Button>
            )}
          </section>

          <Separator className="bg-border/50" />

          {/* Payment */}
          <section className="space-y-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Payment Details</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-muted-foreground">Amount Charged</div>
                <div className="font-medium text-base">${finalAmount.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Method</div>
                <Badge variant="outline" className={paymentKey ? (paymentStyles[paymentKey] || "bg-muted text-muted-foreground border-border") : "bg-muted text-muted-foreground border-border"}>
                  {paymentKey ? (paymentLabel[paymentKey] || paymentKey) : "—"}
                </Badge>
              </div>
              {paidAt && (
                <div className="col-span-2">
                  <div className="text-muted-foreground">Paid At</div>
                  <div className="font-medium">{fmtDateTimeSG(paidAt)}</div>
                </div>
              )}
            </div>

            <div className="rounded-md border border-border/50 p-3 space-y-1 text-sm">
              {hasPromo ? (
                <>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Promo Code</span>
                    <span className="font-mono font-medium">{promoCode || "—"}</span>
                  </div>
                  {originalPrice > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Original Price</span>
                      <span>${originalPrice.toFixed(2)}</span>
                    </div>
                  )}
                  {discountAmount > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Discount</span>
                      <span className="text-green-400">−${discountAmount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-medium pt-1 border-t border-border/50">
                    <span>Final Amount</span>
                    <span>${finalAmount.toFixed(2)}</span>
                  </div>
                </>
              ) : (
                <div className="text-muted-foreground">No promo applied</div>
              )}
            </div>
          </section>

          <Separator className="bg-border/50" />

          {/* Actions */}
          <section className="space-y-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Actions</h3>
            {!hasActions ? (
              <p className="text-sm text-muted-foreground">No actions available.</p>
            ) : confirmCancel ? (
              <div className="space-y-2">
                <p className="text-sm">Are you sure you want to cancel this booking?</p>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => setConfirmCancel(false)}>Keep</Button>
                  <Button
                    variant="destructive"
                    disabled={updateStatus.isPending}
                    onClick={() => {
                      updateStatus.mutate(
                        { bookingId: id, status: "cancelled" },
                        { onSuccess: () => close() },
                      );
                    }}
                  >
                    Confirm Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2 sm:flex-row">
                {canMarkCompleted && (
                  <Button
                    className="bg-green-600 hover:bg-green-700 text-white"
                    disabled={updateStatus.isPending}
                    onClick={() => {
                      updateStatus.mutate(
                        { bookingId: id, status: "completed" },
                        { onSuccess: () => close() },
                      );
                    }}
                  >
                    Mark Completed
                  </Button>
                )}
                {canCancel && (
                  <Button
                    variant="destructive"
                    disabled={updateStatus.isPending}
                    onClick={() => setConfirmCancel(true)}
                  >
                    Cancel Booking
                  </Button>
                )}
              </div>
            )}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AdminBookingDetailDialog;
