import { useState, useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import BookingDetailDialog from "@/components/BookingDetailDialog";
import { useDeviceState, useDeviceControl } from "@/hooks/useDeviceControl";
import { fmtDateSG, fmtTimeSG, fmtDateTimeSG } from "@/lib/sgTime";
import { useTermsContent, useUpdateTerms } from "@/hooks/useTerms";
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
  useDeleteCustomer,
  useCustomerBookings,
  useCustomerWalletHistory,
  useCustomerRewardHistory,
} from "@/hooks/useAdmin";
import LogsTab from "@/components/admin/LogsTab";
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
import { LogOut, ArrowLeft, DollarSign, Calendar, Percent, BarChart3, Trash2, Search, Users, Timer, Play, Square, Wrench, FileText, ScrollText, Pencil, X, Check, MoreHorizontal, Clock, TrendingUp, Power, PowerOff, RotateCcw, Loader2, Wifi, WifiOff } from "lucide-react";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const Admin = () => {
  const { user, loading, signOut } = useAuth();

  if (loading) return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading...</div>;
  if (!user) return <Navigate to="/auth" replace />;
  if (!user.isAdmin) return <Navigate to="/booking" replace />;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/booking"><Button variant="ghost" size="sm"><ArrowLeft className="mr-2 h-4 w-4" /> Back</Button></Link>
          <h1 className="text-xl font-semibold text-foreground tracking-tight">Admin Dashboard</h1>
        </div>
        <Button variant="ghost" size="sm" onClick={signOut}><LogOut className="mr-2 h-4 w-4" /> Sign Out</Button>
      </header>

      <main className="mx-auto max-w-6xl p-6">
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="flex-wrap">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="bookings">Bookings</TabsTrigger>
            <TabsTrigger value="tables">Tables</TabsTrigger>
            <TabsTrigger value="invoices">Invoices</TabsTrigger>
            <TabsTrigger value="customers">Customers</TabsTrigger>
            <TabsTrigger value="pricing">Pricing</TabsTrigger>
            <TabsTrigger value="promos">Promos</TabsTrigger>
            <TabsTrigger value="terms">T&C</TabsTrigger>
            <TabsTrigger value="verification">Verification</TabsTrigger>
            <TabsTrigger value="logs">Logs</TabsTrigger>
          </TabsList>

          <TabsContent value="overview"><OverviewTab /></TabsContent>
          <TabsContent value="bookings"><BookingsTab /></TabsContent>
          <TabsContent value="tables"><TablesTab /></TabsContent>
          <TabsContent value="invoices"><InvoicesTab /></TabsContent>
          <TabsContent value="customers"><CustomersTab /></TabsContent>
          <TabsContent value="pricing"><PricingTab /></TabsContent>
          <TabsContent value="promos"><PromosTab /></TabsContent>
          <TabsContent value="terms"><TermsTab /></TabsContent>
          <TabsContent value="verification"><VerificationTab /></TabsContent>
          <TabsContent value="logs"><LogsTab /></TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

function OverviewTab() {
  const { data: stats } = useAdminStats() as { data: any };
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-6 text-center">
          <Calendar className="h-6 w-6 mx-auto text-primary mb-2" />
          <p className="text-2xl font-bold">{stats?.totalBookings ?? 0}</p>
          <p className="text-sm text-muted-foreground">Total Bookings</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6 text-center">
          <DollarSign className="h-6 w-6 mx-auto text-primary mb-2" />
          <p className="text-2xl font-bold">${(stats?.totalRevenue ?? 0).toFixed(2)}</p>
          <p className="text-sm text-muted-foreground">Total Revenue</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6 text-center">
          <BarChart3 className="h-6 w-6 mx-auto text-primary mb-2" />
          <p className="text-2xl font-bold">{stats?.activeBookings ?? 0}</p>
          <p className="text-sm text-muted-foreground">Active Bookings</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6 text-center">
          <Percent className="h-6 w-6 mx-auto text-accent mb-2" />
          <p className="text-2xl font-bold">{stats?.pendingBookings ?? 0}</p>
          <p className="text-sm text-muted-foreground">Pending Bookings</p>
        </CardContent></Card>
      </div>
    </div>
  );
}

type BookingFilter = "all" | "today" | "upcoming" | "completed" | "cancelled" | "refunded" | "no_show";

function BookingsTab() {
  const { data: bookings, isLoading } = useAdminBookings();
  const deleteBooking = useDeleteBooking();
  const updateStatus = useUpdateBookingStatus();
  const [filter, setFilter] = useState<BookingFilter>("all");
  const [selectedBooking, setSelectedBooking] = useState<any | null>(null);

  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);

  const getField = (b: any, ...keys: string[]) => {
    for (const k of keys) if (b[k] !== undefined) return b[k];
    return undefined;
  };

  const filtered = (bookings || []).filter((b: any) => {
    const startDate = new Date(getField(b, "startTime", "start_time"));
    switch (filter) {
      case "today": return startDate >= todayStart && startDate <= todayEnd;
      case "upcoming": return startDate > now && (b.status === "confirmed" || b.status === "pending");
      case "completed": return b.status === "completed" || (b.status === "confirmed" && new Date(getField(b, "endTime", "end_time")) < now);
      case "cancelled": return b.status === "cancelled";
      case "refunded": return b.status === "refunded";
      case "no_show": return b.status === "no_show";
      default: return true;
    }
  });

  return (
    <>
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <CardTitle>All Bookings</CardTitle>
          <div className="flex flex-wrap gap-1.5">
            {(["all", "today", "upcoming", "completed", "cancelled", "refunded", "no_show"] as BookingFilter[]).map((f) => (
              <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} onClick={() => setFilter(f)} className="capitalize text-xs h-7 px-2.5">
                {f === "no_show" ? "No Show" : f}
              </Button>
            ))}
          </div>
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
              {filtered.map((b) => {
                const canDelete = b.status === "pending" || b.status === "cancelled";
                const canAction = b.status === "confirmed" || b.status === "pending";
                return (
                  <tr key={b.id || b._id} className="border-b border-border last:border-0 cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setSelectedBooking(b)}>
                    <td className="py-3 pr-4">Table {typeof b.tableId === "string" ? b.tableId.replace("T", "") : (b as any).tables?.table_number ?? b.tableId?.tableNumber ?? "?"}</td>
                    <td className="py-3 pr-4">{fmtDateSG(getField(b, "startTime", "start_time"))}</td>
                    <td className="py-3 pr-4">{fmtTimeSG(getField(b, "startTime", "start_time"))} – {fmtTimeSG(getField(b, "endTime", "end_time"))}</td>
                    <td className="py-3 pr-4">{(() => { const mins = getField(b, "duration", "duration_hours"); return mins >= 60 ? `${Math.floor(mins / 60)}h${mins % 60 ? ` ${mins % 60}m` : ""}` : `${mins}m`; })()}</td>
                    <td className="py-3 pr-4">${(getField(b, "finalPrice", "final_price", "price") ?? 0).toFixed(2)}</td>
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
                        {canDelete && (
                          <Button variant="ghost" size="sm" onClick={() => deleteBooking.mutate(b.id)} disabled={deleteBooking.isPending}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                        {canAction && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm"><MoreHorizontal className="h-4 w-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => updateStatus.mutate({ bookingId: b.id, status: "refunded" })}>
                                Refund
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => updateStatus.mutate({ bookingId: b.id, status: "cancelled" })}>
                                Cancel
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => updateStatus.mutate({ bookingId: b.id, status: "no_show" })}>
                                Mark No Show
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="py-8 text-center text-muted-foreground">No bookings found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>

    <BookingDetailDialog
      booking={selectedBooking}
      open={!!selectedBooking}
      onOpenChange={(open) => { if (!open) setSelectedBooking(null); }}
    />
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
    stopTimer.mutate({
      tableId,
      durationSeconds: seconds,
      hourlyRate: Number(tableRate),
      startedAt: table?.timer_started_at!,
    });
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
                      <Button
                        size="sm"
                        variant={isMaintenance ? "outline" : "secondary"}
                        onClick={() => setMaintenance.mutate({ tableId: t.id, maintenance: !isMaintenance })}
                        className="w-full"
                        disabled={false}
                      >
                        <Wrench className="mr-2 h-3 w-3" />
                        {isMaintenance ? "Remove Maintenance" : "Set Maintenance"}
                      </Button>
                    )}
                  </div>

                  {/* Device Control */}
                  <DeviceControlPanel hardwareId={t.hardware_id} />
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function InvoicesTab() {
  const { data: sessions, isLoading } = useAdminTimerSessions();

  const formatDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };


  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" /> Timer Session Invoices
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!sessions?.length ? (
          <p className="text-muted-foreground text-sm">No timer sessions yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="pb-2 pr-4">Table</th>
                  <th className="pb-2 pr-4">Date</th>
                  <th className="pb-2 pr-4">Start</th>
                  <th className="pb-2 pr-4">End</th>
                  <th className="pb-2 pr-4">Duration</th>
                  <th className="pb-2 pr-4">Rate</th>
                  <th className="pb-2">Total</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s: any) => (
                  <tr key={s.id} className="border-b border-border last:border-0">
                    <td className="py-3 pr-4">Table {s.tables?.table_number ?? "?"}</td>
                    <td className="py-3 pr-4">{fmtDateSG(s.started_at)}</td>
                    <td className="py-3 pr-4">{fmtTimeSG(s.started_at)}</td>
                    <td className="py-3 pr-4">{fmtTimeSG(s.ended_at)}</td>
                    <td className="py-3 pr-4 font-mono">{formatDuration(s.duration_seconds)}</td>
                    <td className="py-3 pr-4">${Number(s.hourly_rate).toFixed(2)}/hr</td>
                    <td className="py-3 font-medium">${Number(s.total_cost).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CustomersTab() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const { data: customers, isLoading } = useAdminCustomers(debouncedSearch);
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

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
            placeholder="Search by name or email..."
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
              <th className="pb-2 pr-4">Email</th>
              <th className="pb-2 pr-4">Status</th>
              <th className="pb-2 pr-4">Role</th>
              <th className="pb-2 pr-4">Wallet</th>
              <th className="pb-2 pr-4">Points</th>
              <th className="pb-2 pr-4">Total Spent</th>
              <th className="pb-2">Joined</th>
            </tr></thead>
            <tbody>
              {(customers || []).map((c: any) => (
                <tr
                  key={c.id}
                  className="border-b border-border last:border-0 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => setSelectedCustomer(c)}
                >
                  <td className="py-3 pr-4 font-medium">{c.name || "—"}</td>
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
                  <td className="py-3 pr-4">{c.reward_points ?? 0}</td>
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
  const updateProfile = useUpdateCustomerProfile();
  const deleteCustomer = useDeleteCustomer();
  const { data: bookings, isLoading: bookingsLoading } = useCustomerBookings(customer.user_id);
  const { data: walletHistory } = useCustomerWalletHistory(customer.user_id);
  const { data: rewardHistory } = useCustomerRewardHistory(customer.user_id);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [walletInput, setWalletInput] = useState(String(customer.wallet_balance));
  const [pointsInput, setPointsInput] = useState(String(customer.reward_points));

  const saveEdit = () => {
    updateProfile.mutate({
      userId: customer.user_id,
      wallet_balance: parseFloat(walletInput),
      reward_points: parseFloat(pointsInput),
    });
    setEditing(false);
  };

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="mr-2 h-4 w-4" /> Back to Customers</Button>

      {/* Profile Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{customer.name || "No Name"}</CardTitle>
            <div className="flex gap-2">
              {!editing && <Button size="sm" variant="outline" onClick={() => setEditing(true)}><Pencil className="mr-1 h-3 w-3" /> Edit</Button>}
              {!confirmDelete ? (
                <Button size="sm" variant="destructive" onClick={() => setConfirmDelete(true)}><Trash2 className="mr-1 h-3 w-3" /> Delete</Button>
              ) : (
                <div className="flex gap-1 items-center">
                  <span className="text-sm text-destructive mr-1">Confirm?</span>
                  <Button size="sm" variant="destructive" onClick={() => { deleteCustomer.mutate(customer.user_id); onBack(); }} disabled={deleteCustomer.isPending}>Yes</Button>
                  <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>No</Button>
                </div>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div><p className="text-muted-foreground">Email</p><p className="font-medium">{customer.email}</p></div>
            <div><p className="text-muted-foreground">Phone</p><p className="font-medium">{customer.phone || "—"}</p></div>
            <div><p className="text-muted-foreground">DOB</p><p className="font-medium">{customer.date_of_birth || "—"}</p></div>
            <div><p className="text-muted-foreground">Joined</p><p className="font-medium">{fmtDateSG(customer.created_at)}</p></div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div><p className="text-muted-foreground">Verified</p><p className="font-medium">{customer.isVerified ? <Badge>Yes</Badge> : <Badge variant="destructive">No</Badge>}</p></div>
            <div><p className="text-muted-foreground">Role</p><p className="font-medium capitalize">{customer.role}</p></div>
            <div><p className="text-muted-foreground">Age Verified</p><p className="font-medium">{customer.age_verified ? "Yes" : "No"}</p></div>
          </div>

          {editing ? (
            <div className="grid gap-3 sm:grid-cols-2 pt-2 border-t border-border">
              <div className="space-y-1">
                <Label className="text-xs">Wallet Balance ($)</Label>
                <Input type="number" step="0.01" value={walletInput} onChange={(e) => setWalletInput(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Reward Points</Label>
                <Input type="number" step="1" value={pointsInput} onChange={(e) => setPointsInput(e.target.value)} />
              </div>
              <div className="sm:col-span-2 flex gap-2">
                <Button size="sm" onClick={saveEdit} disabled={updateProfile.isPending}>Save</Button>
                <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
              </div>
            </div>
          ) : (
            <div className="flex gap-6 text-sm pt-2 border-t border-border">
              <span>Wallet: <strong>${customer.wallet_balance.toFixed(2)}</strong></span>
              <span>Points: <strong>{customer.reward_points}</strong></span>
              <span>Total Spent: <strong>${customer.total_spent.toFixed(2)}</strong></span>
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
                    <tr key={b.id || b._id} className="border-b border-border last:border-0">
                      <td className="py-2 pr-4">Table {typeof b.tableId === "string" ? b.tableId.replace("T", "") : b.tables?.table_number ?? "?"}</td>
                      <td className="py-2 pr-4">{fmtDateSG(b.startTime || b.start_time)}</td>
                      <td className="py-2 pr-4">{fmtTimeSG(b.startTime || b.start_time)}</td>
                      <td className="py-2 pr-4">{(() => { const mins = b.duration || b.duration_hours; return mins >= 60 ? `${Math.floor(mins / 60)}h${mins % 60 ? ` ${mins % 60}m` : ""}` : `${mins}m`; })()}</td>
                      <td className="py-2 pr-4">${(b.finalPrice ?? b.final_price ?? b.price ?? 0).toFixed(2)}</td>
                      <td className="py-2"><Badge variant="outline" className="capitalize">{b.status}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Wallet & Reward History */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Wallet Transactions</CardTitle></CardHeader>
          <CardContent>
            {!walletHistory?.length ? <p className="text-muted-foreground text-sm">No transactions.</p> : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {walletHistory.map((t: any) => {
                  const amt = typeof t.amount === "object" ? t.amount?.amount ?? 0 : (typeof t.amount === "number" ? t.amount : Number(t.amount) || 0);
                  const bal = typeof t.balance_after === "object" ? t.balance_after?.amount ?? 0 : (typeof t.balance_after === "number" ? t.balance_after : Number(t.balanceAfter ?? t.balance_after) || 0);
                  const txType = t.type || t.transactionType || "unknown";
                  const dateStr = t.created_at || t.createdAt || "";
                  return (
                  <div key={t.id || t._id} className="flex justify-between text-sm border-b border-border pb-2 last:border-0">
                    <div>
                      <p className="capitalize font-medium">{String(txType).replace(/_/g, " ")}</p>
                      <p className="text-xs text-muted-foreground">{fmtDateTimeSG(dateStr)}</p>
                    </div>
                    <div className="text-right">
                      <p className={amt >= 0 ? "text-green-600" : "text-destructive"}>{amt >= 0 ? "+" : ""}${Math.abs(amt).toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">Bal: ${bal.toFixed(2)}</p>
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Reward Transactions</CardTitle></CardHeader>
          <CardContent>
            {!rewardHistory?.length ? <p className="text-muted-foreground text-sm">No transactions.</p> : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {rewardHistory.map((t: any) => {
                  const pts = typeof t.points === "number" ? t.points : Number(t.points) || 0;
                  const txType = t.type || t.transactionType || "unknown";
                  const dateStr = t.created_at || t.createdAt || "";
                  return (
                  <div key={t.id || t._id} className="flex justify-between text-sm border-b border-border pb-2 last:border-0">
                    <div>
                      <p className="capitalize font-medium">{String(txType).replace(/_/g, " ")}</p>
                      <p className="text-xs text-muted-foreground">{fmtDateTimeSG(dateStr)}</p>
                    </div>
                    <p className={pts >= 0 ? "text-green-600" : "text-destructive"}>{pts >= 0 ? "+" : ""}{pts} pts</p>
                  </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function PricingTab() {
  const { data: rules, create, remove, toggle, update } = useAdminPricingRules();
  const [form, setForm] = useState({
    name: "", start_time: "09:00", end_time: "23:00", hourly_rate: "20",
    priority: "0", weekdays: [...WEEKDAYS] as string[], specific_date: "", table_id: "",
  });
  const [editingId, setEditingId] = useState<string | null>(null);
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
        <CardHeader><CardTitle>Existing Rules</CardTitle></CardHeader>
        <CardContent>
          {!rules?.length ? <p className="text-muted-foreground text-sm">No pricing rules.</p> : (
            <div className="space-y-3">
              {rules.map((r) => (
                <div key={r.id} className="rounded-lg border border-border p-4">
                  {editingId === r.id ? (
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
                  ) : (
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{r.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {r.start_time} – {r.end_time} · ${r.hourly_rate}/hr · Priority {r.priority}
                          {r.specific_date && ` · ${r.specific_date}`}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">{(r.applies_to_weekdays as string[]).join(", ")}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" onClick={() => startEdit(r)}><Pencil className="h-4 w-4" /></Button>
                        <Switch checked={r.is_active} onCheckedChange={(v) => toggle.mutate({ id: r.id, is_active: v })} />
                        <Button variant="ghost" size="sm" onClick={() => remove.mutate(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function PromosTab() {
  const { data: promos, create, toggle, remove } = useAdminPromoCodes();
  const [form, setForm] = useState({
    code: "", discount_type: "percentage" as string, discount_value: "", minimum_spend: "",
    max_discount_amount: "", usage_limit: "", per_user_limit: "", expiry_date: "",
  });

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
        <CardHeader><CardTitle>Existing Promo Codes</CardTitle></CardHeader>
        <CardContent>
          {!promos?.length ? <p className="text-muted-foreground text-sm">No promo codes.</p> : (
            <div className="space-y-3">
              {promos.map((p) => (
                <div key={p.id} className="flex items-center justify-between rounded-lg border border-border p-4">
                  <div>
                    <p className="font-medium font-mono">{p.code}</p>
                    <p className="text-sm text-muted-foreground">
                      {p.discount_type === "percentage" ? `${p.discount_value}%` : `$${p.discount_value}`} off
                      {p.minimum_spend ? ` · Min $${p.minimum_spend}` : ""}
                      {p.max_discount_amount ? ` · Max $${p.max_discount_amount}` : ""}
                      {p.expiry_date ? ` · Expires ${fmtDateSG(p.expiry_date)}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Switch checked={p.is_active} onCheckedChange={(v) => toggle.mutate({ id: p.id, is_active: v })} />
                    <Button variant="ghost" size="sm" onClick={() => remove.mutate(p.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function TermsTab() {
  const { data: terms, isLoading } = useTermsContent();
  const updateTerms = useUpdateTerms();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const startEdit = () => {
    setDraft(terms?.content ?? "");
    setEditing(true);
  };

  const save = () => {
    if (!terms) return;
    updateTerms.mutate({ id: terms.id, content: draft }, {
      onSuccess: () => setEditing(false),
    });
  };

  

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ScrollText className="h-5 w-5 text-primary" /> Terms & Conditions
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {editing ? (
          <>
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={16}
              className="font-mono text-sm"
            />
            <div className="flex gap-2">
              <Button onClick={save} disabled={updateTerms.isPending}>
                {updateTerms.isPending ? "Saving..." : "Save"}
              </Button>
              <Button variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
            </div>
          </>
        ) : (
          <>
            <div className="whitespace-pre-wrap text-sm text-foreground border border-border rounded-lg p-4 max-h-96 overflow-y-auto">
              {terms?.content || "No content yet."}
            </div>
            <Button onClick={startEdit}>Edit Terms</Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function VerificationTab() {
  const { user } = useAuth();
  const [users, setUsers] = useState<any[]>(() => {
    try {
      const cached = localStorage.getItem("cache:unverified-users");
      return cached ? JSON.parse(cached) : [];
    } catch { return []; }
  });
  const [verifying, setVerifying] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchUnverified = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("https://api.envopoolsg.com/api/admin/unverified-users", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch unverified users");
      const data = await res.json();
      const list = Array.isArray(data) ? data : data.users || [];
      setUsers(list);
      localStorage.setItem("cache:unverified-users", JSON.stringify(list));
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  useEffect(() => {
    fetchUnverified();
  }, []);

  const handleVerify = async (userId: string) => {
    try {
      setVerifying(userId);
      const token = localStorage.getItem("token");
      const res = await fetch("https://api.envopoolsg.com/api/admin/verify-user", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ userId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Failed to verify user");
      }
      toast({ title: "User verified successfully" });
      await fetchUnverified();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setVerifying(null);
    }
  };

  

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>User Verification</CardTitle>
          <Button variant="outline" size="sm" onClick={fetchUnverified}>
            <RotateCcw className="mr-2 h-4 w-4" /> Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {users.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">No unverified users</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="pb-2 pr-4">Name</th>
                  <th className="pb-2 pr-4">Email</th>
                  <th className="pb-2 pr-4">Created</th>
                  <th className="pb-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u: any) => (
                  <tr key={u._id || u.userId || u.id} className="border-b border-border last:border-0">
                    <td className="py-3 pr-4">{u.name || "—"}</td>
                    <td className="py-3 pr-4">{u.email || "—"}</td>
                    <td className="py-3 pr-4">{u.createdAt ? fmtDateTimeSG(u.createdAt) : "—"}</td>
                    <td className="py-3">
                      <Button
                        size="sm"
                        onClick={() => handleVerify(u._id || u.userId || u.id)}
                        disabled={verifying === (u._id || u.userId || u.id)}
                      >
                        {verifying === (u._id || u.userId || u.id) ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Check className="mr-2 h-4 w-4" />
                        )}
                        Verify
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default Admin;
