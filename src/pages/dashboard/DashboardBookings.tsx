import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useMyBookings, useTables } from "@/hooks/useBooking";
import { useMyWalkinHistory, useMyWalkinSession, useMyTimerHistory } from "@/hooks/useWalkin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import BookingDetailDialog from "@/components/BookingDetailDialog";
import WalkinReceiptDialog from "@/components/WalkinReceiptDialog";
import TimerSessionReceiptDialog from "@/components/TimerSessionReceiptDialog";
import { fmtDateSG as fmtDate, fmtTimeSG as fmtTime, nowSG } from "@/lib/sgTime";
import { getTableLabel as resolveTableLabel } from "@/lib/tableLabel";
import {
  Calendar, Clock, Zap, CheckCircle2, XCircle,
  AlertCircle, Timer, ChevronRight, Wallet,
} from "lucide-react";

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; icon: any; color: string; bg: string; border: string }> = {
  confirmed:       { label: "Confirmed",      icon: CheckCircle2, color: "text-emerald-400",      bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
  pending:         { label: "Pending",         icon: AlertCircle,  color: "text-amber-400",        bg: "bg-amber-500/10",   border: "border-amber-500/20"   },
  pending_payment: { label: "Pending Payment", icon: AlertCircle,  color: "text-yellow-400",       bg: "bg-yellow-500/10",  border: "border-yellow-500/20"  },
  completed:       { label: "Completed",       icon: CheckCircle2, color: "text-muted-foreground", bg: "bg-muted/50",       border: "border-border"          },
  cancelled:       { label: "Cancelled",       icon: XCircle,      color: "text-destructive",      bg: "bg-destructive/10", border: "border-destructive/20"  },
  expired:         { label: "Expired",         icon: XCircle,      color: "text-muted-foreground", bg: "bg-muted/50",       border: "border-border"          },
  active:          { label: "In Progress",     icon: Zap,          color: "text-green-400",        bg: "bg-green-500/10",   border: "border-green-500/20"    },
  stopped:         { label: "Completed",       icon: CheckCircle2, color: "text-muted-foreground", bg: "bg-muted/50",       border: "border-border"          },
};

function getStatusCfg(s: string) {
  return STATUS_CONFIG[s] ?? { label: s, icon: AlertCircle, color: "text-muted-foreground", bg: "bg-muted/50", border: "border-border" };
}

function fmtDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.ceil((s % 3600) / 60);
  if (s < 60) return "< 1 min";
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function getDaysUntil(dateStr: string): number {
  const now = new Date();
  const target = new Date(dateStr);
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

// ── Resolve display status: confirmed bookings in the past → "completed" ──────
function resolveBookingStatus(b: any, now: Date): string {
  const rawStatus = b.status || "confirmed";
  if (rawStatus === "confirmed") {
    const end = new Date(b.endTime || b.end_time || b.startTime || b.start_time);
    if (end < now) return "completed";
  }
  return rawStatus;
}

// ── Booking Card ──────────────────────────────────────────────────────────────
function BookingCard({ b, tables, now, onClick }: { b: any; tables: any[]; now: Date; onClick?: () => void }) {
  const start = b.startTime || b.start_time;
  const end = b.endTime || b.end_time;
  const price = Number(b.amount ?? b.finalPrice ?? b.final_price ?? b.totalPrice ?? 0);
  const status = resolveBookingStatus(b, now);
  const cfg = getStatusCfg(status);
  const StatusIcon = cfg.icon;
  const method = (b.paymentMethod ?? b.payment_method ?? "").toLowerCase();
  const daysUntil = status === "confirmed" ? getDaysUntil(start) : null;

  const tableLabel = (() => {
    const tid = b.tableId;
    if (tid && typeof tid === "object") {
      if (tid.name) return tid.name;
      const num = tid.tableNumber ?? tid.table_number;
      if (num !== undefined && num !== null) return `Table ${num}`;
      if (tid.hardware_id || tid.hardwareId) return `Table ${String(tid.hardware_id ?? tid.hardwareId).replace(/^T/i, "")}`;
    }
    if (typeof tid === "string") {
      if (/^T\d+$/i.test(tid)) return `Table ${tid.replace(/^T/i, "")}`;
      const match = (tables || []).find((t: any) => t.id === tid);
      if (match) return match.hardware_id ? `Table ${String(match.hardware_id).replace(/^T/i, "")}` : `Table ${match.table_number ?? "?"}`;
    }
    return "Table ?";
  })();

  return (
    <div
      className={`rounded-xl border ${cfg.border} bg-card/50 p-4 transition-all ${
        onClick ? "cursor-pointer hover:bg-muted/30 hover:scale-[1.01] active:scale-[0.99]" : ""
      }`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-3">
        {/* Left */}
        <div className="flex items-start gap-3 min-w-0">
          <div className={`mt-0.5 h-9 w-9 rounded-lg ${cfg.bg} border ${cfg.border} flex items-center justify-center shrink-0`}>
            <Calendar className={`h-4 w-4 ${cfg.color}`} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-sm text-foreground">{tableLabel}</p>
              {daysUntil === 0 && (
                <span className="text-[10px] font-medium text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded px-1.5 py-0.5">
                  Today
                </span>
              )}
            </div>
            <div className="mt-1 space-y-0.5">
              <div className="flex items-center gap-1 text-muted-foreground">
                <Clock className="h-3 w-3 shrink-0" />
                <span className="text-xs">{fmtDate(start)}</span>
              </div>
              <span className="text-xs font-medium text-foreground">{fmtTime(start)} – {fmtTime(end)}</span>
            </div>
          </div>
        </div>

        {/* Right */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="text-right">
            <p className="font-bold text-sm text-foreground">${price.toFixed(2)}</p>
            {method === "wallet" && (
              <div className="flex items-center justify-end gap-0.5 mt-0.5">
                <Wallet className="h-2.5 w-2.5 text-emerald-400" />
                <span className="text-[10px] text-emerald-400">Wallet</span>
              </div>
            )}
            {(method === "paynow" || method === "stripe") && (
              <span className="text-[10px] text-blue-400">PayNow</span>
            )}
          </div>
          {onClick && <ChevronRight className="h-4 w-4 text-muted-foreground/50" />}
        </div>
      </div>

      {/* Status pill */}
      <div className={`mt-3 flex items-center gap-1.5 rounded-md px-2.5 py-1.5 ${cfg.bg} border ${cfg.border}`}>
        <StatusIcon className={`h-3 w-3 ${cfg.color} shrink-0`} />
        <span className={`text-[11px] font-medium ${cfg.color}`}>{cfg.label}</span>
      </div>
    </div>
  );
}

// ── Walk-in Card ──────────────────────────────────────────────────────────────
function WalkinCard({ w, tables, live, onClick }: { w: any; tables: any[]; live?: boolean; onClick?: () => void }) {
  const start = w.startedAt || w.startTime;
  const end = w.stoppedAt || w.endTime;
  const status = live ? "active" : (w.status || "stopped");
  const cfg = getStatusCfg(status);
  const StatusIcon = cfg.icon;
  const fallbackLive = live && start ? Math.floor((Date.now() - new Date(start).getTime()) / 1000) : 0;
  const durationSecs = Number(w.durationSeconds ?? (w.durationMinutes ? w.durationMinutes * 60 : fallbackLive)) || fallbackLive;
  const amount = live ? Number(w.runningCost ?? 0) : Number(w.amountCharged ?? w.totalCost ?? 0);
  const label = resolveTableLabel(w.tableId, tables as any) || "Table ?";

  return (
    <div
      className={`rounded-xl border p-4 transition-all ${
        live ? "border-green-500/40 bg-green-500/5" : `${cfg.border} bg-card/50`
      } ${onClick ? "cursor-pointer hover:bg-muted/30 hover:scale-[1.01] active:scale-[0.99]" : ""}`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className={`mt-0.5 h-9 w-9 rounded-lg border flex items-center justify-center shrink-0 ${
            live ? "bg-green-500/15 border-green-500/30" : `${cfg.bg} ${cfg.border}`
          }`}>
            <Timer className={`h-4 w-4 ${live ? "text-green-400" : cfg.color}`} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-sm text-foreground">{label}</p>
              <span className="text-[10px] font-medium text-accent bg-accent/15 border border-accent/25 rounded px-1.5 py-0.5">Walk-in</span>
              {live && (
                <span className="text-[10px] font-medium text-green-400 bg-green-500/10 border border-green-500/25 rounded px-1.5 py-0.5 animate-pulse">
                  ● Live
                </span>
              )}
            </div>
            <div className="mt-1 space-y-0.5">
              <div className="flex items-center gap-1 text-muted-foreground">
                <Clock className="h-3 w-3 shrink-0" />
                <span className="text-xs">{start ? fmtDate(start) : "—"}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-medium text-foreground">
                  {start ? fmtTime(start) : "—"} – {live ? "now" : (end ? fmtTime(end) : "—")}
                </span>
                {durationSecs > 0 && (
                  <span className="text-xs text-muted-foreground/70">· {fmtDuration(durationSecs)}</span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="text-right">
            <p className={`font-bold text-sm ${live ? "text-green-400" : "text-foreground"}`}>${amount.toFixed(2)}</p>
            <div className="flex items-center justify-end gap-0.5 mt-0.5">
              <Wallet className="h-2.5 w-2.5 text-emerald-400" />
              <span className="text-[10px] text-emerald-400">Wallet</span>
            </div>
          </div>
          {onClick && <ChevronRight className="h-4 w-4 text-muted-foreground/50" />}
        </div>
      </div>

      {/* Status pill */}
      <div className={`mt-3 flex items-center gap-1.5 rounded-md px-2.5 py-1.5 border ${
        live ? "bg-green-500/10 border-green-500/20" : `${cfg.bg} ${cfg.border}`
      }`}>
        <StatusIcon className={`h-3 w-3 ${live ? "text-green-400" : cfg.color} shrink-0`} />
        <span className={`text-[11px] font-medium ${live ? "text-green-400" : cfg.color}`}>{cfg.label}</span>
      </div>
    </div>
  );
}

// ── Admin Timer Session Card ──────────────────────────────────────────────────
function TimerSessionCard({ t, tables, onClick }: { t: any; tables: any[]; onClick?: () => void }) {
  const start = t.startedAt;
  const end = t.endedAt;
  const cfg = getStatusCfg("stopped");
  const StatusIcon = cfg.icon;
  const durationSecs = Number(t.durationSeconds ?? 0);
  const amount = Number(t.amountCharged ?? 0);
  const label = t.tableName || resolveTableLabel(t.tableId, tables as any) || "Table ?";
  return (
    <div
      className={`rounded-xl border ${cfg.border} bg-card/50 p-4 transition-all ${onClick ? "cursor-pointer hover:bg-muted/30 hover:scale-[1.01] active:scale-[0.99]" : ""}`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className={`mt-0.5 h-9 w-9 rounded-lg ${cfg.bg} border ${cfg.border} flex items-center justify-center shrink-0`}>
            <Timer className={`h-4 w-4 ${cfg.color}`} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-sm text-foreground">{label}</p>
              <span className="text-[10px] font-medium text-violet-400 bg-violet-500/10 border border-violet-500/20 rounded px-1.5 py-0.5">Staff Session</span>
            </div>
            <div className="mt-1 space-y-0.5">
              <div className="flex items-center gap-1 text-muted-foreground">
                <Clock className="h-3 w-3 shrink-0" />
                <span className="text-xs">{start ? fmtDate(start) : "—"}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-medium text-foreground">
                  {start ? fmtTime(start) : "—"} – {end ? fmtTime(end) : "—"}
                </span>
                {durationSecs > 0 && (
                  <span className="text-xs text-muted-foreground/70">· {fmtDuration(durationSecs)}</span>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="text-right">
            <p className="font-bold text-sm text-foreground">${amount.toFixed(2)}</p>
            <div className="flex items-center justify-end gap-0.5 mt-0.5">
              <Wallet className="h-2.5 w-2.5 text-emerald-400" />
              <span className="text-[10px] text-emerald-400">Wallet</span>
            </div>
          </div>
          {onClick && <ChevronRight className="h-4 w-4 text-muted-foreground/50" />}
        </div>
      </div>
      <div className={`mt-3 flex items-center gap-1.5 rounded-md px-2.5 py-1.5 ${cfg.bg} border ${cfg.border}`}>
        <StatusIcon className={`h-3 w-3 ${cfg.color} shrink-0`} />
        <span className={`text-[11px] font-medium ${cfg.color}`}>Completed</span>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function DashboardBookings() {
  const { user } = useAuth();
  const { data: bookings } = useMyBookings();
  const { data: tables } = useTables(null, null);
  const { data: walkinHistory } = useMyWalkinHistory();
  const { data: timerHistory } = useMyTimerHistory();
  const { data: activeWalkin } = useMyWalkinSession();
  const [selectedBooking, setSelectedBooking] = useState<any>(null);
  const [selectedWalkin, setSelectedWalkin] = useState<{ session: any; live: boolean } | null>(null);
  const [selectedTimer, setSelectedTimer] = useState<any>(null);
  const [, setNowTick] = useState(0);

  useEffect(() => {
    if (!activeWalkin) return;
    const id = setInterval(() => setNowTick((n) => n + 1), 30000);
    return () => clearInterval(id);
  }, [activeWalkin]);

  const now = nowSG();
  const getStartTime = (b: any) => b.startTime || b.start_time;
  const getStatus = (b: any) => b.status;

  const currentUserId = (user as any)?._id || user?.id;
  const getBookingUserId = (b: any) => {
    const uid = b.userId ?? b.user_id ?? b.user;
    if (uid && typeof uid === "object") return uid._id || uid.id;
    return uid;
  };
  const myBookings = (bookings || []).filter((b: any) => {
    const uid = getBookingUserId(b);
    return !uid || !currentUserId || String(uid) === String(currentUserId);
  });

  const upcoming = myBookings
    .filter((b: any) => {
      const end = new Date(b.endTime || b.end_time || getStartTime(b));
      return end >= now && getStatus(b) !== "cancelled" && getStatus(b) !== "expired";
    })
    .sort((a: any, b: any) => new Date(getStartTime(a)).getTime() - new Date(getStartTime(b)).getTime());

  const pastBookings = myBookings
    .filter((b: any) => {
      const end = new Date(b.endTime || b.end_time || getStartTime(b));
      return end < now || getStatus(b) === "cancelled" || getStatus(b) === "expired";
    })
    .map((b: any) => ({ kind: "booking" as const, when: new Date(getStartTime(b)).getTime(), data: b }));

  const pastWalkins = (walkinHistory || [])
    .filter((w: any) => (w.status || "stopped") !== "active")
    .map((w: any) => ({
      kind: "walkin" as const,
      when: new Date(w.stoppedAt || w.endTime || w.startedAt || w.startTime || 0).getTime(),
      data: w,
    }));

  const pastTimers = (timerHistory || [])
    .map((t: any) => ({
      kind: "timer" as const,
      when: new Date(t.endedAt || t.startedAt || 0).getTime(),
      data: t,
    }));

  const past = [...pastBookings, ...pastWalkins, ...pastTimers].sort((a, b) => b.when - a.when);
  const tableList = (tables as any[]) || [];

  return (
    <>
      {/* Upcoming */}
      <Card className="card-premium">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-blue-400" />
            <CardTitle className="text-base">Upcoming Reservations</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {upcoming.length === 0 ? (
            <div className="text-center py-6">
              <Calendar className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-muted-foreground text-sm">No upcoming reservations</p>
            </div>
          ) : (
            <div className="space-y-3">
              {upcoming.map((b: any) => (
                <BookingCard
                  key={b.id || b._id}
                  b={b}
                  tables={tableList}
                  now={now}
                  onClick={getStatus(b) === "confirmed" ? () => setSelectedBooking(b) : undefined}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Activity History */}
      <Card className="card-premium">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Timer className="h-4 w-4 text-accent" />
            <CardTitle className="text-base">Activity History</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {!activeWalkin && past.length === 0 ? (
            <div className="text-center py-6">
              <Timer className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-muted-foreground text-sm">No past activity yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {activeWalkin && (
                <WalkinCard
                  w={activeWalkin}
                  tables={tableList}
                  live
                  onClick={() => setSelectedWalkin({ session: activeWalkin, live: true })}
                />
              )}
              {past.map((item) =>
                item.kind === "booking" ? (
                  <BookingCard
                    key={`b-${item.data.id || item.data._id}`}
                    b={item.data}
                    tables={tableList}
                    now={now}
                    onClick={
                      getStatus(item.data) === "confirmed" || getStatus(item.data) === "completed"
                        ? () => setSelectedBooking(item.data)
                        : undefined
                    }
                  />
                ) : item.kind === "walkin" ? (
                  <WalkinCard
                    key={`w-${item.data._id || item.data.id}`}
                    w={item.data}
                    tables={tableList}
                    onClick={() => setSelectedWalkin({ session: item.data, live: false })}
                  />
                ) : (
                  <TimerSessionCard
                    key={`t-${item.data._id || item.data.id}`}
                    t={item.data}
                    tables={tableList}
                    onClick={() => setSelectedTimer(item.data)}
                  />
                )
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <BookingDetailDialog
        booking={selectedBooking}
        open={!!selectedBooking}
        onOpenChange={(open) => !open && setSelectedBooking(null)}
      />
      <WalkinReceiptDialog
        session={selectedWalkin?.session ?? null}
        live={selectedWalkin?.live}
        open={!!selectedWalkin}
        onOpenChange={(open) => !open && setSelectedWalkin(null)}
      />
      <TimerSessionReceiptDialog
        session={selectedTimer}
        open={!!selectedTimer}
        onOpenChange={(open) => !open && setSelectedTimer(null)}
      />
    </>
  );
}
