import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Copy, Check } from "lucide-react";
import { fmtDateSG as fmtDate, fmtTimeSG as fmtTime, fmtDateTimeSG } from "@/lib/sgTime";
import { useTables } from "@/hooks/useBooking";
import { getTableLabel as resolveTableLabel } from "@/lib/tableLabel";

interface Props {
  session: any | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  live?: boolean;
}

function fmtDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  if (s < 60) return "< 1m";
  const h = Math.floor(s / 3600);
  const m = Math.ceil((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

const WalkinReceiptDialog = ({ session, open, onOpenChange, live }: Props) => {
  const [copied, setCopied] = useState(false);
  const { data: tables } = useTables(null, null);

  if (!session) return null;
  const s = session;

  const id = String(s._id || s.id || "");
  const shortId = id ? id.slice(-8).toUpperCase() : "—";
  const start = s.startedAt || s.startTime;
  const end = s.stoppedAt || s.endedAt || s.endTime;
  const isLive = !!live || s.status === "active";

  const fallbackSecs = start
    ? Math.max(0, Math.floor(((isLive ? Date.now() : (end ? new Date(end).getTime() : 0)) - new Date(start).getTime()) / 1000))
    : 0;
  const explicitSecs = Number(
    s.durationSeconds ?? (s.durationMinutes ? s.durationMinutes * 60 : 0)
  );
  const durationSeconds = explicitSecs > 0 ? explicitSecs : fallbackSecs;

  const amount = Number(
    isLive ? (s.runningCost ?? 0) : (s.amountCharged ?? s.totalCost ?? 0)
  );
  const baseTotal = Number(s.baseTotal ?? 0);
  const membershipDiscountAmount = Number(s.membershipDiscountAmount ?? s.membershipDiscount ?? s.membership_discount_amount ?? s.membership_discount ?? 0);
  const membershipDiscountPercent = Number(s.membershipDiscountPercent ?? s.membership_discount_percent ?? 0);
  const freeMinutesCredit = Number(s.freeMinutesCredit ?? s.free_minutes_credit ?? 0);
  const freeMinutesApplied = Number(s.freeMinutesApplied ?? s.free_minutes_applied ?? 0);
  const hasBreakdown = baseTotal > 0 && (membershipDiscountAmount > 0 || freeMinutesCredit > 0);
  const effectiveSubtotal = baseTotal > 0 ? baseTotal : amount;

  const rawSegments: any[] = Array.isArray(s.pricingSegments)
    ? s.pricingSegments
    : Array.isArray(s.pricing_segments)
    ? s.pricing_segments
    : [];
  const segments = rawSegments.map((seg: any) => {
    const sStart = seg.startTime || seg.start_time || seg.startedAt;
    const sEnd = seg.endTime || seg.end_time || seg.endedAt;
    const sRate = Number(seg.rate ?? seg.ratePerHour ?? seg.hourlyRate ?? 0);
    const sCost = Number(seg.cost ?? seg.amount ?? 0);
    return { sStart, sEnd, sRate, sCost };
  });

  const tableLabel = resolveTableLabel(s.tableId, tables as any) || "Table ?";

  const handleCopyId = async () => {
    if (!id) return;
    try {
      await navigator.clipboard.writeText(id);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* noop */ }
  };

  const statusBadgeClass = isLive
    ? "bg-green-500/20 text-green-400 border-green-500/30"
    : "bg-muted text-muted-foreground border-border";
  const statusText = isLive ? "In Progress" : "Completed";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card border-border p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <DialogTitle className="text-xl gold-gradient">{tableLabel}</DialogTitle>
              <DialogDescription className="sr-only">Walk-in session receipt</DialogDescription>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="bg-accent/20 text-accent-foreground border-accent/30">Walk-in</Badge>
                <button
                  onClick={handleCopyId}
                  className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors font-mono"
                  aria-label="Copy session ID"
                >
                  #{shortId}
                  {copied ? <Check className="h-3 w-3 text-primary" /> : <Copy className="h-3 w-3" />}
                </button>
              </div>
            </div>
            <Badge variant="outline" className={statusBadgeClass}>{statusText}</Badge>
          </div>
        </DialogHeader>

        <div className="px-6 pb-6 space-y-4">
          {/* Date & Time */}
          <section className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Date</span>
              <span className="font-medium">{start ? fmtDate(start) : "—"}</span>
            </div>

            <div className="rounded-lg border border-border/60 bg-background/40 p-3 space-y-1.5">
              {segments.length > 0 ? (
                segments.map((seg, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground tabular-nums">
                      {seg.sStart ? fmtTime(seg.sStart) : "—"} – {seg.sEnd ? fmtTime(seg.sEnd) : (isLive ? "now" : "—")}
                      <span className="ml-2 text-xs opacity-70">@ ${seg.sRate.toFixed(2)}/hr</span>
                    </span>
                    <span className="font-medium tabular-nums">= ${seg.sCost.toFixed(2)}</span>
                  </div>
                ))
              ) : (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground tabular-nums">
                    {start ? fmtTime(start) : "—"} – {isLive ? "now" : (end ? fmtTime(end) : "—")}
                    {durationSeconds > 0 && (
                      <span className="ml-2 text-xs opacity-70">{fmtDuration(durationSeconds)}</span>
                    )}
                  </span>
                  <span className="font-medium tabular-nums">${effectiveSubtotal.toFixed(2)}</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground pt-1">
              <div>
                <div>Start</div>
                <div className="font-medium text-foreground tabular-nums">{start ? fmtDateTimeSG(start) : "—"}</div>
              </div>
              <div>
                <div>End</div>
                <div className="font-medium text-foreground tabular-nums">
                  {isLive ? "In Progress" : (end ? fmtDateTimeSG(end) : "—")}
                </div>
              </div>
              <div className="col-span-2">
                <div>Duration</div>
                <div className="font-medium text-foreground tabular-nums">{fmtDuration(durationSeconds)}</div>
              </div>
            </div>
          </section>

          <Separator className="bg-border/50" />

          {/* Pricing breakdown */}
          <section className="space-y-1.5 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-medium tabular-nums">${effectiveSubtotal.toFixed(2)}</span>
            </div>

            {hasBreakdown && membershipDiscountAmount > 0 && (
              <div className="flex items-center justify-between text-emerald-500">
                <span>
                  Membership Discount{membershipDiscountPercent > 0 ? ` (${Math.round(membershipDiscountPercent)}%)` : ""}
                </span>
                <span className="tabular-nums">−${membershipDiscountAmount.toFixed(2)}</span>
              </div>
            )}

            {hasBreakdown && freeMinutesCredit > 0 && (
              <div className="flex items-center justify-between text-emerald-500">
                <span>Free Minutes Credit{freeMinutesApplied > 0 ? ` (${freeMinutesApplied}m)` : ""}</span>
                <span className="tabular-nums">−${freeMinutesCredit.toFixed(2)}</span>
              </div>
            )}

            <Separator className="bg-border/50 my-2" />

            <div className="flex items-center justify-between text-base font-bold">
              <span>{isLive ? "Running Total" : "Total Charged"}</span>
              <span className="gold-gradient tabular-nums">${amount.toFixed(2)}</span>
            </div>
          </section>

          <Separator className="bg-border/50" />

          {/* Payment */}
          <section className="space-y-1.5 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Payment Method</span>
              <span className="font-medium">Wallet</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Amount {isLive ? "Running" : "Paid"}</span>
              <span className="font-medium tabular-nums">${amount.toFixed(2)}</span>
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default WalkinReceiptDialog;
