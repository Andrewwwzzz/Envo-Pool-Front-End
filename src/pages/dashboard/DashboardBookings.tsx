import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useMyBookings, useTables } from "@/hooks/useBooking";
import { useMyWalkinHistory, useMyWalkinSession } from "@/hooks/useWalkin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import BookingDetailDialog from "@/components/BookingDetailDialog";
import { fmtDateSG as fmtDate, fmtTimeSG as fmtTime, nowSG } from "@/lib/sgTime";
import { getTableLabel as resolveTableLabel } from "@/lib/tableLabel";

const statusBadge: Record<string, string> = {
  confirmed: "bg-primary/10 text-primary border-primary/20",
  pending: "bg-accent/20 text-accent-foreground border-accent/30",
  pending_payment: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  cancelled: "bg-destructive/10 text-destructive border-destructive/20",
  completed: "bg-muted text-muted-foreground border-border",
  expired: "bg-muted text-muted-foreground border-border",
  active: "bg-green-500/20 text-green-400 border-green-500/30",
};

const paymentBadge = (method?: string | null) => {
  if (!method) return null;
  const m = method.toLowerCase();
  if (m === "wallet") return { label: "Wallet", className: "bg-green-500/10 text-green-400 border-green-500/30" };
  if (m === "paynow" || m === "stripe") return { label: "PayNow", className: "bg-blue-500/10 text-blue-400 border-blue-500/30" };
  return null;
};

const statusLabel = (s: string) => {
  if (s === "pending_payment") return "Pending Payment";
  if (s === "expired") return "Expired";
  if (s === "active") return "In Progress";
  if (s === "stopped") return "Completed";
  return s;
};

function fmtDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.ceil((s % 3600) / 60);
  if (s < 60) return "< 1m";
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function DashboardBookings() {
  const { user } = useAuth();
  const { data: bookings } = useMyBookings();
  const { data: tables } = useTables(null, null);
  const { data: walkinHistory } = useMyWalkinHistory();
  const { data: activeWalkin } = useMyWalkinSession();
  const [selectedBooking, setSelectedBooking] = useState<any>(null);
  const [, setNowTick] = useState(0);

  // Tick every 30s so running cost / elapsed updates for active walk-in
  useEffect(() => {
    if (!activeWalkin) return;
    const id = setInterval(() => setNowTick((n) => n + 1), 30000);
    return () => clearInterval(id);
  }, [activeWalkin]);

  const now = nowSG();
  const getStartTime = (b: any) => b.startTime || b.start_time;
  const getEndTime = (b: any) => b.endTime || b.end_time;
  const getTableLabel = (b: any) => {
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
      if (match) {
        return match.hardware_id
          ? `Table ${String(match.hardware_id).replace(/^T/i, "")}`
          : `Table ${match.table_number ?? "?"}`;
      }
    }
    return "Table ?";
  };
  const getPrice = (b: any) => b.amount ?? b.finalPrice ?? b.final_price ?? b.totalPrice ?? 0;
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
    .filter((b: any) => new Date(getStartTime(b)) >= now && getStatus(b) !== "cancelled")
    .sort((a: any, b: any) => new Date(getStartTime(a)).getTime() - new Date(getStartTime(b)).getTime());
  const pastBookings = myBookings
    .filter((b: any) => new Date(getStartTime(b)) < now || getStatus(b) === "cancelled")
    .map((b: any) => ({ kind: "booking" as const, when: new Date(getStartTime(b)).getTime(), data: b }));

  const pastWalkins = (walkinHistory || [])
    .filter((w: any) => (w.status || "stopped") !== "active")
    .map((w: any) => ({
      kind: "walkin" as const,
      when: new Date(w.stoppedAt || w.endTime || w.startedAt || w.startTime || 0).getTime(),
      data: w,
    }));

  const past = [...pastBookings, ...pastWalkins].sort((a, b) => b.when - a.when);

  const renderBookingRow = (b: any, clickable: boolean) => (
    <div
      key={`b-${b.id || b._id}`}
      className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3 rounded-lg border border-border/50 p-3 sm:p-4 transition-colors ${
        clickable ? "cursor-pointer hover:bg-primary/5 hover:border-primary/30" : ""
      }`}
      onClick={() => clickable && setSelectedBooking(b)}
    >
      <div className="min-w-0">
        <p className="font-medium">{getTableLabel(b)}</p>
        <p className="text-sm text-muted-foreground">
          {fmtDate(getStartTime(b))} {fmtTime(getStartTime(b))} – {fmtTime(getEndTime(b))}
        </p>
      </div>
      <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
        <span className="font-medium">${getPrice(b).toFixed(2)}</span>
        {(() => {
          const pb = paymentBadge(b.paymentMethod ?? b.payment_method);
          return pb ? <Badge variant="outline" className={pb.className}>{pb.label}</Badge> : null;
        })()}
        <Badge variant="outline" className={statusBadge[getStatus(b)] ?? ""}>{statusLabel(getStatus(b))}</Badge>
      </div>
    </div>
  );

  const renderWalkinRow = (w: any, opts: { live?: boolean } = {}) => {
    const start = w.startedAt || w.startTime;
    const end = w.stoppedAt || w.endTime;
    const status = opts.live ? "active" : (w.status || "stopped");
    const durationSecs = Number(
      w.durationSeconds ??
        (w.durationMinutes ? w.durationMinutes * 60 : 0) ??
        (opts.live && start ? Math.floor((Date.now() - new Date(start).getTime()) / 1000) : 0)
    ) || (opts.live && start ? Math.floor((Date.now() - new Date(start).getTime()) / 1000) : 0);
    const amount = opts.live
      ? Number(w.runningCost ?? 0)
      : Number(w.amountCharged ?? w.totalCost ?? 0);
    const label = resolveTableLabel(w.tableId, tables as any) || "Table ?";

    return (
      <div
        key={`w-${w._id || w.id}`}
        className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3 rounded-lg border p-3 sm:p-4 ${
          opts.live ? "border-green-500/40 bg-green-500/5" : "border-border/50"
        }`}
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-medium">{label}</p>
            <Badge variant="outline" className="bg-accent/20 text-accent-foreground border-accent/30">Walk-in</Badge>
            {opts.live && (
              <Badge variant="outline" className="bg-green-500/20 text-green-400 border-green-500/30">Live</Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {start ? `${fmtDate(start)} ${fmtTime(start)}` : "—"}
            {" – "}
            {opts.live ? "now" : (end ? fmtTime(end) : "—")}
            {durationSecs > 0 && <span className="ml-2">· {fmtDuration(durationSecs)}</span>}
          </p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <span className="font-medium tabular-nums">${amount.toFixed(2)}</span>
          <Badge variant="outline" className="bg-green-500/10 text-green-400 border-green-500/30">Wallet</Badge>
          <Badge variant="outline" className={statusBadge[status] ?? ""}>{statusLabel(status)}</Badge>
        </div>
      </div>
    );
  };

  return (
    <>
      <Card className="card-premium">
        <CardHeader><CardTitle className="text-lg">Upcoming Reservations</CardTitle></CardHeader>
        <CardContent>
          {upcoming.length === 0 ? (
            <p className="text-muted-foreground text-sm">No upcoming reservations.</p>
          ) : (
            <div className="space-y-3">
              {upcoming.map((b: any) => renderBookingRow(b, getStatus(b) === "confirmed"))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="card-premium">
        <CardHeader><CardTitle className="text-lg">Activity History</CardTitle></CardHeader>
        <CardContent>
          {!activeWalkin && past.length === 0 ? (
            <p className="text-muted-foreground text-sm">No past activity.</p>
          ) : (
            <div className="space-y-3">
              {activeWalkin && renderWalkinRow(activeWalkin, { live: true })}
              {past.map((item) =>
                item.kind === "booking"
                  ? renderBookingRow(item.data, getStatus(item.data) === "confirmed" || getStatus(item.data) === "completed")
                  : renderWalkinRow(item.data)
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
    </>
  );
}
