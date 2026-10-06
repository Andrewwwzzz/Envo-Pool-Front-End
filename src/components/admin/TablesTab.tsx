import { useState, useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { useDeviceState, useDeviceControl, useBulkDeviceControl } from "@/hooks/useDeviceControl";
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
  useSessionPreviewCost,
  useClosePreview,
  useBookNowPreview,
  useAdminPromoCodes,
  isBookingsAffected,
  PricingMode,
} from "@/hooks/useAdmin";
import { useAuth } from "@/contexts/AuthContext";
import { useActiveWalkinSessions } from "@/hooks/useWalkin";
import { useTablePendingFnb } from "@/hooks/useFnb";
import { useCustomerActiveMembership } from "@/hooks/useMembership";
import { useValidatePromo, PromoValidation } from "@/hooks/usePromo";
import { MoveBookingDialog } from "@/components/admin/MoveBookingDialog";
import { ArrowRightLeft } from "lucide-react";
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

// Approved staff limits (D9) — the server enforces the same.
const STAFF_MAX_DISCOUNT = 20;

/** 3725 → "1:02:05" */
const formatDuration = (totalSeconds: number) => {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

const PRICING_LABELS: Record<PricingMode, string> = {
  time_of_day: "Time-of-day pricing",
  self_practice: "Self-practice",
  custom: "Custom rate",
};

/** Time-of-day / Self-practice for everyone; Custom rate only when `allowCustom`. */
function PricingModePicker({ value, onChange, allowCustom }: { value: PricingMode; onChange: (m: PricingMode) => void; allowCustom: boolean }) {
  const modes: PricingMode[] = allowCustom ? ["time_of_day", "self_practice", "custom"] : ["time_of_day", "self_practice"];
  return (
    <div className={`grid gap-2 ${allowCustom ? "grid-cols-3" : "grid-cols-2"}`}>
      {modes.map((m) => (
        <Button key={m} type="button" size="sm" variant={value === m ? "default" : "outline"} onClick={() => onChange(m)}>
          {PRICING_LABELS[m]}
        </Button>
      ))}
    </div>
  );
}

const PRICING_HELP: Record<PricingMode, string> = {
  time_of_day: "Charged at the rates set in Settings → Pricing, split correctly wherever the price changes.",
  self_practice: "Charged at the self-practice rate set in Marketing → Promos. No member perks. Any time no self-practice rate covers is charged at the normal price.",
  custom: "One flat hourly rate for the whole session — admin only.",
};

/** Staff are capped at 20%; nobody can go over 100%. */
function discountLimitError(pct: number, isAdminUser: boolean): string | null {
  if (pct > 100) return "A discount can't be more than 100%.";
  if (pct > STAFF_MAX_DISCOUNT && !isAdminUser) return `Staff can give up to ${STAFF_MAX_DISCOUNT}% — a bigger discount needs an admin.`;
  return null;
}

/** Discount (%) with its required reason. Returns the error, if any. */
function discountProblem(pct: number, reason: string, isAdminUser: boolean): string | null {
  if (pct <= 0) return null;
  return discountLimitError(pct, isAdminUser) ?? (reason.trim() ? null : "Give a reason for the discount.");
}

/** Discount (%) plus its reason. Staff see the 20% limit. */
function DiscountField({ value, onChange, reason, onReasonChange, isAdminUser, note }: {
  value: string; onChange: (v: string) => void; reason: string; onReasonChange: (v: string) => void; isAdminUser: boolean; note?: string;
}) {
  const pct = Math.max(0, parseFloat(value) || 0);
  // Over the limit shows straight away; a missing reason is checked on confirm.
  const limitError = discountLimitError(pct, isAdminUser);
  return (
    <div className="space-y-2">
      <Label>Discount (%)</Label>
      <Input type="number" step="1" min="0" max={isAdminUser ? 100 : STAFF_MAX_DISCOUNT} value={value} onChange={(e) => onChange(e.target.value)} placeholder="0" />
      {pct > 0 && (
        <Input placeholder="Reason for the discount (required)" value={reason} onChange={(e) => onReasonChange(e.target.value)} />
      )}
      {limitError
        ? <p className="text-xs text-destructive">{limitError}</p>
        : <p className="text-xs text-muted-foreground">Leave at 0 for no discount.{!isAdminUser && ` Up to ${STAFF_MAX_DISCOUNT}% — more needs an admin.`}{note ? ` ${note}` : ""}</p>}
    </div>
  );
}

/** What happens when a wallet charge is more than the balance (D9). */
function NegativeBalanceNotice({ willGoNegative, accountAllowsNegative, isAdminUser, allowNegative, onAllowNegative }: {
  willGoNegative: boolean; accountAllowsNegative: boolean; isAdminUser: boolean; allowNegative: boolean; onAllowNegative: (v: boolean) => void;
}) {
  if (!willGoNegative) return null;
  if (accountAllowsNegative) {
    return (
      <div className="flex items-start gap-2 rounded-md border border-border px-3 py-2 text-sm">
        <AlertTriangle className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
        <p className="text-muted-foreground">Charge exceeds wallet balance — this is a shared account that allows a negative balance, so it'll proceed automatically.</p>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm">
      <AlertTriangle className="h-4 w-4 mt-0.5 text-destructive shrink-0" />
      <div className="space-y-2">
        <p className="text-destructive">Charge exceeds this customer's wallet balance.</p>
        {isAdminUser ? (
          <label className="flex items-center gap-2 text-xs">
            <Checkbox checked={allowNegative} onCheckedChange={(v) => onAllowNegative(v === true)} />
            Allow negative balance
          </label>
        ) : (
          <p className="text-xs text-muted-foreground">Ask the customer to top up, take Cash or PayNow instead, or ask an admin.</p>
        )}
      </div>
    </div>
  );
}

/** Member badge tick-boxes — wallet payments only (D11); none with self-practice (D2). */
function MembershipPerks({ membership, selfPractice, applyDiscount, onApplyDiscount, applyFreeMinutes, onApplyFreeMinutes }: {
  membership: ActiveMembership | null | undefined; selfPractice: boolean; applyDiscount: boolean; onApplyDiscount: (v: boolean) => void; applyFreeMinutes: boolean; onApplyFreeMinutes: (v: boolean) => void;
}) {
  if (!membership) return null;
  if (selfPractice) {
    return <p className="rounded-md border border-border px-3 py-2 text-xs text-muted-foreground">Self-practice pricing — member perks don't apply.</p>;
  }
  return (
    <div className="space-y-1.5 rounded-md border border-border px-3 py-2">
      {membership.discountPercent > 0 && (
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={applyDiscount} onCheckedChange={(v) => onApplyDiscount(v === true)} />
          Apply {membership.discountPercent}% membership discount
        </label>
      )}
      {membership.freeMinutesPerVisit > 0 && (
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={applyFreeMinutes} onCheckedChange={(v) => onApplyFreeMinutes(v === true)} />
          Apply {membership.freeMinutesPerVisit} free minutes
        </label>
      )}
      {membership.unlimitedFreeMinutes && (
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={applyFreeMinutes} onCheckedChange={(v) => onApplyFreeMinutes(v === true)} />
          Apply free self-practice (whole bill waived)
        </label>
      )}
    </div>
  );
}

type TableRow = NonNullable<ReturnType<typeof useAdminTables>["data"]>[number];
type ActiveMembership = NonNullable<ReturnType<typeof useCustomerActiveMembership>["data"]>;
type AffectedBooking = { id: string; customer: string; startTime: string; endTime: string; status: string };
// Customers appear only once something is typed (D26) — opening the selector
// must not put a list of customers, their emails and balances on screen.
const MIN_CUSTOMER_SEARCH = 2;
function CustomerResults({ search, customers, loading, onPick }: { search: string; customers: any[]; loading: boolean; onPick: (c: any) => void }) {
  if (search.trim().length < MIN_CUSTOMER_SEARCH) {
    return <p className="px-1 text-xs text-muted-foreground">Type the customer's name or email to find them.</p>;
  }
  if (loading && customers.length === 0) return <p className="px-1 text-xs text-muted-foreground">Searching…</p>;
  return (
    <div className="max-h-36 overflow-y-auto rounded-md border border-border">
      {customers.slice(0, 20).map((c) => (
        <button key={c.id} type="button" onClick={() => onPick(c)} className="w-full text-left px-3 py-2 text-sm hover:bg-muted">
          <div className="font-medium">{c.name || c.legal_name || "—"}</div>
          <div className="text-xs text-muted-foreground">{c.email} · ${Number(c.wallet_balance ?? 0).toFixed(2)}</div>
        </button>
      ))}
      {customers.length === 0 && <div className="px-3 py-2 text-xs text-muted-foreground">No customers found</div>}
    </div>
  );
}
type AffectedGroup = { label: string; bookings: AffectedBooking[]; inUseNow?: boolean };

/** Lists the bookings a maintenance change would affect; continues only once staff confirm. */
function BookingsAffectedDialog({ groups, onCancel, onConfirm, loading }: { groups: AffectedGroup[] | null; onCancel: () => void; onConfirm: () => void; loading?: boolean }) {
  return (
    <Dialog open={!!groups} onOpenChange={(o) => { if (!o && !loading) onCancel(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Bookings affected</DialogTitle>
          <DialogDescription>
            Move these bookings to another table or contact the customers before closing the table. Continue only once that's done.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-72 space-y-3 overflow-y-auto">
          {(groups || []).map((g) => (
            <div key={g.label} className="space-y-1">
              <p className="text-sm font-medium">{g.label}</p>
              {g.inUseNow && <p className="text-xs text-amber-500">In use right now.</p>}
              {g.bookings.map((b) => (
                <div key={b.id} className="flex justify-between gap-3 rounded-md border border-border px-3 py-1.5 text-xs">
                  <span>{b.customer}</span>
                  <span className="text-muted-foreground">{fmtDateSG(b.startTime)} · {fmtTimeSG(b.startTime)}–{fmtTimeSG(b.endTime)}{b.status === "pending_payment" ? " · awaiting payment" : ""}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={loading}>Go back</Button>
          <Button variant="destructive" onClick={onConfirm} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            I've dealt with them — continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeviceControlPanel({ hardwareId }: { hardwareId: string | null }) {
  const { state, lastSeen, mode, loading, error } = useDeviceState(hardwareId);
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
          {/* Whether the light follows AUTO or a manual ON/OFF set by staff (D3). */}
          {mode && (
            <span className={`text-xs ${mode === "AUTO" ? "text-muted-foreground" : "font-medium text-amber-500"}`}>
              {mode === "AUTO" ? "AUTO" : mode === "MANUAL_ON" ? "Manual ON" : "Manual OFF"}
            </span>
          )}
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
  const { controlDevices, pending: bulkPowerPending } = useBulkDeviceControl();
  const { data: bookings } = useAdminBookings();
  const { data: walkinSessions = [] } = useActiveWalkinSessions();
  const [selectedTables, setSelectedTables] = useState<Set<string>>(new Set());
  const [bulkScheduleOpen, setBulkScheduleOpen] = useState(false);
  const [bulkSchedDate, setBulkSchedDate] = useState("");
  const [bulkSchedStart, setBulkSchedStart] = useState("");
  const [bulkSchedEnd, setBulkSchedEnd] = useState("");
  const [bulkSchedReason, setBulkSchedReason] = useState("");
  const [moveTarget, setMoveTarget] = useState<any | null>(null);
  const { toast } = useToast();
  const [elapsed, setElapsed] = useState<Record<string, number>>({});
  const [bookingCountdown, setBookingCountdown] = useState<Record<string, number>>({});
  const [walkinElapsed, setWalkinElapsed] = useState<Record<string, number>>({});
  const [completedSessions, setCompletedSessions] = useState<Record<string, { seconds: number; cost: number; grossCost?: number; discountPercent?: number; paymentMethod?: "cash" | "paynow" | "wallet"; customerName?: string; fnbTotal?: number }>>({});
  const { user } = useAuth();
  const isAdminUser = user?.role === "admin";
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const bookingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Status changes (single or bulk) need a reason; tables with bookings are
  // listed for staff to deal with before they continue (D22/D23).
  const [statusTarget, setStatusTarget] = useState<{ tableIds: string[]; maintenance: boolean; title: string } | null>(null);
  // The dialog keeps the last target's wording while it closes, so it doesn't flip to the other wording mid-fade.
  const [lastStatusTarget, setLastStatusTarget] = useState(statusTarget);
  if (statusTarget && statusTarget !== lastStatusTarget) setLastStatusTarget(statusTarget);
  const shownStatus = statusTarget ?? lastStatusTarget;
  const [affected, setAffected] = useState<{ groups: AffectedGroup[]; retry: () => Promise<void> } | null>(null);
  const [affectedLoading, setAffectedLoading] = useState(false);
  const tableLabel = (id: string) => `Table ${(tables || []).find((t) => t.id === id)?.table_number ?? ""}`;

  const changeStatus = async (tableIds: string[], maintenance: boolean, reason: string, acknowledgeBookings = false) => {
    if (tableIds.length === 1) {
      try {
        await setMaintenance.mutateAsync({ tableId: tableIds[0], maintenance, reason, acknowledgeBookings });
        setSelectedTables(new Set());
      } catch (e) {
        if (isBookingsAffected(e)) {
          setAffected({ groups: [{ label: tableLabel(tableIds[0]), bookings: e.data.bookings || [] }], retry: () => changeStatus(tableIds, maintenance, reason, true) });
        }
      }
      return;
    }
    const result = await setBulkMaintenance.mutateAsync({ tableIds, maintenance, reason, acknowledgeBookings });
    setSelectedTables(new Set());
    if (result.blocked.length) {
      setAffected({
        groups: result.blocked.map((b) => ({ label: tableLabel(b.tableId), bookings: b.bookings })),
        retry: () => changeStatus(result.blocked.map((b) => b.tableId), maintenance, reason, true),
      });
    }
  };

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

  // Open-table dialog — pricing is chosen per table, every time (D15): it
  // starts on time-of-day, and a custom rate is offered to admins only.
  const [openTarget, setOpenTarget] = useState<string | null>(null);
  const openTable = (tableId: string, pricingMode: PricingMode, hourlyRate?: number) => {
    setCompletedSessions((prev) => {
      const copy = { ...prev };
      delete copy[tableId];
      return copy;
    });
    startTimer.mutate({ tableId, pricingMode, hourlyRate }, { onSuccess: () => setOpenTarget(null) });
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

  const onTableClosed = (tableId: string, info: { seconds: number; cost: number; grossCost: number; discountPercent: number; paymentMethod: "cash" | "paynow" | "wallet"; customerName: string; fnbTotal?: number }) => {
    setCompletedSessions((prev) => ({ ...prev, [tableId]: info }));
  };

  const formatTime = (totalSeconds: number) => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="space-y-4">
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
                    onClick={() => setStatusTarget({ tableIds: [...selectedTables], maintenance: true, title: `Put ${selectedTables.size} table${selectedTables.size > 1 ? "s" : ""} under maintenance?` })}
                    disabled={setBulkMaintenance.isPending}
                  >
                    {setBulkMaintenance.isPending ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Wrench className="mr-2 h-3 w-3" />}
                    Set Maintenance
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setStatusTarget({ tableIds: [...selectedTables], maintenance: false, title: `Make ${selectedTables.size} table${selectedTables.size > 1 ? "s" : ""} available?` })}
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
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      const hwIds = (tables || []).filter(t => selectedTables.has(t.id) && t.hardware_id).map(t => t.hardware_id);
                      if (hwIds.length === 0) {
                        toast({ title: "No linked chips in selection", description: "None of the selected tables have hardware linked.", variant: "destructive" });
                        return;
                      }
                      const { total, failed } = await controlDevices(hwIds, "ON");
                      toast({
                        title: failed > 0 ? `Turned ON ${total - failed}/${total} table(s)` : `Turned ON ${total} table(s)`,
                        variant: failed > 0 ? "destructive" : undefined,
                      });
                      setSelectedTables(new Set());
                    }}
                    disabled={bulkPowerPending}
                  >
                    {bulkPowerPending ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Power className="mr-2 h-3 w-3" />} Turn ON
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      const hwIds = (tables || []).filter(t => selectedTables.has(t.id) && t.hardware_id).map(t => t.hardware_id);
                      if (hwIds.length === 0) {
                        toast({ title: "No linked chips in selection", description: "None of the selected tables have hardware linked.", variant: "destructive" });
                        return;
                      }
                      const { total, failed } = await controlDevices(hwIds, "OFF");
                      toast({
                        title: failed > 0 ? `Turned OFF ${total - failed}/${total} table(s)` : `Turned OFF ${total} table(s)`,
                        variant: failed > 0 ? "destructive" : undefined,
                      });
                      setSelectedTables(new Set());
                    }}
                    disabled={bulkPowerPending}
                  >
                    {bulkPowerPending ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <PowerOff className="mr-2 h-3 w-3" />} Turn OFF
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

              // Check if table has active bookings blocking timer open
              const now = new Date();
              const tableHwId = t.hardware_id;
              const activeBooking = isRunning ? null : (bookings || []).find((b) => {
                const bTableId = typeof b.tableId === "object" ? b.tableId?._id || b.tableId?.hardware_id : b.tableId;
                const matchesId = bTableId === t.id || bTableId === tableHwId;
                if (!matchesId) return false;
                if (!["pending_payment", "confirmed"].includes(b.status)) return false;
                const bStart = new Date(b.startTime || b.start_time);
                const bEnd = new Date(b.endTime || b.end_time);
                return bStart <= now && bEnd > now;
              });
              const hasActiveBooking = !!activeBooking;
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
                : displayState === "booked"    ? "bg-sky-500/10 text-sky-400 border-sky-500/30"
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
                  : displayState === "booked"    ? "border-sky-500/30 bg-sky-500/5"
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
                    <Timer className={`h-4 w-4 ${displayState === "booked" ? "text-sky-400" : displayState === "walkin" ? "text-amber-400" : "text-muted-foreground"}`} />
                    <span className={`font-mono text-xl ${isRunning ? "text-primary" : displayState === "booked" ? "text-sky-400" : displayState === "walkin" ? "text-amber-400" : "text-muted-foreground"}`}>
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

                  {/* Running cost — an estimate; the bill is worked out at close (D25) */}
                  {isRunning && <RunningCost table={t} seconds={seconds} />}

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
                        {(session.fnbTotal ?? 0) > 0 && <> (incl. ${session.fnbTotal!.toFixed(2)} F&B charged to table)</>}
                      </p>
                    </div>
                  )}

                  {/* Action buttons — 2×2 with short labels on phones, stacked
                      with full labels on larger screens. */}
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-1">
                    {isRunning ? (
                      <Button size="sm" variant="destructive" onClick={() => openCloseDialog(t.id)} className="w-full col-span-2 sm:col-span-1">
                        <Square className="mr-2 h-3 w-3" /> Close Table
                      </Button>
                    ) : (
                      <>
                        <Button size="sm" variant="default" onClick={() => setOpenTarget(t.id)} className="w-full" disabled={hasActiveBooking || hasUserWalkin} title={hasActiveBooking ? "Table has an active booking" : hasUserWalkin ? "Table has an active walk-in session" : isMaintenance ? "Table is under maintenance — public booking/walk-in is blocked, but staff can still open it (e.g. for a private event)" : "Pay-by-time — bill is calculated when the table is closed"}>
                          <Play className="mr-2 h-3 w-3" /><span className="sm:hidden">Open Table</span><span className="hidden sm:inline">Open Table (Pro-rate)</span>
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => openBookDialog(t.id)} className="w-full" disabled={hasActiveBooking || hasUserWalkin} title={hasActiveBooking ? "Table has an active booking" : hasUserWalkin ? "Table has an active walk-in session" : "Set a fixed duration and pay upfront — like a customer booking"}>
                          <CalendarClock className="mr-2 h-3 w-3" /><span className="sm:hidden">Book Now</span><span className="hidden sm:inline">Book Now (Fixed Duration)</span>
                        </Button>
                      </>
                    )}
                    {activeBooking && (
                      <Button size="sm" variant="secondary" className="w-full col-span-2 sm:col-span-1" onClick={() => setMoveTarget(activeBooking)} title="Move this booking to another table — same time, price and payment">
                        <ArrowRightLeft className="mr-2 h-3 w-3" /> Move Booking
                      </Button>
                    )}
                    {!isRunning && <ScheduleMaintenanceButton tableId={t.id} tableNumber={t.table_number} />}
                    {/* Independent of isRunning — the maintenance flag is a
                        separate piece of state from whether a timer happens
                        to be active, and staff need to be able to clear it
                        (e.g. after opening the table themselves to bypass
                        the public-booking block) without first stopping the
                        session. isMaintenance itself is forced false while
                        running so the badge above reads "In Use", so this
                        button checks the raw table.status directly. */}
                    <Button
                      size="sm"
                      variant={t.status === "maintenance" ? "outline" : "secondary"}
                      onClick={() => setStatusTarget(t.status === "maintenance"
                        ? { tableIds: [t.id], maintenance: false, title: `Reopen Table ${t.table_number}?` }
                        : { tableIds: [t.id], maintenance: true, title: `Put Table ${t.table_number} under maintenance?` })}
                      className="w-full"
                      title={t.status === "maintenance" ? "Clear the maintenance flag — allows public booking/walk-in again" : "Block public booking/walk-in on this table indefinitely"}
                    >
                      <Wrench className="mr-2 h-3 w-3" />
                      {/* Distinct label from the timer's "Close Table" button
                          above (stop session) — this toggles the separate
                          indefinite maintenance flag, not the running session. */}
                      {t.status === "maintenance" ? "Reopen Table" : <><span className="sm:hidden">Maintenance</span><span className="hidden sm:inline">Mark Under Maintenance</span></>}
                    </Button>
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
                const run = async (tableIds: string[], acknowledgeBookings: boolean) => {
                  const result = await bulkSchedule.mutateAsync({
                    tableIds,
                    startTime: startUTC.toISOString(),
                    endTime:   endUTC.toISOString(),
                    reason:    bulkSchedReason.trim(),
                    acknowledgeBookings,
                  });
                  setBulkScheduleOpen(false);
                  setSelectedTables(new Set());
                  if (result.blocked.length) {
                    setAffected({
                      groups: result.blocked.map((b) => ({ label: tableLabel(b.tableId), bookings: b.bookings, inUseNow: b.inUseNow })),
                      retry: () => run(result.blocked.map((b) => b.tableId), true),
                    });
                  }
                };
                try { await run([...selectedTables], false); } catch { /* the hook shows the error */ }
              }}
            >
              {bulkSchedule.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
              Schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <OpenTableDialog
        table={(tables || []).find((tb) => tb.id === openTarget) || null}
        isAdminUser={isAdminUser}
        pending={startTimer.isPending}
        onOpen={openTable}
        onOpenChange={(o) => { if (!o) setOpenTarget(null); }}
      />

      <ReasonDialog
        open={!!statusTarget}
        onOpenChange={(o) => { if (!o) setStatusTarget(null); }}
        title={shownStatus?.title || ""}
        description={shownStatus?.maintenance
          ? "Customers can't book or start a walk-in on a table under maintenance. The reason is saved in Logs."
          : "Customers can book and start walk-ins on this table again. The reason is saved in Logs."}
        label="Reason"
        placeholder={shownStatus?.maintenance ? "e.g. Cloth torn, waiting for repair" : "e.g. Repair finished"}
        confirmLabel={shownStatus?.maintenance ? "Set Maintenance" : "Make Available"}
        destructive={!!shownStatus?.maintenance}
        loading={setMaintenance.isPending || setBulkMaintenance.isPending}
        onConfirm={async (reason) => {
          if (!statusTarget) return;
          const { tableIds, maintenance } = statusTarget;
          setStatusTarget(null);
          try { await changeStatus(tableIds, maintenance, reason); } catch { /* the hook shows the error */ }
        }}
      />

      <BookingsAffectedDialog
        groups={affected?.groups || null}
        loading={affectedLoading}
        onCancel={() => setAffected(null)}
        onConfirm={async () => {
          if (!affected) return;
          const retry = affected.retry;
          setAffectedLoading(true);
          setAffected(null);
          try { await retry(); } catch { /* the hook shows the error */ } finally { setAffectedLoading(false); }
        }}
      />

      <CloseTableDialog
        tables={tables || []}
        elapsed={elapsed}
        isAdminUser={isAdminUser}
        closeTarget={closeTarget}
        stopTimer={stopTimer}
        onOpenChange={(o) => { if (!o) setCloseTarget(null); }}
        onClosed={onTableClosed}
      />

      <MoveBookingDialog booking={moveTarget} onOpenChange={(o) => { if (!o) setMoveTarget(null); }} />

      <BookNowDialog
        tables={tables || []}
        bookTarget={bookTarget}
        isAdminUser={isAdminUser}
        onOpenChange={(o) => { if (!o) setBookTarget(null); }}
      />
    </div>
  );
}

// "Now", to the minute — keeps the price previews below from refetching every render.
const minuteNowISO = () => new Date(Math.floor(Date.now() / 60000) * 60000).toISOString();

function OpenTableDialog({ table, isAdminUser, pending, onOpen, onOpenChange }: {
  table: TableRow | null;
  isAdminUser: boolean;
  pending: boolean;
  onOpen: (tableId: string, mode: PricingMode, hourlyRate?: number) => void;
  onOpenChange: (open: boolean) => void;
}) {
  const [mode, setMode] = useState<PricingMode>("time_of_day");
  const [rateInput, setRateInput] = useState("");
  const tableId = table?.id;
  useEffect(() => {
    if (tableId) { setMode("time_of_day"); setRateInput(""); }
  }, [tableId]);
  const { data: preview } = useSessionPreviewCost(minuteNowISO(), 60, !!table && mode !== "custom", mode === "self_practice" ? "self_practice" : "time_of_day");
  const rateNow = preview?.segments?.[0]?.hourlyRate;
  const noSelfPracticeRate = mode === "self_practice" && (preview?.uncoveredMinutes ?? 0) > 0;
  const customRate = parseFloat(rateInput) || 0;

  return (
    <Dialog open={!!table} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Open Table {table?.table_number}</DialogTitle>
          <DialogDescription>Pay by time — the bill is worked out when the table is closed.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-2">
          <Label>Pricing</Label>
          <PricingModePicker value={mode} onChange={setMode} allowCustom={isAdminUser} />
          <p className="text-xs text-muted-foreground">{PRICING_HELP[mode]}</p>
          {mode !== "custom" && typeof rateNow === "number" && (
            <p className="text-sm">Rate right now: <strong>${rateNow.toFixed(2)}/hr</strong></p>
          )}
          {noSelfPracticeRate && (
            <p className="text-xs text-amber-500">No self-practice rate is set for right now — this time will be charged at the normal price.</p>
          )}
          {mode === "custom" && (
            <Input type="number" step="0.01" min="0" placeholder="Hourly rate" value={rateInput} onChange={(e) => setRateInput(e.target.value)} />
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={() => table && onOpen(table.id, mode, mode === "custom" ? customRate : undefined)}
            disabled={pending || (mode === "custom" && !(customRate > 0))}
          >
            {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
            Open Table
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Running table's cost so far — an estimate from the real pricing, to the last whole minute (D25). */
function RunningCost({ table, seconds }: { table: TableRow; seconds: number }) {
  const mode: PricingMode = table.pricing_mode || "time_of_day";
  const minute = Math.floor(seconds / 60) * 60;
  const startedISO = table.timer_started_at ? new Date(table.timer_started_at).toISOString() : null;
  const { data: preview } = useSessionPreviewCost(startedISO, minute, mode !== "custom" && minute > 0, mode === "self_practice" ? "self_practice" : "time_of_day");
  const flat = (rate: number) => Math.round((seconds / 3600) * rate * 100) / 100;
  const estimate = mode === "custom" ? flat(Number(table.hourly_rate) || 0) : (minute === 0 ? 0 : preview?.total ?? flat(Number(table.hourly_rate) || 0));
  return (
    <div className="space-y-0.5">
      <div className="flex items-center gap-2 text-sm">
        <DollarSign className="h-4 w-4 text-primary" />
        <span className="font-medium text-primary">≈ ${estimate.toFixed(2)} so far</span>
        <span className="text-muted-foreground">· {mode === "custom" ? `custom $${Number(table.hourly_rate || 0).toFixed(2)}/hr` : PRICING_LABELS[mode]}</span>
      </div>
      <p className="text-xs text-muted-foreground">Estimate — the bill is worked out when the table is closed.</p>
    </div>
  );
}

function CloseTableDialog({
  tables,
  elapsed,
  isAdminUser,
  closeTarget,
  stopTimer,
  onOpenChange,
  onClosed,
}: {
  tables: any[];
  elapsed: Record<string, number>;
  isAdminUser: boolean;
  closeTarget: string | null;
  stopTimer: ReturnType<typeof useAdminTables>["stopTimer"];
  onOpenChange: (open: boolean) => void;
  onClosed: (tableId: string, info: { seconds: number; cost: number; grossCost: number; discountPercent: number; paymentMethod: "cash" | "paynow" | "wallet"; customerName: string; fnbTotal?: number }) => void;
}) {
  const { toast } = useToast();
  const [discountInput, setDiscountInput] = useState("0");
  const [discountReason, setDiscountReason] = useState("");
  const [pricingMode, setPricingMode] = useState<PricingMode>("time_of_day");
  const [rateInput, setRateInput] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"wallet" | "cash" | "paynow">("wallet");
  const [customerId, setCustomerId] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [allowNegative, setAllowNegative] = useState(false);
  const [applyMembershipDiscount, setApplyMembershipDiscount] = useState(true);
  const [applyMembershipFreeMinutes, setApplyMembershipFreeMinutes] = useState(true);
  const { data: customers = [], isFetching: customersLoading } = useAdminCustomers(customerSearch.trim().length >= MIN_CUSTOMER_SEARCH ? customerSearch : "");
  const { data: pendingFnb = [] } = useTablePendingFnb(closeTarget);
  const fnbTotal = Math.round(pendingFnb.reduce((s, o: any) => s + o.totalPrice, 0) * 100) / 100;
  // Membership discount only auto-applies for wallet charges to a known
  // customer — matches the backend's stop-timer logic exactly.
  const { data: activeMembership } = useCustomerActiveMembership(
    paymentMethod === "wallet" ? customerId : null
  );

  useEffect(() => {
    if (closeTarget) {
      setDiscountInput("0");
      setDiscountReason("");
      const openedTable = tables.find((tb) => tb.id === closeTarget);
      // Starts on the pricing the table was opened with. A custom rate an
      // admin opened it at is pre-filled so it holds for the whole session.
      const openedMode: PricingMode = openedTable?.pricing_mode || "time_of_day";
      setPricingMode(openedMode);
      setRateInput(openedMode === "custom" && openedTable?.hourly_rate > 0 ? String(openedTable.hourly_rate) : "");
      setPaymentMethod("wallet");
      setCustomerId("");
      setCustomerSearch("");
      setCustomerName("");
      setAllowNegative(false);
      setApplyMembershipDiscount(true);
      setApplyMembershipFreeMinutes(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [closeTarget]);

  const table = tables.find((tb) => tb.id === closeTarget);
  // Staff can't pick a custom rate — only keep one an admin opened the table at.
  const openedCustom = table?.pricing_mode === "custom";
  const allowCustom = isAdminUser || openedCustom;
  const customRate = Number(rateInput) || 0;
  const seconds = closeTarget ? (elapsed[closeTarget] ?? 0) : 0;
  const startedAtISO = closeTarget
    ? (table?.timer_started_at ? new Date(table.timer_started_at).toISOString() : new Date(Date.now() - seconds * 1000).toISOString())
    : null;
  // The bill comes from the server, worked out by the same function as the
  // real close: time (split at every price change), member free minutes then
  // discount (wallet only, never self-practice), staff discount, F&B, cash
  // rounding. So the total and the balance warning match the actual charge.
  const selfPractice = pricingMode === "self_practice";
  const discountPct = Math.min(100, Math.max(0, parseFloat(discountInput) || 0));
  const { data: bill } = useClosePreview(closeTarget, seconds, {
    pricingMode, hourlyRate: pricingMode === "custom" ? customRate : 0, paymentMethod, customerId,
    discountPercent: discountPct, applyMembershipDiscount, applyMembershipFreeMinutes,
  }, !!closeTarget && (pricingMode !== "custom" || customRate > 0));
  const priceLoading = !bill;
  const gross = bill?.grossAmount ?? 0;
  const freeMinutesCredit = bill?.freeMinutesCredit ?? 0;
  const membershipPct = bill?.membershipDiscountPercent ?? 0;
  const afterMembership = bill?.afterMembership ?? 0;
  const timeChargeExact = bill?.timeCharge ?? 0;
  const finalCost = bill?.amountCharged ?? 0;

  const selectedCustomer = customers.find((c: any) => c.id === customerId);
  const walletBalance = selectedCustomer?.wallet_balance ?? 0;
  const willGoNegative = paymentMethod === "wallet" && !!selectedCustomer && !priceLoading && finalCost > walletBalance;
  // Shared/utility accounts (e.g. "Guest Account Table N") are flagged to always
  // allow a negative balance — no need for staff to tick the checkbox each time.
  const accountAllowsNegative = !!selectedCustomer?.allow_negative_balance;
  // Only an admin can take a normal account below zero (D9).
  const effectiveAllowNegative = (isAdminUser && allowNegative) || accountAllowsNegative;
  const discountErr = discountProblem(discountPct, discountReason, isAdminUser);

  const handleConfirm = () => {
    if (!closeTarget) return;
    if (paymentMethod === "wallet" && !customerId) {
      toast({ title: "Select a customer", description: "A customer must be selected to charge their wallet.", variant: "destructive" });
      return;
    }
    if (paymentMethod === "wallet" && willGoNegative && !effectiveAllowNegative) {
      toast({
        title: "Insufficient wallet balance",
        description: isAdminUser ? "Check 'Allow negative balance' to proceed anyway." : "Ask an admin, or take Cash or PayNow instead.",
        variant: "destructive",
      });
      return;
    }
    if (discountErr) {
      toast({ title: "Check the discount", description: discountErr, variant: "destructive" });
      return;
    }
    if (pricingMode === "custom" && !(customRate > 0)) {
      toast({ title: "Enter the custom rate", variant: "destructive" });
      return;
    }
    const tableId = closeTarget;
    const startedAt = startedAtISO!;

    onClosed(tableId, { seconds, cost: finalCost, grossCost: gross, discountPercent: discountPct, paymentMethod, customerName, fnbTotal });

    stopTimer.mutate(
      {
        tableId,
        durationSeconds: seconds,
        pricingMode,
        hourlyRate: pricingMode === "custom" ? customRate : 0,
        discountPercent: discountPct,
        discountReason,
        startedAt,
        customerId: customerId || null,
        paymentMethod,
        allowNegative: effectiveAllowNegative,
        applyMembershipDiscount,
        applyMembershipFreeMinutes,
      },
      {
        onSuccess: (data: any) => {
          // Use the server-computed amount — it's the authoritative figure
          // once free minutes / membership % / manual % / time-of-day
          // segments are all combined. The estimate passed to onClosed()
          // above (before this request even went out) used a flat rate for
          // the whole session, so it silently diverges from this whenever
          // the session crossed a peak/off-peak pricing boundary — correct
          // the persisted "Session Complete" card here so it always matches
          // the Invoice tab instead of the pre-submission guess.
          const actualCost = typeof data?.amountCharged === "number" ? data.amountCharged : finalCost;
          const actualGross = typeof data?.grossAmount === "number" ? data.grossAmount : gross;
          onClosed(tableId, { seconds, cost: actualCost, grossCost: actualGross, discountPercent: discountPct, paymentMethod, customerName, fnbTotal });
          const methodLabel = paymentMethod === "wallet" ? `charged to ${customerName || "customer"}'s wallet` : `paid via ${paymentMethod === "paynow" ? "PayNow" : "cash"}`;
          const memberNote = data?.membershipDiscountAmount > 0 || data?.freeMinutesCredit > 0
            ? ` (member discount applied)`
            : "";
          toast({
            title: "Table closed",
            description: `$${actualCost.toFixed(2)} ${methodLabel}.${memberNote}` + (fnbTotal > 0 ? ` (incl. $${fnbTotal.toFixed(2)} F&B)` : ""),
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
                Table {table?.table_number} · {formatDuration(seconds)} · {pricingMode === "custom" ? `custom $${customRate.toFixed(2)}/hr` : PRICING_LABELS[pricingMode]}
                {priceLoading ? " (working out the price…)" : <>
                  {" "}— ${gross.toFixed(2)}
                  {freeMinutesCredit > 0 && <> · {bill!.freeMinutesApplied} free min −${freeMinutesCredit.toFixed(2)}</>}
                  {membershipPct > 0 && <> · member {membershipPct}% off</>}
                  {(freeMinutesCredit > 0 || membershipPct > 0) && <>: ${afterMembership.toFixed(2)}</>}
                  {discountPct > 0 && <> · after {discountPct}% off: ${timeChargeExact.toFixed(2)}</>}
                  {fnbTotal > 0 && <> + F&B ${fnbTotal.toFixed(2)}</>}
                  {(discountPct > 0 || fnbTotal > 0 || freeMinutesCredit > 0 || membershipPct > 0 || paymentMethod === "cash") && <> — total: <strong>${finalCost.toFixed(2)}</strong></>}
                </>}
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
            <Label>Pricing</Label>
            <PricingModePicker value={pricingMode} onChange={setPricingMode} allowCustom={allowCustom} />
            <p className="text-xs text-muted-foreground">{PRICING_HELP[pricingMode]}</p>
            {selfPractice && (bill?.uncoveredMinutes ?? 0) > 0 && (
              <p className="text-xs text-amber-500">{bill!.uncoveredMinutes} min of this session had no self-practice rate set — charged at the normal price.</p>
            )}
            {pricingMode === "custom" && (
              isAdminUser
                ? <Input type="number" step="0.01" min="0" placeholder="Hourly rate" value={rateInput} onChange={(e) => setRateInput(e.target.value)} />
                : <p className="text-xs">Opened by an admin at <strong>${customRate.toFixed(2)}/hr</strong> — kept for the whole session.</p>
            )}
          </div>

          <DiscountField
            value={discountInput}
            onChange={setDiscountInput}
            reason={discountReason}
            onReasonChange={setDiscountReason}
            isAdminUser={isAdminUser}
            note={membershipPct > 0 ? "Applied on top of the customer's membership discount." : undefined}
          />

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
                    {activeMembership && (
                      <Badge variant="secondary" className="mt-1">
                        {activeMembership.planName} member
                        {activeMembership.discountPercent > 0 && ` — ${activeMembership.discountPercent}% off auto-applied`}
                        {activeMembership.freeMinutesPerVisit > 0 && ` + free minutes`}
                        {activeMembership.unlimitedFreeMinutes && ` + free self-practice`}
                      </Badge>
                    )}
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => { setCustomerId(""); setCustomerName(""); }}>Change</Button>
                </div>
              ) : (
                <>
                  <Input placeholder="Search name or email" value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)} />
                  <CustomerResults search={customerSearch} customers={customers} loading={customersLoading} onPick={(c) => { setCustomerId(c.id); setCustomerName(c.name || c.legal_name || c.email); }} />
                </>
              )}
              <NegativeBalanceNotice
                willGoNegative={willGoNegative}
                accountAllowsNegative={accountAllowsNegative}
                isAdminUser={isAdminUser}
                allowNegative={allowNegative}
                onAllowNegative={setAllowNegative}
              />
              <MembershipPerks
                membership={activeMembership}
                selfPractice={selfPractice}
                applyDiscount={applyMembershipDiscount}
                onApplyDiscount={setApplyMembershipDiscount}
                applyFreeMinutes={applyMembershipFreeMinutes}
                onApplyFreeMinutes={setApplyMembershipFreeMinutes}
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={stopTimer.isPending || priceLoading}>
            {stopTimer.isPending ? "Closing..." : "Confirm & Close"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const DURATION_PRESETS = [60, 120, 180, 300];

function BookNowDialog({
  tables,
  bookTarget,
  isAdminUser,
  onOpenChange,
}: {
  tables: any[];
  bookTarget: string | null;
  isAdminUser: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const bookTableNow = useBookTableNow();

  const [durationInput, setDurationInput] = useState("60");
  const [pricingMode, setPricingMode] = useState<PricingMode>("time_of_day");
  const [rateInput, setRateInput] = useState("");
  const [discountInput, setDiscountInput] = useState("0");
  const [discountReason, setDiscountReason] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"wallet" | "cash" | "paynow">("wallet");
  const [customerId, setCustomerId] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [allowNegative, setAllowNegative] = useState(false);
  const [applyMembershipDiscount, setApplyMembershipDiscount] = useState(true);
  const [applyMembershipFreeMinutes, setApplyMembershipFreeMinutes] = useState(true);
  const [promoInput, setPromoInput] = useState("");
  const [appliedPromo, setAppliedPromo] = useState<NonNullable<PromoValidation["promo"]> | null>(null);
  const [promoAppliedFor, setPromoAppliedFor] = useState<string | null>(null);
  const [autoApplied, setAutoApplied] = useState(false);
  // A package code matched the duration but the server turned it down (e.g.
  // the booking runs past the code's time window) — shown so staff know why
  // the bundle price isn't there instead of it silently not applying.
  const [autoSkipped, setAutoSkipped] = useState<{ code: string; reason: string } | null>(null);
  // Auto-apply bookkeeping: the duration/price a staff member removed an
  // auto-applied code for (don't re-add it), and the last one checked.
  const dismissedAutoKey = useRef<string | null>(null);
  const autoTried = useRef<string | null>(null);
  const validatePromo = useValidatePromo();
  const { data: customers = [], isFetching: customersLoading } = useAdminCustomers(customerSearch.trim().length >= MIN_CUSTOMER_SEARCH ? customerSearch : "");
  // Membership discount only auto-applies for wallet charges to a known
  // customer — matches the backend's book-now logic exactly.
  const { data: activeMembership } = useCustomerActiveMembership(
    paymentMethod === "wallet" ? customerId : null
  );

  useEffect(() => {
    if (bookTarget) {
      setDurationInput("60");
      // Every booking starts on time-of-day pricing (split correctly across
      // any price change in the window); custom rates are admin-only.
      setPricingMode("time_of_day");
      setRateInput("");
      setDiscountInput("0");
      setDiscountReason("");
      setPaymentMethod("wallet");
      setCustomerId("");
      setCustomerSearch("");
      setCustomerName("");
      setAllowNegative(false);
      setApplyMembershipDiscount(true);
      setApplyMembershipFreeMinutes(true);
      setPromoInput("");
      setAppliedPromo(null);
      setAutoApplied(false);
      setAutoSkipped(null);
      dismissedAutoKey.current = null;
      autoTried.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookTarget]);

  // A code is checked against the duration/pricing it was applied with —
  // make staff re-apply it if either changes. Self-practice can't be
  // combined with a code.
  useEffect(() => {
    setAppliedPromo(null);
  }, [durationInput, rateInput, pricingMode]);

  const table = tables.find((tb) => tb.id === bookTarget);
  const durationMinutes = Math.max(0, parseInt(durationInput, 10) || 0);
  const customRate = Math.max(0, parseFloat(rateInput) || 0);
  const selfPracticeMode = pricingMode === "self_practice";

  const discountPct = Math.min(100, Math.max(0, parseFloat(discountInput) || 0));
  // The duration/pricing a code was applied for. The effect above clears the code one render after
  // either changes — until then it isn't sent, so the server never prices a code against the wrong booking.
  const promoKey = `${durationMinutes}|${pricingMode}|${customRate}`;
  const promoForPreview = appliedPromo && promoAppliedFor === promoKey ? appliedPromo.code : "";
  // The exact bill, worked out by the server with the same function as the real booking — member
  // free minutes, then the % discount (wallet only, never with self-practice — D11/D2), or the promo
  // code when it saves more, then the staff discount and cash rounding. Nothing is used up by it.
  const { data: bill } = useBookNowPreview(bookTarget, {
    durationMinutes, pricingMode, hourlyRate: pricingMode === "custom" ? customRate : 0, paymentMethod, customerId,
    promoCode: promoForPreview, discountPercent: discountPct, applyMembershipDiscount, applyMembershipFreeMinutes,
  }, !!bookTarget && durationMinutes >= 15 && (pricingMode !== "custom" || customRate > 0));
  // Show "…" until the server's price arrives, not $0.00.
  const priceLoading = !bill || !!bill.error;
  const gross = bill?.grossAmount ?? 0;
  // A typed self-practice code (staff-only, per hour) counts as self-practice too.
  const selfPractice = selfPracticeMode || (!!appliedPromo && appliedPromo.discount_type === "hourly_rate" && !!appliedPromo.staff_only);

  const handleApplyPromo = async () => {
    if (!promoInput.trim() || !bookTarget || durationMinutes < 15) return;
    const startMs = Math.floor(Date.now() / 30000) * 30000;
    const result = await validatePromo.mutateAsync({
      code: promoInput.trim(),
      originalPrice: gross,
      tableId: table?.hardware_id || bookTarget,
      bookingStartTime: new Date(startMs).toISOString(),
      bookingEndTime: new Date(startMs + durationMinutes * 60000).toISOString(),
      counter: true,
    });
    if (result.valid && result.promo) {
      setAppliedPromo(result.promo);
      setPromoAppliedFor(promoKey);
      setAutoApplied(false);
    } else {
      toast({ title: "Code not applied", description: result.error, variant: "destructive" });
    }
  };

  // Auto-apply a package code (e.g. DAY2H) when the chosen duration matches
  // one and the booking fits its time window. Candidates are picked by hours
  // here; the server decides whether the window/day/limits actually allow it.
  // Staff-only per-hour codes (SELF7) are never auto-applied — those are for
  // self-practice only, so staff choose them by hand.
  const { data: allPromos = [] } = useAdminPromoCodes("default");
  // Keyed on the last loaded price, so a bill reloading for another reason (payment method,
  // customer, discount) doesn't count as a change and clear the "not applied" note.
  const [stableGross, setStableGross] = useState<number | null>(null);
  useEffect(() => {
    if (bill && !bill.error) setStableGross(bill.grossAmount);
  }, [bill]);
  const autoKey = `${bookTarget}|${durationMinutes}|${stableGross}`;
  useEffect(() => {
    setAutoSkipped(null);
  }, [autoKey, pricingMode]);
  useEffect(() => {
    if (!bookTarget || appliedPromo || pricingMode !== "time_of_day" || priceLoading || durationMinutes < 15) return;
    if (dismissedAutoKey.current === autoKey || autoTried.current === autoKey) return;
    autoTried.current = autoKey;
    const candidates = (allPromos as any[])
      .filter((p) => p.is_active && !p.deleted && p.discount_type === "package_price" && !p.staff_only
        && p.exact_hours && Math.abs(p.exact_hours * 60 - durationMinutes) < 1)
      .sort((a, b) => a.discount_value - b.discount_value);
    if (!candidates.length) return;
    (async () => {
      const startMs = Math.floor(Date.now() / 30000) * 30000;
      let firstRejection: { code: string; reason: string } | null = null;
      for (const p of candidates) {
        const result = await validatePromo.mutateAsync({
          code: p.code,
          originalPrice: gross,
          tableId: table?.hardware_id || bookTarget,
          bookingStartTime: new Date(startMs).toISOString(),
          bookingEndTime: new Date(startMs + durationMinutes * 60000).toISOString(),
          counter: true,
        });
        // Staff may have changed the duration while this was checking.
        if (autoTried.current !== autoKey) return;
        if (result.valid && result.promo && (result.promo.server_discount ?? 0) > 0) {
          setAppliedPromo(result.promo);
          setPromoAppliedFor(promoKey);
          setAutoApplied(true);
          return;
        }
        if (!firstRejection && !result.valid) firstRejection = { code: p.code, reason: result.error || "Not valid for this booking" };
      }
      if (firstRejection) setAutoSkipped(firstRejection);
    })().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoKey, appliedPromo, pricingMode, priceLoading, allPromos]);

  const removePromo = () => {
    if (autoApplied) dismissedAutoKey.current = autoKey;
    setAppliedPromo(null);
    setAutoApplied(false);
    setPromoInput("");
  };
  // Already rounded to 10c by the server for cash; wallet/PayNow settle to the exact cent.
  const estimatedTotal = bill?.amountCharged ?? 0;

  const selectedCustomer = customers.find((c: any) => c.id === customerId);
  const walletBalance = selectedCustomer?.wallet_balance ?? 0;
  const willGoNegative = paymentMethod === "wallet" && !!selectedCustomer && !priceLoading && estimatedTotal > walletBalance;
  const accountAllowsNegative = !!selectedCustomer?.allow_negative_balance;
  // Only an admin can take a normal account below zero (D9).
  const effectiveAllowNegative = (isAdminUser && allowNegative) || accountAllowsNegative;

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
      toast({
        title: "Insufficient wallet balance",
        description: isAdminUser ? "Check 'Allow negative balance' to proceed anyway." : "Ask an admin, or take Cash or PayNow instead.",
        variant: "destructive",
      });
      return;
    }
    const discountErr = discountProblem(discountPct, discountReason, isAdminUser);
    if (discountErr) {
      toast({ title: "Check the discount", description: discountErr, variant: "destructive" });
      return;
    }
    if (pricingMode === "custom" && !(customRate > 0)) {
      toast({ title: "Enter the custom rate", variant: "destructive" });
      return;
    }

    const sentPromo = appliedPromo?.code || null;
    bookTableNow.mutate(
      {
        tableId: bookTarget,
        durationMinutes,
        customerId: customerId || null,
        paymentMethod,
        allowNegative: effectiveAllowNegative,
        discountPercent: discountPct,
        discountReason,
        pricingMode,
        hourlyRate: pricingMode === "custom" ? customRate : 0,
        applyMembershipDiscount,
        applyMembershipFreeMinutes,
        promoCode: appliedPromo?.code || null,
      },
      {
        onSuccess: (data: any) => {
          const amount = data?.finalAmount ?? estimatedTotal;
          const methodLabel = paymentMethod === "wallet" ? `charged to ${customerName || "customer"}'s wallet` : `paid via ${paymentMethod === "paynow" ? "PayNow" : "cash"}`;
          toast({
            title: "Table booked",
            description: `${durationMinutes} min · $${Number(amount).toFixed(2)} ${methodLabel}.`
              + (data?.booking?.promoCode ? ` Promo ${data.booking.promoCode} applied.`
                : sentPromo ? ` ${sentPromo} not used — the customer's membership gave a better price.` : ""),
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
            <Label>Pricing</Label>
            <PricingModePicker value={pricingMode} onChange={setPricingMode} allowCustom={isAdminUser} />
            <p className="text-xs text-muted-foreground">{PRICING_HELP[pricingMode]}</p>
            {selfPracticeMode && (bill?.uncoveredMinutes ?? 0) > 0 && (
              <p className="text-xs text-amber-500">{bill!.uncoveredMinutes} min of this booking has no self-practice rate set — charged at the normal price.</p>
            )}
            {pricingMode === "custom" && (
              <Input type="number" step="0.01" min="0" placeholder="Hourly rate" value={rateInput} onChange={(e) => setRateInput(e.target.value)} />
            )}
          </div>

          <div className="space-y-2">
            <Label>Duration</Label>
            <div className="grid grid-cols-4 gap-2">
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
              <span className="text-muted-foreground">{bill && !bill.error ? "Price" : "Price (working it out…)"}</span>
              <span className="font-medium">{priceLoading ? "…" : `$${gross.toFixed(2)}`}</span>
            </div>
            {!priceLoading && bill!.freeMinutesApplied > 0 && (
              <div className="flex items-center justify-between text-emerald-500 text-xs mt-1">
                <span>{bill!.freeMinutesApplied} free min</span>
                <span>-${bill!.freeMinutesCredit.toFixed(2)}</span>
              </div>
            )}
            {!priceLoading && bill!.membershipDiscountPercent > 0 && (
              <div className="flex items-center justify-between text-emerald-500 text-xs mt-1">
                <span>Member {bill!.membershipDiscountPercent}% discount</span>
                <span>-${bill!.membershipDiscountAmount.toFixed(2)}</span>
              </div>
            )}
            {!priceLoading && bill!.promoCode && (
              <div className="flex items-center justify-between text-emerald-500 text-xs mt-1">
                <span>Promo {bill!.promoCode}</span>
                <span>-${bill!.promoDiscount.toFixed(2)}</span>
              </div>
            )}
            {!priceLoading && bill!.promoNotUsed && (
              <p className="text-xs text-muted-foreground mt-1">Membership saves more than {bill!.promoNotUsed}, so the membership perks are used.</p>
            )}
            {selfPractice && activeMembership && (
              <p className="text-xs text-muted-foreground mt-1">Self-practice — member perks don't apply.</p>
            )}
            {!priceLoading && bill!.discountPct > 0 && (
              <div className="flex items-center justify-between text-emerald-500 text-xs mt-1">
                <span>{bill!.discountPct}% discount</span>
                <span>-${bill!.discountAmount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex items-center justify-between mt-1 border-t border-border pt-1">
              <span className="text-muted-foreground">Total</span>
              <span className="font-semibold">{priceLoading ? "…" : `$${estimatedTotal.toFixed(2)}`}</span>
            </div>
            {bill?.error && <p className="text-xs text-destructive mt-1">{bill.error}</p>}
            <p className="text-xs text-muted-foreground mt-1">The amount charged when you confirm{selfPractice ? "" : " — member free minutes and discount included when paid by wallet"}.</p>
          </div>

          <div className="space-y-2">
            <Label>Promo Code</Label>
            {selfPracticeMode ? (
              <p className="text-xs text-muted-foreground">Not used with self-practice pricing.</p>
            ) : appliedPromo ? (
              <div className="flex items-center justify-between rounded-md border border-primary/40 bg-primary/5 px-3 py-2 text-sm">
                <span className="font-medium">
                  {appliedPromo.code}
                  {autoApplied && <span className="ml-2 text-xs font-normal text-muted-foreground">auto-applied</span>}
                </span>
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={removePromo}>Remove</Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Input
                  placeholder="e.g. DAY2H"
                  value={promoInput}
                  onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                  onKeyDown={(e) => { if (e.key === "Enter") handleApplyPromo(); }}
                />
                <Button type="button" variant="outline" onClick={handleApplyPromo} disabled={!promoInput.trim() || validatePromo.isPending}>
                  {validatePromo.isPending ? "Checking..." : "Apply"}
                </Button>
              </div>
            )}
            {!appliedPromo && autoSkipped && (
              <p className="text-xs text-amber-500">
                {autoSkipped.code} not applied — {autoSkipped.reason}. This booking is charged at normal pricing.
              </p>
            )}
          </div>

          <DiscountField
            value={discountInput}
            onChange={setDiscountInput}
            reason={discountReason}
            onReasonChange={setDiscountReason}
            isAdminUser={isAdminUser}
          />

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
                  {activeMembership && (
                    <Badge variant="secondary" className="mt-1">
                      {activeMembership.planName} member
                      {activeMembership.discountPercent > 0 && ` — ${activeMembership.discountPercent}% off auto-applied`}
                      {activeMembership.freeMinutesPerVisit > 0 && ` + free minutes`}
                      {activeMembership.unlimitedFreeMinutes && ` + free self-practice`}
                    </Badge>
                  )}
                </div>
                <Button size="sm" variant="ghost" onClick={() => { setCustomerId(""); setCustomerName(""); }}>Change</Button>
              </div>
            ) : (
              <>
                <Input placeholder="Search name or email" value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)} />
                <CustomerResults search={customerSearch} customers={customers} loading={customersLoading} onPick={(c) => { setCustomerId(c.id); setCustomerName(c.name || c.legal_name || c.email); }} />
              </>
            )}
            <NegativeBalanceNotice
              willGoNegative={willGoNegative}
              accountAllowsNegative={accountAllowsNegative}
              isAdminUser={isAdminUser}
              allowNegative={allowNegative}
              onAllowNegative={setAllowNegative}
            />
            <MembershipPerks
              membership={activeMembership}
              selfPractice={selfPractice}
              applyDiscount={applyMembershipDiscount}
              onApplyDiscount={setApplyMembershipDiscount}
              applyFreeMinutes={applyMembershipFreeMinutes}
              onApplyFreeMinutes={setApplyMembershipFreeMinutes}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleConfirm} disabled={bookTableNow.isPending || priceLoading}>
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
  const [affected, setAffected] = useState<{ groups: AffectedGroup[]; retry: () => Promise<void> } | null>(null);

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
    const submit = async (acknowledgeBookings: boolean) => {
      await schedule.mutateAsync({
        tableId,
        startTime: startUTC.toISOString(),
        endTime: endUTC.toISOString(),
        reason: trimmedReason,
        acknowledgeBookings,
      });
      setAffected(null);
      reset();
      setOpen(false);
    };
    try {
      await submit(false);
    } catch (e) {
      // Bookings in the window (D23): list them, as bulk scheduling does; the hook shows any other error.
      if (isBookingsAffected(e)) {
        setOpen(false);   // keeps the entered details for "Go back"
        setAffected({ groups: [{ label: `Table ${tableNumber}`, bookings: e.data.bookings || [], inUseNow: e.data.inUseNow }], retry: () => submit(true) });
      }
    }
  };

  return (
    <>
      <BookingsAffectedDialog
        groups={affected?.groups || null}
        loading={schedule.isPending}
        onCancel={() => { setAffected(null); setOpen(true); }}
        onConfirm={() => { affected?.retry().catch(() => {}); }}
      />
      <Button size="sm" variant="default" onClick={() => setOpen(true)} className="w-full">
        <Wrench className="mr-2 h-3 w-3" /><span className="sm:hidden">Schedule</span><span className="hidden sm:inline">Schedule Maintenance</span>
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
  // Deleted windows are history, not something staff act on — hidden unless asked for.
  const [hideDeleted, setHideDeleted] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const { data: windows } = useTableMaintenance(tableId, hideDeleted ? "default" : "all");
  const remove = useDeleteMaintenance();
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [detailRecord, setDetailRecord] = useState<any | null>(null);
  // Normal view: upcoming windows only. "Show Deleted": deleted windows only.
  const list = (Array.isArray(windows) ? windows : []).filter((w: any) => {
    if (!hideDeleted) return isRecordDeleted(w);
    if (isRecordDeleted(w)) return false;
    const end = new Date(w.endTime || w.end_time);
    return !isNaN(end.getTime()) && end.getTime() > Date.now();
  }).sort((a: any, b: any) =>
    new Date(a.startTime || a.start_time).getTime() - new Date(b.startTime || b.start_time).getTime()
  );

  // Nothing upcoming → nothing to show on the card. (In the deleted view,
  // keep the header so there's a way back.)
  if (!list.length && hideDeleted) return null;
  // Only the next two windows by default, to keep each table card short.
  const shown = showAll ? list : list.slice(0, 2);

  return (
    <div className="space-y-1.5 pt-1">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">{hideDeleted ? "Scheduled Maintenance" : "Deleted Maintenance"} ({list.length})</p>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 px-2 text-xs"
          onClick={() => setHideDeleted((v) => !v)}
        >
          {hideDeleted ? <Eye className="h-3 w-3 mr-1" /> : <EyeOff className="h-3 w-3 mr-1" />}
          {hideDeleted ? "Show Deleted" : "Back"}
        </Button>
      </div>
      {!list.length && <p className="text-xs text-muted-foreground">No deleted maintenance windows.</p>}
      {shown.map((w: any) => {
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
      {list.length > 2 && (
        <button type="button" className="text-xs text-primary" onClick={() => setShowAll((v) => !v)}>
          {showAll ? "Show less" : `+${list.length - 2} more`}
        </button>
      )}

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


