import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAdminTransactions, useAdminBookingLogs, useAdminActivityLogs } from "@/hooks/useAdminLogs";
import { fmtDateTimeSG } from "@/lib/sgTime";
import { ScrollText, FileText, Users } from "lucide-react";

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
                <th className="pb-2 pr-4">Balance After</th>
                <th className="pb-2">Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((t: any, i: number) => (
                <tr key={t._id || t.id || i} className="border-b border-border last:border-0">
                  <td className="py-3 pr-4">{t.userName || t.user?.name || (typeof t.userId === "object" ? t.userId?.name || t.userId?.email || "—" : t.userId) || "—"}</td>
                  <td className="py-3 pr-4 font-medium">
                    <span className={t.amount >= 0 ? "text-primary" : "text-destructive"}>
                      ${Math.abs(t.amount ?? 0).toFixed(2)}
                    </span>
                  </td>
                  <td className="py-3 pr-4">
                    <Badge variant="outline" className="capitalize">{t.type || "—"}</Badge>
                  </td>
                  <td className="py-3 pr-4">${(t.balanceAfter ?? t.balance_after ?? 0).toFixed(2)}</td>
                  <td className="py-3 text-muted-foreground">
                    {t.createdAt || t.created_at ? fmtDateTimeSG(t.createdAt || t.created_at) : "—"}
                  </td>
                </tr>
              ))}
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
                  <td className="py-3 pr-4">{l.targetUserName || l.targetUser?.name || l.targetUserId || "—"}</td>
                  <td className="py-3 pr-4 text-xs text-muted-foreground max-w-[200px] truncate">
                    {l.details || "—"}
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
