import { useState, useEffect, useRef, useMemo } from "react";
import TablesTab from "@/components/admin/TablesTab";
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
  useUpdateCustomerEmail,
  useDeleteCustomer,
  useCustomerBookings,
  useCustomerWalletHistory,
  
  useTableMaintenance,
  useScheduleMaintenance,
  useDeleteMaintenance,
  useRestoreRecord,
  useHardDelete,
} from "@/hooks/useAdmin";
import { PinDialog } from "@/components/admin/PinDialog";
import LogsTab from "@/components/admin/LogsTab";
import StaffTab from "@/components/admin/StaffTab";
import { AccountingTab } from "@/components/admin/AccountingTab";
import MembershipTab from "@/components/admin/MembershipTab";
import LockersTab from "@/components/admin/LockersTab";
import { FnbTab } from "@/components/admin/FnbTab";
import { useAdminFnbOrders } from "@/hooks/useFnb";
import { useAdminPublicHolidays } from "@/hooks/usePricing";
import { useAdminCampaigns } from "@/hooks/useCampaign";
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
import { LogOut, ArrowLeft, DollarSign, Calendar, CalendarDays, BarChart3, Trash2, Search, Users, Timer, Play, Square, Wrench, FileText, ScrollText, Pencil, X, Check, MoreHorizontal, Clock, TrendingUp, Power, PowerOff, RotateCcw, Loader2, Wifi, WifiOff, Download, Copy, XCircle, Eye, EyeOff, AlertTriangle, Key, RefreshCw, Mail } from "lucide-react";
import ReasonDialog from "@/components/admin/ReasonDialog";
import { ChargeWalletDialog } from "@/components/admin/ChargeWalletDialog";
import { Checkbox } from "@/components/ui/checkbox";
import DeletedBanner, { getDeletedInfo, isDeleted as isRecordDeleted } from "@/components/admin/DeletedBanner";
import { Skeleton } from "@/components/ui/skeleton";
import { getAuthHeaders, apiFetch } from "@/lib/api";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { getTableLabel } from "@/lib/tableLabel";
import { useActiveWalkinSessions, useForceStopWalkin, useStoppedWalkinSessions } from "@/hooks/useWalkin";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const Admin = () => {
  const { user, loading, signOut } = useAuth();
  const [tab, setTab] = useState("overview");
  const [pendingCustomerEmail, setPendingCustomerEmail] = useState<string | null>(null);
  const { data: pendingFnbOrders = [] } = useAdminFnbOrders("pending");

  if (loading) return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading...</div>;
  if (!user) return <Navigate to="/auth" replace />;
  if (!user.isAdmin) return <Navigate to="/booking" replace />;

  const isAdmin = user.role === "admin";
  const isStaff = user.role === "staff";
  const isMaster = isAdmin && user.isMaster;
  const perms = new Set<string>(user.staffPermissions ?? []);
  const can = (key: string) => isAdmin || perms.has(key);

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
          <h1 className="text-xl font-semibold text-foreground tracking-tight">
            {isMaster ? "Master Dashboard" : isStaff ? "Staff Dashboard" : "Admin Dashboard"}
          </h1>
        </div>
        <Button variant="ghost" size="sm" onClick={signOut}><LogOut className="mr-2 h-4 w-4" /> Sign Out</Button>
      </header>

      <main className="mx-auto max-w-6xl p-4 sm:p-6">
        <Tabs value={tab} onValueChange={setTab} className="space-y-6">
          <div className="overflow-x-auto pb-1">
            <TabsList className="inline-flex w-max gap-0.5 min-w-full">
              {can("overview") && <TabsTrigger value="overview">Overview</TabsTrigger>}
              {can("bookings") && <TabsTrigger value="bookings">Bookings</TabsTrigger>}
              {can("tables") && <TabsTrigger value="tables">Tables</TabsTrigger>}
              {can("invoices") && <TabsTrigger value="invoices">Invoices</TabsTrigger>}
              {can("topups") && <TopUpsTabTrigger />}
              {can("customers") && <TabsTrigger value="customers">Customers</TabsTrigger>}
              {can("rewards") && <TabsTrigger value="rewards">Rewards</TabsTrigger>}
              {can("pricing") && <TabsTrigger value="pricing">Pricing</TabsTrigger>}
              {can("promos") && <TabsTrigger value="promos">Promos</TabsTrigger>}
              {isAdmin && <TabsTrigger value="campaigns">Campaigns</TabsTrigger>}
              {can("membership") && <TabsTrigger value="membership">Membership</TabsTrigger>}
              {can("lockers") && <TabsTrigger value="lockers">Lockers</TabsTrigger>}
              {can("fnb") && (
                <TabsTrigger value="fnb" className="relative">
                  F&B
                  {pendingFnbOrders.length > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-bold">
                      {pendingFnbOrders.length > 9 ? "9+" : pendingFnbOrders.length}
                    </span>
                  )}
                </TabsTrigger>
              )}
              {can("walkin") && <TabsTrigger value="walkin">Walk-in</TabsTrigger>}
              {can("verification") && <VerificationTabTrigger />}
              {can("logs") && <TabsTrigger value="logs">Logs</TabsTrigger>}
              {isMaster && <TabsTrigger value="staff">Staff</TabsTrigger>}
              {isMaster && <TabsTrigger value="accounting">Accounting</TabsTrigger>}
            </TabsList>
          </div>

          {can("overview") && <TabsContent value="overview"><OverviewTab /></TabsContent>}
          {can("bookings") && <TabsContent value="bookings"><BookingsTab /></TabsContent>}
          {can("tables") && <TabsContent value="tables"><TablesTab /></TabsContent>}
          {can("invoices") && <TabsContent value="invoices"><InvoicesTab /></TabsContent>}
          {can("topups") && <TabsContent value="topups"><TopUpsTab /></TabsContent>}
          {can("customers") && (
            <TabsContent value="customers">
              <CustomersTab
                pendingEmail={pendingCustomerEmail}
                onPendingHandled={() => setPendingCustomerEmail(null)}
              />
            </TabsContent>
          )}
          {can("rewards") && <TabsContent value="rewards"><RewardsTab onCustomerClick={goToCustomer} /></TabsContent>}
          {can("pricing") && <TabsContent value="pricing"><PricingTab /></TabsContent>}
          {can("promos") && <TabsContent value="promos"><PromosTab /></TabsContent>}
          {isAdmin && <TabsContent value="campaigns"><CampaignsTab /></TabsContent>}
          {can("membership") && <TabsContent value="membership"><MembershipTab /></TabsContent>}
          {can("lockers") && <TabsContent value="lockers"><LockersTab /></TabsContent>}
          {can("fnb") && <TabsContent value="fnb"><FnbTab /></TabsContent>}
          {can("walkin") && <TabsContent value="walkin"><WalkinSessionsTab /></TabsContent>}
          {can("verification") && <TabsContent value="verification"><VerificationTab /></TabsContent>}
          {can("logs") && <TabsContent value="logs"><LogsTab /></TabsContent>}
          {isMaster && <TabsContent value="staff"><StaffTab /></TabsContent>}
          {isMaster && <TabsContent value="accounting"><AccountingTab /></TabsContent>}
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
  const { data: tablesList } = useAdminTables();

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
    // If backend returns a raw ObjectId/string, resolve it through tablesList
    if (stats?.mostBookedTable) {
      const raw = stats.mostBookedTable;
      // If it already looks like a friendly label, keep it
      if (typeof raw === "string" && /^Table\s/i.test(raw)) return raw;
      return getTableLabel(raw, tablesList as any);
    }
    const counts: Record<string, number> = {};
    for (const b of bookings || []) {
      const created = b.createdAt || b.created_at || b.startTime || b.start_time;
      if (!inRange(created)) continue;
      const name = getTableLabel(b.tableId, tablesList as any, b);
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
  const [cancelRefund, setCancelRefund] = useState(false);
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

    <Dialog open={!!cancelTargetId} onOpenChange={(o) => { if (!o) { setCancelTargetId(null); setCancelReason(""); setCancelRefund(false); } }}>
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
        <div className="flex items-center justify-between rounded-lg border border-border/50 p-3">
          <div>
            <p className="text-sm font-medium">Refund to wallet</p>
            <p className="text-xs text-muted-foreground">Return booking amount to customer wallet</p>
          </div>
          <Switch checked={cancelRefund} onCheckedChange={setCancelRefund} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { setCancelTargetId(null); setCancelReason(""); }}>Go Back</Button>
          <Button
            variant="destructive"
            disabled={cancelReason.trim().length < 5 || updateStatus.isPending}
            onClick={() => {
              if (!cancelTargetId) return;
              updateStatus.mutate(
                { bookingId: cancelTargetId, status: "cancelled", reason: cancelReason.trim(), refund: cancelRefund },
                { onSuccess: () => { setCancelTargetId(null); setCancelReason(""); setCancelRefund(false); } },
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

function InvoiceDetailDialog({ session, onClose, onDelete }: { session: any | null; onClose: () => void; onDelete: () => void }) {
  const [nowTick, setNowTick] = useState(Date.now());
  const propWalkin = !!session?._walkin || !!session?.userId;
  const propId = session ? String(session._id || session.id || "") : "";

  // Re-fetch latest session details (especially for walk-in sessions) so that when
  // the session is stopped/force-stopped elsewhere, the modal reflects the new
  // status, end time, and final amount instead of stale "In Progress" / $0.00.
  const { data: fresh, refetch: refetchSession } = useQuery({
    queryKey: ["session-detail", propId],
    enabled: !!session && propWalkin && !!propId,
    refetchInterval: 5000,
    staleTime: 0,
    queryFn: async () => {
      const res = await apiFetch(`/api/sessions/${propId}`);
      if (!res.ok) return null;
      const data = await res.json().catch(() => null);
      return data?.session ?? data ?? null;
    },
  });

  // Listen for stop / force-stop socket events and immediately re-fetch.
  useEffect(() => {
    if (!session || !propWalkin || !propId) return;
    const handler = (e: Event) => {
      const detail: any = (e as CustomEvent).detail || {};
      const evtId = String(detail?.sessionId || detail?._id || detail?.id || "");
      if (!evtId || evtId === propId) refetchSession();
    };
    window.addEventListener("walkin_session_stopped", handler);
    window.addEventListener("walkin_session_force_stopped", handler);
    return () => {
      window.removeEventListener("walkin_session_stopped", handler);
      window.removeEventListener("walkin_session_force_stopped", handler);
    };
  }, [session, propWalkin, propId, refetchSession]);

  const merged = fresh ? { ...session, ...fresh } : session;
  const walkin = !!merged?._walkin || !!merged?.userId;
  const isActive = !!merged && walkin && (merged.status === "active" || (!merged.endedAt && !merged.endTime && !merged.ended_at));

  useEffect(() => {
    if (!isActive) return;
    const id = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, [isActive]);

  if (!session) return null;
  const s = merged;
  const id = String(s._id || s.id || "");
  const shortId = id.slice(-8).toUpperCase();
  const isDeleted = s.isDeleted === true;
  const startedAt = s.startedAt || s.started_at || s.startTime;
  const endedAtRaw = s.endedAt || s.ended_at || s.endTime;
  const createdAt = s.createdAt || s.created_at || startedAt;

  const startMs = startedAt ? new Date(startedAt).getTime() : 0;
  const endMs = endedAtRaw ? new Date(endedAtRaw).getTime() : (isActive ? nowTick : 0);
  const durationSecondsCalc = startMs && endMs ? Math.max(0, Math.floor((endMs - startMs) / 1000)) : 0;
  const durationSeconds = Number(s.durationSeconds ?? s.duration_seconds ?? (s.durationMinutes ? s.durationMinutes * 60 : 0)) || durationSecondsCalc;

  const h = Math.floor(durationSeconds / 3600);
  const m = Math.floor((durationSeconds % 3600) / 60);
  const sec = durationSeconds % 60;
  const durationLabel = h > 0
    ? `${h}h ${m}m ${sec}s`
    : `${m}m ${sec}s`;

  const rate = Number(s.hourlyRate ?? s.hourly_rate ?? 0);
  const liveAmount = isActive ? Number(s.runningCost ?? 0) : 0;
  const amount = isActive
    ? liveAmount
    : Number(s.amountCharged ?? s.amount_charged ?? s.total_cost ?? s.totalCost ?? s.runningCost ?? 0);
  const baseTotal = Number(s.baseTotal ?? s.base_total ?? 0);
  const membershipDiscountAmount = Number(s.membershipDiscountAmount ?? s.membershipDiscount ?? s.membership_discount_amount ?? s.membership_discount ?? 0);
  const membershipDiscountPercent = Number(s.membershipDiscountPercent ?? s.membership_discount_percent ?? 0);
  const freeMinutesCredit = Number(s.freeMinutesCredit ?? s.free_minutes_credit ?? 0);
  const freeMinutesApplied = Math.round(Number(s.freeMinutesApplied ?? s.free_minutes_applied ?? 0));
  // Manual admin discount applied at table-close time (walk-in/timer sessions)
  const manualGrossAmount = Number(s.grossAmount ?? s.gross_amount ?? 0);
  const manualDiscountPercent = Number(s.discountPercent ?? s.discount_percent ?? 0);
  const manualDiscountAmount = Number(s.discountAmount ?? s.discount_amount ?? 0);
  const hasManualDiscount = !isActive && manualDiscountAmount > 0;
  const hasDiscountBreakdown = !isActive && (membershipDiscountAmount > 0 || freeMinutesCredit > 0 || hasManualDiscount);
  const staff = s.startedBy?.name || s.startedBy?.email || "—";
  const customerName =
    (typeof s.userId === "object"
      ? s.userId?.name || s.userId?.username || s.userId?.email
      : null) || s.userName || s.customerName || "—";
  const tableName = s.tableName || (s.tables?.table_number ? `Table ${s.tables.table_number}` : (s.tableId ? getTableLabel(s.tableId) : "—"));

  // pricingSegments: prefer explicit segments array; otherwise fall back to single segment from rate+duration.
  const rawSegments: any[] = Array.isArray(s.pricingSegments)
    ? s.pricingSegments
    : Array.isArray(s.pricing_segments)
    ? s.pricing_segments
    : Array.isArray(s.segments)
    ? s.segments
    : [];
  const segments = rawSegments.length
    ? rawSegments.map((seg: any) => {
        const sStart = seg.startTime || seg.start_time || seg.startedAt || seg.from;
        const sEnd = seg.endTime || seg.end_time || seg.endedAt || seg.to;
        const sRate = Number(seg.rate ?? seg.hourlyRate ?? seg.hourly_rate ?? 0);
        const segStartMs = sStart ? new Date(sStart).getTime() : 0;
        const segEndMs = sEnd ? new Date(sEnd).getTime() : 0;
        const segSeconds = Number(seg.durationSeconds ?? seg.duration_seconds ??
          (segStartMs && segEndMs ? Math.max(0, Math.floor((segEndMs - segStartMs) / 1000)) : 0));
        const sMins = Math.floor(segSeconds / 60);
        const sSecs = segSeconds % 60;
        const sCost = Number(seg.segmentCost ?? seg.cost ?? seg.amount ?? (sRate * (segSeconds / 3600)));
        return { sStart, sEnd, sRate, segSeconds, sMins, sSecs, sCost };
      })
    : (rate > 0 && startedAt
        ? [{
            sStart: startedAt,
            sEnd: endedAtRaw,
            sRate: rate,
            segSeconds: durationSeconds,
            sMins: Math.floor(durationSeconds / 60),
            sSecs: durationSeconds % 60,
            sCost: amount,
          }]
        : []);

  const copyId = () => { if (id) navigator.clipboard.writeText(id); };

  const endLabel = isActive
    ? "In Progress"
    : endedAtRaw ? fmtDateTimeSG(endedAtRaw) : "—";

  return (
    <Dialog open={!!session} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-lg gold-gradient">
            {walkin ? "Walk-in Session Details" : "Invoice Details"}
          </DialogTitle>
          <DialogDescription className="sr-only">Session details</DialogDescription>
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
                ) : isActive ? (
                  <Badge variant="outline" className="bg-accent/15 text-accent border-accent/40">In Progress</Badge>
                ) : (
                  <Badge variant="outline" className="bg-emerald-500/15 text-emerald-500 border-emerald-500/40">Completed</Badge>
                )}
              </div>
              {walkin && (
                <div className="col-span-2">
                  <Badge variant="outline" className="bg-accent/10 text-accent border-accent/30">Walk-in</Badge>
                </div>
              )}
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
              <div>
                <div className="text-muted-foreground">Start time</div>
                <div className="font-medium tabular-nums">{startedAt ? fmtDateTimeSG(startedAt) : "—"}</div>
              </div>
              <div>
                <div className="text-muted-foreground">End time</div>
                <div className={`font-medium tabular-nums ${isActive ? "text-accent" : ""}`}>{endLabel}</div>
              </div>
            </div>
          </section>

          <Separator className="bg-border/50" />

          {/* Payment */}
          <section className="space-y-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Payment Details</h3>

            {segments.length > 0 ? (
              <div className="rounded-md border border-border/50 p-3 space-y-1.5 text-sm">
                {segments.map((seg, idx) => (
                  <div key={idx} className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground tabular-nums">
                      {seg.sStart ? fmtTimeSG(seg.sStart) : "—"} – {seg.sEnd ? fmtTimeSG(seg.sEnd) : (isActive ? "now" : "—")}
                      <span className="ml-2 text-xs opacity-70">
                        @ ${seg.sRate.toFixed(2)}/hr
                      </span>
                    </span>
                    <span className="tabular-nums font-medium">= ${Number(seg.sCost).toFixed(2)}</span>
                  </div>
                ))}
                <Separator className="bg-border/50 my-1" />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total duration</span>
                  <span className="tabular-nums">{durationLabel}</span>
                </div>
                {hasDiscountBreakdown && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span className="tabular-nums">${(hasManualDiscount ? manualGrossAmount : baseTotal).toFixed(2)}</span>
                    </div>
                    {membershipDiscountAmount > 0 && (
                      <div className="flex justify-between text-primary">
                        <span>
                          Membership discount{membershipDiscountPercent > 0 ? ` (${Math.round(membershipDiscountPercent)}% off)` : ""}
                        </span>
                        <span className="tabular-nums">−${membershipDiscountAmount.toFixed(2)}</span>
                      </div>
                    )}
                    {freeMinutesCredit > 0 && (
                      <div className="flex justify-between text-primary">
                        <span>Free {freeMinutesApplied > 0 ? `${freeMinutesApplied} ` : ""}mins (membership benefit)</span>
                        <span className="tabular-nums">−${freeMinutesCredit.toFixed(2)}</span>
                      </div>
                    )}
                    {hasManualDiscount && (
                      <div className="flex justify-between text-primary">
                        <span>Discount{manualDiscountPercent > 0 ? ` (${Math.round(manualDiscountPercent)}% off)` : ""}</span>
                        <span className="tabular-nums">−${manualDiscountAmount.toFixed(2)}</span>
                      </div>
                    )}
                    <Separator className="bg-border/50 my-1" />
                  </>
                )}
                <div className="flex justify-between font-bold text-base">
                  <span>{isActive ? "Running Total" : (hasDiscountBreakdown ? "Total Charged" : "Amount Charged")}</span>
                  <span className={isDeleted ? "line-through text-muted-foreground tabular-nums" : "gold-gradient tabular-nums"}>
                    ${amount.toFixed(2)}
                  </span>
                </div>
              </div>
            ) : (
              <div className="rounded-md border border-border/50 p-3 space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Duration</span>
                  <span className="tabular-nums">{durationLabel}</span>
                </div>
                <Separator className="bg-border/50 my-1" />
                {hasDiscountBreakdown && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span className="tabular-nums">${(hasManualDiscount ? manualGrossAmount : baseTotal).toFixed(2)}</span>
                    </div>
                    {membershipDiscountAmount > 0 && (
                      <div className="flex justify-between text-primary">
                        <span>
                          Membership discount{membershipDiscountPercent > 0 ? ` (${Math.round(membershipDiscountPercent)}% off)` : ""}
                        </span>
                        <span className="tabular-nums">−${membershipDiscountAmount.toFixed(2)}</span>
                      </div>
                    )}
                    {freeMinutesCredit > 0 && (
                      <div className="flex justify-between text-primary">
                        <span>Free {freeMinutesApplied > 0 ? `${freeMinutesApplied} ` : ""}mins (membership benefit)</span>
                        <span className="tabular-nums">−${freeMinutesCredit.toFixed(2)}</span>
                      </div>
                    )}
                    {hasManualDiscount && (
                      <div className="flex justify-between text-primary">
                        <span>Discount{manualDiscountPercent > 0 ? ` (${Math.round(manualDiscountPercent)}% off)` : ""}</span>
                        <span className="tabular-nums">−${manualDiscountAmount.toFixed(2)}</span>
                      </div>
                    )}
                    <Separator className="bg-border/50 my-1" />
                  </>
                )}
                <div className="flex justify-between font-bold text-base">
                  <span>{isActive ? "Running Total" : (hasDiscountBreakdown ? "Total Charged" : "Amount Charged")}</span>
                  <span className={isDeleted ? "line-through text-muted-foreground tabular-nums" : "gold-gradient tabular-nums"}>
                    ${amount.toFixed(2)}
                  </span>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 text-sm pt-1">
              <div>
                <div className="text-muted-foreground">Method</div>
                <Badge variant="outline" className={walkin ? "bg-green-500/10 text-green-400 border-green-500/30" : "bg-muted text-muted-foreground border-border"}>
                  {walkin ? "Wallet" : "Cash"}
                </Badge>
              </div>
              <div>
                <div className="text-muted-foreground">Paid At</div>
                <div className="font-medium">{endLabel}</div>
              </div>
            </div>
          </section>

          <Separator className="bg-border/50" />

          {/* Customer / Staff */}
          <section className="space-y-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              {walkin ? "Customer" : "Staff Details"}
            </h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-muted-foreground">{walkin ? "Customer" : "Opened by"}</div>
                <div className="font-medium">{walkin ? customerName : staff}</div>
              </div>
            </div>
          </section>
        </div>

        {!isDeleted && !isActive && (
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
  const { user: authUser } = useAuth();
  const isMaster = authUser?.isMaster ?? false;
  const [showDeleted, setShowDeleted] = useState(false);
  const { data, isLoading } = useAdminTimerSessions(showDeleted);
  const timerSessions: any[] = Array.isArray(data) ? data : (data?.sessions || data?.timerSessions || []);
  const { data: stoppedWalkinsData } = useStoppedWalkinSessions(true, showDeleted);
  const stoppedWalkins: any[] = Array.isArray(stoppedWalkinsData) ? stoppedWalkinsData : [];
  // Merge stopped walk-ins into the sessions list with a marker.
  const sessions: any[] = [
    ...timerSessions.map((s) => ({ ...s, _walkin: false })),
    ...stoppedWalkins.map((s) => ({
      ...s,
      _walkin: true,
      startedAt: s.startedAt ?? s.startTime,
      endedAt: s.stoppedAt ?? s.endedAt ?? s.endTime,
      durationSeconds:
        s.durationSeconds ??
        (s.durationMinutes ? s.durationMinutes * 60 : undefined) ??
        (s.startedAt && (s.stoppedAt || s.endedAt)
          ? Math.max(0, Math.floor((new Date(s.stoppedAt || s.endedAt).getTime() - new Date(s.startedAt).getTime()) / 1000))
          : 0),
      amountCharged: s.amountCharged ?? s.totalCost ?? s.runningCost ?? 0,
      tableName: s.tableName || (s.tableId ? getTableLabel(s.tableId) : ""),
      startedBy:
        typeof s.userId === "object"
          ? { name: s.userId?.name || s.userId?.username, email: s.userId?.email }
          : undefined,
    })),
  ].sort(
    (a, b) =>
      new Date(b.startedAt || b.started_at || 0).getTime() -
      new Date(a.startedAt || a.started_at || 0).getTime(),
  );
  const { toast } = useToast();
  const qc = useQueryClient();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deleteTargetIsWalkin, setDeleteTargetIsWalkin] = useState(false);
  const [deleteReason, setDeleteReason] = useState("");
  const [selectedSession, setSelectedSession] = useState<any | null>(null);
  const restore = useRestoreRecord();
  const hardDelete = useHardDelete();
  const [hardDeleteTarget, setHardDeleteTarget] = useState<{ type: string; id: string } | null>(null);

  const handleDelete = async (id: string, reason: string, isWalkin: boolean) => {
    setDeletingId(id);
    try {
      const res = await apiFetch(isWalkin ? `/api/sessions/${id}` : `/api/admin/timer-sessions/${id}`, {
        method: "DELETE",
        body: JSON.stringify({ reason }),
      });
      if (!res.ok) throw new Error("Failed");
      toast({ title: "Invoice deleted" });
      qc.invalidateQueries({ queryKey: ["admin-timer-sessions"] });
      qc.invalidateQueries({ queryKey: ["admin-timer-sessions", true] });
      qc.invalidateQueries({ queryKey: ["walkin-stopped"] });
      setDeleteTargetId(null);
      setDeleteTargetIsWalkin(false);
      setDeleteReason("");
    } catch {
      toast({ title: "Failed to delete invoice", variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  };

  const formatDuration = (seconds: number) => {
    const total = Math.max(0, Math.floor(Number(seconds) || 0));
    if (total > 0 && total < 60) return "< 1m";
    const mins = Math.ceil(total / 60);
    const h = Math.floor(mins / 60);
    const m = mins % 60;
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
    <ActiveWalkinSessionsSection />
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
                  const endedAt = s._walkin
                    ? (s.stoppedAt || s.endedAt || s.ended_at || s.endTime)
                    : (s.endedAt || s.ended_at);
                  const duration = s.durationSeconds ?? s.duration_seconds ?? 0;
                  const segments: any[] = Array.isArray(s.pricingSegments)
                    ? s.pricingSegments
                    : Array.isArray(s.pricing_segments)
                    ? s.pricing_segments
                    : [];
                  const segmentRate = segments.length
                    ? Number(segments[0].rate ?? segments[0].hourlyRate ?? segments[0].hourly_rate ?? 0)
                    : 0;
                  const rate = s._walkin
                    ? segmentRate
                    : Number(s.hourlyRate ?? s.hourly_rate ?? 0);
                  const amount = s._walkin
                    ? Number(s.amountCharged ?? 0)
                    : Number(s.amountCharged ?? s.amount_charged ?? s.total_cost ?? 0);
                  const staff = s._walkin
                    ? ((typeof s.userId === "object"
                        ? (s.userId?.name || s.userId?.username || s.userId?.email)
                        : null) || s.startedBy?.name || s.startedBy?.email || "—")
                    : (s.startedBy?.name || s.startedBy?.email || "—");
                  const showNoRate = rate <= 0 && amount <= 0;
                  const isDeleted = s.isDeleted === true;
                  const deletedBy = s.deletedBy?.name || s.deletedBy?.email || (typeof s.deletedBy === "string" ? s.deletedBy : "");
                  const tooltipText = isDeleted
                    ? `Reason: ${s.deletionReason || s.deletedReason || "—"}\nDeleted by: ${deletedBy || "—"}${s.deletedAt ? `\nDeleted at: ${fmtDateTimeSG(s.deletedAt)}` : ""}`
                    : undefined;
                  return (
                    <tr
                      key={s._id || s.id}
                      className={`border-b border-border last:border-0 cursor-pointer hover:bg-muted/30 ${isDeleted ? "opacity-60" : ""}`}
                      title={tooltipText}
                      onClick={() => setSelectedSession(s)}
                    >
                      <td className="py-3 pr-4">{startedAt ? formatDateLong(startedAt) : "—"}</td>
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-2">
                          <span>{s.tableName || (s.tables?.table_number ? `Table ${s.tables.table_number}` : "—")}</span>
                          {s._walkin && (
                            <Badge variant="outline" className="bg-accent/10 text-accent border-accent/30 text-[10px] py-0 px-1.5">
                              Walk-in
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="py-3 pr-4">{startedAt ? fmtTimeSG(startedAt) : "—"}</td>
                      <td className="py-3 pr-4">{endedAt ? fmtTimeSG(endedAt) : "—"}</td>
                      <td className="py-3 pr-4 font-mono">{formatDuration(duration)}</td>
                      <td className="py-3 pr-4">
                        {showNoRate ? (
                          <Badge variant="outline" className="bg-muted text-muted-foreground border-border text-[10px] py-0 px-1.5">
                            No Rate
                          </Badge>
                        ) : rate > 0 ? (
                          `$${rate.toFixed(0)}/hr`
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className={`py-3 pr-4 font-medium ${isDeleted ? "line-through text-muted-foreground" : ""}`}>${amount.toFixed(2)}</td>
                      <td className="py-3 pr-4 text-muted-foreground">{staff}</td>
                      <td className="py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        {isDeleted ? (
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs"
                              disabled={restore.isPending}
                              onClick={() => restore.mutate({ type: s._walkin ? "walkin-session" : "timer-session", id: s._id || s.id })}
                            >
                              <RotateCcw className="h-3 w-3 mr-1" /> Restore
                            </Button>
                            {isMaster && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs border-destructive/50 text-destructive hover:bg-destructive/10"
                                onClick={() => setHardDeleteTarget({ type: s._walkin ? "walkin-session" : "timer-session", id: s._id || s.id })}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        ) : (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            disabled={deletingId === (s._id || s.id)}
                            onClick={() => { setDeleteTargetId(s._id || s.id); setDeleteTargetIsWalkin(!!s._walkin); setDeleteReason(""); }}
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
          setDeleteTargetIsWalkin(!!selectedSession._walkin);
          setDeleteReason("");
          setSelectedSession(null);
        }
      }}
    />

    <Dialog open={!!deleteTargetId} onOpenChange={(o) => { if (!o) { setDeleteTargetId(null); setDeleteTargetIsWalkin(false); setDeleteReason(""); } }}>
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
          <Button variant="outline" onClick={() => { setDeleteTargetId(null); setDeleteTargetIsWalkin(false); setDeleteReason(""); }}>Go Back</Button>
          <Button
            variant="destructive"
            disabled={deleteReason.trim().length < 5 || deletingId === deleteTargetId}
            onClick={() => { if (deleteTargetId) handleDelete(deleteTargetId, deleteReason.trim(), deleteTargetIsWalkin); }}
          >
            Confirm Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {hardDeleteTarget && (
      <PinDialog
        open={!!hardDeleteTarget}
        onOpenChange={(o) => !o && setHardDeleteTarget(null)}
        loading={hardDelete.isPending}
        onConfirm={(pin) =>
          hardDelete.mutate(
            { type: hardDeleteTarget.type, id: hardDeleteTarget.id, pin },
            {
              onSuccess: () => {
                setHardDeleteTarget(null);
                qc.invalidateQueries({ queryKey: ["admin-timer-sessions"] });
                qc.invalidateQueries({ queryKey: ["admin-timer-sessions", true] });
              }
            }
          )
        }
      />
    )}
    </>
  );
}

type SortCol = "name" | "shortId" | "email" | "status" | "role" | "wallet" | "totalSpent" | "joined";
type SortDir = "asc" | "desc";
type StatusFilter = "all" | "verified" | "unverified";
type RoleFilter = "all" | "admin" | "staff" | "user";

function CustomersTab({
  pendingEmail,
  onPendingHandled,
}: {
  pendingEmail?: string | null;
  onPendingHandled?: () => void;
} = {}) {
  const { user: authUser } = useAuth();
  const isMaster = authUser?.isMaster ?? false;

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [showDeleted, setShowDeleted] = useState(false);
  const { data: customers, isLoading } = useAdminCustomers(debouncedSearch, showDeleted);
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);
  const [sortCol, setSortCol] = useState<SortCol>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");

  // Soft delete
  const deleteCustomer = useDeleteCustomer();
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [deleteReason, setDeleteReason] = useState("");

  // Restore + hard delete
  const restore = useRestoreRecord();
  const hardDelete = useHardDelete();
  const [hardDeleteTarget, setHardDeleteTarget] = useState<{ type: string; id: string } | null>(null);

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

  const handleHeaderClick = (col: SortCol) => {
    if (col === "status") {
      setStatusFilter(prev => prev === "all" ? "verified" : prev === "verified" ? "unverified" : "all");
      return;
    }
    if (col === "role") {
      setRoleFilter(prev => prev === "all" ? "admin" : prev === "admin" ? "staff" : prev === "staff" ? "user" : "all");
      return;
    }
    if (sortCol === col) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortCol(col);
      setSortDir("asc");
    }
  };

  const displayCustomers = useMemo(() => {
    let arr = [...(customers || [])];
    if (statusFilter === "verified") arr = arr.filter(c => c.isVerified);
    if (statusFilter === "unverified") arr = arr.filter(c => !c.isVerified);
    if (roleFilter !== "all") arr = arr.filter(c => c.role === roleFilter);
    arr.sort((a, b) => {
      let va: any, vb: any;
      if (sortCol === "name") { va = (a.legal_name || a.name || "").toLowerCase(); vb = (b.legal_name || b.name || "").toLowerCase(); }
      else if (sortCol === "shortId") { va = a.shortId || ""; vb = b.shortId || ""; }
      else if (sortCol === "email") { va = (a.email || "").toLowerCase(); vb = (b.email || "").toLowerCase(); }
      else if (sortCol === "status") { va = a.isVerified ? 0 : 1; vb = b.isVerified ? 0 : 1; }
      else if (sortCol === "role") { va = a.role || ""; vb = b.role || ""; }
      else if (sortCol === "wallet") { va = a.wallet_balance ?? 0; vb = b.wallet_balance ?? 0; }
      else if (sortCol === "totalSpent") { va = a.total_spent ?? 0; vb = b.total_spent ?? 0; }
      else if (sortCol === "joined") { va = new Date(a.created_at || 0).getTime(); vb = new Date(b.created_at || 0).getTime(); }
      else { return 0; }
      const cmp = typeof va === "number" ? va - vb : String(va).localeCompare(String(vb));
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [customers, sortCol, sortDir, statusFilter, roleFilter]);

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
        <div className="flex gap-2 items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, email or Short ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
              autoComplete="off"
            />
          </div>
          <Button
            variant={showDeleted ? "destructive" : "outline"}
            size="sm"
            className="whitespace-nowrap"
            onClick={() => setShowDeleted(v => !v)}
          >
            <Trash2 className="h-3.5 w-3.5 mr-1.5" />
            {showDeleted ? "Hide Deleted" : "Show Deleted"}
          </Button>
        </div>



        {(statusFilter !== "all" || roleFilter !== "all") && (
          <div className="flex flex-wrap gap-2 text-xs">
            {statusFilter !== "all" && (
              <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-muted border border-border">
                Status: <strong>{statusFilter === "verified" ? "Verified" : "Unverified"}</strong>
                <button className="ml-1 hover:text-destructive" onClick={() => setStatusFilter("all")}>✕</button>
              </span>
            )}
            {roleFilter !== "all" && (
              <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-muted border border-border capitalize">
                Role: <strong>{roleFilter}</strong>
                <button className="ml-1 hover:text-destructive" onClick={() => setRoleFilter("all")}>✕</button>
              </span>
            )}
            <span className="text-muted-foreground py-1">{displayCustomers.length} result{displayCustomers.length !== 1 ? "s" : ""}</span>
          </div>
        )}

        {displayCustomers.length === 0 && !isLoading && (
          <p className="text-muted-foreground text-sm">No customers found.</p>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                {([
                  { key: "name",       label: "Name" },
                  { key: "shortId",    label: "Short ID" },
                  { key: "email",      label: "Email" },
                  { key: "status",     label: "Status" },
                  { key: "role",       label: "Role" },
                  { key: "wallet",     label: "Wallet" },
                  { key: "totalSpent", label: "Total Spent" },
                  { key: "joined",     label: "Joined" },
                ] as { key: SortCol; label: string }[]).map(({ key, label }) => {                  const isFilter = key === "status" || key === "role";
                  const isActive = isFilter
                    ? (key === "status" ? statusFilter !== "all" : roleFilter !== "all")
                    : sortCol === key;
                  const filterLabel = key === "status" && statusFilter !== "all"
                    ? (statusFilter === "verified" ? "✓ Verified" : "✗ Unverified")
                    : key === "role" && roleFilter !== "all"
                    ? roleFilter.charAt(0).toUpperCase() + roleFilter.slice(1)
                    : null;
                  return (
                    <th
                      key={key}
                      onClick={() => handleHeaderClick(key)}
                      className={`pb-2 pr-4 cursor-pointer select-none whitespace-nowrap group ${isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      <span className="inline-flex items-center gap-1">
                        {filterLabel || label}
                        {isFilter ? (
                          <span className={`text-xs ${isActive ? "text-primary" : "opacity-40 group-hover:opacity-70"}`}>▼</span>
                        ) : (
                          <span className={`text-xs transition-opacity ${sortCol === key ? "opacity-100" : "opacity-0 group-hover:opacity-50"}`}>
                            {sortCol === key ? (sortDir === "asc" ? "↑" : "↓") : "↕"}
                          </span>
                        )}
                      </span>
                    </th>
                  );
                })}
                <th className="pb-2 text-muted-foreground whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (!customers || customers.length === 0) ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={`csk-${i}`} className="border-b border-border last:border-0">
                    {Array.from({ length: 9 }).map((__, j) => (
                      <td key={j} className="py-3 pr-4"><Skeleton className="h-4 w-20" /></td>
                    ))}
                  </tr>
                ))
              ) : displayCustomers.map((c: any) => (
                <tr
                  key={c.id}
                  className={`border-b border-border last:border-0 transition-colors ${c.isDeleted ? "opacity-50" : "cursor-pointer hover:bg-muted/50"}`}
                  onClick={() => !c.isDeleted && setSelectedCustomer(c)}
                >
                  <td className="py-3 pr-4 font-medium">
                    <div className="flex items-center gap-1.5">
                      {c.legal_name || c.name || "—"}
                      {c.isDeleted && <Badge variant="destructive" className="text-xs">Deleted</Badge>}
                    </div>
                  </td>
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
                  <td className="py-3 pr-4 text-muted-foreground">{c.created_at ? fmtDateSG(c.created_at) : "—"}</td>
                  <td className="py-3" onClick={(e) => e.stopPropagation()}>
                    {c.isDeleted ? (
                      <div className="flex gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          disabled={restore.isPending}
                          onClick={() => restore.mutate({ type: "user", id: c.id })}
                        >
                          <RotateCcw className="h-3 w-3 mr-1" /> Restore
                        </Button>
                        {isMaster && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs border-destructive/50 text-destructive hover:bg-destructive/10"
                            onClick={() => setHardDeleteTarget({ type: "user", id: c.id })}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => { setDeleteTarget(c); setDeleteReason(""); }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>

      {/* Soft-delete reason dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete customer account?</DialogTitle>
            <DialogDescription>
              This soft-deletes {deleteTarget?.name || deleteTarget?.email}. Their data is retained but the account is disabled. A master admin can restore or permanently delete it later.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label>Reason (required)</Label>
            <Textarea
              placeholder="e.g. duplicate account, user request, abuse..."
              value={deleteReason}
              onChange={(e) => setDeleteReason(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={!deleteReason.trim() || deleteCustomer.isPending}
              onClick={async () => {
                if (!deleteTarget || !deleteReason.trim()) return;
                await deleteCustomer.mutateAsync({ userId: deleteTarget.id, reason: deleteReason.trim() });
                setDeleteTarget(null);
              }}
            >
              {deleteCustomer.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Delete Account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Hard-delete PIN dialog (master only) */}
      {hardDeleteTarget && (
        <PinDialog
          open={!!hardDeleteTarget}
          onOpenChange={(o) => !o && setHardDeleteTarget(null)}
          loading={hardDelete.isPending}
          onConfirm={(pin) =>
            hardDelete.mutate(
              { type: hardDeleteTarget.type, id: hardDeleteTarget.id, pin },
              { onSuccess: () => setHardDeleteTarget(null) }
            )
          }
        />
      )}
    </Card>
  );
}

function CustomerDetail({ customer, onBack }: { customer: any; onBack: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const updateWallet = useUpdateCustomerWallet();
  const updateProfile = useUpdateCustomerProfile();
  const updateEmail = useUpdateCustomerEmail();
  const [changeEmailOpen, setChangeEmailOpen] = useState(false);
  const [newEmailInput, setNewEmailInput] = useState("");
  const [emailReason, setEmailReason] = useState("");
  const { data: bookings, isLoading: bookingsLoading } = useCustomerBookings(customer.user_id);
  const { data: walletHistory } = useCustomerWalletHistory(customer.user_id);
  const { data: activityLogs } = useAdminActivityLogs();
  const { data: allCustomers } = useAdminCustomers("");
  const { data: tablesList } = useAdminTables();

  const verifyInfo = (() => {
    if (customer.kyc_source === "singpass") {
      return { name: "Singpass", isSingpass: true, at: customer.verified_at };
    }
    const lookupName = (id: string) => {
      if (!id || !Array.isArray(allCustomers)) return null;
      const u = allCustomers.find((u: any) => u.user_id === id || u.id === id);
      return u?.legal_name || u?.name || u?.email || null;
    };
    if (customer.verified_by) {
      const raw = String(customer.verified_by);
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
  const [chargeOpen, setChargeOpen] = useState(false);

  // Re-verify (set legal name) state
  const [reVerifyOpen, setReVerifyOpen] = useState(false);
  const [reVerifyName, setReVerifyName] = useState("");
  const [reVerifyDob, setReVerifyDob] = useState("");
  const [reVerifying, setReVerifying] = useState(false);

  const handleReVerify = async () => {
    if (!reVerifyName.trim() || !reVerifyDob) {
      toast({ title: "Missing fields", description: "Legal name and date of birth are required", variant: "destructive" });
      return;
    }
    try {
      setReVerifying(true);
      const res = await apiFetch("/api/admin/verify-user", {
        method: "POST",
        body: JSON.stringify({ userId: customer.user_id, legalName: reVerifyName.trim(), dateOfBirth: reVerifyDob }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || data.message || "Failed");
      }
      toast({ title: "Legal name updated" });
      setReVerifyOpen(false);
      queryClient.invalidateQueries({ queryKey: ["admin-customers"] });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setReVerifying(false);
    }
  };

  // Reset password state
  const [resetPasswordOpen, setResetPasswordOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resettingPassword, setResettingPassword] = useState(false);

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
  const [editPhone, setEditPhone] = useState(customer.phone ?? "");
  const [editDob, setEditDob] = useState(
    customer.date_of_birth ? String(customer.date_of_birth).slice(0, 10) : ""
  );

  const openEditDetails = () => {
    setEditName(customer.name ?? "");
    setEditPhone(customer.phone ?? "");
    setEditDob(customer.date_of_birth ? String(customer.date_of_birth).slice(0, 10) : "");
    setEditDetailsOpen(true);
  };

  const saveDetails = async () => {
    const origName = (customer.name ?? "").trim();
    const origPhone = (customer.phone ?? "").trim();
    const origDob = customer.date_of_birth ? String(customer.date_of_birth).slice(0, 10) : "";

    const newName = editName.trim();
    const newPhone = editPhone.trim();
    const newDob = editDob || "";

    const payload: Parameters<typeof updateProfile.mutateAsync>[0] = { userId: customer.user_id };
    if (newName !== origName) payload.name = newName;
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

  const handleResetPassword = async () => {
    if (newPassword !== confirmPassword) {
      toast({
        title: "Passwords don't match",
        description: "Please make sure both passwords are identical.",
        variant: "destructive",
      });
      return;
    }
    if (newPassword.length < 8) {
      toast({
        title: "Password too short",
        description: "Password must be at least 8 characters.",
        variant: "destructive",
      });
      return;
    }

    setResettingPassword(true);
    try {
      const res = await apiFetch(`/api/users/${customer.user_id}/reset-password`, {
        method: "PATCH",
        body: JSON.stringify({ newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || data.message || "Failed to reset password");
      }
      toast({ title: "Password reset successfully" });
      setResetPasswordOpen(false);
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      toast({
        title: "Reset failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setResettingPassword(false);
    }
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
                  <Button size="sm" variant="outline" onClick={() => { setNewEmailInput(customer.email ?? ""); setEmailReason(""); setChangeEmailOpen(true); }}><Pencil className="mr-1 h-3 w-3" /> Change Email</Button>
                  <Button size="sm" variant="outline" onClick={() => setEditing(true)}><Pencil className="mr-1 h-3 w-3" /> Edit Wallet</Button>
                  <Button size="sm" variant="outline" onClick={() => { setNewPassword(""); setConfirmPassword(""); setResetPasswordOpen(true); }}><Key className="mr-1 h-3 w-3" /> Reset Password</Button>
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
                {verifyInfo ? (
                  verifyInfo.isSingpass ? (
                    <span className="inline-flex items-center gap-1">
                      <Badge className="bg-blue-600 text-white text-xs px-2 py-0">Singpass</Badge>
                    </span>
                  ) : verifyInfo.name
                ) : (customer.isVerified ? "—" : "Not verified")}
                {verifyInfo?.at && (
                  <span className="block text-xs text-muted-foreground">{fmtDateTimeSG(verifyInfo.at)}</span>
                )}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Legal Name</p>
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-medium">{customer.legal_name || <span className="text-muted-foreground">—</span>}</p>
                <Button size="sm" variant="outline" className="h-6 text-xs px-2" onClick={() => { setReVerifyName(customer.legal_name || ""); setReVerifyDob(customer.date_of_birth ? String(customer.date_of_birth).slice(0, 10) : ""); setReVerifyOpen(true); }}>
                  Edit
                </Button>
              </div>
            </div>
          </div>

          {/* Re-verify / Set Legal Name dialog */}
          <Dialog open={reVerifyOpen} onOpenChange={setReVerifyOpen}>
            <DialogContent>
              <DialogHeader><DialogTitle>Set Legal Name</DialogTitle></DialogHeader>
              <div className="space-y-3 pt-2">
                <div className="space-y-1">
                  <Label>Full Legal Name</Label>
                  <Input value={reVerifyName} onChange={e => setReVerifyName(e.target.value)} placeholder="e.g. TAN AH KOW" />
                </div>
                <div className="space-y-1">
                  <Label>Date of Birth</Label>
                  <Input type="date" value={reVerifyDob} onChange={e => setReVerifyDob(e.target.value)} />
                </div>
                <div className="flex gap-2 pt-1">
                  <Button onClick={handleReVerify} disabled={reVerifying || !reVerifyName.trim() || !reVerifyDob}>
                    {reVerifying ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null} Save
                  </Button>
                  <Button variant="ghost" onClick={() => setReVerifyOpen(false)}>Cancel</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

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
            <div className="flex items-center justify-between gap-4 flex-wrap pt-2 border-t border-border text-sm">
              <div className="flex gap-6">
                <span>Wallet: <strong>${(customer.wallet_balance ?? 0).toFixed(2)}</strong></span>
                <span>Total Spent: <strong>${(customer.total_spent ?? 0).toFixed(2)}</strong></span>
              </div>
              <Button size="sm" variant="outline" onClick={() => setChargeOpen(true)}>
                <DollarSign className="h-3.5 w-3.5 mr-1" /> Charge Wallet
              </Button>
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

      {/* Change Email Dialog */}
      <Dialog open={changeEmailOpen} onOpenChange={(o) => { if (!o) setChangeEmailOpen(false); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Email</DialogTitle>
            <DialogDescription>
              Current email: <span className="font-medium">{customer.email}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-email">New Email</Label>
              <Input
                id="new-email"
                type="email"
                value={newEmailInput}
                onChange={(e) => setNewEmailInput(e.target.value)}
                placeholder="new@email.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email-reason">Reason (required)</Label>
              <Textarea
                id="email-reason"
                value={emailReason}
                onChange={(e) => setEmailReason(e.target.value)}
                placeholder="e.g. user requested email change, typo correction..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChangeEmailOpen(false)} disabled={updateEmail.isPending}>Cancel</Button>
            <Button
              disabled={!newEmailInput.trim() || !emailReason.trim() || updateEmail.isPending}
              onClick={async () => {
                try {
                  await updateEmail.mutateAsync({ userId: customer.user_id, email: newEmailInput.trim(), reason: emailReason.trim() });
                  setChangeEmailOpen(false);
                } catch {/* toast handled in hook */}
              }}
            >
              {updateEmail.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
              Update Email
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={resetPasswordOpen} onOpenChange={(o) => { if (!o) { setResetPasswordOpen(false); setNewPassword(""); setConfirmPassword(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Customer Password</DialogTitle>
            <DialogDescription>
              Set a new password for {customer.legal_name || customer.name || "this customer"}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                minLength={8}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm Password</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                minLength={8}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setResetPasswordOpen(false); setNewPassword(""); setConfirmPassword(""); }}
              disabled={resettingPassword}
            >
              Cancel
            </Button>
            <Button
              onClick={handleResetPassword}
              disabled={resettingPassword || !newPassword || !confirmPassword}
            >
              {resettingPassword ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Key className="mr-2 h-4 w-4" />}
              Reset Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AdminBookingDetailDialog
        booking={selectedBooking}
        open={!!selectedBooking}
        onOpenChange={(open) => { if (!open) setSelectedBooking(null); }}
      />

      <ChargeWalletDialog
        open={chargeOpen}
        onOpenChange={setChargeOpen}
        userId={customer.user_id}
        customerName={customer.name || customer.email}
        currentBalance={Number(customer.wallet_balance ?? 0)}
        defaultCategory="fnb"
      />
    </div>
  );
}

function CampaignImagePicker({ preview, onChange }: { preview: string | null; onChange: (file: File | null, preview: string | null) => void }) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => onChange(file, ev.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      onChange(null, null);
    }
  };
  return (
    <div className="space-y-1.5">
      <Label>Image (optional)</Label>
      <input type="file" accept="image/*" onChange={handleChange} className="block w-full text-sm text-muted-foreground file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:bg-accent/10 file:text-accent hover:file:bg-accent/20 cursor-pointer" />
      {preview && <img src={preview} alt="preview" className="mt-2 max-h-36 rounded-lg object-contain border border-border/40" />}
    </div>
  );
}

function CampaignFormFields({ form, setForm, imagePreview, onImageChange }: {
  form: { title: string; body: string; buttonLabel: string; buttonUrl: string };
  setForm: (f: any) => void;
  imagePreview: string | null;
  onImageChange: (file: File | null, preview: string | null) => void;
}) {
  return (
    <>
      <div className="space-y-1.5">
        <Label>Title</Label>
        <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Grand Opening Sale" />
      </div>
      <div className="space-y-1.5">
        <Label>Message</Label>
        <Textarea rows={3} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} placeholder="Tell your members what's happening…" />
      </div>
      <CampaignImagePicker preview={imagePreview} onChange={onImageChange} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Button Label (optional)</Label>
          <Input value={form.buttonLabel} onChange={(e) => setForm({ ...form, buttonLabel: e.target.value })} placeholder="e.g. Learn More" />
        </div>
        <div className="space-y-1.5">
          <Label>Button URL (optional)</Label>
          <Input value={form.buttonUrl} onChange={(e) => setForm({ ...form, buttonUrl: e.target.value })} placeholder="https://…" />
        </div>
      </div>
    </>
  );
}

function CampaignsTab() {
  const [showDeleted, setShowDeleted] = useState(false);
  const { data: campaigns = [], create, update, toggle, restore, remove } = useAdminCampaigns(showDeleted);

  const [form, setForm] = useState({ title: "", body: "", buttonLabel: "", buttonUrl: "" });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ title: "", body: "", buttonLabel: "", buttonUrl: "" });
  const [editImageFile, setEditImageFile] = useState<File | null>(null);
  const [editImagePreview, setEditImagePreview] = useState<string | null>(null);

  const startEdit = (c: any) => {
    setEditingId(c._id);
    setEditForm({ title: c.title ?? "", body: c.body ?? "", buttonLabel: c.buttonLabel ?? "", buttonUrl: c.buttonUrl ?? "" });
    setEditImageFile(null);
    setEditImagePreview(c.imageData || c.imageUrl || null);
  };

  const handleCreate = () => {
    if (!form.title.trim() && !form.body.trim() && !imageFile) return;
    create.mutate({ title: form.title, body: form.body, imageFile, buttonLabel: form.buttonLabel || null, buttonUrl: form.buttonUrl || null }, {
      onSuccess: () => { setForm({ title: "", body: "", buttonLabel: "", buttonUrl: "" }); setImageFile(null); setImagePreview(null); },
    });
  };

  const handleUpdate = (id: string) => {
    update.mutate({ id, data: { title: editForm.title, body: editForm.body, imageFile: editImageFile, buttonLabel: editForm.buttonLabel || null, buttonUrl: editForm.buttonUrl || null } }, {
      onSuccess: () => setEditingId(null),
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>New Campaign</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <CampaignFormFields form={form} setForm={setForm} imagePreview={imagePreview}
            onImageChange={(f, p) => { setImageFile(f); setImagePreview(p); }} />
          <div className="flex justify-end pt-1">
            <Button onClick={handleCreate} disabled={(!form.title.trim() && !form.body.trim() && !imageFile) || create.isPending} className="bg-accent text-accent-foreground hover:bg-accent/90">
              Create Campaign
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>All Campaigns</CardTitle>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Show deleted</span>
              <Switch checked={showDeleted} onCheckedChange={setShowDeleted} />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {campaigns.length === 0 && <p className="text-sm text-muted-foreground">No campaigns yet.</p>}
          {campaigns.map((c: any) => (
            <div key={c._id} className={`rounded-lg border p-3 space-y-2 ${c.isDeleted ? "border-border/30 opacity-50" : c.isActive ? "border-accent/30 bg-accent/5" : "border-border/40"}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  {c.title && <p className={`font-medium text-sm ${c.isDeleted ? "line-through" : ""}`}>{c.title}</p>}
                  {c.body && <p className="text-xs text-muted-foreground whitespace-pre-wrap mt-0.5 line-clamp-2">{c.body}</p>}
                  {(c.imageData || c.imageUrl) && !c.title && !c.body && (
                    <p className="text-xs text-muted-foreground italic">Image only</p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {c.isDeleted ? (
                    <Button size="sm" variant="outline" className="h-7 text-xs px-2" onClick={() => restore.mutate(c._id)}>Restore</Button>
                  ) : (
                    <>
                      <Switch checked={c.isActive} onCheckedChange={() => toggle.mutate(c._id)} />
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-accent" onClick={() => editingId === c._id ? setEditingId(null) : startEdit(c)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive" onClick={() => remove.mutate(c._id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
              {!c.isDeleted && <p className="text-xs text-muted-foreground">{c.isActive ? "Active — shows on next login" : "Inactive"}</p>}

              {editingId === c._id && (
                <div className="border-t border-border/40 pt-3 mt-2 space-y-3">
                  <CampaignFormFields form={editForm} setForm={setEditForm} imagePreview={editImagePreview}
                    onImageChange={(f, p) => { setEditImageFile(f); setEditImagePreview(p); }} />
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>Cancel</Button>
                    <Button size="sm" onClick={() => handleUpdate(c._id)} disabled={update.isPending} className="bg-accent text-accent-foreground hover:bg-accent/90">Save</Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function PricingTab() {
  const [hideDeleted, setHideDeleted] = useState(false);
  const { data: rules, create, remove, toggle, update } = useAdminPricingRules(hideDeleted ? "default" : "all");
  const [showDeletedPH, setShowDeletedPH] = useState(false);
  const {
    data: holidays = [],
    create: createHoliday,
    remove: removeHoliday,
  } = useAdminPublicHolidays(showDeletedPH);

  const [form, setForm] = useState({
    name: "", start_time: "09:00", end_time: "23:00", hourly_rate: "16.25",
    priority: "0", weekdays: [...WEEKDAYS] as string[], specific_date: "", table_id: "",
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [detailRecord, setDetailRecord] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({
    name: "", start_time: "", end_time: "", hourly_rate: "",
    priority: "", weekdays: [] as string[], specific_date: "",
  });
  const [phForm, setPhForm] = useState({ date: "", name: "" });

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
    setForm({ name: "", start_time: "09:00", end_time: "23:00", hourly_rate: "16.25", priority: "0", weekdays: [...WEEKDAYS], specific_date: "", table_id: "" });
  };

  const handleAddHoliday = () => {
    if (!phForm.date || !phForm.name.trim()) return;
    createHoliday.mutate({ date: phForm.date, name: phForm.name.trim() }, {
      onSuccess: () => setPhForm({ date: "", name: "" }),
    });
  };

  // Group holidays: upcoming vs past
  const today = new Date().toISOString().slice(0, 10);
  const upcomingHolidays = holidays.filter((h: any) => h.date >= today);
  const pastHolidays = holidays.filter((h: any) => h.date < today);

  return (
    <div className="space-y-6">

      {/* ── Public Holidays ── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-amber-400" />
              Public Holidays
            </CardTitle>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Switch checked={showDeletedPH} onCheckedChange={setShowDeletedPH} />
              <span>Show deleted</span>
            </div>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Dates listed here (and their eves) will automatically use Fri–Sun pricing regardless of the calendar day.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Add form */}
          <div className="flex gap-2 flex-wrap">
            <Input
              type="date"
              value={phForm.date}
              onChange={(e) => setPhForm({ ...phForm, date: e.target.value })}
              className="w-40"
            />
            <Input
              placeholder="Holiday name (e.g. National Day)"
              value={phForm.name}
              onChange={(e) => setPhForm({ ...phForm, name: e.target.value })}
              className="flex-1 min-w-40"
            />
            <Button
              onClick={handleAddHoliday}
              disabled={!phForm.date || !phForm.name.trim() || createHoliday.isPending}
              className="bg-accent text-accent-foreground hover:bg-accent/90"
            >
              Add
            </Button>
          </div>

          {/* Upcoming holidays */}
          {upcomingHolidays.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Upcoming</p>
              {upcomingHolidays.map((h: any) => {
                // Compute eve date using UTC arithmetic (avoid local-timezone off-by-one)
                const [hy, hmo, hdy] = h.date.split("-").map(Number);
                const eveStr = new Date(Date.UTC(hy, hmo - 1, hdy - 1)).toISOString().slice(0, 10);
                const isDeleted = h.isDeleted === true;
                return (
                  <div key={h._id || h.date} className={`flex items-center justify-between rounded-lg border px-3 py-2 ${isDeleted ? "border-destructive/20 bg-destructive/5 opacity-60" : "border-amber-500/20 bg-amber-500/5"}`}>
                    <div className="flex items-center gap-3">
                      <div>
                        <p className={`text-sm font-medium ${isDeleted ? "line-through text-muted-foreground" : "text-foreground"}`}>{h.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {h.date} <span className="text-amber-400/70">· Eve: {eveStr}</span>
                          {!isDeleted && <span className="ml-2 text-amber-400">↑ Fri–Sun pricing</span>}
                          {isDeleted && <span className="ml-2 text-destructive/70">deleted</span>}
                        </p>
                      </div>
                    </div>
                    {!isDeleted && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => removeHoliday.mutate(h._id || h.id)}
                        disabled={removeHoliday.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Past holidays (compact) */}
          {pastHolidays.length > 0 && (
            <details className="group">
              <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors list-none flex items-center gap-1">
                <span>{pastHolidays.length} past holiday{pastHolidays.length !== 1 ? "s" : ""}</span>
              </summary>
              <div className="mt-2 space-y-1">
                {pastHolidays.map((h: any) => {
                  const isDeleted = h.isDeleted === true;
                  return (
                    <div key={h._id || h.date} className={`flex items-center justify-between rounded-lg border px-3 py-1.5 ${isDeleted ? "border-destructive/20 opacity-40" : "border-border/30 opacity-50"}`}>
                      <p className={`text-xs text-muted-foreground ${isDeleted ? "line-through" : ""}`}>{h.date} — {h.name}{isDeleted ? " (deleted)" : ""}</p>
                      {!isDeleted && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                          onClick={() => removeHoliday.mutate(h._id || h.id)}
                          disabled={removeHoliday.isPending}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </details>
          )}

          {holidays.length === 0 && (
            <p className="text-sm text-muted-foreground">No public holidays configured.</p>
          )}
        </CardContent>
      </Card>

      {/* ── Add Pricing Rule ── */}
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
            <Label>Applies To</Label>
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
            <p className="text-xs text-muted-foreground">
              To apply this rule on public holidays & eves, make sure <span className="text-amber-400">Fri, Sat, Sun</span> are selected — PH dates automatically match those days.
            </p>
          </div>
          <Button onClick={handleCreate} disabled={!form.name || create.isPending}>Create Rule</Button>
        </CardContent>
      </Card>

      {/* ── Existing Rules ── */}
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
                          <Label className="text-xs">Applies To</Label>
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
                        <p className="text-xs text-muted-foreground mt-1">{((r.applies_to_weekdays as string[]) || []).join(", ")}</p>
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

      <OperatingHoursSection />

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
  const { user: authUser } = useAuth();
  const isMaster = authUser?.isMaster ?? false;
  const qc = useQueryClient();
  const [hideDeleted, setHideDeleted] = useState(false);
  const { data: promos, create, toggle, remove, update } = useAdminPromoCodes(hideDeleted ? "default" : "all");
  const [form, setForm] = useState({
    code: "", discount_type: "percentage" as string, discount_value: "", minimum_spend: "",
    minimum_hours: "", max_discount_amount: "", usage_limit: "", per_user_limit: "", expiry_date: "",
    valid_days: [] as number[], valid_time_start: "", valid_time_end: "",
  });
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [detailPromo, setDetailPromo] = useState<any | null>(null);
  const [editTarget, setEditTarget] = useState<any | null>(null);
  const restore = useRestoreRecord();
  const hardDelete = useHardDelete();
  const [hardDeleteTarget, setHardDeleteTarget] = useState<{ type: string; id: string } | null>(null);
  const [editForm, setEditForm] = useState({
    discount_type: "percentage", discount_value: "", minimum_spend: "",
    minimum_hours: "", max_discount_amount: "", usage_limit: "", per_user_limit: "", expiry_date: "",
    valid_days: [] as number[], valid_time_start: "", valid_time_end: "",
  });

  const openEdit = (p: any) => {
    setEditTarget(p);
    setEditForm({
      discount_type: p.discount_type ?? "percentage",
      discount_value: String(p.discount_value ?? ""),
      minimum_spend: p.minimum_spend != null ? String(p.minimum_spend) : "",
      minimum_hours: p.minimum_hours != null ? String(p.minimum_hours) : "",
      max_discount_amount: p.max_discount_amount != null ? String(p.max_discount_amount) : "",
      usage_limit: p.usage_limit != null ? String(p.usage_limit) : "",
      per_user_limit: p.per_user_limit != null ? String(p.per_user_limit) : "",
      expiry_date: p.expiry_date ? new Date(p.expiry_date).toISOString().slice(0, 16) : "",
      valid_days: Array.isArray(p.valid_days) ? p.valid_days : [],
      valid_time_start: p.valid_time_start ?? "",
      valid_time_end: p.valid_time_end ?? "",
    });
  };

  const handleEdit = async () => {
    if (!editTarget) return;
    await update.mutateAsync({
      id: editTarget.id,
      data: {
        discount_type: editForm.discount_type,
        discount_value: parseFloat(editForm.discount_value),
        minimum_spend: editForm.minimum_spend ? parseFloat(editForm.minimum_spend) : null,
        minimum_hours: editForm.minimum_hours ? parseFloat(editForm.minimum_hours) : null,
        max_discount_amount: editForm.max_discount_amount ? parseFloat(editForm.max_discount_amount) : null,
        usage_limit: editForm.usage_limit ? parseInt(editForm.usage_limit) : null,
        per_user_limit: editForm.per_user_limit ? parseInt(editForm.per_user_limit) : null,
        expiry_date: editForm.expiry_date || null,
        valid_days: editForm.valid_days,
        valid_time_start: editForm.valid_time_start || null,
        valid_time_end: editForm.valid_time_end || null,
      },
    });
    setEditTarget(null);
  };

  const handleCreate = () => {
    create.mutate({
      code: form.code,
      discount_type: form.discount_type,
      discount_value: parseFloat(form.discount_value),
      minimum_spend: form.minimum_spend ? parseFloat(form.minimum_spend) : null,
      minimum_hours: form.minimum_hours ? parseFloat(form.minimum_hours) : null,
      max_discount_amount: form.max_discount_amount ? parseFloat(form.max_discount_amount) : null,
      usage_limit: form.usage_limit ? parseInt(form.usage_limit) : null,
      per_user_limit: form.per_user_limit ? parseInt(form.per_user_limit) : null,
      expiry_date: form.expiry_date || null,
      is_active: true,
      valid_days: form.valid_days,
      valid_time_start: form.valid_time_start || null,
      valid_time_end: form.valid_time_end || null,
    });
    setForm({ code: "", discount_type: "percentage", discount_value: "", minimum_spend: "", minimum_hours: "", max_discount_amount: "", usage_limit: "", per_user_limit: "", expiry_date: "", valid_days: [], valid_time_start: "", valid_time_end: "" });
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
              <Label>Min Hours (opt)</Label>
              <Input type="number" value={form.minimum_hours} onChange={(e) => setForm({ ...form, minimum_hours: e.target.value })} placeholder="e.g. 4" />
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

          <div className="space-y-3 border-t border-border/50 pt-4">
            <div className="space-y-2">
              <Label>Valid Days <span className="text-muted-foreground font-normal">(leave empty = all days)</span></Label>
              <div className="flex flex-wrap gap-2">
                {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((day, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      const next = form.valid_days.includes(i)
                        ? form.valid_days.filter(d => d !== i)
                        : [...form.valid_days, i];
                      setForm({ ...form, valid_days: next });
                    }}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium border transition-colors ${
                      form.valid_days.includes(i)
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border hover:border-primary/50 hover:bg-muted/50"
                    }`}
                  >
                    {day}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Time From <span className="text-muted-foreground font-normal">(SGT, opt)</span></Label>
                <Input type="time" value={form.valid_time_start} onChange={(e) => setForm({ ...form, valid_time_start: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Time Until <span className="text-muted-foreground font-normal">(SGT, opt)</span></Label>
                <Input type="time" value={form.valid_time_end} onChange={(e) => setForm({ ...form, valid_time_end: e.target.value })} />
              </div>
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
                          {deleted ? (
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs"
                                disabled={restore.isPending}
                                onClick={() => restore.mutate({ type: "promo", id: p.id })}
                              >
                                <RotateCcw className="h-3 w-3 mr-1" /> Restore
                              </Button>
                              {isMaster && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-xs border-destructive/50 text-destructive hover:bg-destructive/10"
                                  onClick={() => setHardDeleteTarget({ type: "promo", id: p.id })}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          ) : (
                            <div className="flex items-center justify-end gap-2">
                              <Switch
                                checked={p.is_active}
                                onCheckedChange={() => toggle.mutate({ id: p.id, is_active: !p.is_active })}
                              />
                              <Button variant="ghost" size="sm" onClick={() => openEdit(p)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
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

      <Dialog open={!!editTarget} onOpenChange={(o) => !o && setEditTarget(null)}>
        <DialogContent className="max-h-[90vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>Edit Promo Code — {editTarget?.code}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2 py-2 overflow-y-auto flex-1 min-h-0 pr-1">
            <div className="space-y-1.5">
              <Label>Discount Type</Label>
              <Select value={editForm.discount_type} onValueChange={(v) => setEditForm({ ...editForm, discount_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">Percentage</SelectItem>
                  <SelectItem value="fixed">Fixed Amount</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Discount Value</Label>
              <Input type="number" value={editForm.discount_value} onChange={(e) => setEditForm({ ...editForm, discount_value: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Min Spend (opt)</Label>
              <Input type="number" value={editForm.minimum_spend} onChange={(e) => setEditForm({ ...editForm, minimum_spend: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Min Hours (opt)</Label>
              <Input type="number" value={editForm.minimum_hours} onChange={(e) => setEditForm({ ...editForm, minimum_hours: e.target.value })} placeholder="e.g. 4" />
            </div>
            <div className="space-y-1.5">
              <Label>Max Discount (opt)</Label>
              <Input type="number" value={editForm.max_discount_amount} onChange={(e) => setEditForm({ ...editForm, max_discount_amount: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Usage Limit (opt)</Label>
              <Input type="number" value={editForm.usage_limit} onChange={(e) => setEditForm({ ...editForm, usage_limit: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Per User Limit (opt)</Label>
              <Input type="number" value={editForm.per_user_limit} onChange={(e) => setEditForm({ ...editForm, per_user_limit: e.target.value })} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Expiry Date (opt)</Label>
              <Input type="datetime-local" value={editForm.expiry_date} onChange={(e) => setEditForm({ ...editForm, expiry_date: e.target.value })} />
            </div>
          </div>

          <div className="space-y-3 border-t border-border/50 pt-3">
            <div className="space-y-2">
              <Label>Valid Days <span className="text-muted-foreground font-normal">(empty = all days)</span></Label>
              <div className="flex flex-wrap gap-2">
                {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((day, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      const next = editForm.valid_days.includes(i)
                        ? editForm.valid_days.filter(d => d !== i)
                        : [...editForm.valid_days, i];
                      setEditForm({ ...editForm, valid_days: next });
                    }}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium border transition-colors ${
                      editForm.valid_days.includes(i)
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border hover:border-primary/50 hover:bg-muted/50"
                    }`}
                  >
                    {day}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Time From <span className="text-muted-foreground font-normal">(SGT)</span></Label>
                <Input type="time" value={editForm.valid_time_start} onChange={(e) => setEditForm({ ...editForm, valid_time_start: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Time Until <span className="text-muted-foreground font-normal">(SGT)</span></Label>
                <Input type="time" value={editForm.valid_time_end} onChange={(e) => setEditForm({ ...editForm, valid_time_end: e.target.value })} />
              </div>
            </div>
          </div>

          <DialogFooter className="flex-shrink-0">
            <Button variant="outline" onClick={() => setEditTarget(null)}>Cancel</Button>
            <Button onClick={handleEdit} disabled={!editForm.discount_value || update.isPending}>
              {update.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

      {hardDeleteTarget && (
        <PinDialog
          open={!!hardDeleteTarget}
          onOpenChange={(o) => !o && setHardDeleteTarget(null)}
          loading={hardDelete.isPending}
          onConfirm={(pin) =>
            hardDelete.mutate(
              { type: hardDeleteTarget.type, id: hardDeleteTarget.id, pin },
              {
                onSuccess: () => {
                  setHardDeleteTarget(null);
                  qc.invalidateQueries({ queryKey: ["admin-promo-codes"] });
                }
              }
            )
          }
        />
      )}

      <PromoDetailDialog promo={detailPromo} onClose={() => setDetailPromo(null)} />
    </div>
  );
}


function PromoDetailDialog({ promo, onClose }: { promo: any | null; onClose: () => void }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["promo-usage", promo?.code],
    enabled: !!promo?.code,
    queryFn: async () => {
      const res = await apiFetch(`/api/promo/${encodeURIComponent(promo.code)}/usage`);
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
            <div><div className="text-muted-foreground">Min Hours</div><div>{promo.minimum_hours ?? "—"}</div></div>
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
                      const name = u.customer?.name || u.customerName || u.customer_name || u.user?.name || u.userName || "—";
                      const email = u.customer?.email || u.customerEmail || u.customer_email || u.user?.email || u.userEmail || "";
                      const shortId = u.customer?.shortId || u.shortId || u.short_id || u.bookingShortId || u.booking?.shortId || u.bookingId || u.booking_id || "—";
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
  const queryClient = useQueryClient();
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

  useEffect(() => {
    refresh();
    // Auto-refresh every 15 seconds so new registrations appear without page reload
    const interval = setInterval(refresh, 15000);
    return () => clearInterval(interval);
  }, []);

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
      queryClient.invalidateQueries({ queryKey: ["admin-customers"] });
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

  const handleUnreject = async () => {
    if (!rejectedDetail) return;
    const userId = rejectedDetail._id || rejectedDetail.userId || rejectedDetail.id;
    try {
      setUnrejecting(userId);
      const res = await apiFetch("/api/admin/unreject-user", {
        method: "POST",
        body: JSON.stringify({ userId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Failed to unreject user");
      }
      toast({ title: "User re-opened", description: "Moved back to pending" });
      setRejectedDetail(null);
      await refresh();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setUnrejecting(null);
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
                        <tr
                          key={uid}
                          className="border-b border-border last:border-0 text-muted-foreground cursor-pointer hover:bg-muted/30"
                          onClick={() => setRejectedDetail(u)}
                        >
                          <td className="py-3 pr-4 line-through">{u.name || "—"}</td>
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

      <Dialog open={!!rejectedDetail} onOpenChange={(o) => { if (!o) setRejectedDetail(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejected User</DialogTitle>
          </DialogHeader>
          {rejectedDetail && (() => {
            const u = rejectedDetail;
            const uid = u._id || u.userId || u.id;
            const reason = u.rejectionReason || u.rejection_reason || u.rejectReason || "—";
            const rejectedAt = u.rejectedAt || u.rejected_at;
            const rb = u.rejectedBy || u.rejected_by;
            const rejectedByName = rb && typeof rb === "object"
              ? (rb.name || rb.legalName || rb.email || "—")
              : (typeof rb === "string" && !/^[a-f0-9]{24}$/i.test(rb) ? rb : "—");
            return (
              <div className="space-y-4">
                <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm space-y-1">
                  <div className="flex items-center gap-2 font-medium text-destructive">
                    <AlertTriangle className="h-4 w-4" /> This account has been rejected
                  </div>
                  <div className="text-xs text-foreground/80 space-y-0.5 pl-6">
                    <div><span className="text-muted-foreground">Reason:</span> {reason}</div>
                    <div><span className="text-muted-foreground">Rejected by:</span> {rejectedByName}</div>
                    <div><span className="text-muted-foreground">Rejected at:</span> {rejectedAt ? fmtDateTimeSG(rejectedAt) : "—"}</div>
                  </div>
                </div>
                <div className="text-sm space-y-1.5">
                  <div className="flex justify-between gap-3"><span className="text-muted-foreground">Name</span><span>{u.name || "—"}</span></div>
                  <div className="flex justify-between gap-3"><span className="text-muted-foreground">Email</span><span>{u.email || "—"}</span></div>
                  <div className="flex justify-between gap-3"><span className="text-muted-foreground">Phone</span><span>{u.phone || u.phoneNumber || "—"}</span></div>
                  <div className="flex justify-between gap-3"><span className="text-muted-foreground">Joined</span><span>{u.createdAt ? fmtDateTimeSG(u.createdAt) : "—"}</span></div>
                  <div className="flex justify-between gap-3"><span className="text-muted-foreground">User ID</span><span className="font-mono text-xs">{uid ? String(uid).slice(-8) : "—"}</span></div>
                </div>
              </div>
            );
          })()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectedDetail(null)} disabled={!!unrejecting}>Close</Button>
            <Button onClick={handleUnreject} disabled={!!unrejecting}>
              {unrejecting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-2 h-4 w-4" />}
              Unreject / Re-open
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

  const [checkingGmail, setCheckingGmail] = useState(false);

  const checkGmailNow = async () => {
    setCheckingGmail(true);
    try {
      const res = await apiFetch("/api/transactions/topup/admin/check-gmail", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Gmail check failed");
      toast({ title: "Gmail checked", description: data.message });
      refresh();
    } catch (err: any) {
      toast({ title: "Gmail check failed", description: err?.message, variant: "destructive" });
    } finally {
      setCheckingGmail(false);
    }
  };

  const confirmMatch = async (id: string) => {
    setBusyId(id);
    try {
      const res = await apiFetch(`/api/transactions/topup/admin/requests/${id}/confirm-match`, { method: "POST" });
      if (!res.ok) throw new Error();
      toast({ title: "Match confirmed — wallet credited" });
      refresh();
    } catch {
      toast({ title: "Failed to confirm match", variant: "destructive" });
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
    // Prefer the Singpass-verified legal name over the self-chosen display
    // name/nickname — top-up requests are matched against bank transfers,
    // which are made under the account holder's legal name, so that's
    // what's actually useful for an admin to see here.
    const legalName = u.kyc?.verified ? u.kyc?.name : null;
    return {
      name: legalName || u.name || r.customerName || "—",
      displayName: u.name || r.customerName || "—",
      isLegalName: !!legalName,
      shortId: u.shortId || r.shortId || "—",
    };
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 flex-wrap">
        <CardTitle>Top Up Requests</CardTitle>
        <Button size="sm" variant="outline" onClick={checkGmailNow} disabled={checkingGmail} className="gap-1.5">
          <RefreshCw className={`h-3.5 w-3.5 ${checkingGmail ? "animate-spin" : ""}`} />
          {checkingGmail ? "Checking..." : "Check Gmail Now"}
        </Button>
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
                  const hasSuggestedMatch = isPending && !!r.bankSenderName && r.matchedVia !== "gmail_auto";
                  return (
                    <tr
                      key={id}
                      className="border-b border-border/50 cursor-pointer hover:bg-muted/40"
                      onClick={() => setDetailId(id)}
                    >
                      <td className="py-2 pr-4">{fmtDateTimeSG(r.createdAt || r.created_at)}</td>
                      <td className="py-2 pr-4">
                        <div>{c.name}</div>
                        {hasSuggestedMatch && (
                          <div className="flex items-center gap-1 text-xs text-amber-400 mt-0.5">
                            <Mail className="h-3 w-3" />
                            Gmail match: "{r.bankSenderName}"
                          </div>
                        )}
                      </td>
                      <td className="py-2 pr-4 font-mono">{c.shortId}</td>
                      <td className="py-2 pr-4 font-medium">${Number(r.amount || 0).toFixed(2)}</td>
                      <td className="py-2 pr-4">
                        <Badge variant="outline" className={methodClass}>{methodLabel}</Badge>
                      </td>
                      <td className="py-2 pr-4">
                        <Badge variant="outline" className={statusBadge(r.status)}>
                          {String(r.status || "pending").charAt(0).toUpperCase() + String(r.status || "pending").slice(1)}
                        </Badge>
                        {r.matchedVia === "gmail_auto" && (
                          <Badge variant="outline" className="ml-1.5 bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
                            <Mail className="h-3 w-3 mr-1" /> Auto
                          </Badge>
                        )}
                      </td>
                      <td className="py-2 pr-4" onClick={(e) => e.stopPropagation()}>
                        {isPending ? (
                          <div className="flex gap-2 flex-wrap">
                            {hasSuggestedMatch && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-amber-500/40 text-amber-400 hover:bg-amber-500/10"
                                disabled={busyId === id}
                                onClick={() => confirmMatch(id)}
                              >
                                <Mail className="h-4 w-4 mr-1" /> Confirm Match
                              </Button>
                            )}
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
  getCustomer: (r: any) => { name: string; displayName?: string; isLegalName?: boolean; shortId: string };
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
              <div>
                <div className="text-muted-foreground">Full Name</div>
                <div className="font-medium">{c.name}</div>
                {c.isLegalName && c.displayName && c.displayName !== c.name && (
                  <div className="text-xs text-muted-foreground mt-0.5">Display name: {c.displayName}</div>
                )}
                {!c.isLegalName && (
                  <div className="text-xs text-amber-400/80 mt-0.5">Not Singpass-verified — this is the customer's chosen nickname, not their legal name</div>
                )}
              </div>
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

function ActiveWalkinSessionsSection() {
  const { toast } = useToast();
  const { data: sessions, refetch } = useActiveWalkinSessions();
  const { data: tablesList } = useAdminTables();
  const forceStop = useForceStopWalkin();
  const [now, setNow] = useState(Date.now());
  const [reasonOpen, setReasonOpen] = useState(false);
  const [reasonValue, setReasonValue] = useState("");
  const [targetId, setTargetId] = useState<string | null>(null);
  const [chargeTarget, setChargeTarget] = useState<{ userId: string; name: string; balance: number } | null>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const list = Array.isArray(sessions) ? sessions : [];
  if (list.length === 0) return null;

  const openForceStop = (id: string) => {
    setTargetId(id);
    setReasonValue("");
    setReasonOpen(true);
  };

  const submitForceStop = async () => {
    if (!targetId || !reasonValue.trim()) {
      toast({ title: "Reason required", variant: "destructive" });
      return;
    }
    try {
      await forceStop.mutateAsync({ id: targetId, reason: reasonValue.trim() });
      toast({ title: "Session force-stopped" });
      setReasonOpen(false);
      setTargetId(null);
      refetch();
    } catch (err: any) {
      toast({ title: "Failed to force stop", description: err?.message, variant: "destructive" });
    }
  };

  return (
    <Card className="mb-4 border-accent/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Timer className="h-5 w-5 text-accent" /> Active Walk-in Sessions ({list.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground border-b border-border">
                <th className="py-2 pr-4">Customer</th>
                <th className="py-2 pr-4">Table</th>
                <th className="py-2 pr-4">Started</th>
                <th className="py-2 pr-4">Elapsed</th>
                <th className="py-2 pr-4">Running Cost</th>
                <th className="py-2 pr-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {list.map((s: any) => {
                const id = s._id || s.id;
                const userObj = typeof s.userId === "object" ? s.userId : null;
                const userId = userObj?._id || userObj?.id || (typeof s.userId === "string" ? s.userId : "");
                const customer =
                  (userObj ? userObj.name || userObj.username || userObj.email : null)
                  || s.userName || s.customerName || "—";
                const balance = Number(userObj?.walletBalance ?? userObj?.wallet_balance ?? s.walletBalance ?? 0);
                const startMs = new Date(s.startedAt ?? s.startTime).getTime();
                const elapsedMs = Math.max(0, now - startMs);
                const h = Math.floor(elapsedMs / 3600000);
                const m = Math.floor((elapsedMs % 3600000) / 60000);
                const sec = Math.floor((elapsedMs % 60000) / 1000);
                const elapsed = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
                return (
                  <tr key={id} className="border-b border-border/50">
                    <td className="py-2 pr-4">{customer}</td>
                    <td className="py-2 pr-4 font-medium">{getTableLabel(s.tableId, tablesList as any)}</td>
                    <td className="py-2 pr-4">{new Date(s.startedAt ?? s.startTime).toLocaleString("en-SG", { timeZone: "Asia/Singapore" })}</td>
                    <td className="py-2 pr-4 font-mono">{elapsed}</td>
                    <td className="py-2 pr-4 font-mono">${Number(s.runningCost ?? 0).toFixed(2)}</td>
                    <td className="py-2 pr-4 text-right space-x-2 whitespace-nowrap">
                      {userId && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setChargeTarget({ userId, name: String(customer), balance })}
                        >
                          <DollarSign className="h-3.5 w-3.5 mr-1" /> Charge
                        </Button>
                      )}
                      <Button size="sm" variant="destructive" onClick={() => openForceStop(id)}>
                        Force Stop
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>

      <Dialog open={reasonOpen} onOpenChange={setReasonOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Force Stop Walk-in Session</DialogTitle>
            <DialogDescription>
              The customer's wallet will be charged for the elapsed time. Please provide a reason.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Reason for force stopping..."
            value={reasonValue}
            onChange={(e) => setReasonValue(e.target.value)}
            rows={3}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setReasonOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={submitForceStop} disabled={forceStop.isPending}>
              {forceStop.isPending ? "Stopping..." : "Force Stop"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ChargeWalletDialog
        open={!!chargeTarget}
        onOpenChange={(v) => { if (!v) setChargeTarget(null); }}
        userId={chargeTarget?.userId ?? ""}
        customerName={chargeTarget?.name}
        currentBalance={chargeTarget?.balance ?? 0}
        defaultCategory="fnb"
      />
    </Card>
  );
}

function WalkinSessionsTab() {
  const { toast } = useToast();
  const { data: sessions, refetch } = useActiveWalkinSessions();
  const { data: tablesList } = useAdminTables();
  const forceStop = useForceStopWalkin();
  const { data: pendingFnbOrders = [] } = useAdminFnbOrders("pending");

  const [now, setNow] = useState(Date.now());
  const [conflictAlert, setConflictAlert] = useState<string | null>(null);
  const [reasonOpen, setReasonOpen] = useState(false);
  const [reasonValue, setReasonValue] = useState("");
  const [targetId, setTargetId] = useState<string | null>(null);
  const [chargeTarget, setChargeTarget] = useState<{ userId: string; name: string; balance: number } | null>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const onConflict = (e: Event) => {
      const detail = (e as CustomEvent).detail || {};
      const msg = detail.message || "A walk-in session conflicts with an upcoming booking.";
      setConflictAlert(msg);
    };
    window.addEventListener("walkin_booking_conflict_admin", onConflict);
    return () => window.removeEventListener("walkin_booking_conflict_admin", onConflict);
  }, []);

  const list = Array.isArray(sessions) ? sessions : [];

  const openForceStop = (id: string) => {
    setTargetId(id);
    setReasonValue("");
    setReasonOpen(true);
  };

  const submitForceStop = async () => {
    if (!targetId) return;
    if (!reasonValue.trim()) {
      toast({ title: "Reason required", variant: "destructive" });
      return;
    }
    try {
      await forceStop.mutateAsync({ id: targetId, reason: reasonValue.trim() });
      toast({ title: "Session force-stopped" });
      setReasonOpen(false);
      setTargetId(null);
      refetch();
    } catch (err: any) {
      toast({ title: "Failed to force stop", description: err?.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4">
      {conflictAlert && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Walk-in booking conflict</AlertTitle>
          <AlertDescription>
            {conflictAlert}
            <Button
              variant="ghost"
              size="sm"
              className="ml-2 h-7"
              onClick={() => setConflictAlert(null)}
            >
              Dismiss
            </Button>
          </AlertDescription>
        </Alert>
      )}
      {pendingFnbOrders.length > 0 && (
        <Alert className="border-amber-500/50 bg-amber-500/10">
          <AlertTriangle className="h-4 w-4 text-amber-400" />
          <AlertTitle className="text-amber-400">F&B Orders Pending</AlertTitle>
          <AlertDescription className="text-amber-300">
            {pendingFnbOrders.length} order{pendingFnbOrders.length > 1 ? "s" : ""} waiting to be served.{" "}
            <Button variant="ghost" size="sm" className="ml-1 h-6 text-amber-300 hover:text-amber-100 px-1" onClick={() => window.location.href = "/admin?tab=fnb"}>
              View Orders →
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Timer className="h-5 w-5" /> Active Walk-in Sessions ({list.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {list.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active walk-in sessions.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted-foreground border-b border-border">
                    <th className="py-2 pr-4">Table</th>
                    <th className="py-2 pr-4">Customer</th>
                    <th className="py-2 pr-4">Start Time</th>
                    <th className="py-2 pr-4">Elapsed</th>
                    <th className="py-2 pr-4">Running Cost</th>
                    <th className="py-2 pr-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((s: any) => {
                    const id = s._id || s.id;
                    const userObj = typeof s.userId === "object" ? s.userId : null;
                    const userId = userObj?._id || userObj?.id || (typeof s.userId === "string" ? s.userId : "");
                    const customer =
                      (userObj ? userObj.name || userObj.username || userObj.email : null)
                      || s.userName || s.customerName || "—";
                    const balance = Number(userObj?.walletBalance ?? userObj?.wallet_balance ?? s.walletBalance ?? 0);
                    const startMs = new Date(s.startedAt ?? s.startTime).getTime();
                    const elapsedMs = now - startMs;
                    const h = Math.floor(elapsedMs / 3600000);
                    const m = Math.floor((elapsedMs % 3600000) / 60000);
                    const sec = Math.floor((elapsedMs % 60000) / 1000);
                    const elapsed = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
                    return (
                      <tr key={id} className="border-b border-border/50">
                        <td className="py-2 pr-4 font-medium">
                          {getTableLabel(s.tableId, tablesList as any)}
                        </td>
                        <td className="py-2 pr-4">{customer}</td>
                        <td className="py-2 pr-4">{new Date(s.startedAt ?? s.startTime).toLocaleString("en-SG", { timeZone: "Asia/Singapore" })}</td>
                        <td className="py-2 pr-4 font-mono">{elapsed}</td>
                        <td className="py-2 pr-4 font-mono">
                          ${Number(s.runningCost ?? 0).toFixed(2)}
                        </td>
                        <td className="py-2 pr-4 text-right space-x-2 whitespace-nowrap">
                          {userId && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setChargeTarget({ userId, name: String(customer), balance })}
                            >
                              <DollarSign className="h-3.5 w-3.5 mr-1" /> Charge
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => openForceStop(id)}
                          >
                            Force Stop
                          </Button>
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

      <Dialog open={reasonOpen} onOpenChange={setReasonOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Force Stop Walk-in Session</DialogTitle>
            <DialogDescription>
              The customer's wallet will be charged for the elapsed time. Please provide a reason.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Reason for force stopping..."
            value={reasonValue}
            onChange={(e) => setReasonValue(e.target.value)}
            rows={3}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setReasonOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={submitForceStop}
              disabled={forceStop.isPending}
            >
              {forceStop.isPending ? "Stopping..." : "Force Stop"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ChargeWalletDialog
        open={!!chargeTarget}
        onOpenChange={(v) => { if (!v) setChargeTarget(null); }}
        userId={chargeTarget?.userId ?? ""}
        customerName={chargeTarget?.name}
        currentBalance={chargeTarget?.balance ?? 0}
        defaultCategory="fnb"
      />
    </div>
  );
}

export default Admin;

