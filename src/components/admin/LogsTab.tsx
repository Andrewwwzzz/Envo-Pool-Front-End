import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAdminTransactions, useAdminBookingLogs, useAdminActivityLogs } from "@/hooks/useAdminLogs";
import { useAdminCustomers } from "@/hooks/useAdmin";
import { fmtDateTimeSG } from "@/lib/sgTime";
import { ScrollText, FileText, Users } from "lucide-react";

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
  const { data, isLoading, refetch } = useAdminTransactions();
  const transactions = Array.isArray(data) ? data : data?.transactions || [];
  const nameMap = useUserNameMap();

  

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
                const userDisplay = t.userName || t.user?.name || userObj?.name || userObj?.email || (rawId ? `${String(rawId).slice(0, 8)}...` : "—");
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
                <tr key={t._id || t.id || i} className="border-b border-border last:border-0">
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
    </Card>
  );
}

function BookingLogsView() {
  const { data, isLoading, refetch } = useAdminBookingLogs();
  const logs = Array.isArray(data) ? data : data?.logs || [];

  

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
              {logs.map((l: any, i: number) => (
                <tr key={l._id || l.id || i} className="border-b border-border last:border-0">
                  <td className="py-3 pr-4 font-mono text-xs">{l.bookingId || l.booking_id || "—"}</td>
                  <td className="py-3 pr-4">
                    <Badge variant="outline" className="capitalize">
                      {l.action || "—"}
                    </Badge>
                  </td>
                  <td className="py-3 text-muted-foreground">
                    {l.createdAt || l.created_at || l.timestamp ? fmtDateTimeSG(l.createdAt || l.created_at || l.timestamp) : "—"}
                  </td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr><td colSpan={3} className="py-8 text-center text-muted-foreground">No booking logs found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function AdminLogsView() {
  const { data, isLoading, refetch } = useAdminActivityLogs();
  const logs = Array.isArray(data) ? data : data?.logs || [];

  

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
              {logs.map((l: any, i: number) => (
                <tr key={l._id || l.id || i} className="border-b border-border last:border-0">
                  <td className="py-3 pr-4">{l.adminName || l.admin?.name || (typeof l.adminId === "object" ? l.adminId?.name || l.adminId?.email || "—" : l.adminId) || "—"}</td>
                  <td className="py-3 pr-4">
                    <Badge variant="outline" className="capitalize">{l.action || "—"}</Badge>
                  </td>
                  <td className="py-3 pr-4">{l.targetUserName || l.targetUser?.name || (typeof l.targetUserId === "object" ? l.targetUserId?.name || l.targetUserId?.email || "—" : l.targetUserId) || "—"}</td>
                  <td className="py-3 pr-4 text-xs text-muted-foreground max-w-[200px] truncate">
                    {l.details == null
                      ? "—"
                      : typeof l.details === "object"
                      ? Object.entries(l.details)
                          .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`)
                          .join(", ")
                      : String(l.details)}
                  </td>
                  <td className="py-3 text-muted-foreground">
                    {l.createdAt || l.created_at || l.timestamp ? fmtDateTimeSG(l.createdAt || l.created_at || l.timestamp) : "—"}
                  </td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr><td colSpan={5} className="py-8 text-center text-muted-foreground">No admin logs found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
