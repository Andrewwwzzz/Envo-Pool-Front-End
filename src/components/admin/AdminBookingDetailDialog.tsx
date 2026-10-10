import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Copy, Check, Pencil, AlertTriangle } from "lucide-react";
import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { fmtDateSG, fmtTimeSG, fmtDateTimeSG } from "@/lib/sgTime";
import { getTableLabel } from "@/lib/tableLabel";
import { useAdminTables, useAdminCustomers, useChangeBookingPaymentMethod } from "@/hooks/useAdmin";

interface Props {
  booking: any | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCancel?: (bookingId: string) => void;
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
  paynow: "bg-purple-500/10 text-purple-400 border-purple-500/30",
  stripe: "bg-purple-500/10 text-purple-400 border-purple-500/30",
  cash: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  reward: "bg-primary/10 text-primary border-primary/30",
};

const paymentLabel: Record<string, string> = {
  wallet: "Wallet",
  paynow: "PayNow",
  stripe: "PayNow",
  cash: "Cash",
  reward: "Reward",
  booking_payment: "Wallet",
  wallet_deduct: "Wallet",
};

const fmtDur = (mins: number) => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
};

const AdminBookingDetailDialog = ({ booking, open, onOpenChange, onCancel }: Props) => {
  const { data: tablesList } = useAdminTables();
  const [editingMethod, setEditingMethod] = useState(false);
  const [changedMethod, setChangedMethod] = useState<{ id: string; method: string } | null>(null);

  const segments = useMemo(() => {
    if (!booking) return [];
    const b = booking;
    const raw = b.pricingSegments || b.pricing_segments || b.segments;
    if (!Array.isArray(raw) || raw.length === 0) return [];
    return raw
      .map((s: any) => {
        const sStart = s.startTime || s.start_time || s.start;
        const sEnd = s.endTime || s.end_time || s.end;
        if (!sStart || !sEnd) return null;
        return {
          startTime: new Date(sStart),
          endTime: new Date(sEnd),
          ratePerHour: Number(s.ratePerHour ?? s.rate_per_hour ?? s.hourlyRate ?? s.hourly_rate ?? s.rate ?? 0),
          amount: Number(s.amount ?? s.segmentCost ?? s.segment_cost ?? s.cost ?? 0),
          ruleName: s.ruleName || s.rule_name || null,
        };
      })
      .filter(Boolean) as Array<{ startTime: Date; endTime: Date; ratePerHour: number; amount: number; ruleName: string | null }>;
  }, [booking]);

  if (!booking) return null;
  const b = booking;
  const id: string = b._id || b.id || "";
  const shortId = id ? id.slice(-8).toUpperCase() : "—";
  const startTime = b.startTime || b.start_time;
  const endTime = b.endTime || b.end_time;
  const createdAt = b.createdAt || b.created_at;
  const status: string = b.status || "pending";

  const totalMins =
    startTime && endTime
      ? Math.round((new Date(endTime).getTime() - new Date(startTime).getTime()) / 60000)
      : 0;

  const tableName = getTableLabel(b.tableId, tablesList as any, b);

  const customer = (() => {
    const u = b.userId || b.user || {};
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
  const originalAmount = Number(b.originalAmount ?? b.original_amount ?? b.originalPrice ?? b.original_price ?? 0);
  const membershipDiscount = Number(b.membershipDiscount ?? b.membership_discount ?? 0);
  const freeMinutesCredit = Number(b.freeMinutesCredit ?? b.free_minutes_credit ?? 0);
  const freeMinutesApplied = Number(b.freeMinutesApplied ?? b.free_minutes_applied ?? 0);
  const promoDiscount = Number(b.promoDiscount ?? b.promo_discount ?? b.discountAmount ?? b.discount_amount ?? 0);
  const rewardDiscount = Number(b.rewardDiscount ?? b.reward_discount ?? 0);

  const promoObj = b.appliedPromo || b.promo;
  const promoCode =
    (typeof promoObj === "object" && promoObj?.code) ||
    b.promoCode ||
    b.promo_code ||
    null;
  const rewardCode =
    b.rewardCode || b.reward_code || (typeof b.reward === "object" ? b.reward?.code : null) || null;

  const membershipPct = Number(
    b.membershipDiscountPercent ??
      b.membership_discount_percent ??
      b.membershipDiscountPct ??
      b.membership_discount_pct ??
      0
  );

  const hasBreakdown =
    originalAmount > 0 &&
    (membershipDiscount > 0 || freeMinutesCredit > 0 || promoDiscount > 0 || rewardDiscount > 0 || Math.abs(originalAmount - finalAmount) > 0.005);

  const paymentMethodRaw =
    b.paymentMethod ||
    b.payment_method ||
    b.inferredPaymentMethod ||
    (b.paymentStatus === "paid" ? "paynow" : null);
  const paymentKey = paymentMethodRaw ? String(paymentMethodRaw).toLowerCase() : null;
  const paidAt = b.paidAt || b.paid_at;

  const canCancel = (status === "confirmed" || status === "pending" || status === "pending_payment") && !b.isDeleted;
  // The booking prop is a snapshot from the list — show a just-saved method straight away.
  const shownKey = changedMethod?.id === id ? changedMethod.method : paymentKey;
  // Correct the payment method on a paid cash / PayNow / wallet booking (not refunded — the server checks too).
  const canEditMethod =
    (status === "confirmed" || status === "completed") && !b.isDeleted &&
    !(Number(b.refundedAmount) > 0) &&
    (shownKey === "cash" || shownKey === "paynow" || shownKey === "wallet");

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) setEditingMethod(false); onOpenChange(o); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-lg gold-gradient">Booking Details</DialogTitle>
          <DialogDescription className="sr-only">Full booking information for admin</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 pt-2">
          {b.isDeleted && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm space-y-1">
              <div className="font-semibold text-destructive">This booking has been deleted</div>
              {(b.deletionReason || b.deletedReason) && <div><span className="text-muted-foreground">Reason: </span>{b.deletionReason || b.deletedReason}</div>}
              {(b.deletedBy?.name || b.deletedBy?.email || typeof b.deletedBy === "string") && (
                <div><span className="text-muted-foreground">Deleted by: </span>{b.deletedBy?.name || b.deletedBy?.email || b.deletedBy}</div>
              )}
              {b.deletedAt && <div><span className="text-muted-foreground">Deleted at: </span>{fmtDateTimeSG(b.deletedAt)}</div>}
            </div>
          )}

          {/* Booking Information */}
          <section className="space-y-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Booking Information</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-muted-foreground">Booking ID</div>
                <div className="flex items-center gap-2">
                  <div className="font-mono font-medium">#{shortId}</div>
                  <CopyIdButton value={id} />
                </div>
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
            </div>

            <div className="rounded-md border border-border/50 bg-background/40 p-3 space-y-1.5 text-sm">
              {segments.length > 0 ? (
                segments.map((seg, i) => {
                  const segMins = Math.round((seg.endTime.getTime() - seg.startTime.getTime()) / 60000);
                  return (
                    <div key={i} className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground tabular-nums">
                        {fmtTimeSG(seg.startTime.toISOString())} – {fmtTimeSG(seg.endTime.toISOString())}
                        <span className="ml-2 text-xs opacity-70">
                          @ ${seg.ratePerHour.toFixed(2)}/hr · {fmtDur(segMins)}
                        </span>
                      </span>
                      <span className="font-medium tabular-nums">${seg.amount.toFixed(2)}</span>
                    </div>
                  );
                })
              ) : (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground tabular-nums">
                    {startTime ? fmtTimeSG(startTime) : "—"} – {endTime ? fmtTimeSG(endTime) : "—"}
                    {totalMins > 0 && <span className="ml-2 text-xs opacity-70">({fmtDur(totalMins)})</span>}
                  </span>
                </div>
              )}
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
                Copy Short ID
              </Button>
            )}
          </section>

          <Separator className="bg-border/50" />

          {/* Payment */}
          <section className="space-y-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Payment Details</h3>

            <div className="rounded-md border border-border/50 p-3 space-y-1.5 text-sm">
              {hasBreakdown ? (
                <>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="tabular-nums">${originalAmount.toFixed(2)}</span>
                  </div>
                  {freeMinutesCredit > 0 && (
                    <div className="flex justify-between text-primary">
                      <span>Free {freeMinutesApplied > 0 ? `${freeMinutesApplied} ` : ""}mins (membership benefit)</span>
                      <span className="tabular-nums">−${freeMinutesCredit.toFixed(2)}</span>
                    </div>
                  )}
                  {membershipDiscount > 0 && (
                    <div className="flex justify-between text-primary">
                      <span>
                        Membership discount
                        {membershipPct > 0 ? ` (${Math.round(membershipPct)}% off)` : ""}
                      </span>
                      <span className="tabular-nums">−${membershipDiscount.toFixed(2)}</span>
                    </div>
                  )}
                  {promoDiscount > 0 && (
                    <div className="flex justify-between text-primary">
                      <span>Promo code{promoCode ? ` (${promoCode})` : ""}</span>
                      <span className="tabular-nums">−${promoDiscount.toFixed(2)}</span>
                    </div>
                  )}
                  {rewardDiscount > 0 && (
                    <div className="flex justify-between text-primary">
                      <span>Reward{rewardCode ? ` (${rewardCode})` : ""}</span>
                      <span className="tabular-nums">−${rewardDiscount.toFixed(2)}</span>
                    </div>
                  )}
                  <Separator className="bg-border/50 my-1" />
                  <div className="flex justify-between font-bold text-base">
                    <span>Total Charged</span>
                    <span className="gold-gradient tabular-nums">${finalAmount.toFixed(2)}</span>
                  </div>
                </>
              ) : (
                <div className="flex justify-between font-bold text-base">
                  <span>Amount Charged</span>
                  <span className="gold-gradient tabular-nums">${finalAmount.toFixed(2)}</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm pt-1">
              <div>
                <div className="text-muted-foreground">Method</div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={shownKey ? (paymentStyles[shownKey] || "bg-muted text-muted-foreground border-border") : "bg-muted text-muted-foreground border-border"}>
                    {shownKey ? (paymentLabel[shownKey] || shownKey) : "—"}
                  </Badge>
                  {canEditMethod && !editingMethod && (
                    <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditingMethod(true)} aria-label="Change payment method">
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
              {paidAt && (
                <div>
                  <div className="text-muted-foreground">Paid At</div>
                  <div className="font-medium">{fmtDateTimeSG(paidAt)}</div>
                </div>
              )}
            </div>
            {editingMethod && canEditMethod && (
              <BookingPaymentMethodEditor
                key={id}
                bookingId={id}
                currentMethod={shownKey as "cash" | "paynow" | "wallet"}
                amount={finalAmount}
                onDone={(m) => { if (m) setChangedMethod({ id, method: m }); setEditingMethod(false); }}
              />
            )}
          </section>

          {status === "cancelled" && (
            <section className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm space-y-1">
              <div className="font-semibold text-amber-500">Cancellation Details</div>
              <div><span className="text-muted-foreground">Reason: </span>{b.cancellationReason || b.cancelled_reason || "No reason provided"}</div>
              <div><span className="text-muted-foreground">Cancelled by: </span>{b.cancelledBy?.name || b.cancelledBy?.email || "—"}</div>
              <div><span className="text-muted-foreground">Cancelled at: </span>{b.updatedAt ? fmtDateTimeSG(b.updatedAt) : "—"}</div>
            </section>
          )}
        </div>

        {canCancel && onCancel && (
          <DialogFooter className="pt-2">
            <Button variant="destructive" onClick={() => onCancel(id)}>
              Cancel Booking
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
};

// Same correction form as an invoice's: pick the method, a customer for
// wallet, and say why. Calls onDone(newMethod) after saving, onDone() on cancel.
const BookingPaymentMethodEditor = ({
  bookingId,
  currentMethod,
  amount,
  onDone,
}: {
  bookingId: string;
  currentMethod: "cash" | "paynow" | "wallet";
  amount: number;
  onDone: (newMethod?: string) => void;
}) => {
  const { toast } = useToast();
  const changeMethod = useChangeBookingPaymentMethod();
  const [draft, setDraft] = useState<"cash" | "paynow" | "wallet">(currentMethod === "paynow" ? "cash" : currentMethod);
  const [customerId, setCustomerId] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [allowNegative, setAllowNegative] = useState(false);
  const [reason, setReason] = useState("");
  const { data: customers = [] } = useAdminCustomers(customerSearch);
  const label = (m: string) => (m === "wallet" ? "Wallet" : m === "paynow" ? "PayNow" : "Cash");

  const selected = (customers as any[]).find((c: any) => c.id === customerId);
  const balance = selected?.wallet_balance ?? 0;
  const willGoNegative = draft === "wallet" && !!selected && amount > balance;
  const accountAllowsNegative = !!selected?.allow_negative_balance;
  const effectiveAllowNegative = allowNegative || accountAllowsNegative;

  const save = () => {
    if (draft === currentMethod) { onDone(); return; }
    if (reason.trim().length < 5) {
      toast({ title: "Reason required", description: "Say why the payment method is changing (at least 5 characters).", variant: "destructive" });
      return;
    }
    if (draft === "wallet" && !customerId) {
      toast({ title: "Select a customer", description: "A customer must be selected to charge the wallet.", variant: "destructive" });
      return;
    }
    if (willGoNegative && !effectiveAllowNegative) {
      toast({ title: "Insufficient wallet balance", description: "Check 'Allow negative balance' to proceed anyway.", variant: "destructive" });
      return;
    }
    changeMethod.mutate(
      { bookingId, newMethod: draft, customerId: draft === "wallet" ? customerId : undefined, allowNegative: effectiveAllowNegative, reason: reason.trim() },
      {
        onSuccess: () => {
          toast({ title: "Payment method updated", description: `Changed from ${label(currentMethod)} to ${label(draft)}.` });
          onDone(draft);
        },
        onError: (err: Error) => toast({ title: "Failed to change payment method", description: err.message, variant: "destructive" }),
      }
    );
  };

  return (
    <div className="rounded-md border border-border/50 p-3 space-y-3">
      <div className="grid grid-cols-3 gap-2">
        {(["cash", "paynow", "wallet"] as const).map((m) => (
          <Button key={m} type="button" size="sm" variant={draft === m ? "default" : "outline"} onClick={() => setDraft(m)}>
            {label(m)}
          </Button>
        ))}
      </div>

      {draft === "wallet" && (
        <div className="space-y-2">
          <Label className="text-xs">Customer</Label>
          {selected ? (
            <div className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
              <div>
                <p className="font-medium">{selected.name || selected.legal_name || selected.email}</p>
                <p className="text-xs text-muted-foreground">Balance: ${Number(balance).toFixed(2)}</p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setCustomerId("")}>Change</Button>
            </div>
          ) : (
            <>
              <Input placeholder="Search name or email" value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)} className="h-8 text-sm" />
              <div className="max-h-32 overflow-y-auto rounded-md border border-border">
                {(customers as any[]).slice(0, 20).map((c: any) => (
                  <button key={c.id} type="button" onClick={() => setCustomerId(c.id)} className="w-full text-left px-3 py-2 text-sm hover:bg-muted">
                    <div className="font-medium">{c.name || c.legal_name || "—"}</div>
                    <div className="text-xs text-muted-foreground">{c.email} · ${Number(c.wallet_balance ?? 0).toFixed(2)}</div>
                  </button>
                ))}
                {customerSearch && customers.length === 0 && (
                  <div className="px-3 py-2 text-xs text-muted-foreground">No customers found</div>
                )}
              </div>
            </>
          )}
          {willGoNegative && accountAllowsNegative && (
            <div className="flex items-start gap-2 rounded-md border border-border px-3 py-2 text-xs">
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
              <p className="text-muted-foreground">Charge exceeds wallet balance — this account allows a negative balance, so it'll proceed automatically.</p>
            </div>
          )}
          {willGoNegative && !accountAllowsNegative && (
            <div className="space-y-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2">
              <p className="text-xs text-destructive">Charge exceeds this customer's wallet balance.</p>
              <label className="flex items-center gap-2 text-xs">
                <Checkbox checked={allowNegative} onCheckedChange={(v) => setAllowNegative(v === true)} />
                Allow negative balance
              </label>
            </div>
          )}
        </div>
      )}

      <div className="space-y-1">
        <Label className="text-xs">Reason for the change</Label>
        <Textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. Customer paid cash, not PayNow (min 5 characters)"
          rows={2}
          maxLength={300}
          className="text-sm"
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={() => onDone()} disabled={changeMethod.isPending}>Cancel</Button>
        <Button size="sm" onClick={save} disabled={changeMethod.isPending || (draft !== currentMethod && reason.trim().length < 5)}>
          {changeMethod.isPending ? "Saving..." : "Save"}
        </Button>
      </div>
    </div>
  );
};

const CopyIdButton = ({ value }: { value: string }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    if (!value) return;
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <TooltipProvider>
      <Tooltip open={copied || undefined}>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={handleCopy}
            disabled={!value}
            aria-label="Copy booking ID"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right" align="center">{copied ? "Copied!" : "Copy full Booking ID"}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default AdminBookingDetailDialog;
