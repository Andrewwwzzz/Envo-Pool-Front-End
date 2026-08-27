import { useState, useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { useDeviceState, useDeviceControl } from "@/hooks/useDeviceControl";
import { fmtDateSG, fmtTimeSG, fmtDateTimeSG, sgSlotToUTC, getSGDateStr } from "@/lib/sgTime";
import {
  useAdminTables,
  useAdminBookings,
  useAdminCustomers,
  useTableMaintenance,
  useScheduleMaintenance,
  useDeleteMaintenance,
  useBulkScheduleMaintenance,
  useBookTableNow,
} from "@/hooks/useAdmin";
import { useActiveWalkinSessions } from "@/hooks/useWalkin";
import { useTablePendingFnb } from "@/hooks/useFnb";
import { usePricingRules, usePublicHolidaySet } from "@/hooks/usePricing";
import { getCurrentHourlyRate } from "@/lib/pricing";
import { roundCashAmount } from "@/lib/money";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import ReasonDialog from "@/components/admin/ReasonDialog";
import DeletedBanner, { getDeletedInfo, isDeleted as isRecordDeleted } from "@/components/admin/DeletedBanner";
import { Timer, Play, Square, Wrench, DollarSign, Wifi, WifiOff, Power, PowerOff, RotateCcw, Loader2, AlertTriangle, X, Check, Eye, EyeOff, CalendarClock } from "lucide-react";

function ChipStatus({ lastSeen }: { lastSeen: string | null }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 5000);
    return () => clearInterval(id);
  }, []);

  if (!lastSeen) {
    return <span className="flex items-center gap-1 text-xs text-muted-foreground"><span className="h-2 w-2 rounded-full bg-muted-foreground inline-block" />No chip</span>;
  }
  const age = (Date.now() - new Date(lastSeen).getTime()) / 1000;
  if (age <= 10) {
    return <span className="flex items-center gap-1 text-xs text-green-400"><span className="h-2 w-2 rounded-full bg-green-400 inline-block" />Online</span>;
  }
  if (age <= 30) {
    return <span className="flex items-center gap-1 text-xs text-yellow-400"><span className="h-2 w-2 rounded-full bg-yellow-400 inline-block" />Delayed</span>;
  }
  return <span className="flex items-center gap-1 text-xs text-red-400"><span className="h-2 w-2 rounded-full bg-red-400 inline-block" />Offline</span>;
}

function DeviceControlPanel({ hardwareId }: { hardwareId: string | null }) {
  const { state, lastSeen, loading, error } = useDeviceState(hardwareId);
  const { controlDevice, clearOverride, pending } = useDeviceControl(hardwareId);

  if (!hardwareId) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <WifiOff className="h-3 w-3" /> No hardware linked
      </div>
    );
  }

  return (
    <div className="space-y-2 border-t border-border pt-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          {loading && !state ? (
            <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
          ) : (
            <Wifi className={`h-3 w-3 ${state === "ON" ? "text-primary" : "text-muted-foreground"}`} />
          )}
          <span className="text-muted-foreground">Device:</span>
          <Badge variant="outline" className={state === "ON" ? "bg-primary/10 text-primary border-primary/20" : ""}>
            {state ?? "Unknown"}
          </Badge>
        </div>
        <ChipStatus lastSeen={lastSeen} />
      </div>
      {error && <span className="text-xs text-destructive">{error}</span>}
      <div className="flex gap-2">
        <Button size="sm" variant="outline" className="flex-1" onClick={() => controlDevice("ON")} disabled={pending}>
          {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Power className="mr-1 h-3 w-3" />} ON
        </Button>
        <Button size="sm" variant="outline" className="flex-1" onClick={() => controlDevice("OFF")} disabled={pending}>
          {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <PowerOff className="mr-1 h-3 w-3" />} OFF
        </Button>
        <Button size="sm" variant="outline" className="flex-1" onClick={() => clearOverride()} disabled={pending}>
          {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="mr-1 h-3 w-3" />} AUTO
        </Button>
      </div>
    </div>
  );
}

export default function TablesTab() {
  const { data: tables, startTimer, stopTimer, setMaintenance, setBulkMaintenance } = useAdminTables();
  const bulkSchedule = useBulkScheduleMaintenance();
  const { data: bookings } = useAdminBookings();
  const { data: walkinSessions = [] } = useActiveWalkinSessions();
  const [selectedTables, setSelectedTables] = useState<Set<string>>(new Set());
  const [bulkScheduleOpen, setBulkScheduleOpen] = useState(false);
  const [bulkSchedDate, setBulkSchedDate] = useState("");
  const [bulkSchedStart, setBulkSchedStart] = useState("");
  const [bulkSchedEnd, setBulkSchedEnd] = useState("");
  const [bulkSchedReason, setBulkSchedReason] = useState("");
  const { toast } = useToast();
  const [elapsed, setElapsed] = useState<Record<string, number>>({});
  const [bookingCountdown, setBookingCountdown] = useState<Record<string, number>>({});
  const [walkinElapsed, setWalkinElapsed] = useState<Record<string, number>>({});
  const [completedSessions, setCompletedSessions] = useState<Record<string, { seconds: number; cost: number; grossCost?: number; discountPercent?: number; paymentMethod?: "cash" | "paynow" | "wallet"; customerName?: string }>>({});
  const { data: pricingRules = [] } = usePricingRules();
  const phDates = usePublicHolidaySet();
  const [hourlyRate, setHourlyRate] = useState("");
  const [rateTouched, setRateTouched] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const bookingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Prefill the rate preset with whatever's actually in effect right now
  // (per the active pricing rules), instead of a stale hardcoded default —
  // stops updating once staff manually edits the field.
  useEffect(() => {
    if (rateTouched || pricingRules.length === 0) return;
    setHourlyRate(String(getCurrentHourlyRate(pricingRules, phDates)));
  }, [pricingRules, phDates, rateTouched]);

  const rate = parseFloat(hourlyRate) || 0;

  // Compute elapsed from DB-persisted timer_started_at
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

  // Count down to endTime for tables currently held by an active booking
  // (confirmed, or pending_payment within its payment window) — mirrors the
  // pro-rate timer's count-up above, just running the other direction. Also
  // counts UP the elapsed time for tables with an active user walk-in
  // session, which otherwise has no live duration display at all.
  useEffect(() => {
    if (bookingIntervalRef.current) clearInterval(bookingIntervalRef.current);

    const endTimesByTable: Record<string, number> = {};
    const walkinStartByTable: Record<string, number> = {};
    for (const t of (tables || [])) {
      if (t.timer_started_at) continue;
      const tableHwId = t.hardware_id;
      const now = Date.now();
      let soonestEnd: number | null = null;
      for (const b of (bookings || [])) {
        const bTableId = typeof b.tableId === "object" ? b.tableId?._id || b.tableId?.hardware_id : b.tableId;
        if (bTableId !== t.id && bTableId !== tableHwId) continue;
        if (!["pending_payment", "confirmed"].includes(b.status)) continue;
        const bStart = new Date(b.startTime || b.start_time).getTime();
        const bEnd = new Date(b.endTime || b.end_time).getTime();
        if (bStart <= now && bEnd > now && (soonestEnd === null || bEnd < soonestEnd)) {
          soonestEnd = bEnd;
        }
      }
      if (soonestEnd !== null) endTimesByTable[t.id] = soonestEnd;

      const walkin = (walkinSessions as any[]).find((s: any) => {
        const sTableId = s.tableId || s.table_id;
        return sTableId === tableHwId || sTableId === t.id;
      });
      if (walkin) {
        const startedAt = walkin.startedAt || walkin.startTime;
        if (startedAt) walkinStartByTable[t.id] = new Date(startedAt).getTime();
      }
    }

    const countdownIds = Object.keys(endTimesByTable);
    const walkinIds = Object.keys(walkinStartByTable);
    if (countdownIds.length > 0 || walkinIds.length > 0) {
      const tick = () => {
        const now = Date.now();
        const nextCountdown: Record<string, number> = {};
        for (const id of countdownIds) {
          nextCountdown[id] = Math.max(0, Math.floor((endTimesByTable[id] - now) / 1000));
        }
        const nextWalkin: Record<string, number> = {};
        for (const id of walkinIds) {
          nextWalkin[id] = Math.max(0, Math.floor((now - walkinStartByTable[id]) / 1000));
        }
        setBookingCountdown((prev) => ({ ...prev, ...nextCountdown }));
        setWalkinElapsed((prev) => ({ ...prev, ...nextWalkin }));
      };
      tick();
      bookingIntervalRef.current = setInterval(tick, 1000);
    }
    return () => {
      if (bookingIntervalRef.current) clearInterval(bookingIntervalRef.current);
    };
  }, [tables, bookings, walkinSessions]);

  const openTable = (tableId: string) => {
    setCompletedSessions((prev) => {
      const copy = { ...prev };
      delete copy[tableId];
      return copy;
    });
    startTimer.mutate({ tableId, hourlyRate: rate });
  };

  // Close-table dialog — table id currently being closed (dialog owns its own state)
  const [closeTarget, setCloseTarget] = useState<string | null>(null);

  const openCloseDialog = (tableId: string) => {
    setCloseTarget(tableId);
  };

  // Book-now dialog — fixed-duration, paid-upfront admin booking for walk-in guests
  const [bookTarget, setBookTarget] = useState<string | null>(null);

  const openBookDialog = (tableId: string) => {
    setBookTarget(tableId);
  };

  const onTableClosed = (tableId: string, info: { seconds: number; cost: number; grossCost: number; discountPercent: number; paymentMethod: "cash" | "paynow" | "wallet"; customerName: string }) => {
    setCompletedSessions((prev) => ({ ...prev, [tableId]: info }));
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
              onChange={(e) => { setRateTouched(true); setHourlyRate(e.target.value); }}
              className="w-[120px]"
            />
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Auto-filled with the current active pricing rate — edit to override. Discount (if any) is entered when closing the table.
          </p>
        </CardContent>
      </Card>

      {/* Bulk maintenance action bar */}
      {(tables || []).length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <Checkbox
                  checked={selectedTables.size === (tables || []).filter(t => !t.timer_started_at).length && selectedTables.size > 0}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setSelectedTables(new Set((tables || []).filter(t => !t.timer_started_at).map(t => t.id)));
                    } else {
                      setSelectedTables(new Set());
                    }
                  }}
                />
                <CardTitle className="text-sm font-medium">
                  {selectedTables.size > 0 ? `${selectedTables.size} table${selectedTables.size > 1 ? "s" : ""} selected` : "Select tables for bulk action"}
                </CardTitle>
              </div>
              {selectedTables.size > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => {
                      setBulkMaintenance.mutate({ tableIds: [...selectedTables], maintenance: true }, {
                        onSuccess: () => setSelectedTables(new Set()),
                      });
                    }}
                    disabled={setBulkMaintenance.isPending}
                  >
                    {setBulkMaintenance.isPending ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Wrench className="mr-2 h-3 w-3" />}
                    Set Maintenance
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setBulkMaintenance.mutate({ tableIds: [...selectedTables], maintenance: false }, {
                        onSuccess: () => setSelectedTables(new Set()),
                      });
                    }}
                    disabled={setBulkMaintenance.isPending}
                  >
                    <Check className="mr-2 h-3 w-3" /> Set Available
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setBulkScheduleOpen(true)}
                    disabled={setBulkMaintenance.isPending}
                  >
                    <Timer className="mr-2 h-3 w-3" /> Schedule Maintenance
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setSelectedTables(new Set())} disabled={setBulkMaintenance.isPending}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Manage Tables</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {(tables || []).slice().sort((a, b) => a.table_number - b.table_number).map((t) => {
              const isRunning = !!t.timer_started_at;
              const seconds = elapsed[t.id] ?? 0;
              const session = completedSessions[t.id];
              const tableRate = isRunning ? Number(t.hourly_rate ?? rate) : rate;

              // Check if table has active bookings blocking timer open
              const now = new Date();
              const tableHwId = t.hardware_id;
              const hasActiveBooking = !isRunning && (bookings || []).some((b) => {
                const bTableId = typeof b.tableId === "object" ? b.tableId?._id || b.tableId?.hardware_id : b.tableId;
                const matchesId = bTableId === t.id || bTableId === tableHwId;
                if (!matchesId) return false;
                if (!["pending_payment", "confirmed"].includes(b.status)) return false;
                const bStart = new Date(b.startTime || b.start_time);
                const bEnd = new Date(b.endTime || b.end_time);
                return bStart <= now && bEnd > now;
              });
              // Check for user-initiated walk-in sessions
              const hasUserWalkin = !isRunning && (walkinSessions as any[]).some((s: any) => {
                const sTableId = s.tableId || s.table_id;
                return sTableId === tableHwId || sTableId === t.id;
              });

              const isMaintenance = !(isRunning || hasUserWalkin) && t.status === "maintenance";

              // Derive the single source-of-truth display state
              const displayState: "running" | "walkin" | "booked" | "maintenance" | "available" =
                isRunning      ? "running"
                : hasUserWalkin ? "walkin"
                : hasActiveBooking ? "booked"
                : isMaintenance ? "maintenance"
                : "available";

              const badgeClass =
                displayState === "running"     ? "bg-primary/10 text-primary border-primary/20"
                : displayState === "walkin"    ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                : displayState === "booked"    ? "bg-accent/20 text-accent-foreground border-accent/30"
                : displayState === "maintenance" ? "bg-destructive/10 text-destructive border-destructive/20"
                : "bg-muted/30 text-muted-foreground border-border";

              const badgeLabel =
                displayState === "running"     ? "In Use"
                : displayState === "walkin"    ? "Walk-in Active"
                : displayState === "booked"    ? "Booked"
                : displayState === "maintenance" ? "Maintenance"
                : "Available";

              return (
                <div key={t.id} className={`rounded-xl border p-4 space-y-3 ${
                  displayState === "running"     ? "border-primary/30 bg-primary/5"
                  : displayState === "walkin"    ? "border-amber-500/30 bg-amber-500/5"
                  : displayState === "booked"    ? "border-accent/30 bg-accent/5"
                  : displayState === "maintenance" ? "border-destructive/30 bg-destructive/5"
                  : "border-border"
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {!isRunning && (
                        <Checkbox
                          checked={selectedTables.has(t.id)}
                          onCheckedChange={(checked) => {
                            setSelectedTables((prev) => {
                              const next = new Set(prev);
                              checked ? next.add(t.id) : next.delete(t.id);
                              return next;
                            });
                          }}
                        />
                      )}
                      <p className="font-medium">Table {t.table_number}</p>
                    </div>
                    <Badge variant="outline" className={badgeClass}>
                      {badgeLabel}
                    </Badge>
                  </div>

                  {/* Timer display */}
                  <div className="flex items-center gap-2">
                    <Timer className={`h-4 w-4 ${displayState === "booked" ? "text-accent-foreground" : displayState === "walkin" ? "text-amber-400" : "text-muted-foreground"}`} />
                    <span className={`font-mono text-xl ${isRunning ? "text-primary" : displayState === "booked" ? "text-accent-foreground" : displayState === "walkin" ? "text-amber-400" : "text-muted-foreground"}`}>
                      {displayState === "booked" ? formatTime(bookingCountdown[t.id] ?? 0)
                        : displayState === "walkin" ? formatTime(walkinElapsed[t.id] ?? 0)
                        : formatTime(isRunning ? seconds : (session?.seconds ?? 0))}
                    </span>
                    {displayState === "booked" && (
                      <span className="text-xs text-muted-foreground">left</span>
                    )}
                    {displayState === "walkin" && (
                      <span className="text-xs text-muted-foreground">played</span>
                    )}
                  </div>

                  {/* Live cost */}
                  {isRunning && (
                    <div className="flex items-center gap-2 text-sm">
                      <DollarSign className="h-4 w-4 text-primary" />
                      <span className="font-medium text-primary">${calculateLiveCost(seconds, tableRate).toFixed(2)}</span>
                      <span className="text-muted-foreground">@ ${tableRate}/hr</span>
                    </div>
                  )}

                  {/* Completed session summary */}
                  {!isRunning && session && (
                    <div className="rounded-lg bg-muted/50 p-3 space-y-1">
                      <p className="text-sm font-medium">Session Complete — Invoice Generated</p>
                      <p className="text-sm text-muted-foreground">
                        Duration: {formatTime(session.seconds)} · Cost: <strong>${session.cost.toFixed(2)}</strong>
                      </p>
                      {(session.discountPercent ?? 0) > 0 && (
                        <p className="text-xs text-emerald-500">
                          {session.discountPercent}% discount applied (gross ${session.grossCost?.toFixed(2)})
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {session.paymentMethod === "cash"
                          ? "Paid via cash"
                          : session.paymentMethod === "paynow"
                          ? "Paid via PayNow"
                          : `Paid via ${session.customerName || "customer"}'s wallet`}
                      </p>
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="space-y-2">
                    {isRunning ? (
                      <Button size="sm" variant="destructive" onClick={() => openCloseDialog(t.id)} className="w-full">
                        <Square className="mr-2 h-3 w-3" /> Close Table
                      </Button>
                    ) : (
                      <>
                        <Button size="sm" variant="default" onClick={() => openTable(t.id)} className="w-full" disabled={hasActiveBooking || hasUserWalkin} title={hasActiveBooking ? "Table has an active booking" : hasUserWalkin ? "Table has an active walk-in session" : isMaintenance ? "Table is under maintenance — public booking/walk-in is blocked, but staff can still open it (e.g. for a private event)" : "Pay-by-time — bill is calculated when the table is closed"}>
                          <Play className="mr-2 h-3 w-3" /> Open Table (Pro-rate)
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => openBookDialog(t.id)} className="w-full" disabled={hasActiveBooking || hasUserWalkin} title={hasActiveBooking ? "Table has an active booking" : hasUserWalkin ? "Table has an active walk-in session" : "Set a fixed duration and pay upfront — like a customer booking"}>
                          <CalendarClock className="mr-2 h-3 w-3" /> Book Now (Fixed Duration)
                        </Button>
                      </>
                    )}
                    {!isRunning && (
                      <>
                        <ScheduleMaintenanceButton tableId={t.id} tableNumber={t.table_number} />
                        <Button
                          size="sm"
                          variant={isMaintenance ? "outline" : "secondary"}
                          onClick={() => setMaintenance.mutate({ tableId: t.id, maintenance: !isMaintenance })}
                          className="w-full"
                          disabled={false}
                        >
                          <Wrench className="mr-2 h-3 w-3" />
                          {isMaintenance ? "Reopen Table" : "Close Table"}
                        </Button>
                      </>
                    )}
                  </div>

                  {/* Scheduled maintenance windows */}
                  {!isRunning && <TableMaintenanceList tableId={t.id} />}

                  {/* Device Control */}
                  <DeviceControlPanel hardwareId={t.hardware_id} />
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Bulk Schedule Maintenance dialog */}
      <Dialog open={bulkScheduleOpen} onOpenChange={(o) => { setBulkScheduleOpen(o); if (!o) { setBulkSchedDate(""); setBulkSchedStart(""); setBulkSchedEnd(""); setBulkSchedReason(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule Maintenance — {selectedTables.size} table{selectedTables.size > 1 ? "s" : ""}</DialogTitle>
            <DialogDescription>Set a maintenance window for all selected tables.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="bulk-maint-date">Date</Label>
              <Input id="bulk-maint-date" type="date" value={bulkSchedDate} min={getSGDateStr(new Date())} onChange={(e) => setBulkSchedDate(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="bulk-maint-start">Start Time</Label>
                <Input id="bulk-maint-start" type="time" value={bulkSchedStart} onChange={(e) => setBulkSchedStart(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="bulk-maint-end">End Time</Label>
                <Input id="bulk-maint-end" type="time" value={bulkSchedEnd} onChange={(e) => setBulkSchedEnd(e.target.value)} />
              </div>
            </div>
            <div>
              <Label htmlFor="bulk-maint-reason">Reason</Label>
              <Input id="bulk-maint-reason" placeholder="e.g. Scheduled closure" value={bulkSchedReason} onChange={(e) => setBulkSchedReason(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkScheduleOpen(false)} disabled={bulkSchedule.isPending}>Cancel</Button>
            <Button
              disabled={bulkSchedule.isPending || !bulkSchedDate || !bulkSchedStart || !bulkSchedEnd || !bulkSchedReason.trim()}
              onClick={async () => {
                const [y, m, d] = bulkSchedDate.split("-").map(Number);
                const sgDate = new Date(y, (m || 1) - 1, d || 1);
                const startUTC = sgSlotToUTC(sgDate, bulkSchedStart);
                const endUTC   = sgSlotToUTC(sgDate, bulkSchedEnd);
                if (endUTC.getTime() <= startUTC.getTime()) {
                  toast({ title: "Invalid time range", description: "End time must be after start time.", variant: "destructive" });
                  return;
                }
                try {
                  await bulkSchedule.mutateAsync({
                    tableIds: [...selectedTables],
                    startTime: startUTC.toISOString(),
                    endTime:   endUTC.toISOString(),
                    reason:    bulkSchedReason.trim(),
                  });
                  setBulkScheduleOpen(false);
                  setSelectedTables(new Set());
                } catch {}
              }}
            >
              {bulkSchedule.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
              Schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CloseTableDialog
        tables={tables || []}
        elapsed={elapsed}
        rate={rate}
        closeTarget={closeTarget}
        stopTimer={stopTimer}
        onOpenChange={(o) => { if (!o) setCloseTarget(null); }}
        onClosed={onTableClosed}
      />

      <BookNowDialog
        tables={tables || []}
        bookTarget={bookTarget}
        onOpenChange={(o) => { if (!o) setBookTarget(null); }}
      />
    </div>
  );
}

function CloseTableDialog({
  tables,
  elapsed,
  rate,
  closeTarget,
  stopTimer,
  onOpenChange,
  onClosed,
}: {
  tables: any[];
  elapsed: Record<string, number>;
  rate: number;
  closeTarget: string | null;
  stopTimer: ReturnType<typeof useAdminTables>["stopTimer"];
  onOpenChange: (open: boolean) => void;
  onClosed: (tableId: string, info: { seconds: number; cost: number; grossCost: number; discountPercent: number; paymentMethod: "cash" | "paynow" | "wallet"; customerName: string }) => void;
}) {
  const { toast } = useToast();
  const [discountInput, setDiscountInput] = useState("0");
  const [rateInput, setRateInput] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"wallet" | "cash" | "paynow">("wallet");
  const [customerId, setCustomerId] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [allowNegative, setAllowNegative] = useState(false);
  const { data: customers = [] } = useAdminCustomers(customerSearch);
  const { data: pendingFnb = [] } = useTablePendingFnb(closeTarget);
  const fnbTotal = Math.round(pendingFnb.reduce((s, o: any) => s + o.totalPrice, 0) * 100) / 100;

  useEffect(() => {
    if (closeTarget) {
      setDiscountInput("0");
      const defaultRate = tables.find((tb) => tb.id === closeTarget)?.hourly_rate ?? rate;
      setRateInput(String(defaultRate));
      setPaymentMethod("wallet");
      setCustomerId("");
      setCustomerSearch("");
      setCustomerName("");
      setAllowNegative(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [closeTarget]);

  const table = tables.find((tb) => tb.id === closeTarget);
  const defaultRate = table?.hourly_rate ?? rate;
  const tableRate = rateInput === "" ? defaultRate : (Number(rateInput) || 0);
  const seconds = closeTarget ? (elapsed[closeTarget] ?? 0) : 0;
  const gross = Math.round((seconds / 3600) * Number(tableRate) * 100) / 100;
  const discountPct = Math.min(100, Math.max(0, parseFloat(discountInput) || 0));
  const discountAmt = Math.round(gross * (discountPct / 100) * 100) / 100;
  const timeChargeExact = Math.max(0, Math.round((gross - discountAmt) * 100) / 100);
  const finalCostExact = Math.round((timeChargeExact + fnbTotal) * 100) / 100;
  // Cash has no 1c/5c coins to give as change — round the bill to the
  // nearest 10c. Wallet/PayNow settle to the exact cent.
  const finalCost = paymentMethod === "cash" ? roundCashAmount(finalCostExact) : finalCostExact;

  const selectedCustomer = customers.find((c: any) => c.id === customerId);
  const walletBalance = selectedCustomer?.wallet_balance ?? 0;
  const willGoNegative = paymentMethod === "wallet" && !!selectedCustomer && finalCost > walletBalance;
  // Shared/utility accounts (e.g. "Guest Account Table N") are flagged to always
  // allow a negative balance — no need for staff to tick the checkbox each time.
  const accountAllowsNegative = !!selectedCustomer?.allow_negative_balance;
  const effectiveAllowNegative = allowNegative || accountAllowsNegative;

  const handleConfirm = () => {
    if (!closeTarget) return;
    if (paymentMethod === "wallet" && !customerId) {
      toast({ title: "Select a customer", description: "A customer must be selected to charge their wallet.", variant: "destructive" });
      return;
    }
    if (paymentMethod === "wallet" && willGoNegative && !effectiveAllowNegative) {
      toast({ title: "Insufficient wallet balance", description: "Check 'Allow negative balance' to proceed anyway.", variant: "destructive" });
      return;
    }
    const tableId = closeTarget;
    const startedAt = table?.timer_started_at
      ? new Date(table.timer_started_at).toISOString()
      : new Date(Date.now() - seconds * 1000).toISOString();

    onClosed(tableId, { seconds, cost: finalCost, grossCost: gross, discountPercent: discountPct, paymentMethod, customerName });

    stopTimer.mutate(
      {
        tableId,
        durationSeconds: seconds,
        hourlyRate: Number(tableRate),
        discountPercent: discountPct,
        startedAt,
        customerId: customerId || null,
        paymentMethod,
        allowNegative: effectiveAllowNegative,
      },
      {
        onSuccess: () => {
          const methodLabel = paymentMethod === "wallet" ? `charged to ${customerName || "customer"}'s wallet` : `paid via ${paymentMethod === "paynow" ? "PayNow" : "cash"}`;
          toast({
            title: "Table closed",
            description: `$${finalCost.toFixed(2)} ${methodLabel}.` + (fnbTotal > 0 ? ` (incl. $${fnbTotal.toFixed(2)} F&B)` : ""),
          });
        },
        onError: (err: Error) => {
          toast({ title: "Failed to close table", description: err.message, variant: "destructive" });
        },
      }
    );
    onOpenChange(false);
  };

  return (
    <Dialog open={!!closeTarget} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Close Table</DialogTitle>
          <DialogDescription>
            {closeTarget && (
              <>
                Table {table?.table_number} · {seconds}s @ ${tableRate}/hr — gross ${gross.toFixed(2)}
                {discountPct > 0 && <> · after {discountPct}% off: ${timeChargeExact.toFixed(2)}</>}
                {fnbTotal > 0 && <> + F&B ${fnbTotal.toFixed(2)}</>}
                {(discountPct > 0 || fnbTotal > 0) && <> — total: <strong>${finalCost.toFixed(2)}</strong></>}
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {pendingFnb.length > 0 && (
            <div className="rounded-md border border-border/50 divide-y divide-border/50">
              <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground bg-muted/30">F&B charged to this table</div>
              {pendingFnb.map((o: any) => (
                <div key={o._id} className="flex justify-between px-3 py-1.5 text-sm">
                  <span>{o.productName}</span>
                  <span className="text-muted-foreground">${o.totalPrice.toFixed(2)}</span>
                </div>
              ))}
              <div className="flex justify-between px-3 py-1.5 text-sm font-medium">
                <span>F&B Total</span>
                <span>${fnbTotal.toFixed(2)}</span>
              </div>
            </div>
          )}
          <div className="space-y-2">
            <Label>Rate ($/hr)</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={rateInput}
              onChange={(e) => setRateInput(e.target.value)}
              placeholder={String(defaultRate)}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">Defaults to ${defaultRate}/hr — edit to bill this session at a different rate.</p>
          </div>

          <div className="space-y-2">
            <Label>Discount (%)</Label>
            <Input
              type="number"
              step="1"
              min="0"
              max="100"
              value={discountInput}
              onChange={(e) => setDiscountInput(e.target.value)}
              placeholder="0"
            />
            <p className="text-xs text-muted-foreground">Leave at 0 for no discount.</p>
          </div>

          <div className="space-y-2">
            <Label>Payment Method</Label>
            <div className="grid grid-cols-3 gap-2">
              {(["wallet", "cash", "paynow"] as const).map((m) => (
                <Button
                  key={m}
                  type="button"
                  size="sm"
                  variant={paymentMethod === m ? "default" : "outline"}
                  onClick={() => setPaymentMethod(m)}
                >
                  {m === "wallet" ? "Wallet" : m === "cash" ? "Cash" : "PayNow"}
                </Button>
              ))}
            </div>
            {paymentMethod !== "wallet" && (
              <p className="text-xs text-muted-foreground">
                Paid at the counter — doesn't touch any wallet, and counts toward Cash/PayNow Top-Ups.
              </p>
            )}
          </div>

          {(
            <div className="space-y-2">
              <Label>Customer {paymentMethod === "wallet" && <span className="text-destructive">*</span>}</Label>
              {selectedCustomer ? (
                <div className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                  <div>
                    <p className="font-medium">{customerName}</p>
                    <p className="text-xs text-muted-foreground">Balance: ${walletBalance.toFixed(2)}</p>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => { setCustomerId(""); setCustomerName(""); }}>Change</Button>
                </div>
              ) : (
                <>
                  <Input placeholder="Search name or email" value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)} />
                  <div className="max-h-36 overflow-y-auto rounded-md border border-border">
                    {customers.slice(0, 20).map((c: any) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => { setCustomerId(c.id); setCustomerName(c.name || c.legal_name || c.email); }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-muted"
                      >
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
                <div className="flex items-start gap-2 rounded-md border border-border px-3 py-2 text-sm">
                  <AlertTriangle className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                  <p className="text-muted-foreground">Charge exceeds wallet balance — this account allows a negative balance, so it'll proceed automatically.</p>
                </div>
              )}
              {willGoNegative && !accountAllowsNegative && (
                <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm">
                  <AlertTriangle className="h-4 w-4 mt-0.5 text-destructive shrink-0" />
                  <div className="space-y-2">
                    <p className="text-destructive">Charge exceeds this customer's wallet balance.</p>
                    <label className="flex items-center gap-2 text-xs">
                      <Checkbox checked={allowNegative} onCheckedChange={(v) => setAllowNegative(v === true)} />
                      Allow negative balance
                    </label>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={stopTimer.isPending}>
            {stopTimer.isPending ? "Closing..." : "Confirm & Close"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const DURATION_PRESETS = [30, 60, 90, 120, 180];

function BookNowDialog({
  tables,
  bookTarget,
  onOpenChange,
}: {
  tables: any[];
  bookTarget: string | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const bookTableNow = useBookTableNow();
  const { data: pricingRules = [] } = usePricingRules();
  const phDates = usePublicHolidaySet();

  const [durationInput, setDurationInput] = useState("60");
  const [rateInput, setRateInput] = useState("");
  const [discountInput, setDiscountInput] = useState("0");
  const [paymentMethod, setPaymentMethod] = useState<"wallet" | "cash" | "paynow">("wallet");
  const [customerId, setCustomerId] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [allowNegative, setAllowNegative] = useState(false);
  const { data: customers = [] } = useAdminCustomers(customerSearch);

  useEffect(() => {
    if (bookTarget) {
      setDurationInput("60");
      setRateInput(String(getCurrentHourlyRate(pricingRules, phDates)));
      setDiscountInput("0");
      setPaymentMethod("wallet");
      setCustomerId("");
      setCustomerSearch("");
      setCustomerName("");
      setAllowNegative(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookTarget]);

  const table = tables.find((tb) => tb.id === bookTarget);
  const durationMinutes = Math.max(0, parseInt(durationInput, 10) || 0);
  const rate = Math.max(0, parseFloat(rateInput) || 0);

  const gross = Math.round((durationMinutes / 60) * rate * 100) / 100;
  const discountPct = Math.min(100, Math.max(0, parseFloat(discountInput) || 0));
  const discountAmt = Math.round(gross * (discountPct / 100) * 100) / 100;
  const estimatedTotalExact = Math.max(0, Math.round((gross - discountAmt) * 100) / 100);
  // Cash has no 1c/5c coins to give as change — round the bill to the
  // nearest 10c. Wallet/PayNow settle to the exact cent.
  const estimatedTotal = paymentMethod === "cash" ? roundCashAmount(estimatedTotalExact) : estimatedTotalExact;

  const selectedCustomer = customers.find((c: any) => c.id === customerId);
  const walletBalance = selectedCustomer?.wallet_balance ?? 0;
  const willGoNegative = paymentMethod === "wallet" && !!selectedCustomer && estimatedTotal > walletBalance;
  const accountAllowsNegative = !!selectedCustomer?.allow_negative_balance;
  const effectiveAllowNegative = allowNegative || accountAllowsNegative;

  const handleConfirm = () => {
    if (!bookTarget) return;
    if (paymentMethod === "wallet" && !customerId) {
      toast({ title: "Select a customer", description: "A customer must be selected to charge their wallet.", variant: "destructive" });
      return;
    }
    if (durationMinutes < 15) {
      toast({ title: "Duration too short", description: "Minimum booking duration is 15 minutes.", variant: "destructive" });
      return;
    }
    if (paymentMethod === "wallet" && willGoNegative && !effectiveAllowNegative) {
      toast({ title: "Insufficient wallet balance", description: "Check 'Allow negative balance' to proceed anyway.", variant: "destructive" });
      return;
    }

    bookTableNow.mutate(
      {
        tableId: bookTarget,
        durationMinutes,
        customerId: customerId || null,
        paymentMethod,
        allowNegative: effectiveAllowNegative,
        discountPercent: discountPct,
        hourlyRate: rate,
      },
      {
        onSuccess: (data: any) => {
          const amount = data?.finalAmount ?? estimatedTotal;
          const methodLabel = paymentMethod === "wallet" ? `charged to ${customerName || "customer"}'s wallet` : `paid via ${paymentMethod === "paynow" ? "PayNow" : "cash"}`;
          toast({
            title: "Table booked",
            description: `${durationMinutes} min · $${Number(amount).toFixed(2)} ${methodLabel}.`,
          });
        },
        onError: (err: Error) => {
          toast({ title: "Failed to book table", description: err.message, variant: "destructive" });
        },
      }
    );
    onOpenChange(false);
  };

  return (
    <Dialog open={!!bookTarget} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Book Table Now</DialogTitle>
          <DialogDescription>
            {bookTarget && (
              <>
                Table {table?.table_number} · fixed duration, paid upfront — like a booking, for a walk-in guest.
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Rate ($/hr)</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={rateInput}
              onChange={(e) => setRateInput(e.target.value)}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">Auto-filled with the current active pricing rate — click in to edit and bill this booking at a different flat rate.</p>
          </div>

          <div className="space-y-2">
            <Label>Duration</Label>
            <div className="grid grid-cols-5 gap-2">
              {DURATION_PRESETS.map((m) => (
                <Button
                  key={m}
                  type="button"
                  size="sm"
                  variant={durationMinutes === m ? "default" : "outline"}
                  onClick={() => setDurationInput(String(m))}
                >
                  {m < 60 ? `${m}m` : `${m / 60}h`}
                </Button>
              ))}
            </div>
            <Input
              type="number"
              step="15"
              min="15"
              max="720"
              value={durationInput}
              onChange={(e) => setDurationInput(e.target.value)}
              placeholder="Minutes"
            />
            <p className="text-xs text-muted-foreground">Custom minutes — 15 min to 12 hours.</p>
          </div>

          <div className="rounded-md border border-border px-3 py-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Estimated price</span>
              <span className="font-medium">${gross.toFixed(2)}</span>
            </div>
            {discountPct > 0 && (
              <div className="flex items-center justify-between text-emerald-500 text-xs mt-1">
                <span>{discountPct}% discount</span>
                <span>-${discountAmt.toFixed(2)}</span>
              </div>
            )}
            <div className="flex items-center justify-between mt-1 border-t border-border pt-1">
              <span className="text-muted-foreground">Est. total</span>
              <span className="font-semibold">${estimatedTotal.toFixed(2)}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Final price is computed at confirm — includes the customer's membership discount/free minutes if they have one active.</p>
          </div>

          <div className="space-y-2">
            <Label>Discount (%)</Label>
            <Input
              type="number"
              step="1"
              min="0"
              max="100"
              value={discountInput}
              onChange={(e) => setDiscountInput(e.target.value)}
              placeholder="0"
            />
            <p className="text-xs text-muted-foreground">Leave at 0 for no extra discount.</p>
          </div>

          <div className="space-y-2">
            <Label>Payment Method</Label>
            <div className="grid grid-cols-3 gap-2">
              {(["wallet", "cash", "paynow"] as const).map((m) => (
                <Button
                  key={m}
                  type="button"
                  size="sm"
                  variant={paymentMethod === m ? "default" : "outline"}
                  onClick={() => setPaymentMethod(m)}
                >
                  {m === "wallet" ? "Wallet" : m === "cash" ? "Cash" : "PayNow"}
                </Button>
              ))}
            </div>
            {paymentMethod !== "wallet" && (
              <p className="text-xs text-muted-foreground">
                Paid at the counter — doesn't touch any wallet, and counts toward Cash/PayNow Top-Ups.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Customer {paymentMethod === "wallet" && <span className="text-destructive">*</span>}</Label>
            {selectedCustomer ? (
              <div className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                <div>
                  <p className="font-medium">{customerName}</p>
                  <p className="text-xs text-muted-foreground">Balance: ${walletBalance.toFixed(2)}</p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => { setCustomerId(""); setCustomerName(""); }}>Change</Button>
              </div>
            ) : (
              <>
                <Input placeholder="Search name or email" value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)} />
                <div className="max-h-36 overflow-y-auto rounded-md border border-border">
                  {customers.slice(0, 20).map((c: any) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => { setCustomerId(c.id); setCustomerName(c.name || c.legal_name || c.email); }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-muted"
                    >
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
              <div className="flex items-start gap-2 rounded-md border border-border px-3 py-2 text-sm">
                <AlertTriangle className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                <p className="text-muted-foreground">Charge exceeds wallet balance — this account allows a negative balance, so it'll proceed automatically.</p>
              </div>
            )}
            {willGoNegative && !accountAllowsNegative && (
              <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm">
                <AlertTriangle className="h-4 w-4 mt-0.5 text-destructive shrink-0" />
                <div className="space-y-2">
                  <p className="text-destructive">Charge exceeds this customer's wallet balance.</p>
                  <label className="flex items-center gap-2 text-xs">
                    <Checkbox checked={allowNegative} onCheckedChange={(v) => setAllowNegative(v === true)} />
                    Allow negative balance
                  </label>
                </div>
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleConfirm} disabled={bookTableNow.isPending}>
            {bookTableNow.isPending ? "Booking..." : "Confirm & Book"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ScheduleMaintenanceButton({ tableId, tableNumber }: { tableId: string; tableNumber: number }) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [reason, setReason] = useState("");
  const schedule = useScheduleMaintenance();
  const { toast } = useToast();

  const reset = () => { setDate(""); setStartTime(""); setEndTime(""); setReason(""); };

  const handleSchedule = async () => {
    if (!date || !startTime || !endTime) {
      toast({ title: "Missing fields", description: "Date, start and end times are required.", variant: "destructive" });
      return;
    }
    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      toast({ title: "Missing reason", description: "Reason is required to schedule maintenance.", variant: "destructive" });
      return;
    }
    const [y, m, d] = date.split("-").map(Number);
    const sgDate = new Date(y, (m || 1) - 1, d || 1);
    const startUTC = sgSlotToUTC(sgDate, startTime);
    const endUTC = sgSlotToUTC(sgDate, endTime);
    if (endUTC.getTime() <= startUTC.getTime()) {
      toast({ title: "Invalid time range", description: "End time must be after start time.", variant: "destructive" });
      return;
    }
    try {
      await schedule.mutateAsync({
        tableId,
        startTime: startUTC.toISOString(),
        endTime: endUTC.toISOString(),
        reason: trimmedReason,
      });
      reset();
      setOpen(false);
    } catch {
      // toast handled in hook
    }
  };

  return (
    <>
      <Button size="sm" variant="default" onClick={() => setOpen(true)} className="w-full">
        <Wrench className="mr-2 h-3 w-3" /> Schedule Maintenance
      </Button>
      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule Maintenance — Table {tableNumber}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="maint-date">Date</Label>
              <Input id="maint-date" type="date" value={date} min={getSGDateStr(new Date())} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="maint-start">Start Time</Label>
                <Input id="maint-start" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="maint-end">End Time</Label>
                <Input id="maint-end" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
              </div>
            </div>
            <div>
              <Label htmlFor="maint-reason">Reason</Label>
              <Input id="maint-reason" placeholder="e.g. Felt replacement" value={reason} onChange={(e) => setReason(e.target.value)} required />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={schedule.isPending}>Cancel</Button>
            <Button onClick={handleSchedule} disabled={schedule.isPending || !date || !startTime || !endTime || !reason.trim()}>
              {schedule.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
              Schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function TableMaintenanceList({ tableId }: { tableId: string }) {
  const [hideDeleted, setHideDeleted] = useState(false);
  const { data: windows } = useTableMaintenance(tableId, hideDeleted ? "default" : "all");
  const remove = useDeleteMaintenance();
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [detailRecord, setDetailRecord] = useState<any | null>(null);
  const list = (Array.isArray(windows) ? windows : []).filter((w: any) => {
    if (isRecordDeleted(w)) return true;
    const end = new Date(w.endTime || w.end_time);
    return !isNaN(end.getTime()) && end.getTime() > Date.now();
  }).sort((a: any, b: any) =>
    new Date(a.startTime || a.start_time).getTime() - new Date(b.startTime || b.start_time).getTime()
  );

  if (!list.length) return null;

  return (
    <div className="space-y-1.5 pt-1">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">Scheduled Maintenance</p>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 px-2 text-xs"
          onClick={() => setHideDeleted((v) => !v)}
        >
          {hideDeleted ? <Eye className="h-3 w-3 mr-1" /> : <EyeOff className="h-3 w-3 mr-1" />}
          {hideDeleted ? "Show Deleted" : "Hide Deleted"}
        </Button>
      </div>
      {list.map((w: any) => {
        const id = w._id || w.id;
        const start = w.startTime || w.start_time;
        const end = w.endTime || w.end_time;
        const deleted = isRecordDeleted(w);
        return (
          <div
            key={id}
            className={`flex items-start justify-between gap-2 rounded-md border border-border px-2 py-1.5 text-xs ${deleted ? "bg-muted/10 text-muted-foreground cursor-pointer" : "bg-muted/30"}`}
            onClick={deleted ? () => setDetailRecord(w) : undefined}
          >
            <div className="min-w-0 flex-1">
              <p className={`font-medium ${deleted ? "line-through" : ""}`}>{fmtDateSG(start)} · {fmtTimeSG(start)}–{fmtTimeSG(end)}</p>
              {w.reason && <p className="text-muted-foreground truncate">{w.reason}</p>}
            </div>
            {deleted ? (
              <Badge variant="outline" className="bg-muted whitespace-nowrap text-[10px]">Deleted</Badge>
            ) : (
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6 shrink-0 text-destructive hover:text-destructive"
                onClick={(e) => { e.stopPropagation(); setDeleteTarget({ id, tableId }); }}
                disabled={remove.isPending}
                title="Remove"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        );
      })}

      <ReasonDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="Remove maintenance window?"
        label="Reason for removal"
        placeholder="e.g. cancelled by ops"
        confirmLabel="Remove"
        destructive
        loading={remove.isPending}
        onConfirm={async (reason) => {
          if (!deleteTarget) return;
          try {
            await remove.mutateAsync({ id: deleteTarget.id, tableId: deleteTarget.tableId, reason });
            setDeleteTarget(null);
          } catch {}
        }}
      />

      <Dialog open={!!detailRecord} onOpenChange={(o) => !o && setDetailRecord(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Maintenance Window</DialogTitle>
          </DialogHeader>
          {detailRecord && (
            <div className="space-y-3">
              <DeletedBanner info={getDeletedInfo(detailRecord)} />
              <div className="opacity-70 text-sm space-y-1.5">
                <div className="flex justify-between gap-3"><span className="text-muted-foreground">Start</span><span>{fmtDateTimeSG(detailRecord.startTime || detailRecord.start_time)}</span></div>
                <div className="flex justify-between gap-3"><span className="text-muted-foreground">End</span><span>{fmtDateTimeSG(detailRecord.endTime || detailRecord.end_time)}</span></div>
                {detailRecord.reason && <div className="flex justify-between gap-3"><span className="text-muted-foreground">Reason</span><span>{detailRecord.reason}</span></div>}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}


