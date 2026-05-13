import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAdminTransactions, useAdminBookingLogs, useAdminActivityLogs } from "@/hooks/useAdminLogs";
import { useAdminCustomers, useAdminBookings } from "@/hooks/useAdmin";
import { fmtDateTimeSG, fmtDateSG } from "@/lib/sgTime";
import { ScrollText, FileText, Users } from "lucide-react";
import AdminBookingDetailDialog from "@/components/admin/AdminBookingDetailDialog";

function useUserNameMap() {
  const { data: customers } = useAdminCustomers("");
  return useMemo(() => {
    const map: Record<string, string> = {};
    (customers || []).forEach((c: any) => {
      const display = c.legal_name || c.name || c.email;
      if (c.user_id) map[String(c.user_id)] = display;
      if (c.id) map[String(c.id)] = display;
    });
    return map;
  }, [customers]);
}

function resolveUserDisplay(field: any, fallback: any, nameMap: Record<string, string>): string {
  if (fallback) return String(fallback);
  if (field == null) return "—";
  if (typeof field === "object") {
    return field.legalName || field.legal_name || field.name || field.email || nameMap[String(field._id || field.id)] || "—";
  }
  const id = String(field);
  return nameMap[id] || id;
}

// Convert backend snake_case / camelCase tokens to Title Case (no underscores)
function humanize(input: string): string {
  if (!input) return "—";
  return String(input)
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

const ACTION_LABELS: Record<string, string> = {
  update_wallet_points: "Balance Change",
  update_wallet: "Balance Change",
  verify_user: "Verify User",
  unverify_user: "Unverify User",
  update_profile: "Update Profile",
  delete_user: "Delete User",
  create_booking: "Create Booking",
  cancel_booking: "Cancel Booking",
  refund_booking: "Refund Booking",
  schedule_maintenance: "Schedule Maintenance",
  delete_maintenance: "Remove Maintenance",
  start_timer_session: "Start Timer Session",
  end_timer_session: "End Timer Session",
};

const DETAIL_LABELS: Record<string, string> = {
  walletChange: "Balance Change",
  walletDelta: "Balance Change",
  walletBalance: "New Balance",
  legalName: "Legal Name",
  dateOfBirth: "Date of Birth",
  reason: "Reason",
  startTime: "Start Time",
  endTime: "End Time",
  tableId: "Table",
  amount: "Amount",
  paymentMethod: "Payment Method",
  bookingId: "Booking ID",
};

const HIDDEN_DETAIL_KEYS = new Set(["pointsChange", "points", "pointsDelta", "userName", "name"]);

function actionLabel(action: string): string {
  if (!action) return "—";
  return ACTION_LABELS[action] || humanize(action);
}

function formatDetailValue(key: string, value: any): string {
  if (value == null) return "—";
  if (key === "startTime" || key === "endTime" || key.toLowerCase().includes("date") || key.toLowerCase().includes("at")) {
    const d = new Date(value);
    if (!isNaN(d.getTime())) return fmtDateTimeSG(value);
  }
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function formatDetailsSummary(details: any): string {
  if (details == null) return "—";
  if (typeof details !== "object") return String(details);
  const parts = Object.entries(details)
    .filter(([k]) => !HIDDEN_DETAIL_KEYS.has(k))
    .map(([k, v]) => `${DETAIL_LABELS[k] || humanize(k)}: ${formatDetailValue(k, v)}`);
  return parts.length ? parts.join(", ") : "—";
}

export default function LogsTab() {
  return (
    <Tabs defaultValue="transactions" className="space-y-4">
      <TabsList>
        <TabsTrigger value="transactions" className="gap-1.5">
          <ScrollText className="h-3.5 w-3.5" /> Transactions
        </TabsTrigger>
        <TabsTrigger value="booking-logs" className="gap-1.5">
          <FileText className="h-3.5 w-3.5" /> Booking Logs
        </TabsTrigger>
        <TabsTrigger value="admin-logs" className="gap-1.5">
          <Users className="h-3.5 w-3.5" /> Admin Logs
        </TabsTrigger>
      </TabsList>

      <TabsContent value="transactions"><TransactionsView /></TabsContent>
      <TabsContent value="booking-logs"><BookingLogsView /></TabsContent>
      <TabsContent value="admin-logs"><AdminLogsView /></TabsContent>
    </Tabs>
  );
}

function TransactionsView() {
  const { data, refetch } = useAdminTransactions();
  const transactions = Array.isArray(data) ? data : data?.transactions || [];
  const nameMap = useUserNameMap();
  const [selected, setSelected] = useState<any | null>(null);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Transaction History</CardTitle>
        <Button variant="outline" size="sm" onClick={() => refetch()}>Refresh</Button>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="pb-2 pr-4">User</th>
                <th className="pb-2 pr-4">Amount</th>
                <th className="pb-2 pr-4">Type</th>
                <th className="pb-2 pr-4">Method</th>
                <th className="pb-2">Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((t: any, i: number) => {
                const amt = typeof t.amount === "object" ? (t.amount?.amount ?? 0) : (typeof t.amount === "number" ? t.amount : Number(t.amount) || 0);
                const userObj = typeof t.userId === "object" ? t.userId : null;
                const rawId = typeof t.userId === "string" ? t.userId : (userObj?._id || userObj?.id || "");
                const userDisplay = userObj?.legalName || userObj?.legal_name || t.userName || t.user?.name || userObj?.name || userObj?.email || (rawId ? nameMap[String(rawId)] || `${String(rawId).slice(0, 8)}...` : "—");
                const rawMethod = String(t.paymentMethod || t.payment_method || t.method || "").toLowerCase();
                const methodLabel = rawMethod === "stripe" ? "paynow" : rawMethod;
                const rawType = String(t.type || t.transactionType || "").toLowerCase();
                let typeLabel = rawType === "booking_payment" || rawType === "wallet_deduct" ? "payment" : rawType;
                if (rawMethod === "cash") typeLabel = "timer session";
                const typeClass = rawMethod === "cash"
                  ? "bg-muted text-muted-foreground border-border"
                  : typeLabel === "payment"
                  ? "bg-destructive/10 text-destructive border-destructive/30"
                  : typeLabel === "topup"
                  ? "bg-green-500/10 text-green-400 border-green-500/30"
                  : typeLabel === "refund"
                  ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                  : "";
                const methodClass = rawMethod === "cash"
                  ? "bg-muted text-muted-foreground border-border"
                  : "";
                return (
                  <tr
                    key={t._id || t.id || i}
                    className="border-b border-border last:border-0 cursor-pointer hover:bg-muted/40 transition-colors"
                    onClick={() => setSelected({ ...t, _userDisplay: userDisplay, _typeLabel: typeLabel, _methodLabel: methodLabel, _amount: amt })}
                  >
                    <td className="py-3 pr-4">{userDisplay}</td>
                    <td className="py-3 pr-4 font-medium">
                      <span className={amt >= 0 ? "text-primary" : "text-destructive"}>
                        ${Math.abs(amt).toFixed(2)}
                      </span>
                    </td>
                    <td className="py-3 pr-4">
                      {typeLabel ? <Badge variant="outline" className={`capitalize ${typeClass}`}>{typeLabel}</Badge> : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="py-3 pr-4">
                      {rawMethod === "cash"
                        ? <Badge variant="outline" className={methodClass}>Cash</Badge>
                        : methodLabel === "paynow"
                        ? <span className="capitalize text-muted-foreground">PayNow</span>
                        : <span className="capitalize text-muted-foreground">{methodLabel || "—"}</span>}
                    </td>
                    <td className="py-3 text-muted-foreground">
                      {t.createdAt || t.created_at ? fmtDateTimeSG(t.createdAt || t.created_at) : "—"}
                    </td>
                  </tr>
                );
              })}
              {transactions.length === 0 && (
                <tr><td colSpan={5} className="py-8 text-center text-muted-foreground">No transactions found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
      <DetailsDialog
        open={!!selected}
        onClose={() => setSelected(null)}
        title="Transaction Details"
        rows={selected ? [
          { label: "User", value: selected._userDisplay },
          { label: "Type", value: selected._typeLabel ? humanize(selected._typeLabel) : "—" },
          { label: "Amount", value: `$${Math.abs(selected._amount).toFixed(2)}` },
          { label: "Method", value: selected._methodLabel === "paynow" ? "PayNow" : humanize(selected._methodLabel || "—") },
          { label: "Timestamp", value: selected.createdAt || selected.created_at ? fmtDateTimeSG(selected.createdAt || selected.created_at) : "—" },
          { label: "Reference", value: selected._id || selected.id || "—", mono: true },
        ] : []}
        raw={selected}
      />
    </Card>
  );
}

function BookingLogsView() {
  const { data, refetch } = useAdminBookingLogs();
  const logs = Array.isArray(data) ? data : data?.logs || [];
  const { data: bookingsData } = useAdminBookings(true) as { data: any };
  const bookings = Array.isArray(bookingsData) ? bookingsData : bookingsData?.bookings || [];
  const bookingMap = useMemo(() => {
    const m: Record<string, any> = {};
    bookings.forEach((b: any) => {
      const id = b._id || b.id;
      if (id) m[String(id)] = b;
    });
    return m;
  }, [bookings]);
  const [selectedBooking, setSelectedBooking] = useState<any | null>(null);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Booking Logs</CardTitle>
        <Button variant="outline" size="sm" onClick={() => refetch()}>Refresh</Button>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="pb-2 pr-4">Booking ID</th>
                <th className="pb-2 pr-4">Action</th>
                <th className="pb-2">Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l: any, i: number) => {
                const bid = l.bookingId || l.booking_id;
                const found = bid ? bookingMap[String(bid)] : null;
                return (
                  <tr
                    key={l._id || l.id || i}
                    className="border-b border-border last:border-0 cursor-pointer hover:bg-muted/40 transition-colors"
                    onClick={() => setSelectedBooking(found || { _id: bid, id: bid, status: l.action, details: l.details, createdAt: l.createdAt || l.created_at || l.timestamp })}
                  >
                    <td className="py-3 pr-4 font-mono text-xs">{bid || "—"}</td>
                    <td className="py-3 pr-4">
                      <Badge variant="outline">{actionLabel(l.action)}</Badge>
                    </td>
                    <td className="py-3 text-muted-foreground">
                      {l.createdAt || l.created_at || l.timestamp ? fmtDateTimeSG(l.createdAt || l.created_at || l.timestamp) : "—"}
                    </td>
                  </tr>
                );
              })}
              {logs.length === 0 && (
                <tr><td colSpan={3} className="py-8 text-center text-muted-foreground">No booking logs found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
      <AdminBookingDetailDialog
        booking={selectedBooking}
        open={!!selectedBooking}
        onOpenChange={(open) => { if (!open) setSelectedBooking(null); }}
      />
    </Card>
  );
}

function AdminLogsView() {
  const { data, refetch } = useAdminActivityLogs();
  const logs = Array.isArray(data) ? data : data?.logs || [];
  const nameMap = useUserNameMap();
  const [selected, setSelected] = useState<any | null>(null);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Admin Activity Logs</CardTitle>
        <Button variant="outline" size="sm" onClick={() => refetch()}>Refresh</Button>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="pb-2 pr-4">Admin</th>
                <th className="pb-2 pr-4">Action</th>
                <th className="pb-2 pr-4">Target User</th>
                <th className="pb-2 pr-4">Details</th>
                <th className="pb-2">Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l: any, i: number) => {
                const adminDisplay = resolveUserDisplay(l.adminId, l.adminName || l.admin?.legalName || l.admin?.legal_name || l.admin?.name, nameMap);
                const targetDisplay = resolveUserDisplay(l.targetUserId, l.targetUserName || l.targetUser?.legalName || l.targetUser?.legal_name || l.targetUser?.name, nameMap);
                const summary = formatDetailsSummary(l.details);
                return (
                  <tr
                    key={l._id || l.id || i}
                    className="border-b border-border last:border-0 cursor-pointer hover:bg-muted/40 transition-colors"
                    onClick={() => setSelected({ ...l, _adminDisplay: adminDisplay, _targetDisplay: targetDisplay })}
                  >
                    <td className="py-3 pr-4">{adminDisplay}</td>
                    <td className="py-3 pr-4">
                      <Badge variant="outline">{actionLabel(l.action)}</Badge>
                    </td>
                    <td className="py-3 pr-4">{targetDisplay}</td>
                    <td className="py-3 pr-4 text-xs text-muted-foreground max-w-[200px] truncate">{summary}</td>
                    <td className="py-3 text-muted-foreground">
                      {l.createdAt || l.created_at || l.timestamp ? fmtDateTimeSG(l.createdAt || l.created_at || l.timestamp) : "—"}
                    </td>
                  </tr>
                );
              })}
              {logs.length === 0 && (
                <tr><td colSpan={5} className="py-8 text-center text-muted-foreground">No admin logs found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
      <DetailsDialog
        open={!!selected}
        onClose={() => setSelected(null)}
        title="Admin Activity Details"
        rows={selected ? [
          { label: "Admin", value: selected._adminDisplay },
          { label: "Action", value: actionLabel(selected.action) },
          { label: "Target User", value: selected._targetDisplay },
          { label: "Timestamp", value: selected.createdAt || selected.created_at || selected.timestamp ? fmtDateTimeSG(selected.createdAt || selected.created_at || selected.timestamp) : "—" },
          ...(selected.details && typeof selected.details === "object"
            ? Object.entries(selected.details)
                .filter(([k]) => !HIDDEN_DETAIL_KEYS.has(k))
                .map(([k, v]) => ({ label: DETAIL_LABELS[k] || humanize(k), value: formatDetailValue(k, v) }))
            : selected.details ? [{ label: "Details", value: String(selected.details) }] : []),
        ] : []}
        raw={selected}
      />
    </Card>
  );
}

function DetailsDialog({
  open,
  onClose,
  title,
  rows,
  raw,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  rows: { label: string; value: any; mono?: boolean }[];
  raw?: any;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {rows.map((r, i) => (
            <div key={i} className="grid grid-cols-3 gap-2 text-sm border-b border-border pb-2 last:border-0">
              <div className="text-muted-foreground">{r.label}</div>
              <div className={`col-span-2 break-words ${r.mono ? "font-mono text-xs" : "font-medium"}`}>
                {r.value == null || r.value === "" ? "—" : String(r.value)}
              </div>
            </div>
          ))}
          {raw && (
            <details className="text-xs text-muted-foreground">
              <summary className="cursor-pointer select-none">Raw data</summary>
              <pre className="mt-2 p-2 rounded bg-muted overflow-x-auto whitespace-pre-wrap break-all">{JSON.stringify(raw, null, 2)}</pre>
            </details>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
