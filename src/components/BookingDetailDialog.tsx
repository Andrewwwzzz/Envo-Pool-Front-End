import { useState, useMemo, useEffect } from "react";
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
import { Copy, Check } from "lucide-react";
import { fmtDateSG as fmtDate, fmtTimeSG as fmtTime } from "@/lib/sgTime";
import { useMyMembership } from "@/hooks/useMembership";

interface BookingData {
  id: string;
  start_time: string;
  end_time: string;
  created_at: string;
  duration_hours: number;
  final_price: number;
  price: number;
  status: string;
  payment_method: string | null;
  tables?: { table_number: number } | null;
}

interface BookingDetailDialogProps {
  booking: BookingData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCancel?: (bookingId: string) => void;
  cancelling?: boolean;
}

const statusBadge: Record<string, string> = {
  confirmed: "bg-primary/10 text-primary border-primary/20",
  pending: "bg-accent/20 text-accent-foreground border-accent/30",
  cancelled: "bg-destructive/10 text-destructive border-destructive/20",
  completed: "bg-muted text-muted-foreground border-border",
  refunded: "bg-orange-500/10 text-orange-600 border-orange-300",
  no_show: "bg-destructive/10 text-destructive border-destructive/20",
};

const paymentLabel: Record<string, string> = {
  wallet: "Wallet",
  paynow: "PayNow",
  stripe: "PayNow",
  reward: "Reward",
  booking_payment: "Wallet",
  wallet_deduct: "Wallet",
};

const BookingDetailDialog = ({ booking, open, onOpenChange }: BookingDetailDialogProps) => {
  const [copied, setCopied] = useState(false);
  const { data: membershipData } = useMyMembership();

  const b = booking as any;
  const startTime = b?.startTime || b?.start_time;
  const endTime = b?.endTime || b?.end_time;


  // Prefer backend-stored segments (snapshot at booking time). Fall back to
  // live pricing-rule computation only if backend didn't provide them AND the
  // live computation reconciles with the stored subtotal.
  const storedSegments = useMemo(() => {
    const raw = b?.pricingSegments || b?.pricing_segments || b?.segments;
    if (!Array.isArray(raw) || raw.length === 0) return [];
    return raw
      .map((s: any) => {
        const sStart = s.startTime || s.start_time || s.start;
        const sEnd = s.endTime || s.end_time || s.end;
        if (!sStart || !sEnd) return null;
        return {
          startTime: new Date(sStart),
          endTime: new Date(sEnd),
          hourlyRate: Number(s.ratePerHour ?? s.rate_per_hour ?? s.hourlyRate ?? s.hourly_rate ?? s.rate ?? 0),
          segmentCost: Number(s.amount ?? s.segmentCost ?? s.segment_cost ?? s.cost ?? 0),
        };
      })
      .filter(Boolean) as Array<{ startTime: Date; endTime: Date; hourlyRate: number; segmentCost: number }>;
  }, [b]);

  const segments = storedSegments;

  useEffect(() => {
    if (open && b) {
      console.log("[BookingDetail] pricingSegments:", b.pricingSegments ?? b.pricing_segments);
      console.log("[BookingDetail] originalAmount:", b.originalAmount ?? b.original_amount);
      console.log("[BookingDetail] membershipDiscount:", b.membershipDiscount ?? b.membership_discount);
      console.log("[BookingDetail] amount:", b.amount ?? b.finalPrice ?? b.final_price);
    }
  }, [open, b]);

  if (!booking) return null;

  const createdAt = b.createdAt || b.created_at;
  const mins = startTime && endTime ? Math.round((new Date(endTime).getTime() - new Date(startTime).getTime()) / 60000) : 0;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const durationDisplay = mins > 0 ? (m > 0 ? `${h}h ${m}m` : `${h}h`) : null;

  const finalPrice = Number(b.amount ?? b.finalPrice ?? b.final_price ?? b.totalPrice ?? b.price ?? 0);
  const originalAmount = Number(
    b.originalAmount ?? b.original_amount ?? b.subtotal ?? 0
  );
  const subtotal = originalAmount > 0 ? originalAmount : finalPrice;

  const membershipDiscount = Number(b.membershipDiscount ?? b.membership_discount ?? 0);
  const promoDiscount = Number(b.promoDiscount ?? b.discountAmount ?? b.discount_amount ?? 0);
  const rewardDiscount = Number(b.rewardDiscount ?? b.reward_discount ?? 0);

  const promoObj = b.appliedPromo || b.promo;
  const promoCode =
    (typeof promoObj === "object" && promoObj?.code) ||
    b.promoCode ||
    b.promo_code ||
    null;
  const rewardCode = b.rewardCode || b.reward_code || (typeof b.reward === "object" ? b.reward?.code : null) || null;
  const activeMembership = (membershipData?.memberships || []).find(
    (m: any) => m?.status === "active"
  );
  const planBenefitPct = Number(
    activeMembership?.planId?.benefits?.bookingDiscount ??
      activeMembership?.plan?.benefits?.bookingDiscount ??
      activeMembership?.planId?.bookingDiscountPct ??
      0
  );
  const membershipPct = Number(
    b.membershipDiscountPercent ??
      b.membership_discount_percent ??
      b.membershipDiscountPct ??
      b.membership_discount_pct ??
      planBenefitPct ??
      0
  );

  const tableLabel =
    typeof b.tableId === "string"
      ? `Table ${b.tableId.replace(/^T/i, "")}`
      : b.tableId?.name || `Table ${b.tables?.table_number || b.tableId?.table_number || "?"}`;

  const paymentMethodRaw =
    b.paymentMethod || b.payment_method || b.inferredPaymentMethod || (b.paymentStatus === "paid" ? "paynow" : null);
  const payment = paymentMethodRaw
    ? paymentLabel[paymentMethodRaw] ?? paymentMethodRaw
    : finalPrice === 0
    ? "Reward"
    : "N/A";

  const isCompleted = (booking.status === "confirmed" || booking.status === "completed") && new Date(endTime) < new Date();
  const displayStatus = isCompleted ? "completed" : booking.status;
  const statusLabel = displayStatus === "no_show" ? "No Show" : displayStatus;

  const bookingId = b._id || b.id || "";
  const shortId = bookingId ? String(bookingId).slice(-8).toUpperCase() : "—";

  const handleCopyId = async () => {
    if (!bookingId) return;
    try {
      await navigator.clipboard.writeText(String(bookingId));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* noop */ }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card border-border p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <DialogTitle className="text-xl gold-gradient">{tableLabel}</DialogTitle>
              <DialogDescription className="sr-only">
                Receipt for booking on {tableLabel}
              </DialogDescription>
              <button
                onClick={handleCopyId}
                className="mt-1 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors font-mono"
                aria-label="Copy booking ID"
              >
                #{shortId}
                {copied ? <Check className="h-3 w-3 text-primary" /> : <Copy className="h-3 w-3" />}
              </button>
            </div>
            <Badge variant="outline" className={`${statusBadge[displayStatus] ?? ""} capitalize`}>
              {statusLabel}
            </Badge>
          </div>
        </DialogHeader>

        <div className="px-6 pb-6 space-y-4">
          {/* Date & Time */}
          <section className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Date</span>
              <span className="font-medium">{startTime ? fmtDate(startTime) : "—"}</span>
            </div>

            <div className="rounded-lg border border-border/60 bg-background/40 p-3 space-y-1.5">
              {segments.length >= 1 ? (
                segments.map((seg, i) => {
                  const segMins = Math.round((seg.endTime.getTime() - seg.startTime.getTime()) / 60000);
                  const sH = Math.floor(segMins / 60);
                  const sM = segMins % 60;
                  const dur = sM > 0 ? `${sH}h ${sM}m` : `${sH}h`;
                  return (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground tabular-nums">
                        {fmtTime(seg.startTime.toISOString())} – {fmtTime(seg.endTime.toISOString())}
                        <span className="ml-2 text-xs opacity-70">@ ${seg.hourlyRate.toFixed(2)}/hr · {dur}</span>
                      </span>
                      <span className="font-medium tabular-nums">${seg.segmentCost.toFixed(2)}</span>
                    </div>
                  );
                })
              ) : (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground tabular-nums">
                    {startTime ? fmtTime(startTime) : "—"} – {endTime ? fmtTime(endTime) : "—"}
                    {durationDisplay && (
                      <span className="ml-2 text-xs opacity-70">
                        {segments[0] ? `@ $${segments[0].hourlyRate.toFixed(2)}/hr · ` : ""}{durationDisplay}
                      </span>
                    )}
                  </span>
                  <span className="font-medium tabular-nums">${subtotal.toFixed(2)}</span>
                </div>
              )}
            </div>
          </section>

          <Separator className="bg-border/50" />

          {/* Pricing breakdown */}
          <section className="space-y-1.5 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-medium tabular-nums">${subtotal.toFixed(2)}</span>
            </div>

            {membershipDiscount > 0 && (
              <div className="flex items-center justify-between text-primary">
                <span>
                  Membership discount
                  {membershipPct > 0 && ` (${Math.round(membershipPct)}% off)`}
                </span>
                <span className="tabular-nums">−${membershipDiscount.toFixed(2)}</span>
              </div>
            )}

            {promoDiscount > 0 && (
              <div className="flex items-center justify-between text-primary">
                <span>Promo code{promoCode ? ` (${promoCode})` : ""}</span>
                <span className="tabular-nums">−${promoDiscount.toFixed(2)}</span>
              </div>
            )}

            {rewardDiscount > 0 && (
              <div className="flex items-center justify-between text-accent">
                <span>Reward{rewardCode ? ` (${rewardCode})` : ""}</span>
                <span className="tabular-nums">−${rewardDiscount.toFixed(2)}</span>
              </div>
            )}

            <Separator className="bg-border/50 my-2" />

            <div className="flex items-center justify-between text-base font-bold">
              <span>Total Paid</span>
              <span className="gold-gradient tabular-nums">${finalPrice.toFixed(2)}</span>
            </div>
          </section>

          <Separator className="bg-border/50" />

          {/* Payment */}
          <section className="space-y-1.5 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Payment Method</span>
              <span className="font-medium">{payment}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Amount Paid</span>
              <span className="font-medium tabular-nums">${finalPrice.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Booked at</span>
              <span className="font-medium">
                {createdAt ? `${fmtDate(createdAt)} at ${fmtTime(createdAt)}` : "—"}
              </span>
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BookingDetailDialog;
