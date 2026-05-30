import { useState, useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import AdminBookingDetailDialog from "@/components/admin/AdminBookingDetailDialog";
import CustomerRewardsSection from "@/components/admin/CustomerRewardsSection";
import RewardsTab from "@/components/admin/RewardsTab";
import { useDeviceState, useDeviceControl } from "@/hooks/useDeviceControl";
import { fmtDateSG, fmtTimeSG, fmtDateTimeSG, sgSlotToUTC, getSGDateStr } from "@/lib/sgTime";

import { useAuth } from "@/contexts/AuthContext";

import { Navigate, Link } from "react-router-dom";
import {
  useAdminStats,
  useAdminBookings,
  useDeleteBooking,
  useUpdateBookingStatus,
  useAdminTables,
  useAdminTimerSessions,
  useAdminPricingRules,
  useAdminPromoCodes,
  useAdminCustomers,
  useUpdateCustomerWallet,
  useUpdateCustomerProfile,
  useDeleteCustomer,
  useCustomerBookings,
  useCustomerWalletHistory,
  
  useTableMaintenance,
  useScheduleMaintenance,
  useDeleteMaintenance,
} from "@/hooks/useAdmin";
import LogsTab from "@/components/admin/LogsTab";
import MembershipTab from "@/components/admin/MembershipTab";
import LockersTab from "@/components/admin/LockersTab";
import { OperatingHoursSection } from "@/components/admin/OperatingHoursSection";
import { useAdminTransactions, useAdminActivityLogs } from "@/hooks/useAdminLogs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { LogOut, ArrowLeft, DollarSign, Calendar, BarChart3, Trash2, Search, Users, Timer, Play, Square, Wrench, FileText, ScrollText, Pencil, X, Check, MoreHorizontal, Clock, TrendingUp, Power, PowerOff, RotateCcw, Loader2, Wifi, WifiOff, Download, Copy, XCircle, Eye, EyeOff, AlertTriangle } from "lucide-react";
import ReasonDialog from "@/components/admin/ReasonDialog";
import DeletedBanner, { getDeletedInfo, isDeleted as isRecordDeleted } from "@/components/admin/DeletedBanner";
import { Skeleton } from "@/components/ui/skeleton";
import { getAuthHeaders, apiFetch } from "@/lib/api";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { getTableLabel } from "@/lib/tableLabel";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const Admin = () => {
  const { user, loading, signOut } = useAuth();
  const [tab, setTab] = useState("overview");
  const [pendingCustomerEmail, setPendingCustomerEmail] = useState<string | null>(null);

  if (loading) return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading...</div>;
  if (!user) return <Navigate to="/auth" replace />;
  if (!user.isAdmin) return <Navigate to="/booking" replace />;

  const goToCustomer = (info: { email: string }) => {
    if (!info.email) return;
    setPendingCustomerEmail(info.email);
    setTab("customers");
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <Link to="/booking"><Button variant="ghost" size="sm"><ArrowLeft className="mr-2 h-4 w-4" /> Back</Button></Link>
          <h1 className="text-xl font-semibold text-foreground tracking-tight">Admin Dashboard</h1>
        </div>
        <Button variant="ghost" size="sm" onClick={signOut}><LogOut className="mr-2 h-4 w-4" /> Sign Out</Button>
      </header>

      <main className="mx-auto max-w-6xl p-4 sm:p-6">
        <Tabs value={tab} onValueChange={setTab} className="space-y-6">
          <TabsList className="flex-wrap">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="bookings">Bookings</TabsTrigger>
            <TabsTrigger value="tables">Tables</TabsTrigger>
            <TabsTrigger value="invoices">Invoices</TabsTrigger>
            <TopUpsTabTrigger />
            <TabsTrigger value="customers">Customers</TabsTrigger>
            <TabsTrigger value="rewards">Rewards</TabsTrigger>
            <TabsTrigger value="pricing">Pricing</TabsTrigger>
            <TabsTrigger value="promos">Promos</TabsTrigger>
            <TabsTrigger value="membership">Membership</TabsTrigger>
            <TabsTrigger value="lockers">Lockers</TabsTrigger>
            
            <VerificationTabTrigger />
            <TabsTrigger value="logs">Logs</TabsTrigger>
          </TabsList>

          <TabsContent value="overview"><OverviewTab /></TabsContent>
          <TabsContent value="bookings"><BookingsTab /></TabsContent>
          <TabsContent value="tables"><TablesTab /></TabsContent>
          <TabsContent value="invoices"><InvoicesTab /></TabsContent>
          <TabsContent value="topups"><TopUpsTab /></TabsContent>
          <TabsContent value="customers">
            <CustomersTab
              pendingEmail={pendingCustomerEmail}
              onPendingHandled={() => setPendingCustomerEmail(null)}
            />
          </TabsContent>
          <TabsContent value="rewards"><RewardsTab onCustomerClick={goToCustomer} /></TabsContent>
          <TabsContent value="pricing"><PricingTab /></TabsContent>
          <TabsContent value="promos"><PromosTab /></TabsContent>
          <TabsContent value="membership"><MembershipTab /></TabsContent>
          <TabsContent value="lockers"><LockersTab /></TabsContent>
          
          <TabsContent value="verification"><VerificationTab /></TabsContent>
          <TabsContent value="logs"><LogsTab /></TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

type PeriodKey = "today" | "this_week" | "this_month" | "last_month" | "this_year" | "all_time";

function getPeriodRange(period: PeriodKey): { from: string; to: string } {
  const toISO = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const now = new Date();
  if (period === "today") {
    return { from: toISO(now), to: toISO(now) };
  }
  if (period === "this_week") {
    // Week starts Monday
    const day = now.getDay(); // 0=Sun..6=Sat
    const diffToMonday = (day + 6) % 7;
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diffToMonday);
    const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
    return { from: toISO(monday), to: toISO(sunday) };
  }
  if (period === "this_month") {
    return { from: toISO(new Date(now.getFullYear(), now.getMonth(), 1)), to: toISO(new Date(now.getFullYear(), now.getMonth() + 1, 0)) };
  }
  if (period === "last_month") {
    return { from: toISO(new Date(now.getFullYear(), now.getMonth() - 1, 1)), to: toISO(new Date(now.getFullYear(), now.getMonth(), 0)) };
  }
  if (period === "this_year") {
    return { from: toISO(new Date(now.getFullYear(), 0, 1)), to: toISO(new Date(now.getFullYear(), 11, 31)) };
  }
  return { from: "2000-01-01", to: toISO(now) };
}

function OverviewTab() {
  const { toast } = useToast();
  const [period, setPeriod] = useState<PeriodKey>("this_month");
  const { from, to } = getPeriodRange(period);

  const { data: stats } = useAdminStats(from, to) as { data: any };
  const { data: bookings } = useAdminBookings() as { data: any };
  const { data: transactions } = useAdminTransactions() as { data: any };
  const { data: timerSessions } = useAdminTimerSessions() as { data: any };

  const [reportFrom, setReportFrom] = useState(from);
  const [reportTo, setReportTo] = useState(to);
  useEffect(() => { setReportFrom(from); setReportTo(to); }, [from, to]);
  const [generating, setGenerating] = useState(false);

  const inRange = (raw: any): boolean => {
    if (!raw) return false;
    const d = new Date(raw);
    if (isNaN(d.getTime())) return false;
    const startD = new Date(`${from}T00:00:00+08:00`);
    const endD = new Date(`${to}T23:59:59+08:00`);
    return d >= startD && d <= endD;
  };

  // Average booking value
  const avgBookingValue = stats && stats.totalBookings > 0
    ? stats.totalRevenue / stats.totalBookings
    : 0;

  // Most booked table (client-side from bookings in range)
  const mostBookedTable = (() => {
    if (stats?.mostBookedTable) return stats.mostBookedTable;
    const counts: Record<string, number> = {};
    for (const b of bookings || []) {
      const created = b.createdAt || b.created_at || b.startTime || b.start_time;
      if (!inRange(created)) continue;
      const t = b.tableId;
      const name = typeof t === "string"
        ? `Table ${t.replace("T", "")}`
        : (t?.name || (t?.tableNumber ? `Table ${t.tableNumber}` : null)) || "Unknown";
      counts[name] = (counts[name] || 0) + 1;
    }
    let best: { name: string; count: number } | null = null;
    for (const [name, count] of Object.entries(counts)) {
      if (!best || count > best.count) best = { name, count };
    }
    return best ? `${best.name} (${best.count})` : "—";
  })();

  // Wallet top-ups this period
  const walletTopups = (() => {
    if (typeof stats?.walletTopups === "number") return stats.walletTopups;
    const txs = Array.isArray(transactions) ? transactions : (transactions?.transactions ?? []);
    let total = 0;
    for (const t of txs) {
      const type = String(t.type || "").toLowerCase();
      if (type !== "topup" && type !== "top_up" && type !== "wallet_topup") continue;
      const date = t.createdAt || t.created_at;
      if (!inRange(date)) continue;
      const status = String(t.status || "").toLowerCase();
      if (status && status !== "approved" && status !== "completed" && status !== "success") continue;
      total += Number(t.amount || 0);
    }
    return total;
  })();

  // Cash collected from timer sessions
  const cashCollected = (() => {
    if (typeof stats?.cashCollected === "number") return stats.cashCollected;
    const sessions = Array.isArray(timerSessions) ? timerSessions : (timerSessions?.sessions ?? []);
    let total = 0;
    for (const s of sessions) {
      const date = s.endedAt || s.ended_at || s.startedAt || s.started_at || s.createdAt || s.created_at;
      if (!inRange(date)) continue;
      total += Number(s.totalCost ?? s.total_cost ?? s.amount ?? 0);
    }
    return total;
  })();

  const handleDownload = async () => {
    setGenerating(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`https://api.envopoolsg.com/api/admin/report/sales?from=${reportFrom}&to=${reportTo}`, {
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to generate report");
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `EnvoPool-Report-${reportFrom}-to-${reportTo}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (e) {
      toast({ title: "Error", description: "Failed to generate report. Please try again.", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const periodOptions: { key: PeriodKey; label: string }[] = [
    { key: "today", label: "Today" },
    { key: "this_week", label: "This Week" },
    { key: "this_month", label: "This Month" },
    { key: "last_month", label: "Last Month" },
    { key: "this_year", label: "This Year" },
    { key: "all_time", label: "All Time" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-1 flex-wrap">
          {periodOptions.map((opt) => (
            <Button
              key={opt.key}
              size="sm"
              variant={period === opt.key ? "default" : "outline"}
              onClick={() => setPeriod(opt.key)}
            >
              {opt.label}
            </Button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">{from} → {to}</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <Card><CardContent className="pt-6 text-center">
          <DollarSign className="h-6 w-6 mx-auto text-primary mb-2" />
          <p className="text-2xl font-bold">${(stats?.totalRevenue ?? 0).toFixed(2)}</p>
          <p className="text-sm text-muted-foreground">Total Revenue</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6 text-center">
          <Users className="h-6 w-6 mx-auto text-primary mb-2" />
          <p className="text-2xl font-bold">{stats?.totalUsers ?? 0}</p>
          <p className="text-sm text-muted-foreground">Total Users</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6 text-center">
          <Calendar className="h-6 w-6 mx-auto text-primary mb-2" />
          <p className="text-2xl font-bold">{stats?.totalBookings ?? 0}</p>
          <p className="text-sm text-muted-foreground">Total Bookings</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6 text-center">
          <BarChart3 className="h-6 w-6 mx-auto text-primary mb-2" />
          <p className="text-2xl font-bold">{stats?.totalTransactions ?? 0}</p>
          <p className="text-sm text-muted-foreground">Total Transactions</p>
        </CardContent></Card>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <Card><CardContent className="pt-6 text-center">
          <TrendingUp className="h-6 w-6 mx-auto text-primary mb-2" />
          <p className="text-2xl font-bold">${avgBookingValue.toFixed(2)}</p>
          <p className="text-sm text-muted-foreground">Avg Booking Value</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6 text-center">
          <Calendar className="h-6 w-6 mx-auto text-primary mb-2" />
          <p className="text-lg font-bold truncate">{mostBookedTable}</p>
          <p className="text-sm text-muted-foreground">Most Booked Table</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6 text-center">
          <DollarSign className="h-6 w-6 mx-auto text-primary mb-2" />
          <p className="text-2xl font-bold">${walletTopups.toFixed(2)}</p>
          <p className="text-sm text-muted-foreground">Wallet Top-Ups</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6 text-center">
          <DollarSign className="h-6 w-6 mx-auto text-primary mb-2" />
          <p className="text-2xl font-bold">${cashCollected.toFixed(2)}</p>
          <p className="text-sm text-muted-foreground">Cash Collected</p>
        </CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sales Report</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="report-from">From</Label>
              <Input id="report-from" type="date" value={reportFrom} onChange={(e) => setReportFrom(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="report-to">To</Label>
              <Input id="report-to" type="date" value={reportTo} onChange={(e) => setReportTo(e.target.value)} />
            </div>
          </div>
          <Button
            onClick={handleDownload}
            disabled={generating}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            {generating ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating...</>
            ) : (
              <><Download className="mr-2 h-4 w-4" /> Download PDF Report</>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

type BookingFilter = "all" | "today" | "upcoming" | "completed" | "cancelled";

function BookingsTab() {
  const [filter, setFilter] = useState<BookingFilter>("all");
  const [search, setSearch] = useState("");
  const { data: bookings, isLoading } = useAdminBookings(false);
  const { data: tablesList } = useAdminTables();
  const updateStatus = useUpdateBookingStatus();
  const [selectedBooking, setSelectedBooking] = useState<any | null>(null);
  const [cancelTargetId, setCancelTargetId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);

  const getField = (b: any, ...keys: string[]) => {
    for (const k of keys) if (b[k] !== undefined) return b[k];
    return undefined;
  };
  const getBookingId = (b: any) => b._id || b.id;

  const filtered = (bookings || []).filter((b: any) => {
    if (b.isDeleted === true) return false;
    const startDate = new Date(getField(b, "startTime", "start_time"));
    const endDate = new Date(getField(b, "endTime", "end_time"));
    switch (filter) {
      case "today": if (!(startDate >= todayStart && startDate <= todayEnd)) return false; break;
      case "upcoming": if (!(startDate > now && (b.status === "confirmed" || b.status === "pending"))) return false; break;
      case "completed": if (!(b.status === "completed" || (b.status === "confirmed" && endDate < now))) return false; break;
      case "cancelled": if (b.status !== "cancelled") return false; break;
    }
    const q = search.trim().toLowerCase();
    if (!q) return true;
    const u = b.userId || b.user || {};
    const tableName = getTableLabel(b.tableId, tablesList as any, b).toLowerCase();
    const dateStr = (fmtDateSG(getField(b, "startTime", "start_time")) || "").toLowerCase();
    const haystack = [
      typeof u === "object" ? u.name : "",
      typeof u === "object" ? u.email : "",
      typeof u === "object" ? u.shortId : "",
      b.customerName, b.customerEmail, b.shortId,
      tableName,
      b._id, b.id,
      dateStr,
    ].filter(Boolean).join(" ").toLowerCase();
    return haystack.includes(q);
  });

  return (
    <>
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <CardTitle>All Bookings</CardTitle>
          <div className="flex flex-wrap gap-1.5">
            {(["all", "today", "upcoming", "completed", "cancelled"] as BookingFilter[]).map((f) => (
              <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} onClick={() => setFilter(f)} className="capitalize text-xs h-7 px-2.5">
                {f}
              </Button>
            ))}
          </div>
        </div>
        <div className="relative mt-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, short ID, table, booking ID, or date (e.g. 14/05)"
            className="pl-9 h-9"
          />
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border text-left">
              <th className="pb-2 pr-4">Table</th>
              <th className="pb-2 pr-4">Date</th>
              <th className="pb-2 pr-4">Time</th>
              <th className="pb-2 pr-4">Duration</th>
              <th className="pb-2 pr-4">Price</th>
              <th className="pb-2 pr-4">Payment</th>
              <th className="pb-2 pr-4">Status</th>
              <th className="pb-2">Actions</th>
            </tr></thead>
            <tbody>
              {isLoading && (bookings || []).length === 0 ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={`sk-${i}`} className="border-b border-border last:border-0">
                    {Array.from({ length: 8 }).map((__, j) => (
                      <td key={j} className="py-3 pr-4"><Skeleton className="h-4 w-20" /></td>
                    ))}
                  </tr>
                ))
              ) : (
              <>
              {filtered.map((b) => {
                const bookingId = getBookingId(b);
                const canCancel = b.status === "confirmed";
                return (
                  <tr key={bookingId} className="border-b border-border last:border-0 cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setSelectedBooking(b)}>
                    <td className="py-3 pr-4">{getTableLabel(b.tableId, tablesList as any, b)}</td>
                    <td className="py-3 pr-4">{fmtDateSG(getField(b, "startTime", "start_time"))}</td>
                    <td className="py-3 pr-4">{fmtTimeSG(getField(b, "startTime", "start_time"))} – {fmtTimeSG(getField(b, "endTime", "end_time"))}</td>
                    <td className="py-3 pr-4">{(() => { const s = b.startTime || b.start_time; const e = b.endTime || b.end_time; const mins = s && e ? Math.round((new Date(e).getTime() - new Date(s).getTime()) / 60000) : 0; const h = Math.floor(mins / 60); const m = mins % 60; return m > 0 ? `${h}h ${m}m` : `${h}h`; })()}</td>
                    <td className="py-3 pr-4">${(getField(b, "amount", "finalPrice", "final_price", "price") ?? 0).toFixed(2)}</td>
                    <td className="py-3 pr-4 capitalize">{getField(b, "paymentMethod", "payment_method", "inferredPaymentMethod") ?? (b.paymentStatus === "paid" ? "paynow" : "—")}</td>
                    <td className="py-3 pr-4">
                      <Badge variant="outline" className={`capitalize ${
                        b.status === "refunded" ? "text-orange-600 border-orange-300" :
                        b.status === "no_show" ? "text-red-600 border-red-300" :
                        b.status === "cancelled" ? "text-destructive border-destructive/30" : ""
                      }`}>{b.status === "no_show" ? "No Show" : b.status}</Badge>
                    </td>
                    <td className="py-3">
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        {canCancel && (
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Cancel booking"
                            onClick={() => { setCancelTargetId(bookingId); setCancelReason(""); }}
                            disabled={updateStatus.isPending}
                            className="text-destructive hover:text-destructive gap-1"
                          >
                            <X className="h-4 w-4" /> Cancel
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="py-8 text-center text-muted-foreground">No bookings found</td></tr>
              )}
              </>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>

    <AdminBookingDetailDialog
      booking={selectedBooking}
      open={!!selectedBooking}
      onOpenChange={(open) => { if (!open) setSelectedBooking(null); }}
      onCancel={(bookingId) => {
        setCancelTargetId(bookingId);
        setCancelReason("");
        setSelectedBooking(null);
      }}
    />

    <Dialog open={!!cancelTargetId} onOpenChange={(o) => { if (!o) { setCancelTargetId(null); setCancelReason(""); } }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancel Booking</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">Please provide a reason for cancelling this booking.</p>
        <Textarea
          value={cancelReason}
          onChange={(e) => setCancelReason(e.target.value)}
          placeholder="Reason for cancellation (min 5 characters)"
          rows={4}
          maxLength={500}
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => { setCancelTargetId(null); setCancelReason(""); }}>Go Back</Button>
          <Button
            variant="destructive"
            disabled={cancelReason.trim().length < 5 || updateStatus.isPending}
            onClick={() => {
              if (!cancelTargetId) return;
              updateStatus.mutate(
                { bookingId: cancelTargetId, status: "cancelled", reason: cancelReason.trim() },
                { onSuccess: () => { setCancelTargetId(null); setCancelReason(""); } },
              );
            }}
          >
            Confirm Cancellation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}

function DeviceControlPanel({ hardwareId }: { hardwareId: string | null }) {
  const { state, loading, error } = useDeviceState(hardwareId);
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
        {error && <span className="text-xs text-destructive">{error}</span>}
      </div>
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

function TablesTab() {
  const { data: tables, startTimer, stopTimer, setMaintenance } = useAdminTables();
  const { data: bookings } = useAdminBookings();
  const [elapsed, setElapsed] = useState<Record<string, number>>({});
  const [completedSessions, setCompletedSessions] = useState<Record<string, { seconds: number; cost: number }>>({});
  const [hourlyRate, setHourlyRate] = useState("20");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  const openTable = (tableId: string) => {
    setCompletedSessions((prev) => {
      const copy = { ...prev };
      delete copy[tableId];
      return copy;
    });
    startTimer.mutate({ tableId, hourlyRate: rate });
  };

  const closeTable = (tableId: string) => {
    const table = (tables || []).find((t) => t.id === tableId);
    const tableRate = table?.hourly_rate ?? rate;
    const seconds = elapsed[tableId] ?? 0;
    const cost = Math.round((seconds / 3600) * Number(tableRate) * 100) / 100;
    setCompletedSessions((prev) => ({ ...prev, [tableId]: { seconds, cost } }));
    const startedAt = table?.timer_started_at
      ? new Date(table.timer_started_at).toISOString()
      : new Date(Date.now() - seconds * 1000).toISOString();
    const payload = {
      tableId,
      durationSeconds: seconds,
      hourlyRate: Number(tableRate),
      startedAt,
    };
    console.log("[closeTable] calling stopTimer.mutate with:", payload);
    stopTimer.mutate(payload);
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Manage Tables</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {(tables || []).map((t) => {
              const isRunning = !!t.timer_started_at;
              const seconds = elapsed[t.id] ?? 0;
              const session = completedSessions[t.id];
              const tableRate = isRunning ? Number(t.hourly_rate ?? rate) : rate;

              // Check if table has active bookings blocking timer open
              const now = new Date();
              const hasActiveBooking = !isRunning && (bookings || []).some((b) => {
                if (b.table_id !== t.id) return false;
                if (!["pending", "confirmed"].includes(b.status)) return false;
                return new Date(b.start_time) <= now && new Date(b.end_time) > now;
              });

              const isMaintenance = !isRunning && t.status === "maintenance";

              return (
                <div key={t.id} className={`rounded-xl border p-4 space-y-3 ${isMaintenance ? "border-destructive/30 bg-destructive/5" : "border-border"}`}>
                  <div className="flex items-center justify-between">
                    <p className="font-medium">Table {t.table_number}</p>
                    <Badge variant="outline" className={
                      isRunning ? "bg-primary/10 text-primary border-primary/20" 
                      : isMaintenance ? "bg-destructive/10 text-destructive border-destructive/20"
                      : hasActiveBooking ? "bg-accent/20 text-accent-foreground border-accent/30" 
                      : "capitalize"
                    }>
                      {isRunning ? "In Use" : isMaintenance ? "Maintenance" : hasActiveBooking ? "Has Booking" : "Available"}
                    </Badge>
                  </div>

                  {/* Timer display */}
                  <div className="flex items-center gap-2">
                    <Timer className="h-4 w-4 text-muted-foreground" />
                    <span className={`font-mono text-xl ${isRunning ? "text-primary" : "text-muted-foreground"}`}>
                      {formatTime(isRunning ? seconds : (session?.seconds ?? 0))}
                    </span>
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
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="space-y-2">
                    {isRunning ? (
                      <Button size="sm" variant="destructive" onClick={() => closeTable(t.id)} className="w-full">
                        <Square className="mr-2 h-3 w-3" /> Close Table
                      </Button>
                    ) : (
                      <Button size="sm" variant="default" onClick={() => openTable(t.id)} className="w-full" disabled={hasActiveBooking || isMaintenance} title={hasActiveBooking ? "Table has an active booking" : isMaintenance ? "Table is under maintenance" : undefined}>
                        <Play className="mr-2 h-3 w-3" /> Open Table
                      </Button>
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

      <OperatingHoursSection />
    </div>
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


function InvoiceDetailDialog({ session, onClose, onDelete }: { session: any | null; onClose: () => void; onDelete: () => void }) {
  if (!session) return null;
  const s = session;
  const id = String(s._id || s.id || "");
  const shortId = id.slice(-8).toUpperCase();
  const isDeleted = s.isDeleted === true;
  const startedAt = s.startedAt || s.started_at;
  const endedAt = s.endedAt || s.ended_at;
  const createdAt = s.createdAt || s.created_at || startedAt;
  const durationSeconds = Number(s.durationSeconds ?? s.duration_seconds ?? 0);
  const h = Math.floor(durationSeconds / 3600);
  const m = Math.floor((durationSeconds % 3600) / 60);
  const durationLabel = h && m ? `${h}h ${m}m` : h ? `${h}h` : `${m}m`;
  const hours = durationSeconds / 3600;
  const rate = Number(s.hourlyRate ?? s.hourly_rate ?? 0);
  const amount = Number(s.amountCharged ?? s.amount_charged ?? s.total_cost ?? 0);
  const staff = s.startedBy?.name || s.startedBy?.email || "—";
  const tableName = s.tableName || (s.tables?.table_number ? `Table ${s.tables.table_number}` : "—");

  const copyId = () => { if (id) navigator.clipboard.writeText(id); };

  return (
    <Dialog open={!!session} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-lg gold-gradient">Invoice Details</DialogTitle>
          <DialogDescription className="sr-only">Timer session invoice</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 pt-2">
          {isDeleted && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm space-y-1">
              <div className="font-semibold text-destructive">This invoice has been deleted</div>
              {(s.deletionReason || s.deletedReason) && <div><span className="text-muted-foreground">Reason: </span>{s.deletionReason || s.deletedReason}</div>}
              {(s.deletedBy?.name || s.deletedBy?.email || typeof s.deletedBy === "string") && (
                <div><span className="text-muted-foreground">Deleted by: </span>{s.deletedBy?.name || s.deletedBy?.email || s.deletedBy}</div>
              )}
              {s.deletedAt && <div><span className="text-muted-foreground">Deleted at: </span>{fmtDateTimeSG(s.deletedAt)}</div>}
            </div>
          )}

          {/* Session Information */}
          <section className="space-y-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Session Information</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-muted-foreground">Invoice ID</div>
                <div className="flex items-center gap-2">
                  <div className="font-mono font-medium">#{shortId}</div>
                  <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={copyId} aria-label="Copy invoice ID">
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Status</div>
                {isDeleted ? (
                  <Badge variant="outline" className="bg-destructive/15 text-destructive border-destructive/40">Deleted</Badge>
                ) : (
                  <Badge variant="outline" className="bg-emerald-500/15 text-emerald-500 border-emerald-500/40">Active</Badge>
                )}
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
                <div className="font-medium">{startedAt ? fmtDateSG(startedAt) : "—"}</div>
              </div>
            </div>

            <div className="rounded-md border border-border/50 bg-background/40 p-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground tabular-nums">
                  {startedAt ? fmtTimeSG(startedAt) : "—"} – {endedAt ? fmtTimeSG(endedAt) : "—"}
                  <span className="ml-2 text-xs opacity-70">@ ${rate.toFixed(2)}/hr · {durationLabel}</span>
                </span>
                <span className="font-medium tabular-nums">${amount.toFixed(2)}</span>
              </div>
            </div>
          </section>

          <Separator className="bg-border/50" />

          {/* Billing */}
          <section className="space-y-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Billing Details</h3>
            <div className="rounded-md border border-border/50 p-3 space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Hourly rate</span>
                <span className="tabular-nums">${rate.toFixed(2)} / hr</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Duration</span>
                <span className="tabular-nums">{hours.toFixed(2)} hrs</span>
              </div>
              <Separator className="bg-border/50 my-1" />
              <div className="flex justify-between font-bold text-base">
                <span>Total Charged</span>
                <span className={isDeleted ? "line-through text-muted-foreground tabular-nums" : "gold-gradient tabular-nums"}>
                  ${amount.toFixed(2)}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm pt-1">
              <div>
                <div className="text-muted-foreground">Method</div>
                <Badge variant="outline" className="bg-muted text-muted-foreground border-border">Cash</Badge>
              </div>
              <div>
                <div className="text-muted-foreground">Closed at</div>
                <div className="font-medium">{endedAt ? fmtDateTimeSG(endedAt) : "—"}</div>
              </div>
            </div>
          </section>

          <Separator className="bg-border/50" />

          {/* Staff */}
          <section className="space-y-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Staff Details</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-muted-foreground">Opened by</div>
                <div className="font-medium">{staff}</div>
              </div>
            </div>
          </section>
        </div>

        {!isDeleted && (
          <DialogFooter className="pt-2">
            <Button variant="destructive" onClick={onDelete}>
              <Trash2 className="h-4 w-4 mr-1" /> Delete Invoice
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}


function InvoicesTab() {
  const [showDeleted, setShowDeleted] = useState(false);
  const { data, isLoading } = useAdminTimerSessions(showDeleted);
  const sessions: any[] = Array.isArray(data) ? data : (data?.sessions || data?.timerSessions || []);
  const { toast } = useToast();
  const qc = useQueryClient();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deleteReason, setDeleteReason] = useState("");
  const [selectedSession, setSelectedSession] = useState<any | null>(null);

  const handleDelete = async (id: string, reason: string) => {
    setDeletingId(id);
    try {
      const res = await apiFetch(`/api/admin/timer-sessions/${id}`, {
        method: "DELETE",
        body: JSON.stringify({ reason }),
      });
      if (!res.ok) throw new Error("Failed");
      toast({ title: "Invoice deleted" });
      qc.invalidateQueries({ queryKey: ["admin-timer-sessions"] });
      qc.invalidateQueries({ queryKey: ["admin-timer-sessions", true] });
      setDeleteTargetId(null);
      setDeleteReason("");
    } catch {
      toast({ title: "Failed to delete invoice", variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  };

  const formatDuration = (seconds: number) => {
    const total = Math.max(0, Math.floor(Number(seconds) || 0));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    return `${h}h ${m}m`;
  };

  const formatDateLong = (d: string | Date) =>
    new Date(d).toLocaleDateString("en-GB", {
      timeZone: "Asia/Singapore",
      day: "numeric",
      month: "short",
      year: "numeric",
    });

  return (
    <>
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" /> Timer Session Invoices
          </CardTitle>
          <Button
            size="sm"
            variant={showDeleted ? "default" : "outline"}
            onClick={() => setShowDeleted((v) => !v)}
            className="text-xs h-7"
          >
            {showDeleted ? "Hide Deleted" : "Show Deleted"}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading && !sessions.length ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : !sessions.length ? (
          <p className="text-muted-foreground text-sm">No timer sessions yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="pb-2 pr-4">Date</th>
                  <th className="pb-2 pr-4">Table</th>
                  <th className="pb-2 pr-4">Start Time</th>
                  <th className="pb-2 pr-4">End Time</th>
                  <th className="pb-2 pr-4">Duration</th>
                  <th className="pb-2 pr-4">Rate</th>
                  <th className="pb-2 pr-4">Amount</th>
                  <th className="pb-2 pr-4">Staff</th>
                  <th className="pb-2"></th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s: any) => {
                  const startedAt = s.startedAt || s.started_at;
                  const endedAt = s.endedAt || s.ended_at;
                  const duration = s.durationSeconds ?? s.duration_seconds ?? 0;
                  const rate = Number(s.hourlyRate ?? s.hourly_rate ?? 0);
                  const amount = Number(s.amountCharged ?? s.amount_charged ?? s.total_cost ?? 0);
                  const staff = s.startedBy?.name || s.startedBy?.email || "—";
                  const isDeleted = s.isDeleted === true;
                  const deletedBy = s.deletedBy?.name || s.deletedBy?.email || (typeof s.deletedBy === "string" ? s.deletedBy : "");
                  const tooltipText = isDeleted
                    ? `Reason: ${s.deletionReason || "—"}\nDeleted by: ${deletedBy || "—"}${s.deletedAt ? `\nDeleted at: ${fmtDateTimeSG(s.deletedAt)}` : ""}`
                    : undefined;
                  return (
                    <tr
                      key={s._id || s.id}
                      className={`border-b border-border last:border-0 cursor-pointer hover:bg-muted/30 ${isDeleted ? "opacity-60" : ""}`}
                      title={tooltipText}
                      onClick={() => setSelectedSession(s)}
                    >
                      <td className="py-3 pr-4">{startedAt ? formatDateLong(startedAt) : "—"}</td>
                      <td className="py-3 pr-4">{s.tableName || (s.tables?.table_number ? `Table ${s.tables.table_number}` : "—")}</td>
                      <td className="py-3 pr-4">{startedAt ? fmtTimeSG(startedAt) : "—"}</td>
                      <td className="py-3 pr-4">{endedAt ? fmtTimeSG(endedAt) : "—"}</td>
                      <td className="py-3 pr-4 font-mono">{formatDuration(duration)}</td>
                      <td className="py-3 pr-4">${rate.toFixed(0)}/hr</td>
                      <td className={`py-3 pr-4 font-medium ${isDeleted ? "line-through text-muted-foreground" : ""}`}>${amount.toFixed(2)}</td>
                      <td className="py-3 pr-4 text-muted-foreground">{staff}</td>
                      <td className="py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        {isDeleted ? (
                          <Badge variant="outline" className="bg-muted text-muted-foreground border-border">Deleted</Badge>
                        ) : (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            disabled={deletingId === (s._id || s.id)}
                            onClick={() => { setDeleteTargetId(s._id || s.id); setDeleteReason(""); }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>

    <InvoiceDetailDialog
      session={selectedSession}
      onClose={() => setSelectedSession(null)}
      onDelete={() => {
        if (selectedSession) {
          setDeleteTargetId(selectedSession._id || selectedSession.id);
          setDeleteReason("");
          setSelectedSession(null);
        }
      }}
    />

    <Dialog open={!!deleteTargetId} onOpenChange={(o) => { if (!o) { setDeleteTargetId(null); setDeleteReason(""); } }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Invoice</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">Please provide a reason for deleting this invoice. This action cannot be undone.</p>
        <Textarea
          value={deleteReason}
          onChange={(e) => setDeleteReason(e.target.value)}
          placeholder="Reason for deletion (min 5 characters)"
          rows={4}
          maxLength={500}
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => { setDeleteTargetId(null); setDeleteReason(""); }}>Go Back</Button>
          <Button
            variant="destructive"
            disabled={deleteReason.trim().length < 5 || deletingId === deleteTargetId}
            onClick={() => { if (deleteTargetId) handleDelete(deleteTargetId, deleteReason.trim()); }}
          >
            Confirm Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}

function CustomersTab({
  pendingEmail,
  onPendingHandled,
}: {
  pendingEmail?: string | null;
  onPendingHandled?: () => void;
} = {}) {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const { data: customers, isLoading } = useAdminCustomers(debouncedSearch);
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  // Handle incoming pending customer email (e.g. from Rewards tab)
  useEffect(() => {
    if (pendingEmail) {
      setSearch(pendingEmail);
      setDebouncedSearch(pendingEmail);
      setSelectedCustomer(null);
    }
  }, [pendingEmail]);

  useEffect(() => {
    if (pendingEmail && customers && customers.length) {
      const match = customers.find((c: any) =>
        (c.email || "").toLowerCase() === pendingEmail.toLowerCase()
      );
      if (match) {
        setSelectedCustomer(match);
        onPendingHandled?.();
      }
    }
  }, [pendingEmail, customers, onPendingHandled]);

  if (selectedCustomer) {
    return <CustomerDetail customer={selectedCustomer} onBack={() => setSelectedCustomer(null)} />;
  }


  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" /> Customer Management
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email or Short ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        

        {customers && customers.length === 0 && (
          <p className="text-muted-foreground text-sm">No customers found.</p>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border text-left">
              <th className="pb-2 pr-4">Name</th>
              <th className="pb-2 pr-4">Short ID</th>
              <th className="pb-2 pr-4">Email</th>
              <th className="pb-2 pr-4">Status</th>
              <th className="pb-2 pr-4">Role</th>
              <th className="pb-2 pr-4">Wallet</th>
              
              <th className="pb-2 pr-4">Total Spent</th>
              <th className="pb-2">Joined</th>
            </tr></thead>
            <tbody>
              {isLoading && (!customers || customers.length === 0) ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={`csk-${i}`} className="border-b border-border last:border-0">
                    {Array.from({ length: 8 }).map((__, j) => (
                      <td key={j} className="py-3 pr-4"><Skeleton className="h-4 w-20" /></td>
                    ))}
                  </tr>
                ))
              ) : (customers || []).map((c: any) => (
                <tr
                  key={c.id}
                  className="border-b border-border last:border-0 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => setSelectedCustomer(c)}
                >
                  <td className="py-3 pr-4 font-medium">{c.legal_name || c.name || "—"}</td>
                  <td className="py-3 pr-4">
                    {c.shortId ? (
                      <code className="px-2 py-0.5 rounded bg-muted font-mono text-xs">{c.shortId}</code>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="py-3 pr-4 text-muted-foreground">{c.email}</td>
                  <td className="py-3 pr-4">
                    <Badge variant={c.isVerified ? "default" : "destructive"} className="text-xs">
                      {c.isVerified ? "Verified" : "Unverified"}
                    </Badge>
                  </td>
                  <td className="py-3 pr-4">
                    <Badge variant={c.role === "admin" ? "secondary" : "outline"} className="text-xs capitalize">
                      {c.role}
                    </Badge>
                  </td>
                  <td className="py-3 pr-4">${(c.wallet_balance ?? 0).toFixed(2)}</td>
                  
                  <td className="py-3 pr-4">${(c.total_spent ?? 0).toFixed(2)}</td>
                  <td className="py-3 text-muted-foreground">{c.created_at ? fmtDateSG(c.created_at) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function CustomerDetail({ customer, onBack }: { customer: any; onBack: () => void }) {
  const { toast } = useToast();
  const updateWallet = useUpdateCustomerWallet();
  const updateProfile = useUpdateCustomerProfile();
  const { data: bookings, isLoading: bookingsLoading } = useCustomerBookings(customer.user_id);
  const { data: walletHistory } = useCustomerWalletHistory(customer.user_id);
  const { data: activityLogs } = useAdminActivityLogs();
  const { data: allCustomers } = useAdminCustomers("");
  const { data: tablesList } = useAdminTables();

  const verifyInfo = (() => {
    const lookupName = (id: string) => {
      if (!id || !Array.isArray(allCustomers)) return null;
      const u = allCustomers.find((u: any) => u.user_id === id || u.id === id);
      return u?.legal_name || u?.name || u?.email || null;
    };
    if (customer.verified_by) {
      const raw = String(customer.verified_by);
      // If it looks like an ID (no spaces, hex-ish), try to resolve to legal name
      const looksLikeId = /^[a-f0-9]{16,}$/i.test(raw) || /^[0-9a-f-]{20,}$/i.test(raw);
      const resolved = looksLikeId ? lookupName(raw) : null;
      return { name: resolved || raw, at: customer.verified_at };
    }
    const logs = Array.isArray(activityLogs) ? activityLogs : [];
    const entry = logs.find((l: any) => l.action === "verify_user" && (l.targetUserId === customer.user_id || l.targetUserId?._id === customer.user_id));
    if (!entry) return null;
    const adminId = typeof entry.adminId === "object" ? entry.adminId?._id : entry.adminId;
    const adminName = typeof entry.adminId === "object"
      ? (entry.adminId?.legalName || entry.adminId?.legal_name || entry.adminId?.name || entry.adminId?.email)
      : lookupName(adminId);
    return { name: adminName || adminId || "Admin", at: entry.createdAt };
  })();
  const [editing, setEditing] = useState(false);
  const [editDetailsOpen, setEditDetailsOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<any | null>(null);

  const fmtDob = (v: any) => {
    if (!v) return "—";
    const s = String(v).slice(0, 10);
    const [y, m, d] = s.split("-");
    if (!y || !m || !d) return s;
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const mi = parseInt(m, 10) - 1;
    if (mi < 0 || mi > 11) return s;
    return `${d.padStart(2, "0")} ${months[mi]} ${y}`;
  };
  const [editName, setEditName] = useState(customer.name ?? "");
  const [editEmail, setEditEmail] = useState(customer.email ?? "");
  const [editPhone, setEditPhone] = useState(customer.phone ?? "");
  const [editDob, setEditDob] = useState(
    customer.date_of_birth ? String(customer.date_of_birth).slice(0, 10) : ""
  );

  const openEditDetails = () => {
    setEditName(customer.name ?? "");
    setEditEmail(customer.email ?? "");
    setEditPhone(customer.phone ?? "");
    setEditDob(customer.date_of_birth ? String(customer.date_of_birth).slice(0, 10) : "");
    setEditDetailsOpen(true);
  };

  const saveDetails = async () => {
    const origName = (customer.name ?? "").trim();
    const origEmail = (customer.email ?? "").trim();
    const origPhone = (customer.phone ?? "").trim();
    const origDob = customer.date_of_birth ? String(customer.date_of_birth).slice(0, 10) : "";

    const newName = editName.trim();
    const newEmail = editEmail.trim();
    const newPhone = editPhone.trim();
    const newDob = editDob || "";

    const payload: Parameters<typeof updateProfile.mutateAsync>[0] = { userId: customer.user_id };
    if (newName !== origName) payload.name = newName;
    if (newEmail !== origEmail) payload.email = newEmail;
    if (newPhone !== origPhone) payload.phone = newPhone;
    if (newDob !== origDob) payload.dateOfBirth = newDob;

    // Nothing changed — just close
    if (Object.keys(payload).length === 1) {
      setEditDetailsOpen(false);
      return;
    }

    try {
      await updateProfile.mutateAsync(payload);
      setEditDetailsOpen(false);
    } catch {/* toast handled in hook */}
  };

  // Wallet editing state
  const [walletMode, setWalletMode] = useState<"exact" | "delta">("delta");
  const [walletExact, setWalletExact] = useState(String(customer.wallet_balance));
  const [walletDelta, setWalletDelta] = useState("0");

  const saveEdit = () => {
    const payload: Parameters<typeof updateWallet.mutate>[0] = { userId: customer.user_id };
    if (walletMode === "exact") {
      payload.walletBalance = parseFloat(walletExact);
    } else {
      const d = parseFloat(walletDelta);
      if (d !== 0) payload.walletDelta = d;
    }
    updateWallet.mutate(payload);
    setEditing(false);
  };

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="mr-2 h-4 w-4" /> Back to Customers</Button>

      {/* Profile Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3 flex-wrap">
              <CardTitle>{customer.legal_name || customer.name || "No Name"}</CardTitle>
              {customer.shortId ? (
                <div className="flex items-center gap-1">
                  <span className="px-3 py-1 rounded-full bg-accent/20 text-accent-foreground border border-accent/30 font-mono text-sm font-semibold">
                    {customer.shortId}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0"
                    title="Copy Short ID"
                    onClick={() => {
                      navigator.clipboard.writeText(String(customer.shortId));
                      toast({ title: "Short ID copied" });
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              ) : null}
            </div>
            <div className="flex gap-2">
              {!editing && (
                <>
                  <Button size="sm" variant="outline" onClick={openEditDetails}><Pencil className="mr-1 h-3 w-3" /> Edit Details</Button>
                  <Button size="sm" variant="outline" onClick={() => setEditing(true)}><Pencil className="mr-1 h-3 w-3" /> Edit Wallet</Button>
                </>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 text-sm">
            <div><p className="text-muted-foreground">Email</p><p className="font-medium">{customer.email}</p></div>
            <div><p className="text-muted-foreground">Phone</p><p className="font-medium">{customer.phone || "—"}</p></div>
            <div><p className="text-muted-foreground">Date of Birth</p><p className="font-medium">{fmtDob(customer.date_of_birth)}</p></div>
            <div><p className="text-muted-foreground">Joined</p><p className="font-medium">{fmtDateSG(customer.created_at)}</p></div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 text-sm">
            <div><p className="text-muted-foreground">Verified</p><p className="font-medium">{customer.isVerified ? <Badge>Yes</Badge> : <Badge variant="destructive">No</Badge>}</p></div>
            <div><p className="text-muted-foreground">Role</p><p className="font-medium capitalize">{customer.role}</p></div>
            <div>
              <p className="text-muted-foreground">Verified By</p>
              <p className="font-medium">
                {verifyInfo?.name || (customer.isVerified ? "—" : "Not verified")}
                {verifyInfo?.at && (
                  <span className="block text-xs text-muted-foreground">{fmtDateTimeSG(verifyInfo.at)}</span>
                )}
              </p>
            </div>
          </div>

          {editing ? (
            <div className="pt-3 border-t border-border space-y-4">
              {/* Wallet Section */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="font-semibold">Wallet Balance (Current: ${(customer.wallet_balance ?? 0).toFixed(2)})</Label>
                  <div className="flex gap-1">
                    <Button size="sm" variant={walletMode === "delta" ? "default" : "outline"} onClick={() => setWalletMode("delta")} className="text-xs h-7">+/− Adjust</Button>
                    <Button size="sm" variant={walletMode === "exact" ? "default" : "outline"} onClick={() => setWalletMode("exact")} className="text-xs h-7">Set Exact</Button>
                  </div>
                </div>
                {walletMode === "exact" ? (
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Set wallet balance to:</Label>
                    <Input type="number" step="0.01" min="0" value={walletExact} onChange={(e) => setWalletExact(e.target.value)} placeholder="e.g. 50.00" />
                  </div>
                ) : (
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Add or subtract from wallet (use negative to deduct):</Label>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => setWalletDelta(String(parseFloat(walletDelta || "0") - 10))}>−$10</Button>
                      <Button size="sm" variant="outline" onClick={() => setWalletDelta(String(parseFloat(walletDelta || "0") - 5))}>−$5</Button>
                      <Input type="number" step="0.01" value={walletDelta} onChange={(e) => setWalletDelta(e.target.value)} className="w-28" placeholder="0.00" />
                      <Button size="sm" variant="outline" onClick={() => setWalletDelta(String(parseFloat(walletDelta || "0") + 5))}>+$5</Button>
                      <Button size="sm" variant="outline" onClick={() => setWalletDelta(String(parseFloat(walletDelta || "0") + 10))}>+$10</Button>
                    </div>
                    {parseFloat(walletDelta) !== 0 && (
                      <p className="text-xs text-muted-foreground">
                        New balance: <strong>${((customer.wallet_balance ?? 0) + parseFloat(walletDelta || "0")).toFixed(2)}</strong>
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <Button size="sm" onClick={saveEdit} disabled={updateWallet.isPending}>
                  {updateWallet.isPending ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Check className="mr-1 h-3 w-3" />} Save Changes
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditing(false)}><X className="mr-1 h-3 w-3" /> Cancel</Button>
              </div>
            </div>
          ) : (
            <div className="flex gap-6 text-sm pt-2 border-t border-border">
              <span>Wallet: <strong>${(customer.wallet_balance ?? 0).toFixed(2)}</strong></span>
              <span>Total Spent: <strong>${(customer.total_spent ?? 0).toFixed(2)}</strong></span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Booking History */}
      <Card>
        <CardHeader><CardTitle className="text-base">Booking History</CardTitle></CardHeader>
        <CardContent>
          {!bookings?.length ? (
            <p className="text-muted-foreground text-sm">No bookings.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border text-left">
                  <th className="pb-2 pr-4">Table</th>
                  <th className="pb-2 pr-4">Date</th>
                  <th className="pb-2 pr-4">Time</th>
                  <th className="pb-2 pr-4">Duration</th>
                  <th className="pb-2 pr-4">Price</th>
                  <th className="pb-2">Status</th>
                </tr></thead>
                <tbody>
                  {bookings.map((b: any) => (
                    <tr
                      key={b.id || b._id}
                      className="border-b border-border last:border-0 cursor-pointer hover:bg-muted/40 transition-colors"
                      onClick={() => setSelectedBooking(b)}
                    >
                      <td className="py-2 pr-4">{getTableLabel(b.tableId, tablesList as any, b)}</td>
                      <td className="py-2 pr-4">{fmtDateSG(b.startTime || b.start_time)}</td>
                      <td className="py-2 pr-4">{fmtTimeSG(b.startTime || b.start_time)}</td>
                      <td className="py-2 pr-4">{(() => { const s = b.startTime || b.start_time; const e = b.endTime || b.end_time; const mins = s && e ? Math.round((new Date(e).getTime() - new Date(s).getTime()) / 60000) : 0; const h = Math.floor(mins / 60); const m = mins % 60; return m > 0 ? `${h}h ${m}m` : `${h}h`; })()}</td>
                      <td className="py-2 pr-4">${(b.amount ?? b.finalPrice ?? b.final_price ?? b.price ?? 0).toFixed(2)}</td>
                      <td className="py-2"><Badge variant="outline" className="capitalize">{b.status}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Wallet History */}
      <Card>
        <CardHeader><CardTitle className="text-base">Wallet Transactions{customer.shortId ? <span className="text-muted-foreground font-normal"> — Reference: <span className="font-mono">{customer.shortId}</span></span> : null}</CardTitle></CardHeader>
        <CardContent>
          {(() => {
            const txs = Array.isArray(walletHistory) ? walletHistory : (walletHistory?.transactions ?? []);
            if (!txs.length) return <p className="text-muted-foreground text-sm">No wallet activity yet</p>;
            return (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {txs.map((t: any) => {
                  const amt = typeof t.amount === "number" ? t.amount : Number(t.amount) || 0;
                  const txType = t.type || "unknown";
                  const dateStr = t.createdAt || t.created_at || "";
                  const direction = t.direction || (txType === "payment" ? "debit" : "credit");
                  const isCredit = direction === "credit";
                  const method = t.method || "—";
                  const typeLabel = txType === "topup" ? "Top Up" : txType === "payment" ? "Payment" : txType === "refund" ? "Refund" : txType;
                  const badgeClass = txType === "topup"
                    ? "bg-green-500/15 text-green-600 border-green-500/30"
                    : txType === "payment"
                    ? "bg-destructive/15 text-destructive border-destructive/30"
                    : "bg-amber-500/15 text-amber-600 border-amber-500/30";
                  return (
                    <div key={t._id || t.id} className="flex justify-between items-center text-sm border-b border-border pb-2 last:border-0">
                      <div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={badgeClass}>{typeLabel}</Badge>
                          <span className="text-xs text-muted-foreground capitalize">{method}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{fmtDateTimeSG(dateStr)}</p>
                      </div>
                      <div className="text-right">
                        <p className={isCredit ? "text-green-600 font-medium" : "text-destructive font-medium"}>
                          {isCredit ? "+" : "-"}${Math.abs(amt).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </CardContent>
      </Card>

      {/* Rewards */}
      <CustomerRewardsSection userId={customer.user_id} />

      <Dialog open={editDetailsOpen} onOpenChange={(o) => { if (!o) setEditDetailsOpen(false); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Customer Details</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cust-name">Name</Label>
              <Input id="cust-name" value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cust-email">Email</Label>
              <Input id="cust-email" type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cust-phone">Phone</Label>
              <Input id="cust-phone" type="tel" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} placeholder="e.g. 91234567" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cust-dob">Date of Birth</Label>
              <Input id="cust-dob" type="date" value={editDob} onChange={(e) => setEditDob(e.target.value)} />
            </div>
            <p className="text-xs text-muted-foreground">Changes will be recorded in the activity log.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDetailsOpen(false)} disabled={updateProfile.isPending}>Cancel</Button>
            <Button onClick={saveDetails} disabled={updateProfile.isPending}>
              {updateProfile.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AdminBookingDetailDialog
        booking={selectedBooking}
        open={!!selectedBooking}
        onOpenChange={(open) => { if (!open) setSelectedBooking(null); }}
      />
    </div>
  );
}

function PricingTab() {
  const [hideDeleted, setHideDeleted] = useState(false);
  const { data: rules, create, remove, toggle, update } = useAdminPricingRules(hideDeleted ? "default" : "all");
  const [form, setForm] = useState({
    name: "", start_time: "09:00", end_time: "23:00", hourly_rate: "20",
    priority: "0", weekdays: [...WEEKDAYS] as string[], specific_date: "", table_id: "",
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [detailRecord, setDetailRecord] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({
    name: "", start_time: "", end_time: "", hourly_rate: "",
    priority: "", weekdays: [] as string[], specific_date: "",
  });

  const startEdit = (r: any) => {
    setEditingId(r.id);
    setEditForm({
      name: r.name,
      start_time: r.start_time,
      end_time: r.end_time,
      hourly_rate: String(r.hourly_rate),
      priority: String(r.priority),
      weekdays: [...(r.applies_to_weekdays as string[])],
      specific_date: r.specific_date || "",
    });
  };

  const saveEdit = () => {
    if (!editingId) return;
    update.mutate({
      id: editingId,
      name: editForm.name,
      start_time: editForm.start_time,
      end_time: editForm.end_time,
      hourly_rate: parseFloat(editForm.hourly_rate),
      applies_to_weekdays: editForm.weekdays,
      specific_date: editForm.specific_date || null,
      priority: parseInt(editForm.priority),
    });
    setEditingId(null);
  };

  const handleCreate = () => {
    create.mutate({
      name: form.name,
      start_time: form.start_time,
      end_time: form.end_time,
      hourly_rate: parseFloat(form.hourly_rate),
      applies_to_weekdays: form.weekdays,
      specific_date: form.specific_date || null,
      applies_to_table_id: form.table_id || null,
      priority: parseInt(form.priority),
      is_active: true,
    });
    setForm({ name: "", start_time: "09:00", end_time: "23:00", hourly_rate: "20", priority: "0", weekdays: [...WEEKDAYS], specific_date: "", table_id: "" });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Add Pricing Rule</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Peak Hours" />
            </div>
            <div className="space-y-2">
              <Label>Start Time</Label>
              <Input type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>End Time</Label>
              <Input type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Hourly Rate ($)</Label>
              <Input type="number" value={form.hourly_rate} onChange={(e) => setForm({ ...form, hourly_rate: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Priority</Label>
              <Input type="number" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Specific Date (optional)</Label>
              <Input type="date" value={form.specific_date} onChange={(e) => setForm({ ...form, specific_date: e.target.value })} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Weekdays</Label>
            <div className="flex flex-wrap gap-2">
              {WEEKDAYS.map((d) => (
                <button
                  key={d}
                  onClick={() => setForm({ ...form, weekdays: form.weekdays.includes(d) ? form.weekdays.filter((w) => w !== d) : [...form.weekdays, d] })}
                  className={`px-3 py-1 rounded-full text-xs border transition-all ${form.weekdays.includes(d) ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground"}`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
          <Button onClick={handleCreate} disabled={!form.name || create.isPending}>Create Rule</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle>Existing Rules</CardTitle>
          <Button
            size="sm"
            variant={hideDeleted ? "secondary" : "outline"}
            onClick={() => setHideDeleted((v) => !v)}
          >
            {hideDeleted ? <Eye className="h-4 w-4 mr-1" /> : <EyeOff className="h-4 w-4 mr-1" />}
            {hideDeleted ? "Show Deleted" : "Hide Deleted"}
          </Button>
        </CardHeader>
        <CardContent>
          {!rules?.length ? <p className="text-muted-foreground text-sm">No pricing rules.</p> : (
            <div className="space-y-3">
              {rules.map((r: any) => {
                const deleted = isRecordDeleted(r);
                if (editingId === r.id && !deleted) {
                  return (
                    <div key={r.id} className="rounded-lg border border-border p-4">
                      <div className="space-y-4">
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          <div className="space-y-1">
                            <Label className="text-xs">Name</Label>
                            <Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Start Time</Label>
                            <Input type="time" value={editForm.start_time} onChange={(e) => setEditForm({ ...editForm, start_time: e.target.value })} />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">End Time</Label>
                            <Input type="time" value={editForm.end_time} onChange={(e) => setEditForm({ ...editForm, end_time: e.target.value })} />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Rate ($)</Label>
                            <Input type="number" value={editForm.hourly_rate} onChange={(e) => setEditForm({ ...editForm, hourly_rate: e.target.value })} />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Priority</Label>
                            <Input type="number" value={editForm.priority} onChange={(e) => setEditForm({ ...editForm, priority: e.target.value })} />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Specific Date</Label>
                            <Input type="date" value={editForm.specific_date} onChange={(e) => setEditForm({ ...editForm, specific_date: e.target.value })} />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Weekdays</Label>
                          <div className="flex flex-wrap gap-2">
                            {WEEKDAYS.map((d) => (
                              <button
                                key={d}
                                onClick={() => setEditForm({ ...editForm, weekdays: editForm.weekdays.includes(d) ? editForm.weekdays.filter((w) => w !== d) : [...editForm.weekdays, d] })}
                                className={`px-3 py-1 rounded-full text-xs border transition-all ${editForm.weekdays.includes(d) ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground"}`}
                              >
                                {d}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" onClick={saveEdit} disabled={update.isPending}><Check className="mr-1 h-3 w-3" /> Save</Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}><X className="mr-1 h-3 w-3" /> Cancel</Button>
                        </div>
                      </div>
                    </div>
                  );
                }

                const rowCls = deleted
                  ? "rounded-lg border border-border p-4 text-muted-foreground cursor-pointer hover:bg-muted/30"
                  : "rounded-lg border border-border p-4";
                return (
                  <div
                    key={r.id}
                    className={rowCls}
                    onClick={deleted ? () => setDetailRecord(r) : undefined}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className={`font-medium ${deleted ? "line-through" : ""}`}>{r.name}</p>
                        <p className={`text-sm text-muted-foreground ${deleted ? "line-through" : ""}`}>
                          {r.start_time} – {r.end_time} · ${r.hourly_rate}/hr · Priority {r.priority}
                          {r.specific_date && ` · ${r.specific_date}`}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">{(r.applies_to_weekdays as string[]).join(", ")}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {deleted ? (
                          <Badge variant="outline" className="bg-muted whitespace-nowrap">Deleted</Badge>
                        ) : (
                          <>
                            <Button variant="ghost" size="sm" onClick={() => startEdit(r)}><Pencil className="h-4 w-4" /></Button>
                            <Switch checked={r.is_active} onCheckedChange={(v) => toggle.mutate({ id: r.id, is_active: v })} />
                            <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(r)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <ReasonDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="Delete pricing rule?"
        description="This rule will be marked as deleted but retained for audit history."
        label="Reason for deletion"
        placeholder="e.g. superseded by new schedule"
        confirmLabel="Delete"
        destructive
        loading={remove.isPending}
        onConfirm={async (reason) => {
          if (!deleteTarget) return;
          try {
            await remove.mutateAsync({ id: deleteTarget.id, reason });
            setDeleteTarget(null);
          } catch {}
        }}
      />

      <Dialog open={!!detailRecord} onOpenChange={(o) => !o && setDetailRecord(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pricing Rule — {detailRecord?.name}</DialogTitle>
          </DialogHeader>
          {detailRecord && (
            <div className="space-y-3">
              <DeletedBanner info={getDeletedInfo(detailRecord)} />
              <div className="opacity-70 text-sm space-y-1.5">
                <DetailRow label="Name" value={detailRecord.name} />
                <DetailRow label="Time" value={`${detailRecord.start_time} – ${detailRecord.end_time}`} />
                <DetailRow label="Rate" value={`$${detailRecord.hourly_rate}/hr`} />
                <DetailRow label="Priority" value={String(detailRecord.priority)} />
                <DetailRow label="Weekdays" value={(detailRecord.applies_to_weekdays || []).join(", ") || "—"} />
                {detailRecord.specific_date && <DetailRow label="Specific Date" value={detailRecord.specific_date} />}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  );
}


function PromosTab() {
  const [hideDeleted, setHideDeleted] = useState(false);
  const { data: promos, create, toggle, remove } = useAdminPromoCodes(hideDeleted ? "default" : "all");
  const [form, setForm] = useState({
    code: "", discount_type: "percentage" as string, discount_value: "", minimum_spend: "",
    max_discount_amount: "", usage_limit: "", per_user_limit: "", expiry_date: "",
  });
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [detailPromo, setDetailPromo] = useState<any | null>(null);

  const handleCreate = () => {
    create.mutate({
      code: form.code,
      discount_type: form.discount_type,
      discount_value: parseFloat(form.discount_value),
      minimum_spend: form.minimum_spend ? parseFloat(form.minimum_spend) : null,
      max_discount_amount: form.max_discount_amount ? parseFloat(form.max_discount_amount) : null,
      usage_limit: form.usage_limit ? parseInt(form.usage_limit) : null,
      per_user_limit: form.per_user_limit ? parseInt(form.per_user_limit) : null,
      expiry_date: form.expiry_date || null,
      is_active: true,
    });
    setForm({ code: "", discount_type: "percentage", discount_value: "", minimum_spend: "", max_discount_amount: "", usage_limit: "", per_user_limit: "", expiry_date: "" });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Create Promo Code</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <Label>Code</Label>
              <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="SUMMER20" />
            </div>
            <div className="space-y-2">
              <Label>Discount Type</Label>
              <Select value={form.discount_type} onValueChange={(v) => setForm({ ...form, discount_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">Percentage</SelectItem>
                  <SelectItem value="fixed">Fixed Amount</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Discount Value</Label>
              <Input type="number" value={form.discount_value} onChange={(e) => setForm({ ...form, discount_value: e.target.value })} placeholder={form.discount_type === "percentage" ? "20" : "5.00"} />
            </div>
            <div className="space-y-2">
              <Label>Min Spend (opt)</Label>
              <Input type="number" value={form.minimum_spend} onChange={(e) => setForm({ ...form, minimum_spend: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Max Discount (opt)</Label>
              <Input type="number" value={form.max_discount_amount} onChange={(e) => setForm({ ...form, max_discount_amount: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Usage Limit (opt)</Label>
              <Input type="number" value={form.usage_limit} onChange={(e) => setForm({ ...form, usage_limit: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Per User Limit (opt)</Label>
              <Input type="number" value={form.per_user_limit} onChange={(e) => setForm({ ...form, per_user_limit: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Expiry Date (opt)</Label>
              <Input type="datetime-local" value={form.expiry_date} onChange={(e) => setForm({ ...form, expiry_date: e.target.value })} />
            </div>
          </div>
          <Button onClick={handleCreate} disabled={!form.code || !form.discount_value || create.isPending}>Create Promo</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle>Existing Promo Codes</CardTitle>
          <Button
            size="sm"
            variant={hideDeleted ? "secondary" : "outline"}
            onClick={() => setHideDeleted((v) => !v)}
          >
            {hideDeleted ? <Eye className="h-4 w-4 mr-1" /> : <EyeOff className="h-4 w-4 mr-1" />}
            {hideDeleted ? "Show Deleted" : "Hide Deleted"}
          </Button>
        </CardHeader>
        <CardContent>
          {!promos?.length ? <p className="text-muted-foreground text-sm">No promo codes.</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">Code</th>
                    <th className="py-2 pr-3 font-medium">Type</th>
                    <th className="py-2 pr-3 font-medium">Value</th>
                    <th className="py-2 pr-3 font-medium">Min Spend</th>
                    <th className="py-2 pr-3 font-medium">Usage</th>
                    <th className="py-2 pr-3 font-medium">Expiry</th>
                    <th className="py-2 pr-3 font-medium">Status</th>
                    <th className="py-2 pr-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {promos.map((p: any) => {
                    const isPct = p.discount_type === "percentage";
                    const valueLabel = isPct ? `${p.discount_value}%` : `$${Number(p.discount_value).toFixed(2)}`;
                    const minSpend = p.minimum_spend ? `$${Number(p.minimum_spend).toFixed(2)}` : "—";
                    const usageLabel = `${p.usage_count ?? 0} / ${p.usage_limit ?? "unlimited"}`;
                    const expiryLabel = p.expiry_date ? fmtDateSG(p.expiry_date) : "No expiry";
                    const deleted = isRecordDeleted(p);
                    const rowCls = deleted
                      ? "border-b border-border/50 cursor-pointer hover:bg-muted/40 text-muted-foreground"
                      : "border-b border-border/50 cursor-pointer hover:bg-muted/40";
                    return (
                      <tr
                        key={p.id}
                        className={rowCls}
                        onClick={() => setDetailPromo(p)}
                      >
                        <td className={`py-3 pr-3 font-mono font-medium ${deleted ? "line-through" : ""}`}>{p.code}</td>
                        <td className="py-3 pr-3">{isPct ? "Percentage" : "Fixed"}</td>
                        <td className={`py-3 pr-3 ${deleted ? "line-through" : ""}`}>{valueLabel}</td>
                        <td className="py-3 pr-3">{minSpend}</td>
                        <td className="py-3 pr-3">{usageLabel}</td>
                        <td className="py-3 pr-3">{expiryLabel}</td>
                        <td className="py-3 pr-3">
                          {deleted ? (
                            <Badge variant="outline" className="bg-muted whitespace-nowrap">Deleted</Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className={p.is_active
                                ? "border-transparent bg-green-500/15 text-green-500"
                                : "border-transparent bg-muted text-muted-foreground"}
                            >
                              {p.is_active ? "Active" : "Inactive"}
                            </Badge>
                          )}
                        </td>
                        <td className="py-3 pr-3" onClick={(e) => e.stopPropagation()}>
                          {!deleted && (
                            <div className="flex items-center justify-end gap-3">
                              <Switch
                                checked={p.is_active}
                                onCheckedChange={() => toggle.mutate({ id: p.id, is_active: !p.is_active })}
                              />
                              <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(p)}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <ReasonDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title={`Delete promo code ${deleteTarget?.code ?? ""}?`}
        description="This promo code will be marked as deleted but retained for audit history."
        label="Reason for deletion"
        placeholder="e.g. campaign ended"
        confirmLabel="Delete"
        destructive
        loading={remove.isPending}
        onConfirm={async (reason) => {
          if (!deleteTarget) return;
          try {
            await remove.mutateAsync({ id: deleteTarget.id, reason });
            setDeleteTarget(null);
          } catch {}
        }}
      />

      <PromoDetailDialog promo={detailPromo} onClose={() => setDetailPromo(null)} />
    </div>
  );
}


function PromoDetailDialog({ promo, onClose }: { promo: any | null; onClose: () => void }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["promo-usage", promo?.code],
    enabled: !!promo?.code,
    queryFn: async () => {
      const res = await apiFetch(`/api/promos/${encodeURIComponent(promo.code)}/usage`);
      if (res.status === 404) return { __missing: true };
      if (!res.ok) throw new Error("Failed to fetch usage");
      const raw = await res.json();
      const list = Array.isArray(raw) ? raw : (raw?.usage || raw?.usages || raw?.history || []);
      return { usage: list };
    },
  });

  if (!promo) return null;

  const isPct = promo.discount_type === "percentage";
  const valueLabel = isPct ? `${promo.discount_value}%` : `$${Number(promo.discount_value).toFixed(2)}`;
  const minSpend = promo.minimum_spend ? `$${Number(promo.minimum_spend).toFixed(2)}` : "—";
  const maxDisc = promo.max_discount_amount ? `$${Number(promo.max_discount_amount).toFixed(2)}` : "—";
  const perUser = promo.per_user_limit ?? "Unlimited";
  const usageCount = promo.usage_count ?? 0;
  const usageLimit = promo.usage_limit ?? "unlimited";
  const expiryLabel = promo.expiry_date ? fmtDateSG(promo.expiry_date) : "No expiry";

  const usage = (data as any)?.usage as any[] | undefined;
  const missing = (data as any)?.__missing;

  const money = (n: any) => {
    const v = Number(n);
    if (!isFinite(v)) return "—";
    return `$${v.toFixed(2)}`;
  };

  return (
    <Dialog open={!!promo} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onClose} className="-ml-2">
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
          </div>
          <DialogTitle className="font-mono">{promo.code}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {isRecordDeleted(promo) && <DeletedBanner info={getDeletedInfo(promo)} />}

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
            <div><div className="text-muted-foreground">Type</div><div>{isPct ? "Percentage" : "Fixed"}</div></div>
            <div><div className="text-muted-foreground">Value</div><div>{valueLabel}</div></div>
            <div><div className="text-muted-foreground">Min Spend</div><div>{minSpend}</div></div>
            <div><div className="text-muted-foreground">Max Discount</div><div>{maxDisc}</div></div>
            <div><div className="text-muted-foreground">Per User Limit</div><div>{perUser}</div></div>
            <div><div className="text-muted-foreground">Expiry</div><div>{expiryLabel}</div></div>
            <div>
              <div className="text-muted-foreground">Status</div>
              <Badge variant="outline" className={promo.is_active
                ? "border-transparent bg-green-500/15 text-green-500"
                : "border-transparent bg-muted text-muted-foreground"}>
                {promo.is_active ? "Active" : "Inactive"}
              </Badge>
            </div>
            <div>
              <div className="text-muted-foreground">Total Uses</div>
              <Badge variant="outline">{usageCount} / {usageLimit}</Badge>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold mb-2">Usage History</h4>
            {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
            {error && <p className="text-sm text-destructive">Failed to load usage history.</p>}
            {!isLoading && missing && (
              <p className="text-sm text-muted-foreground">
                Usage history endpoint not available yet. Please add <code className="font-mono">GET /api/promos/:code/usage</code> to the backend.
              </p>
            )}
            {!isLoading && !missing && usage && usage.length === 0 && (
              <p className="text-sm text-muted-foreground">No usage yet.</p>
            )}
            {!isLoading && !missing && usage && usage.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-muted-foreground">
                      <th className="py-2 pr-3 font-medium">Customer</th>
                      <th className="py-2 pr-3 font-medium">Short ID</th>
                      <th className="py-2 pr-3 font-medium">Discount</th>
                      <th className="py-2 pr-3 font-medium">Original → Final</th>
                      <th className="py-2 pr-3 font-medium">Booking Date</th>
                      <th className="py-2 pr-3 font-medium">Used At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usage.map((u: any, i: number) => {
                      const name = u.customerName || u.customer_name || u.user?.name || u.userName || "—";
                      const email = u.customerEmail || u.customer_email || u.user?.email || u.userEmail || "";
                      const shortId = u.shortId || u.short_id || u.bookingShortId || u.booking?.shortId || u.bookingId || u.booking_id || "—";
                      const discount = u.discountApplied ?? u.discount_applied ?? u.discount ?? u.discountAmount;
                      const original = u.originalAmount ?? u.original_amount ?? u.originalPrice ?? u.original_price;
                      const final = u.finalAmount ?? u.final_amount ?? u.finalPrice ?? u.final_price;
                      const bookingDate = u.bookingDate || u.booking_date || u.bookingStartTime || u.booking?.startTime || u.booking?.start_time;
                      const usedAt = u.usedAt || u.used_at || u.createdAt || u.created_at;
                      return (
                        <tr key={u.id || u._id || i} className="border-b border-border/50">
                          <td className="py-2 pr-3">
                            <div className="font-medium">{name}</div>
                            {email && <div className="text-xs text-muted-foreground">{email}</div>}
                          </td>
                          <td className="py-2 pr-3 font-mono text-xs">{shortId}</td>
                          <td className="py-2 pr-3 text-destructive">-{money(discount)}</td>
                          <td className="py-2 pr-3">{money(original)} → {money(final)}</td>
                          <td className="py-2 pr-3">{bookingDate ? fmtDateTimeSG(bookingDate) : "—"}</td>
                          <td className="py-2 pr-3">{usedAt ? fmtDateTimeSG(usedAt) : "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}


function VerificationTab() {
  const [tab, setTab] = useState<"pending" | "rejected">("pending");
  const [users, setUsers] = useState<any[]>(() => {
    try {
      const cached = localStorage.getItem("cache:unverified-users");
      return cached ? JSON.parse(cached) : [];
    } catch { return []; }
  });
  const [rejectedUsers, setRejectedUsers] = useState<any[]>([]);
  const [verifying, setVerifying] = useState<string | null>(null);
  const [verifyTarget, setVerifyTarget] = useState<any | null>(null);
  const [legalName, setLegalName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [search, setSearch] = useState("");
  const [rejectTarget, setRejectTarget] = useState<any | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [rejectedDetail, setRejectedDetail] = useState<any | null>(null);
  const [unrejecting, setUnrejecting] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchUnverified = async () => {
    try {
      const res = await apiFetch("/api/admin/unverified-users?status=pending");
      if (!res.ok) throw new Error("Failed to fetch unverified users");
      const data = await res.json();
      const list = Array.isArray(data) ? data : data.users || [];
      setUsers(list);
      localStorage.setItem("cache:unverified-users", JSON.stringify(list));
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const fetchRejected = async () => {
    try {
      const res = await apiFetch("/api/admin/unverified-users?status=rejected");
      if (!res.ok) throw new Error("Failed to fetch rejected users");
      const data = await res.json();
      const list = Array.isArray(data) ? data : data.users || [];
      setRejectedUsers(list);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const refresh = () => { fetchUnverified(); fetchRejected(); };

  useEffect(() => { refresh(); }, []);

  const openVerifyDialog = (u: any) => {
    setVerifyTarget(u);
    setLegalName("");
    setDateOfBirth("");
  };

  const handleVerify = async () => {
    if (!verifyTarget) return;
    const userId = verifyTarget._id || verifyTarget.userId || verifyTarget.id;
    if (!legalName.trim() || !dateOfBirth) {
      toast({ title: "Missing fields", description: "Legal name and date of birth are required", variant: "destructive" });
      return;
    }
    const dobDate = new Date(dateOfBirth);
    const today = new Date();
    let age = today.getFullYear() - dobDate.getFullYear();
    const m = today.getMonth() - dobDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dobDate.getDate())) age--;
    if (isNaN(dobDate.getTime()) || age < 16) {
      toast({ title: "Age requirement not met", description: "Customer must be at least 16 years old to be verified", variant: "destructive" });
      return;
    }
    try {
      setVerifying(userId);
      const res = await apiFetch("/api/admin/verify-user", {
        method: "POST",
        body: JSON.stringify({ userId, legalName: legalName.trim(), dateOfBirth }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Failed to verify user");
      }
      toast({ title: "User verified successfully" });
      setVerifyTarget(null);
      await fetchUnverified();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setVerifying(null);
    }
  };

  const handleReject = async () => {
    if (!rejectTarget) return;
    const userId = rejectTarget._id || rejectTarget.userId || rejectTarget.id;
    if (!rejectReason.trim()) {
      toast({ title: "Reason required", description: "Please provide a reason for rejection", variant: "destructive" });
      return;
    }
    try {
      setRejecting(userId);
      const res = await apiFetch("/api/admin/reject-user", {
        method: "POST",
        body: JSON.stringify({ userId, reason: rejectReason.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Failed to reject user");
      }
      toast({ title: "User rejected" });
      setRejectTarget(null);
      setRejectReason("");
      await refresh();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setRejecting(null);
    }
  };


  const matchesSearch = (u: any) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return (
      (u.name || "").toLowerCase().includes(q) ||
      (u.email || "").toLowerCase().includes(q) ||
      (u.dateOfBirth || u.date_of_birth || "").toLowerCase().includes(q)
    );
  };

  const filteredUsers = users.filter(matchesSearch);
  const filteredRejected = rejectedUsers.filter(matchesSearch);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>User Verification</CardTitle>
          <Button variant="outline" size="sm" onClick={refresh}>
            <RotateCcw className="mr-2 h-4 w-4" /> Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList>
            <TabsTrigger value="pending">Pending {users.length > 0 && `(${users.length})`}</TabsTrigger>
            <TabsTrigger value="rejected">Rejected {rejectedUsers.length > 0 && `(${rejectedUsers.length})`}</TabsTrigger>
          </TabsList>

          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, email or date of birth..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <TabsContent value="pending" className="mt-4">
            {users.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No pending users</p>
            ) : filteredUsers.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No matches for "{search}"</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th className="pb-2 pr-4">Name</th>
                      <th className="pb-2 pr-4">Date of Birth</th>
                      <th className="pb-2 pr-4">Email</th>
                      <th className="pb-2 pr-4">Created</th>
                      <th className="pb-2">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((u: any) => {
                      const uid = u._id || u.userId || u.id;
                      const busy = verifying === uid || rejecting === uid;
                      return (
                      <tr key={uid} className="border-b border-border last:border-0">
                        <td className="py-3 pr-4">{u.name || "—"}</td>
                        <td className="py-3 pr-4 text-accent font-medium">{u.dateOfBirth || u.date_of_birth || "—"}</td>
                        <td className="py-3 pr-4">{u.email || "—"}</td>
                        <td className="py-3 pr-4">{u.createdAt ? fmtDateTimeSG(u.createdAt) : "—"}</td>
                        <td className="py-3">
                          <div className="flex gap-2">
                            <Button size="sm" onClick={() => openVerifyDialog(u)} disabled={busy}>
                              {verifying === uid ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                              Verify
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-destructive text-destructive hover:bg-destructive/10 hover:text-destructive"
                              onClick={() => { setRejectTarget(u); setRejectReason(""); }}
                              disabled={busy}
                            >
                              {rejecting === uid ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <X className="mr-2 h-4 w-4" />}
                              Reject
                            </Button>
                          </div>
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="rejected" className="mt-4">
            {rejectedUsers.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No rejected users</p>
            ) : filteredRejected.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No matches for "{search}"</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th className="pb-2 pr-4">Name</th>
                      <th className="pb-2 pr-4">Email</th>
                      <th className="pb-2 pr-4">Joined</th>
                      <th className="pb-2 pr-4">Rejection Reason</th>
                      <th className="pb-2 pr-4">Rejected At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRejected.map((u: any) => {
                      const uid = u._id || u.userId || u.id;
                      const reason = u.rejectionReason || u.rejection_reason || u.rejectReason || "—";
                      const rejectedAt = u.rejectedAt || u.rejected_at;
                      return (
                        <tr key={uid} className="border-b border-border last:border-0">
                          <td className="py-3 pr-4">{u.name || "—"}</td>
                          <td className="py-3 pr-4">{u.email || "—"}</td>
                          <td className="py-3 pr-4">{u.createdAt ? fmtDateTimeSG(u.createdAt) : "—"}</td>
                          <td className="py-3 pr-4 whitespace-pre-wrap text-destructive">{reason}</td>
                          <td className="py-3 pr-4">{rejectedAt ? fmtDateTimeSG(rejectedAt) : "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>

      <Dialog open={!!verifyTarget} onOpenChange={(o) => { if (!o) setVerifyTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Verify User</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Verifying account for <span className="font-medium text-foreground">{verifyTarget?.email}</span>. The display name on this account ({verifyTarget?.name || "—"}) is a nickname — enter the customer's legal details below.
            </p>
            <div className="space-y-2">
              <Label htmlFor="legal-name">Legal Name</Label>
              <Input id="legal-name" value={legalName} onChange={(e) => setLegalName(e.target.value)} placeholder="Full legal name" />
              <p className="text-xs text-muted-foreground">Customer's full legal name as per IC/passport</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="legal-dob">Date of Birth</Label>
              <Input id="legal-dob" type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} />
              <p className="text-xs text-muted-foreground">Customer's date of birth as per IC/passport</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVerifyTarget(null)} disabled={!!verifying}>Cancel</Button>
            <Button onClick={handleVerify} disabled={!legalName.trim() || !dateOfBirth || !!verifying}>
              {verifying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
              Confirm Verification
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!rejectTarget} onOpenChange={(o) => { if (!o) { setRejectTarget(null); setRejectReason(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject User</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Rejecting account for <span className="font-medium text-foreground">{rejectTarget?.email}</span>. Please provide a reason — this will be recorded.
            </p>
            <div className="space-y-2">
              <Label htmlFor="reject-reason">Reason for rejection</Label>
              <Textarea
                id="reject-reason"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Explain why this verification request is being rejected..."
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRejectTarget(null); setRejectReason(""); }} disabled={!!rejecting}>Cancel</Button>
            <Button variant="destructive" onClick={handleReject} disabled={!rejectReason.trim() || !!rejecting}>
              {rejecting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <X className="mr-2 h-4 w-4" />}
              Confirm Rejection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </Card>
  );
}

function useAdminTopUps(status: string) {
  return useQuery({
    queryKey: ["admin-topups", status],
    queryFn: async () => {
      const qs = status && status !== "all" ? `?status=${status}` : "";
      const res = await apiFetch(`/api/transactions/topup/admin/requests${qs}`);
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : data?.requests ?? [];
    },
    refetchInterval: 15000,
  });
}

function TopUpsTabTrigger() {
  const { data } = useAdminTopUps("pending");
  const count = Array.isArray(data) ? data.length : 0;
  return (
    <TabsTrigger value="topups" className="relative">
      Top Ups
      {count > 0 && (
        <span className="absolute -top-2 -right-2 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center shadow-md">
          {count}
        </span>
      )}
    </TabsTrigger>
  );
}

function VerificationTabTrigger() {
  const { data } = useQuery({
    queryKey: ["admin-unverified-users"],
    queryFn: async () => {
      const res = await apiFetch("/api/admin/unverified-users?status=pending");
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : data?.users ?? [];
    },
    refetchInterval: 15000,
  });
  const count = Array.isArray(data) ? data.length : 0;
  return (
    <TabsTrigger value="verification" className="relative">
      Verification
      {count > 0 && (
        <span className="absolute -top-2 -right-2 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center shadow-md">
          {count}
        </span>
      )}
    </TabsTrigger>
  );
}

function TopUpsTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [status, setStatus] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const { data: requests } = useAdminTopUps(status);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [inlineRejectMode, setInlineRejectMode] = useState(false);
  const [inlineRejectReason, setInlineRejectReason] = useState("");

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["admin-topups"] });
  };

  const approve = async (id: string) => {
    setBusyId(id);
    try {
      const res = await apiFetch(`/api/transactions/topup/admin/requests/${id}/approve`, { method: "POST" });
      if (!res.ok) throw new Error();
      toast({ title: "Wallet credited successfully" });
      refresh();
    } catch {
      toast({ title: "Failed to approve request", variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  const reject = async () => {
    if (!rejectId) return;
    setBusyId(rejectId);
    try {
      const res = await apiFetch(`/api/transactions/topup/admin/requests/${rejectId}/reject`, {
        method: "POST",
        body: JSON.stringify({ rejectionReason: rejectReason }),
      });
      if (!res.ok) throw new Error();
      toast({ title: "Request rejected" });
      setRejectId(null);
      setRejectReason("");
      refresh();
    } catch {
      toast({ title: "Failed to reject request", variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  const statusBadge = (s: string) => {
    const v = String(s || "").toLowerCase();
    if (v === "approved") return "bg-green-500/10 text-green-400 border-green-500/30";
    if (v === "rejected") return "bg-destructive/10 text-destructive border-destructive/30";
    return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
  };

  const getCustomer = (r: any) => {
    const u = r.user || r.userId || {};
    if (typeof u === "string") return { name: "—", shortId: r.shortId || "—" };
    return {
      name: u.name || r.customerName || "—",
      shortId: u.shortId || r.shortId || "—",
    };
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Top Up Requests</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs value={status} onValueChange={(v) => setStatus(v as any)}>
          <TabsList>
            <TabsTrigger value="pending">Pending</TabsTrigger>
            <TabsTrigger value="approved">Approved</TabsTrigger>
            <TabsTrigger value="rejected">Rejected</TabsTrigger>
            <TabsTrigger value="all">All</TabsTrigger>
          </TabsList>
        </Tabs>

        {!requests?.length ? (
          <p className="text-muted-foreground text-sm">No requests.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="py-2 pr-4">Date & Time</th>
                  <th className="py-2 pr-4">Customer Name</th>
                  <th className="py-2 pr-4">Short ID</th>
                  <th className="py-2 pr-4">Amount</th>
                  <th className="py-2 pr-4">Method</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((r: any) => {
                  const c = getCustomer(r);
                  const id = r._id || r.id;
                  const isPending = String(r.status || "pending").toLowerCase() === "pending";
                  const methodRaw = String(r.method || "paynow").toLowerCase();
                  const methodIsCash = methodRaw === "cash";
                  const methodClass = methodIsCash
                    ? "bg-blue-500/10 text-blue-400 border-blue-500/30"
                    : "bg-purple-500/10 text-purple-400 border-purple-500/30";
                  const methodLabel = methodIsCash ? "Cash" : "PayNow";
                  return (
                    <tr
                      key={id}
                      className="border-b border-border/50 cursor-pointer hover:bg-muted/40"
                      onClick={() => setDetailId(id)}
                    >
                      <td className="py-2 pr-4">{fmtDateTimeSG(r.createdAt || r.created_at)}</td>
                      <td className="py-2 pr-4">{c.name}</td>
                      <td className="py-2 pr-4 font-mono">{c.shortId}</td>
                      <td className="py-2 pr-4 font-medium">${Number(r.amount || 0).toFixed(2)}</td>
                      <td className="py-2 pr-4">
                        <Badge variant="outline" className={methodClass}>{methodLabel}</Badge>
                      </td>
                      <td className="py-2 pr-4">
                        <Badge variant="outline" className={statusBadge(r.status)}>
                          {String(r.status || "pending").charAt(0).toUpperCase() + String(r.status || "pending").slice(1)}
                        </Badge>
                      </td>
                      <td className="py-2 pr-4" onClick={(e) => e.stopPropagation()}>
                        {isPending ? (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              className="bg-green-600 hover:bg-green-700 text-white"
                              disabled={busyId === id}
                              onClick={() => approve(id)}
                            >
                              <Check className="h-4 w-4 mr-1" /> Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              disabled={busyId === id}
                              onClick={() => { setRejectId(id); setRejectReason(""); }}
                            >
                              <X className="h-4 w-4 mr-1" /> Reject
                            </Button>
                          </div>
                        ) : (
                          <Badge variant="outline" className={statusBadge(r.status)}>
                            {String(r.status).charAt(0).toUpperCase() + String(r.status).slice(1)}
                          </Badge>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <Dialog open={!!rejectId} onOpenChange={(o) => !o && setRejectId(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reject Top Up Request</DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              <Label>Rejection Reason</Label>
              <Textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Reason for rejecting this request..."
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRejectId(null)}>Cancel</Button>
              <Button variant="destructive" onClick={reject} disabled={!rejectReason.trim() || busyId === rejectId}>
                Reject
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <TopUpDetailDialog
          request={(requests || []).find((r: any) => (r._id || r.id) === detailId) || null}
          onClose={() => { setDetailId(null); setInlineRejectMode(false); setInlineRejectReason(""); }}
          statusBadge={statusBadge}
          getCustomer={getCustomer}
          busy={busyId === detailId}
          inlineRejectMode={inlineRejectMode}
          setInlineRejectMode={setInlineRejectMode}
          inlineRejectReason={inlineRejectReason}
          setInlineRejectReason={setInlineRejectReason}
          onApprove={async () => {
            if (!detailId) return;
            await approve(detailId);
            setDetailId(null);
          }}
          onReject={async () => {
            if (!detailId || !inlineRejectReason.trim()) return;
            setBusyId(detailId);
            try {
              const res = await apiFetch(`/api/transactions/topup/admin/requests/${detailId}/reject`, {
                method: "POST",
                body: JSON.stringify({ rejectionReason: inlineRejectReason }),
              });
              if (!res.ok) throw new Error();
              toast({ title: "Request rejected" });
              setDetailId(null);
              setInlineRejectMode(false);
              setInlineRejectReason("");
              refresh();
            } catch {
              toast({ title: "Failed to reject request", variant: "destructive" });
            } finally {
              setBusyId(null);
            }
          }}
        />
      </CardContent>
    </Card>
  );
}

function TopUpDetailDialog({
  request,
  onClose,
  statusBadge,
  getCustomer,
  busy,
  inlineRejectMode,
  setInlineRejectMode,
  inlineRejectReason,
  setInlineRejectReason,
  onApprove,
  onReject,
}: {
  request: any;
  onClose: () => void;
  statusBadge: (s: string) => string;
  getCustomer: (r: any) => { name: string; shortId: string };
  busy: boolean;
  inlineRejectMode: boolean;
  setInlineRejectMode: (v: boolean) => void;
  inlineRejectReason: string;
  setInlineRejectReason: (v: string) => void;
  onApprove: () => void;
  onReject: () => void;
}) {
  const r = request;
  if (!r) return null;
  const c = getCustomer(r);
  const u = r.user || r.userId || {};
  const isObj = typeof u !== "string";
  const email = isObj ? (u.email || r.customerEmail || "—") : "—";
  const walletBalance = isObj ? (u.walletBalance ?? u.wallet_balance) : undefined;
  const id = r._id || r.id || "";
  const shortReqId = String(id).slice(-8);
  const amount = Number(r.amount || 0);
  const statusStr = String(r.status || "pending");
  const isPending = statusStr.toLowerCase() === "pending";
  const reviewedAt = r.reviewedAt || r.reviewed_at;
  const reviewedBy = r.reviewedBy || r.reviewed_by;
  const reviewerName = reviewedBy && typeof reviewedBy === "object" ? reviewedBy.name : (typeof reviewedBy === "string" ? reviewedBy : null);
  const adminNotes = r.adminNotes || r.notes;
  const rejectionReason = r.rejectionReason || r.rejection_reason;

  return (
    <Dialog open={!!r} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Top Up Request Details</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Customer details */}
          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Customer Details</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><div className="text-muted-foreground">Full Name</div><div className="font-medium">{c.name}</div></div>
              <div><div className="text-muted-foreground">Email</div><div className="font-medium break-all">{email}</div></div>
              <div><div className="text-muted-foreground">Short ID</div><div className="font-mono font-medium">{c.shortId}</div></div>
              <div>
                <div className="text-muted-foreground">Wallet Balance</div>
                <div className="font-medium">{walletBalance !== undefined && walletBalance !== null ? `$${Number(walletBalance).toFixed(2)}` : "—"}</div>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                navigator.clipboard.writeText(String(c.shortId));
              }}
            >
              Copy Short ID to find in Customers
            </Button>
          </section>

          {/* Request details */}
          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Request Details</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><div className="text-muted-foreground">Request ID</div><div className="font-mono font-medium">…{shortReqId}</div></div>
              <div><div className="text-muted-foreground">Amount</div><div className="font-medium text-base">${amount.toFixed(2)}</div></div>
              <div>
                <div className="text-muted-foreground">Status</div>
                <Badge variant="outline" className={statusBadge(statusStr)}>
                  {statusStr.charAt(0).toUpperCase() + statusStr.slice(1)}
                </Badge>
              </div>
              <div><div className="text-muted-foreground">Submitted</div><div className="font-medium">{fmtDateTimeSG(r.createdAt || r.created_at)}</div></div>
              <div>
                <div className="text-muted-foreground">Method</div>
                {(() => {
                  const m = String(r.method || "paynow").toLowerCase();
                  const isCash = m === "cash";
                  const cls = isCash
                    ? "bg-blue-500/10 text-blue-400 border-blue-500/30"
                    : "bg-purple-500/10 text-purple-400 border-purple-500/30";
                  return (
                    <Badge variant="outline" className={cls}>{isCash ? "Cash" : "PayNow"}</Badge>
                  );
                })()}
              </div>
            </div>
          </section>

          {/* Processing details */}
          {!isPending && (
            <section className="space-y-2">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Processing Details</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><div className="text-muted-foreground">Processed</div><div className="font-medium">{reviewedAt ? fmtDateTimeSG(reviewedAt) : "—"}</div></div>
                <div><div className="text-muted-foreground">Processed By</div><div className="font-medium">{reviewerName || "—"}</div></div>
              </div>
              {adminNotes && (
                <div className="text-sm"><div className="text-muted-foreground">Admin Notes</div><div className="font-medium whitespace-pre-wrap">{adminNotes}</div></div>
              )}
              {rejectionReason && (
                <div className="text-sm"><div className="text-muted-foreground">Rejection Reason</div><div className="font-medium whitespace-pre-wrap text-destructive">{rejectionReason}</div></div>
              )}
            </section>
          )}

          {/* Staff instructions */}
          {isPending && (
            <section className="space-y-1 rounded-md border border-yellow-500/30 bg-yellow-500/5 p-4">
              <h3 className="text-sm font-semibold text-yellow-500 uppercase tracking-wide">Instructions for Staff</h3>
              <ul className="text-sm space-y-1 list-disc pl-5">
                <li>Check PayNow for a transfer of <span className="font-semibold">${amount.toFixed(2)}</span></li>
                <li>The customer's reference code is <span className="font-mono font-semibold">{c.shortId}</span></li>
                <li>Verify the amount matches before approving</li>
              </ul>
            </section>
          )}

          {/* Actions */}
          {isPending && (
            <section className="space-y-3">
              {!inlineRejectMode ? (
                <div className="flex flex-col gap-2">
                  <Button
                    size="lg"
                    className="bg-green-600 hover:bg-green-700 text-white w-full"
                    disabled={busy}
                    onClick={onApprove}
                  >
                    <Check className="h-4 w-4 mr-2" /> Approve — Credit ${amount.toFixed(2)} to wallet
                  </Button>
                  <Button
                    variant="destructive"
                    disabled={busy}
                    onClick={() => setInlineRejectMode(true)}
                  >
                    <X className="h-4 w-4 mr-2" /> Reject
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>Rejection Reason</Label>
                  <Textarea
                    value={inlineRejectReason}
                    onChange={(e) => setInlineRejectReason(e.target.value)}
                    placeholder="Reason for rejecting this request..."
                  />
                  <div className="flex gap-2 justify-end">
                    <Button variant="outline" onClick={() => { setInlineRejectMode(false); setInlineRejectReason(""); }}>Cancel</Button>
                    <Button variant="destructive" disabled={!inlineRejectReason.trim() || busy} onClick={onReject}>
                      Confirm Reject
                    </Button>
                  </div>
                </div>
              )}
            </section>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default Admin;
