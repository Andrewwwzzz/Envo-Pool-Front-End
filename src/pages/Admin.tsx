import { useState, useEffect, useRef } from "react";
import { useAdminTables, useAdminBookings } from "@/hooks/useAdmin";
import { useActiveWalkinSessions } from "@/hooks/useWalkin";
import { useDeviceControl } from "@/hooks/useDeviceControl";
import { getTableLabel } from "@/lib/tableLabel";
import { ChargeWalletDialog } from "@/components/admin/ChargeWalletDialog";
import { OperatingHoursSection } from "@/components/admin/OperatingHoursSection";
import { DeviceControlPanel } from "@/components/admin/DeviceControlPanel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Timer, DollarSign, Play, Square, Wrench } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface TableData {
  id: string;
  table_number: number;
  hardware_id: string;
  timer_started_at?: string;
  hourly_rate?: number;
  status: string;
}

interface CompletedSession {
  seconds: number;
  cost: number;
  grossCost?: number;
  discountPercent?: number;
}

function TablesTab() {
  const { data: tables, startTimer, stopTimer, setMaintenance } = useAdminTables();
  const { data: bookings } = useAdminBookings();
  const { data: walkinSessions = [] } = useActiveWalkinSessions();
  const { toast } = useToast();

  const [elapsed, setElapsed] = useState<Record<string, number>>({});
  const [completedSessions, setCompletedSessions] = useState<Record<string, CompletedSession>>({});
  const [hourlyRate, setHourlyRate] = useState("20");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Charge wallet dialog state
  const [chargeDialogOpen, setChargeDialogOpen] = useState(false);
  const [chargeDialogData, setChargeDialogData] = useState<{
    tableId: string;
    userId?: string;
    amount: number;
    description: string;
  } | null>(null);

  // Close table dialog state
  const [closeTarget, setCloseTarget] = useState<string | null>(null);
  const [closeDiscountInput, setCloseDiscountInput] = useState("0");

  const rate = parseFloat(hourlyRate) || 0;

  // Timer elapsed calculation
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);

    const activeTables = (tables || []).filter((t) => t.timer_started_at);
    if (activeTables.length > 0) {
      const tick = () => {
        const now = Date.now();
        const newElapsed: Record<string, number> = {};
        for (const t of activeTables) {
          newElapsed[t.id] = Math.floor((now - new Date(t.timer_started_at!).getTime()) / 1000);
        }
        setElapsed((prev) => ({ ...prev, ...newElapsed }));
      };
      tick();
      intervalRef.current = setInterval(tick, 1000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [tables]);

  const openTable = (tableId: string) => {
    setCompletedSessions((prev) => {
      const copy = { ...prev };
      delete copy[tableId];
      return copy;
    });
    startTimer.mutate({ tableId, hourlyRate: rate });
  };

  const openCloseDialog = (tableId: string) => {
    setCloseDiscountInput("0");
    setCloseTarget(tableId);
  };

  const confirmCloseTable = () => {
    if (!closeTarget) return;
    const tableId = closeTarget;
    const table = (tables || []).find((t) => t.id === tableId);
    const tableRate = table?.hourly_rate ?? rate;
    const discountPct = Math.min(100, Math.max(0, parseFloat(closeDiscountInput) || 0));
    const seconds = elapsed[tableId] ?? 0;
    const grossCost = Math.round((seconds / 3600) * Number(tableRate) * 100) / 100;
    const discountAmount = Math.round(grossCost * (discountPct / 100) * 100) / 100;
    const cost = Math.max(0, Math.round((grossCost - discountAmount) * 100) / 100);

    setCompletedSessions((prev) => ({ ...prev, [tableId]: { seconds, cost, grossCost, discountPercent: discountPct } }));
    const startedAt = table?.timer_started_at
      ? new Date(table.timer_started_at).toISOString()
      : new Date(Date.now() - seconds * 1000).toISOString();

    const payload = {
      tableId,
      durationSeconds: seconds,
      hourlyRate: Number(tableRate),
      discountPercent: discountPct,
      startedAt,
    };

    stopTimer.mutate(payload, {
      onSuccess: () => {
        setCloseTarget(null);
        toast({ title: "Table closed successfully", description: "Ready to charge customer wallet or complete booking." });
      },
      onError: () => {
        toast({ title: "Error", description: "Failed to close table. Try again.", variant: "destructive" });
      },
    });
  };

  const openChargeWallet = (session: CompletedSession) => {
    if (!closeTarget) return;
    const table = (tables || []).find((t) => t.id === closeTarget);
    if (!table) return;

    setChargeDialogData({
      tableId: closeTarget,
      amount: session.cost,
      description: `Table ${table.table_number} - ${Math.floor(session.seconds / 60)} minutes @ $${(table?.hourly_rate ?? rate).toFixed(2)}/hr`,
    });
    setChargeDialogOpen(true);
  };

  const formatTime = (totalSeconds: number) => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const calculateLiveCost = (seconds: number, tableRate: number) => {
    return Math.round((seconds / 3600) * tableRate * 100) / 100;
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Hourly Rate Preset</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Label>Rate ($/hr)</Label>
            <Input
              type="number"
              step="0.01"
              value={hourlyRate}
              onChange={(e) => setHourlyRate(e.target.value)}
              className="w-[120px]"
            />
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Discount (if any) is entered when closing the table.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Manage Tables</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {(tables || []).map((t) => {
              const isRunning = !!t.timer_started_at;
              const seconds = elapsed[t.id] ?? 0;
              const session = completedSessions[t.id];
              const tableRate = isRunning ? Number(t.hourly_rate ?? rate) : rate;

              const now = new Date();
              const tableHwId = t.hardware_id;
              const hasActiveBooking = !isRunning && (bookings || []).some((b: any) => {
                const bTableId = typeof b.tableId === "object" ? b.tableId?._id || b.tableId?.hardware_id : b.tableId;
                const matchesId = bTableId === t.id || bTableId === tableHwId;
                if (!matchesId) return false;
                if (!["pending_payment", "confirmed"].includes(b.status)) return false;
                const bStart = new Date(b.startTime || b.start_time);
                const bEnd = new Date(b.endTime || b.end_time);
                return bStart <= now && bEnd > now;
              });

              const hasUserWalkin = !isRunning && (walkinSessions as any[]).some((s: any) => {
                const sTableId = s.tableId || s.table_id;
                return sTableId === tableHwId || sTableId === t.id;
              });

              const isMaintenance = !(isRunning || hasUserWalkin) && t.status === "maintenance";

              return (
                <div
                  key={t.id}
                  className={`rounded-xl border p-4 space-y-3 ${
                    isMaintenance ? "border-destructive/30 bg-destructive/5" : "border-border"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <p className="font-medium">Table {t.table_number}</p>
                    <Badge
                      variant="outline"
                      className={
                        isRunning
                          ? "bg-primary/10 text-primary border-primary/20"
                          : isMaintenance
                          ? "bg-destructive/10 text-destructive border-destructive/20"
                          : hasActiveBooking
                          ? "bg-accent/20 text-accent-foreground border-accent/30"
                          : "capitalize"
                      }
                    >
                      {t.status === "in_use"
                        ? "In Use"
                        : t.status === "maintenance"
                        ? "Maintenance"
                        : t.status === "booked"
                        ? "Booked"
                        : "Available"}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-2">
                    <Timer className="h-4 w-4 text-muted-foreground" />
                    <span className={`font-mono text-xl ${isRunning ? "text-primary" : "text-muted-foreground"}`}>
                      {formatTime(isRunning ? seconds : session?.seconds ?? 0)}
                    </span>
                  </div>

                  {isRunning && (
                    <div className="flex items-center gap-2 text-sm">
                      <DollarSign className="h-4 w-4 text-primary" />
                      <span className="font-medium text-primary">${calculateLiveCost(seconds, tableRate).toFixed(2)}</span>
                      <span className="text-muted-foreground">@ ${tableRate}/hr</span>
                    </div>
                  )}

                  {!isRunning && session && (
                    <div className="rounded-lg bg-muted/50 p-3 space-y-1">
                      <p className="text-sm font-medium">Session Complete</p>
                      <p className="text-sm text-muted-foreground">
                        Duration: {formatTime(session.seconds)} · Cost: <strong>${session.cost.toFixed(2)}</strong>
                      </p>
                      {(session.discountPercent ?? 0) > 0 && (
                        <p className="text-xs text-emerald-500">
                          {session.discountPercent}% discount applied (gross ${session.grossCost?.toFixed(2)})
                        </p>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openChargeWallet(session)}
                        className="w-full mt-2"
                      >
                        <DollarSign className="mr-2 h-3 w-3" /> Charge Customer Wallet
                      </Button>
                    </div>
                  )}

                  <div className="space-y-2">
                    {isRunning ? (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => openCloseDialog(t.id)}
                        className="w-full"
                      >
                        <Square className="mr-2 h-3 w-3" /> Close Table
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => openTable(t.id)}
                        className="w-full"
                        disabled={hasActiveBooking || isMaintenance}
                        title={
                          hasActiveBooking
                            ? "Table has an active booking"
                            : isMaintenance
                            ? "Table is under maintenance"
                            : undefined
                        }
                      >
                        <Play className="mr-2 h-3 w-3" /> Open Table
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <OperatingHoursSection />

      {/* Close table dialog */}
      <Dialog open={!!closeTarget} onOpenChange={(o) => !o && setCloseTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Close Table</DialogTitle>
            <DialogDescription>
              {closeTarget && (() => {
                const t = (tables || []).find((tb) => tb.id === closeTarget);
                const tableRate = t?.hourly_rate ?? rate;
                const seconds = elapsed[closeTarget] ?? 0;
                const gross = Math.round((seconds / 3600) * Number(tableRate) * 100) / 100;
                const discountPct = Math.min(100, Math.max(0, parseFloat(closeDiscountInput) || 0));
                const discountAmt = Math.round(gross * (discountPct / 100) * 100) / 100;
                const final = Math.max(0, Math.round((gross - discountAmt) * 100) / 100);
                return (
                  <>
                    Table {t?.table_number} · {formatTime(seconds)} @ ${tableRate}/hr — gross ${gross.toFixed(2)}
                    {discountPct > 0 && <> · after {discountPct}% off: <strong>${final.toFixed(2)}</strong></>}
                  </>
                );
              })()}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label>Discount (%)</Label>
            <Input
              type="number"
              step="1"
              min="0"
              max="100"
              value={closeDiscountInput}
              onChange={(e) => setCloseDiscountInput(e.target.value)}
              placeholder="0"
              autoFocus
            />
            <p className="text-xs text-muted-foreground">Leave at 0 for no discount.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCloseTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmCloseTable} disabled={stopTimer.isPending}>
              {stopTimer.isPending ? "Closing..." : "Confirm & Close"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Charge wallet dialog */}
      {chargeDialogData && (
        <ChargeWalletDialog
          open={chargeDialogOpen}
          onOpenChange={setChargeDialogOpen}
          userId={chargeDialogData.userId || ""}
          defaultAmount={chargeDialogData.amount}
          defaultDescription={chargeDialogData.description}
          defaultCategory="manual_timer"
          onCharged={() => {
            setChargeDialogOpen(false);
            setCloseTarget(null);
            toast({
              title: "Payment recorded",
              description: "Customer wallet charged and invoice updated.",
            });
          }}
        />
      )}
    </div>
  );
}

export default TablesTab;
