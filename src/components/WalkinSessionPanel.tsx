import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Timer, AlertTriangle, Square } from "lucide-react";
import { toast } from "sonner";
import { useMyWalkinSession, useStopWalkin } from "@/hooks/useWalkin";
import { getTableLabel } from "@/lib/tableLabel";
import { fmtDateTimeSG } from "@/lib/sgTime";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";

function formatElapsed(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export default function WalkinSessionPanel() {
  const { data: session } = useMyWalkinSession();
  const stop = useStopWalkin();
  const [now, setNow] = useState(Date.now());
  const [conflictMsg, setConflictMsg] = useState<string | null>(null);
  const [insufficientMsg, setInsufficientMsg] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<any | null>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const onConflict = (e: Event) => {
      const detail = (e as CustomEvent).detail || {};
      const msg = detail.message || "A booking conflict was detected for your walk-in session.";
      setConflictMsg(msg);
      toast.error(msg);
    };
    const onInsufficient = (e: Event) => {
      const detail = (e as CustomEvent).detail || {};
      const msg = detail.message || "Insufficient wallet balance. Your remaining balance has been deducted.";
      setInsufficientMsg(msg);
      toast.error(msg);
    };
    window.addEventListener("walkin_booking_conflict", onConflict);
    window.addEventListener("walkin_insufficient_balance", onInsufficient);
    return () => {
      window.removeEventListener("walkin_booking_conflict", onConflict);
      window.removeEventListener("walkin_insufficient_balance", onInsufficient);
    };
  }, []);

  const handleStop = async () => {
    try {
      const result: any = await stop.mutateAsync();
      const r = result?.session ?? result;
      setReceipt({
        duration: r?.durationMinutes ?? Math.floor((Date.now() - new Date(session!.startTime).getTime()) / 60000),
        amount: r?.amountCharged ?? r?.totalCost ?? r?.runningCost ?? 0,
        walletBalance: r?.walletBalanceAfter ?? r?.walletBalance ?? null,
      });
    } catch (err: any) {
      toast.error(err?.message || "Failed to stop session");
    }
  };

  if (!session && !receipt && !conflictMsg && !insufficientMsg) return null;

  return (
    <>
      {conflictMsg && (
        <Alert variant="destructive" className="border-destructive/40">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Booking conflict</AlertTitle>
          <AlertDescription>{conflictMsg}</AlertDescription>
        </Alert>
      )}
      {insufficientMsg && (
        <Alert variant="destructive" className="border-destructive/40">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Insufficient balance</AlertTitle>
          <AlertDescription>{insufficientMsg}</AlertDescription>
        </Alert>
      )}

      {session && (
        <Card className="card-premium border-accent/40">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Timer className="h-5 w-5 text-accent" />
              Walk-in Session — {getTableLabel(session.tableId)}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Started</p>
                <p className="font-medium">{fmtDateTimeSG(session.startTime)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Elapsed</p>
                <p className="font-mono text-2xl font-bold gold-gradient">
                  {formatElapsed(now - new Date(session.startTime).getTime())}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Running Cost</p>
                <p className="font-mono text-2xl font-bold">
                  ${Number(session.runningCost ?? 0).toFixed(2)}
                </p>
              </div>
            </div>
            <div className="flex justify-end">
              <Button
                variant="destructive"
                onClick={handleStop}
                disabled={stop.isPending}
                className="gap-2"
              >
                <Square className="h-4 w-4" />
                {stop.isPending ? "Stopping..." : "Stop Session"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={!!receipt} onOpenChange={(o) => !o && setReceipt(null)}>
        <DialogContent className="card-premium">
          <DialogHeader>
            <DialogTitle>Session Receipt</DialogTitle>
            <DialogDescription>Your walk-in session has ended.</DialogDescription>
          </DialogHeader>
          {receipt && (
            <div className="space-y-2 py-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Duration</span>
                <span className="font-medium">{receipt.duration} min</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Amount charged</span>
                <span className="font-medium">${Number(receipt.amount).toFixed(2)}</span>
              </div>
              {receipt.walletBalance !== null && (
                <div className="flex justify-between text-sm border-t border-border pt-2 mt-2">
                  <span className="text-muted-foreground">New wallet balance</span>
                  <span className="font-medium gold-gradient">
                    ${Number(receipt.walletBalance).toFixed(2)}
                  </span>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setReceipt(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
