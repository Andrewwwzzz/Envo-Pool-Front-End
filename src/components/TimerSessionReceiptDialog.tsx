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
}

function fmtDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  if (s < 60) return "< 1m";
  const h = Math.floor(s / 3600);
  const m = Math.ceil((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

const TimerSessionReceiptDialog = ({ session, open, onOpenChange }: Props) => {
  const [copied, setCopied] = useState(false);
  const { data: tables } = useTables(null, null);

  if (!session) return null;
  const t = session;

  const id = String(t._id || t.id || "");
  const shortId = id ? id.slice(-8).toUpperCase() : "—";
  const start = t.startedAt;
  const end = t.endedAt;
  const durationSeconds = Number(t.durationSeconds ?? 0);
  const amount = Number(t.amountCharged ?? 0);
  const discountPercent = Number(t.discountPercent ?? 0);
  const discountAmount = Number(t.discountAmount ?? 0);
  const label = t.tableName || resolveTableLabel(t.tableId, tables as any) || "Table ?";

  const handleCopyId = async () => {
    if (!id) return;
    try {
      await navigator.clipboard.writeText(id);
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
              <DialogTitle className="text-xl gold-gradient">{label}</DialogTitle>
              <DialogDescription className="sr-only">Staff timer session receipt</DialogDescription>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="bg-violet-500/10 text-violet-400 border-violet-500/20">Staff Session</Badge>
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
            <Badge variant="outline" className="bg-muted text-muted-foreground border-border">Completed</Badge>
          </div>
        </DialogHeader>

        <div className="px-6 pb-6 space-y-4">
          {/* Date & Time */}
          <section className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Date</span>
              <span className="font-medium">{start ? fmtDate(start) : "—"}</span>
            </div>

            <div className="rounded-lg border border-border/60 bg-background/40 p-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground tabular-nums">
                  {start ? fmtTime(start) : "—"} – {end ? fmtTime(end) : "—"}
                  {durationSeconds > 0 && (
                    <span className="ml-2 text-xs opacity-70">{fmtDuration(durationSeconds)}</span>
                  )}
                </span>
                <span className="font-medium tabular-nums">${amount.toFixed(2)}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground pt-1">
              <div>
                <div>Start</div>
                <div className="font-medium text-foreground tabular-nums">{start ? fmtDateTimeSG(start) : "—"}</div>
              </div>
              <div>
                <div>End</div>
                <div className="font-medium text-foreground tabular-nums">{end ? fmtDateTimeSG(end) : "—"}</div>
              </div>
              <div className="col-span-2">
                <div>Duration</div>
                <div className="font-medium text-foreground tabular-nums">
                  {durationSeconds > 0 ? fmtDuration(durationSeconds) : "—"}
                </div>
              </div>
            </div>
          </section>

          <Separator className="bg-border/50" />

          {/* Pricing */}
          <section className="space-y-1.5 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-medium tabular-nums">${(amount + discountAmount).toFixed(2)}</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex items-center justify-between text-emerald-500">
                <span>Discount{discountPercent > 0 ? ` (${Math.round(discountPercent)}%)` : ""}</span>
                <span className="tabular-nums">−${discountAmount.toFixed(2)}</span>
              </div>
            )}
            <Separator className="bg-border/50 my-2" />
            <div className="flex items-center justify-between text-base font-bold">
              <span>Total Charged</span>
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
              <span className="text-muted-foreground">Amount Paid</span>
              <span className="font-medium tabular-nums">${amount.toFixed(2)}</span>
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TimerSessionReceiptDialog;
