import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fmtDateTimeSG } from "@/lib/sgTime";
import { useAdminCustomers, useAdminTables } from "@/hooks/useAdmin";
import {
  useVendingAdminOrders, useVendingExternalSales, useVendingLogs, useVendingRefundOrder, useVendingResolveOrder, useVendingChangePayment,
  VendingAdminOrder, fmtCents, ORDER_STATUS_COLORS, ORDER_STATUS_LABELS, PAY_TYPE_LABELS, PAYMENT_LABELS,
  EDITABLE_PAYMENTS, EditablePayment, PAYMENT_EDITABLE_STATUSES,
} from "@/hooks/useVending";

const FILTERS = [
  { value: "needs_review", label: "Needs review" },
  { value: "all", label: "All" },
  { value: "queued,sent", label: "In flight" },
  { value: "dispensed", label: "Dispensed" },
  { value: "refunded", label: "Refunded" },
  { value: "failed,expired", label: "Failed / expired" },
];

const REFUNDABLE = ["queued", "sent", "dispensed", "failed", "expired", "needs_review"];

const canEditPayment = (o: VendingAdminOrder) =>
  (EDITABLE_PAYMENTS as readonly string[]).includes(o.paymentMethod) && PAYMENT_EDITABLE_STATUSES.includes(o.status) && !o.settledAt;

// Corrects how an order was paid (logged as cash but it was PayNow, should be
// on the table's tab, the member wants it on their wallet…). Free drink /
// reward orders aren't editable; a table-tab drink already settled with its
// invoice isn't either — the invoice's payment method is what to change then.
function EditPaymentDialog({ order, onClose }: { order: VendingAdminOrder | null; onClose: () => void }) {
  const change = useVendingChangePayment();
  const { data: tables = [] } = useAdminTables();
  const runningTables = tables.filter((t: { timer_started_at?: string | null }) => !!t.timer_started_at);
  const [method, setMethod] = useState<EditablePayment>("cash");
  const [tableId, setTableId] = useState("");
  const [reason, setReason] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [customerLabel, setCustomerLabel] = useState("");
  const searchReady = customerSearch.trim().length >= 2;
  const { data: customers = [], isFetching } = useAdminCustomers(searchReady ? customerSearch : "");

  useEffect(() => {
    if (order) {
      setMethod((EDITABLE_PAYMENTS as readonly string[]).includes(order.paymentMethod) ? (order.paymentMethod as EditablePayment) : "cash");
      setTableId(""); setReason(""); setCustomerSearch(""); setCustomerId(""); setCustomerLabel("");
    }
  }, [order]);

  if (!order) return null;
  // A counter sale sits on the shared Guest Account; charging a wallet needs the real member.
  const hasMember = !!order.userId && !/guest/i.test(order.userId.name || "");
  const needsCustomer = method === "wallet" && !hasMember && !customerId;
  const ready = method !== order.paymentMethod && reason.trim() && (method !== "charge_to_table" || tableId) && !needsCustomer;
  const submit = () => order && change.mutate(
    { id: order._id, paymentMethod: method, reason: reason.trim(), tableRefId: method === "charge_to_table" ? tableId : undefined, userId: method === "wallet" && customerId ? customerId : undefined },
    { onSuccess: onClose }
  );

  return (
    <Dialog open={!!order} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Edit payment</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">{order.productName} — currently <strong>{PAYMENT_LABELS[order.paymentMethod] ?? order.paymentMethod}</strong>{order.tableName ? ` (${order.tableName})` : ""}, {fmtCents(order.priceCents)}</p>
          <div className="grid grid-cols-2 gap-2">
            {EDITABLE_PAYMENTS.map((m) => (
              <Button key={m} type="button" size="sm" variant={method === m ? "default" : "outline"} onClick={() => setMethod(m)}>{PAYMENT_LABELS[m]}</Button>
            ))}
          </div>
          {method === "charge_to_table" && (
            <Select value={tableId || "none"} onValueChange={(v) => setTableId(v === "none" ? "" : v)}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Select a running table" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Select a running table</SelectItem>
                {runningTables.map((t: { id: string; table_number: number | string }) => <SelectItem key={t.id} value={t.id}>Table {t.table_number}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          {method === "wallet" && !hasMember && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Member whose wallet to charge</p>
              {customerId ? (
                <div className="flex items-center gap-2 text-sm"><span className="truncate">{customerLabel}</span><Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => { setCustomerId(""); setCustomerLabel(""); }}>change</Button></div>
              ) : (
                <Input value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)} placeholder="Name, email or phone" className="h-9" />
              )}
              {!customerId && searchReady && (
                <div className="rounded-md border border-border/50 max-h-32 overflow-y-auto text-sm">
                  {isFetching && customers.length === 0 && <p className="px-2 py-1.5 text-xs text-muted-foreground">Searching…</p>}
                  {customers.slice(0, 8).map((c: { id: string; name?: string; email?: string; phone?: string }) => (
                    <button key={c.id} type="button" className="w-full text-left px-2 py-1.5 hover:bg-muted/50" onClick={() => { setCustomerId(c.id); setCustomerLabel(c.name || c.email || c.id); setCustomerSearch(""); }}>
                      <span className="font-medium">{c.name || "—"}</span> <span className="text-muted-foreground text-xs">{c.email || c.phone || ""}</span>
                    </button>
                  ))}
                  {!isFetching && customers.length === 0 && <p className="px-2 py-1.5 text-xs text-muted-foreground">No match</p>}
                </div>
              )}
            </div>
          )}
          {method !== order.paymentMethod && <p className="text-xs text-muted-foreground">{order.paymentMethod === "charge_to_table" ? "Taken off the table's bill and charged the new way." : method === "charge_to_table" ? "The original charge is reversed and the drink goes on the table's bill." : "The ledger line is corrected; the money moves accordingly."}</p>}
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (required)" />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!ready || change.isPending} onClick={submit}>{change.isPending ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RefundDialog({ order, onClose }: { order: VendingAdminOrder | null; onClose: () => void }) {
  const refund = useVendingRefundOrder();
  const [reason, setReason] = useState("");
  return (
    <Dialog open={!!order} onOpenChange={(o) => { if (!o) { onClose(); setReason(""); } }}>
      <DialogContent>
        <DialogHeader><DialogTitle>Refund {order?.productName}</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">
          {order?.paymentMethod === "free_membership" ? "Gives the member today's free drink back."
            : order?.paymentMethod === "charge_to_table" ? `Nothing was paid yet — this takes the drink off ${order.tableName || "the table"}'s bill.`
            : order?.paymentMethod === "cash" || order?.paymentMethod === "paynow" ? `${order ? fmtCents(order.priceCents) : ""} was paid at the counter — hand it back to the customer; this records the reversal.`
            : `${order ? fmtCents(order.priceCents) : ""} goes back to the member's wallet.`} This can only happen once.
        </p>
        <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (required, shown to the member)" />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="destructive" disabled={!reason.trim() || refund.isPending} onClick={() => order && refund.mutate({ id: order._id, reason: reason.trim() }, { onSuccess: () => { onClose(); setReason(""); } })}>Refund</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ResolveDialog({ order, onClose }: { order: VendingAdminOrder | null; onClose: () => void }) {
  const resolve = useVendingResolveOrder();
  const [note, setNote] = useState("");
  const finish = (outcome: "dispensed" | "refunded") => order && resolve.mutate({ id: order._id, outcome, note: note.trim() || undefined }, { onSuccess: () => { onClose(); setNote(""); } });
  return (
    <Dialog open={!!order} onOpenChange={(o) => { if (!o) { onClose(); setNote(""); } }}>
      <DialogContent>
        <DialogHeader><DialogTitle>Resolve: {order?.productName} (slot {order?.slotNo})</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">The machine never confirmed this vend. Check the tray / stock, then say what happened.</p>
        {order?.review?.note && <p className="text-xs text-muted-foreground">Note: {order.review.note}</p>}
        <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="What you found (optional)" />
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="destructive" disabled={resolve.isPending} onClick={() => finish("refunded")}>Nothing dropped — refund</Button>
          <Button disabled={resolve.isPending} onClick={() => finish("dispensed")}>Drink dropped — close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function OrdersView() {
  const [filter, setFilter] = useState("needs_review");
  const { data: orders = [], isLoading } = useVendingAdminOrders(filter);
  const [refunding, setRefunding] = useState<VendingAdminOrder | null>(null);
  const [resolving, setResolving] = useState<VendingAdminOrder | null>(null);
  const [editing, setEditing] = useState<VendingAdminOrder | null>(null);

  return (
    <Card>
      <CardHeader className="pb-2 flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-base">Vending orders</CardTitle>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-44 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>{FILTERS.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : orders.length === 0 ? (
          <p className="text-sm text-muted-foreground">{filter === "needs_review" ? "Nothing to review." : "No orders."}</p>
        ) : (
          <Table>
            <TableHeader><TableRow><TableHead>Time</TableHead><TableHead>Member</TableHead><TableHead>Item</TableHead><TableHead>Paid</TableHead><TableHead>Status</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {orders.map((o) => (
                <TableRow key={o._id}>
                  <TableCell className="whitespace-nowrap text-xs">{fmtDateTimeSG(o.createdAt)}</TableCell>
                  <TableCell className="text-xs"><p>{o.userId?.name || "—"}</p><p className="text-muted-foreground">{o.userId?.email || o.userId?.phone || ""}</p></TableCell>
                  <TableCell className="text-xs"><p>{o.productName}</p><p className="text-muted-foreground">slot {o.slotNo} · {o.mode}</p></TableCell>
                  <TableCell className="text-xs">{o.paymentMethod === "free_membership" ? "Free drink" : fmtCents(o.priceCents)}<p className="text-muted-foreground">{PAYMENT_LABELS[o.paymentMethod] ?? o.paymentMethod}{o.tableName ? ` · ${o.tableName}${o.settledAt ? " (settled)" : ""}` : ""}{o.placedBy ? " · counter" : ""}</p></TableCell>
                  <TableCell>
                    <Badge className={`text-xs ${ORDER_STATUS_COLORS[o.status]}`}>{ORDER_STATUS_LABELS[o.status]}</Badge>
                    {o.failure?.reason && <p className="text-[11px] text-muted-foreground mt-0.5">{o.failure.reason}</p>}
                    {o.refund?.reason && <p className="text-[11px] text-muted-foreground mt-0.5">Refund: {o.refund.reason}{o.refund.by?.name ? ` (${o.refund.by.name})` : ""}</p>}
                    {o.review?.note && o.status === "needs_review" && <p className="text-[11px] text-orange-400 mt-0.5">{o.review.note}</p>}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {o.status === "needs_review" && <Button size="sm" className="h-7 text-xs mr-1" onClick={() => setResolving(o)}>Resolve</Button>}
                    {canEditPayment(o) && <Button size="sm" variant="ghost" className="h-7 text-xs mr-1" onClick={() => setEditing(o)}>Edit payment</Button>}
                    {REFUNDABLE.includes(o.status) && o.status !== "needs_review" && <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setRefunding(o)}>Refund</Button>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
      <RefundDialog order={refunding} onClose={() => setRefunding(null)} />
      <ResolveDialog order={resolving} onClose={() => setResolving(null)} />
      <EditPaymentDialog order={editing} onClose={() => setEditing(null)} />
    </Card>
  );
}

function SalesView() {
  const { data: sales = [], isLoading } = useVendingExternalSales();
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Sales made on the machine</CardTitle>
        <p className="text-xs text-muted-foreground">Card / QR / cash purchases at the machine itself — no Envo account involved, nothing to refund here.</p>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : sales.length === 0 ? <p className="text-sm text-muted-foreground">No machine-side sales recorded.</p> : (
          <Table>
            <TableHeader><TableRow><TableHead>Time</TableHead><TableHead>Slot</TableHead><TableHead>Item</TableHead><TableHead>Amount</TableHead><TableHead>Paid by</TableHead><TableHead>Result</TableHead></TableRow></TableHeader>
            <TableBody>
              {sales.map((s) => (
                <TableRow key={s._id}>
                  <TableCell className="whitespace-nowrap text-xs">{fmtDateTimeSG(s.createdAt)}</TableCell>
                  <TableCell className="text-xs">{s.slotNo ?? "—"}</TableCell>
                  <TableCell className="text-xs">{s.name || "—"}</TableCell>
                  <TableCell className="text-xs">{s.amount ?? "—"}</TableCell>
                  <TableCell className="text-xs">{(s.payType && PAY_TYPE_LABELS[s.payType]) || s.payType || "—"}</TableCell>
                  <TableCell>{s.status === "0" ? <Badge className="bg-green-500/20 text-green-400 text-xs">Dispensed</Badge> : <Badge className="bg-red-500/20 text-red-400 text-xs">Failed</Badge>}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function LogsView() {
  const [includeEmpty, setIncludeEmpty] = useState(false);
  const { data: logs = [], isLoading } = useVendingLogs(includeEmpty);
  return (
    <Card>
      <CardHeader className="pb-2 flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-base">Machine log</CardTitle>
        <label className="flex items-center gap-2 text-xs text-muted-foreground"><Switch checked={includeEmpty} onCheckedChange={setIncludeEmpty} /> show empty polls</label>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : logs.length === 0 ? <p className="text-sm text-muted-foreground">No requests logged.</p> : (
          <Table>
            <TableHeader><TableRow><TableHead>Time</TableHead><TableHead>Code</TableHead><TableHead>What happened</TableHead><TableHead>Request</TableHead></TableRow></TableHeader>
            <TableBody>
              {logs.map((l) => (
                <TableRow key={l._id}>
                  <TableCell className="whitespace-nowrap text-xs">{fmtDateTimeSG(l.createdAt)}</TableCell>
                  <TableCell className="font-mono text-xs">{l.funCode ?? "—"}</TableCell>
                  <TableCell className="text-xs">{l.note || (l.isEmptyPoll ? "poll — nothing to do" : "")}</TableCell>
                  <TableCell className="font-mono text-[11px] text-muted-foreground max-w-[380px] truncate" title={l.rawBody}>{l.rawBody}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

export function VendingOrdersPanel({ view }: { view: "orders" | "sales" | "logs" }) {
  if (view === "sales") return <SalesView />;
  if (view === "logs") return <LogsView />;
  return <OrdersView />;
}
