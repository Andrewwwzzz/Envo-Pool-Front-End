import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Wifi, WifiOff, RefreshCw, Play, Thermometer, Signal, Check, ChevronsUpDown } from "lucide-react";
import { fmtDateTimeSG } from "@/lib/sgTime";
import { useAdminMenu, FnbProduct } from "@/hooks/useFnb";
import { useAdminCustomers } from "@/hooks/useAdmin";
import {
  useVendingStatus, useVendingTestVend, useVendingRequestReport, useVendingCancelCommand, useVendingUpdateSlot,
  useVendingStaffOrder, useVendingOrder, isOrderFinal,
  VendingSlot, VendingMachineStatus, VendingCommand, VendingPaymentMethod, fmtCents, PAYMENT_LABELS,
} from "@/hooks/useVending";
import { ShoppingCart, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { VendingOrdersPanel } from "@/components/admin/VendingOrdersPanel";

const COMMAND_COLORS: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  queued: "bg-yellow-500/20 text-yellow-400",
  sent: "bg-blue-500/20 text-blue-400",
  done: "bg-green-500/20 text-green-400",
  failed: "bg-red-500/20 text-red-400",
  no_result: "bg-orange-500/20 text-orange-400",
  cancelled: "bg-muted text-muted-foreground",
};

function MachineCard({ machine, counts, commands }: { machine: VendingMachineStatus; counts: { queued: number; sent: number; needs_review: number }; commands: VendingCommand[] }) {
  const testVend = useVendingTestVend();
  const requestReport = useVendingRequestReport();
  const cancel = useVendingCancelCommand();
  const [slotInput, setSlotInput] = useState("");
  const [confirmSlot, setConfirmSlot] = useState<number | null>(null);
  const slotNo = parseInt(slotInput, 10);
  const slotOk = Number.isInteger(slotNo) && slotNo >= 1 && slotNo <= 999;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between gap-2 flex-wrap">
          <span className="flex items-center gap-2">
            Machine {machine.machineId}
            {machine.online
              ? <Badge className="bg-green-500/20 text-green-400 gap-1"><Wifi className="h-3 w-3" /> Online</Badge>
              : <Badge className="bg-red-500/20 text-red-400 gap-1"><WifiOff className="h-3 w-3" /> Offline</Badge>}
          </span>
          <Button size="sm" variant="outline" disabled={requestReport.isPending} onClick={() => requestReport.mutate({ machineId: machine.machineId })}>
            <RefreshCw className="h-3.5 w-3.5 mr-1" /> Request slot report
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <div><p className="text-xs text-muted-foreground">Last poll</p><p>{machine.lastPollAt ? fmtDateTimeSG(machine.lastPollAt) : "never"}</p></div>
          <div><p className="text-xs text-muted-foreground flex items-center gap-1"><Thermometer className="h-3 w-3" /> Temp</p><p>{machine.temp ?? "—"}</p></div>
          <div><p className="text-xs text-muted-foreground flex items-center gap-1"><Signal className="h-3 w-3" /> Signal</p><p>{machine.signal ?? "—"}</p></div>
          <div><p className="text-xs text-muted-foreground">Open orders</p><p>{counts.queued + counts.sent} in flight · <span className={counts.needs_review ? "text-orange-400 font-medium" : ""}>{counts.needs_review} to review</span></p></div>
        </div>

        <div className="flex items-end gap-2 flex-wrap">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Test vend (no charge)</p>
            <Input value={slotInput} onChange={(e) => setSlotInput(e.target.value)} placeholder="Slot no." className="w-28" inputMode="numeric" />
          </div>
          <Button size="sm" disabled={!slotOk || !machine.online || testVend.isPending} onClick={() => setConfirmSlot(slotNo)}>
            <Play className="h-3.5 w-3.5 mr-1" /> Dispense
          </Button>
          {!machine.online && <p className="text-xs text-muted-foreground">Machine must be online to test.</p>}
        </div>

        {commands.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground mb-1">Recent commands</p>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Time</TableHead><TableHead>Type</TableHead><TableHead>Slot</TableHead><TableHead>Status</TableHead><TableHead>Trade no.</TableHead><TableHead></TableHead></TableRow></TableHeader>
                <TableBody>
                  {commands.map((c) => (
                    <TableRow key={c._id}>
                      <TableCell className="whitespace-nowrap text-xs">{fmtDateTimeSG(c.createdAt)}</TableCell>
                      <TableCell className="text-xs">{c.type === "report_slots" ? "Slot report" : c.isTest ? "Test vend" : "Vend"}</TableCell>
                      <TableCell className="text-xs">{c.slotNo ?? "—"}</TableCell>
                      <TableCell><Badge className={`text-xs ${COMMAND_COLORS[c.status] ?? ""}`}>{c.status.replace("_", " ")}</Badge>{c.cancelReason && <p className="text-[11px] text-muted-foreground mt-0.5">{c.cancelReason}</p>}</TableCell>
                      <TableCell className="font-mono text-xs">{c.tradeNo}</TableCell>
                      <TableCell>{c.status === "queued" && <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => cancel.mutate({ id: c._id })}>Cancel</Button>}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </CardContent>

      <Dialog open={confirmSlot !== null} onOpenChange={(o) => !o && setConfirmSlot(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Dispense slot {confirmSlot}?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">The machine will drop whatever is in slot {confirmSlot} on its next poll (within ~3 s). Nobody is charged.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmSlot(null)}>Cancel</Button>
            <Button onClick={() => { if (confirmSlot !== null) testVend.mutate({ machineId: machine.machineId, slotNo: confirmSlot }); setConfirmSlot(null); setSlotInput(""); }}>Dispense</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// One slot row: what the machine reports on the left, what we sell on the right.
// Edits are local until Save, so a 5-second status refresh can't wipe typing.
// Type-to-search product picker for a slot (the plain dropdown got too long
// once every F&B item was listed).
function ProductPicker({ products, value, onChange }: { products: FnbProduct[]; value: string; onChange: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const selected = products.find((p) => p._id === value);
  const choose = (id: string) => { onChange(id); setOpen(false); };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open} className="h-9 w-full justify-between font-normal">
          <span className={`truncate ${selected ? "" : "text-muted-foreground"}`}>{selected ? `${selected.name} ($${selected.sellingPrice.toFixed(2)})` : "— No product —"}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0" align="start">
        <Command filter={(value, search) => (value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0)}>
          <CommandInput placeholder="Type to search…" />
          <CommandList>
            <CommandEmpty>No product found.</CommandEmpty>
            <CommandGroup>
              <CommandItem value="— No product —" onSelect={() => choose("")}>
                <Check className={`mr-2 h-4 w-4 ${value ? "opacity-0" : "opacity-100"}`} />— No product —
              </CommandItem>
              {products.filter((p) => p.isActive).map((p) => (
                <CommandItem key={p._id} value={`${p.name} ${p.category}`} onSelect={() => choose(p._id)}>
                  <Check className={`mr-2 h-4 w-4 ${value === p._id ? "opacity-100" : "opacity-0"}`} />
                  <span className="truncate">{p.name}</span>
                  <span className="ml-auto pl-2 text-xs text-muted-foreground">${p.sellingPrice.toFixed(2)}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function SlotRow({ slot }: { slot: VendingSlot }) {
  const { data: products = [] } = useAdminMenu();
  const update = useVendingUpdateSlot();
  const [productRef, setProductRef] = useState<string>(slot.productRef?._id ?? "");
  const [price, setPrice] = useState<string>(slot.priceCents != null ? (slot.priceCents / 100).toFixed(2) : "");
  const [displayName, setDisplayName] = useState<string>(slot.displayName ?? "");
  const [enabled, setEnabled] = useState<boolean>(slot.enabled);

  const dirty = productRef !== (slot.productRef?._id ?? "")
    || price !== (slot.priceCents != null ? (slot.priceCents / 100).toFixed(2) : "")
    || displayName !== (slot.displayName ?? "")
    || enabled !== slot.enabled;
  const priceCents = price.trim() === "" ? null : Math.round(parseFloat(price) * 100);
  const priceBad = price.trim() !== "" && (!Number.isFinite(priceCents) || (priceCents as number) < 0);
  const selected = products.find((p) => p._id === productRef);
  const faulty = !!slot.status && slot.status !== "0";
  const available = faulty ? 0 : (slot.quantity ?? 0) - (slot.reservedCount ?? 0);

  const save = () => update.mutate({
    machineId: slot.machineId,
    slotNo: slot.slotNo,
    productRef: productRef || null,
    priceCents: priceBad ? undefined : priceCents,
    displayName: displayName.trim() || null,
    enabled,
  });

  return (
    <TableRow className={slot.status && slot.status !== "0" ? "bg-red-500/5" : ""}>
      <TableCell className="font-semibold">{slot.slotNo}</TableCell>
      <TableCell className="text-xs text-muted-foreground">
        <p className="text-foreground">{slot.name || "—"}</p>
        <p>{slot.quantity ?? "?"}/{slot.capacity ?? "?"} in machine{slot.reservedCount ? ` · ${slot.reservedCount} reserved` : ""}{slot.machinePrice && slot.machinePrice !== "6553.5" ? ` · machine price ${slot.machinePrice}` : ""}</p>
        {slot.status && slot.status !== "0" && <p className="text-red-400">Fault code {slot.status}</p>}
      </TableCell>
      <TableCell className="min-w-[180px]">
        <ProductPicker products={products} value={productRef} onChange={setProductRef} />
        <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Display name (optional)" className="h-8 mt-1 text-xs" />
      </TableCell>
      <TableCell>
        <Input value={price} onChange={(e) => setPrice(e.target.value)} placeholder={selected ? selected.sellingPrice.toFixed(2) : "0.00"} className={`h-9 w-24 ${priceBad ? "border-red-500/60" : ""}`} inputMode="decimal" />
        {!price.trim() && selected && <p className="text-[11px] text-muted-foreground mt-0.5">uses ${selected.sellingPrice.toFixed(2)}</p>}
      </TableCell>
      <TableCell><Switch checked={enabled} onCheckedChange={setEnabled} disabled={!productRef} /></TableCell>
      <TableCell className="text-xs">{faulty ? <span className="text-red-400">not for sale (fault)</span> : slot.enabled && slot.productRef ? (available > 0 ? <span className="text-green-400">{available} for sale</span> : <span className="text-muted-foreground">sold out</span>) : <span className="text-muted-foreground">hidden</span>}</TableCell>
      <TableCell><Button size="sm" disabled={!dirty || priceBad || update.isPending} onClick={save}>Save</Button></TableCell>
    </TableRow>
  );
}

// Counter sale: staff pick the item, the customer (optional for cash/PayNow)
// and how they paid; the machine drops it straight away and the row below
// follows the result the same way the member's app does.
function SellCard({ machine, slots }: { machine: VendingMachineStatus; slots: VendingSlot[] }) {
  const sell = useVendingStaffOrder();
  const [slotNo, setSlotNo] = useState<string>("");
  const [payment, setPayment] = useState<VendingPaymentMethod>("cash");
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [customerLabel, setCustomerLabel] = useState("");
  const [lastOrderId, setLastOrderId] = useState<string | null>(null);
  const searchReady = customerSearch.trim().length >= 2;
  const { data: customers = [], isFetching } = useAdminCustomers(searchReady ? customerSearch : "");
  const { data: lastOrder } = useVendingOrder(lastOrderId);

  // One line per drink: its slots' stock added up; the server picks the slot.
  const drinks = new Map<string, { productId: string; name: string; priceCents: number; available: number }>();
  for (const s of slots) {
    if (!s.enabled || !s.productRef || (s.status != null && s.status !== "0")) continue;
    const avail = Math.max(0, (s.quantity ?? 0) - (s.reservedCount ?? 0));
    const cur = drinks.get(s.productRef._id) || { productId: s.productRef._id, name: s.displayName || s.productRef.name, priceCents: s.priceCents != null ? s.priceCents : Math.round(s.productRef.sellingPrice * 100), available: 0 };
    cur.available += avail;
    drinks.set(s.productRef._id, cur);
  }
  const sellable = [...drinks.values()].sort((a, b) => a.name.localeCompare(b.name));
  const chosen = sellable.find((d) => d.productId === slotNo);
  const price = chosen ? chosen.priceCents : null;
  const needsCustomer = payment === "wallet" || payment === "free_membership";
  const canSell = !!chosen && machine.online && !sell.isPending && (!needsCustomer || !!customerId);

  const pick = (c: { id: string; name?: string; email?: string }) => {
    setCustomerId(c.id);
    setCustomerLabel(c.name || c.email || c.id);
    setCustomerSearch("");
  };

  const submit = () => {
    if (!chosen) return;
    sell.mutate(
      { machineId: machine.machineId, productId: chosen.productId, paymentMethod: payment, userId: customerId || undefined },
      { onSuccess: (data) => setLastOrderId((data.order as { _id: string })?._id ?? null) }
    );
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2"><ShoppingCart className="h-4 w-4" /> Sell at the counter</CardTitle>
        <p className="text-xs text-muted-foreground">Customer pays you, you pick the item, the machine drops it. Cash/PayNow need no account; wallet and the free drink need the member.</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid sm:grid-cols-3 gap-3">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Item</p>
            <Select value={slotNo} onValueChange={setSlotNo}>
              <SelectTrigger className="h-9"><SelectValue placeholder={sellable.length ? "Pick an item" : "No items on sale"} /></SelectTrigger>
              <SelectContent>
                {sellable.map((d) => (
                  <SelectItem key={d.productId} value={d.productId} disabled={d.available <= 0}>{d.name} {fmtCents(d.priceCents)}{d.available <= 0 ? " (sold out)" : ` (${d.available} left)`}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Paid by</p>
            <Select value={payment} onValueChange={(v) => setPayment(v as VendingPaymentMethod)}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(["cash", "paynow", "wallet", "free_membership"] as VendingPaymentMethod[]).map((m) => <SelectItem key={m} value={m}>{PAYMENT_LABELS[m]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Customer {needsCustomer ? "(required)" : "(optional)"}</p>
            {customerId ? (
              <div className="flex items-center gap-2 h-9 text-sm"><span className="truncate">{customerLabel}</span><Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => { setCustomerId(""); setCustomerLabel(""); }}>change</Button></div>
            ) : (
              <Input value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)} placeholder="Name, email or phone" className="h-9" />
            )}
            {!customerId && searchReady && (
              <div className="rounded-md border border-border/50 max-h-40 overflow-y-auto text-sm">
                {isFetching && customers.length === 0 && <p className="px-2 py-1.5 text-xs text-muted-foreground">Searching…</p>}
                {customers.slice(0, 8).map((c: { id: string; name?: string; email?: string; phone?: string }) => (
                  <button key={c.id} type="button" className="w-full text-left px-2 py-1.5 hover:bg-muted/50" onClick={() => pick(c)}>
                    <span className="font-medium">{c.name || "—"}</span> <span className="text-muted-foreground text-xs">{c.email || c.phone || ""}</span>
                  </button>
                ))}
                {!isFetching && customers.length === 0 && <p className="px-2 py-1.5 text-xs text-muted-foreground">No match</p>}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Button disabled={!canSell} onClick={submit}>
            <Play className="h-3.5 w-3.5 mr-1" /> {sell.isPending ? "Sending…" : price != null ? `Dispense — ${payment === "free_membership" ? "free" : fmtCents(price)}` : "Dispense"}
          </Button>
          {!machine.online && <p className="text-xs text-muted-foreground">Machine is offline.</p>}
          {lastOrder && (
            <p className="text-sm flex items-center gap-1.5">
              {!isOrderFinal(lastOrder.status) ? <Loader2 className="h-4 w-4 animate-spin text-accent" /> : lastOrder.status === "dispensed" ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <XCircle className="h-4 w-4 text-red-400" />}
              {lastOrder.productName}: {lastOrder.message}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function VendingTab() {
  const { data: status, isLoading, error } = useVendingStatus();

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading vending machine…</p>;
  if (error || !status) return <p className="text-sm text-red-400">{(error as Error)?.message || "Couldn't load vending status"}</p>;
  if (status.config.machineIds.length === 0) return <p className="text-sm text-muted-foreground">No vending machine is configured on the server (VENDING_MACHINE_IDS).</p>;

  return (
    <Tabs defaultValue="machine" className="space-y-4">
      <TabsList className="flex-wrap h-auto">
        <TabsTrigger value="machine">Machine</TabsTrigger>
        <TabsTrigger value="slots">Slots</TabsTrigger>
        <TabsTrigger value="orders">Orders{status.openOrders.needs_review > 0 && <Badge className="ml-1.5 bg-orange-500/20 text-orange-400 text-[10px] px-1.5">{status.openOrders.needs_review}</Badge>}</TabsTrigger>
        <TabsTrigger value="sales">Machine sales</TabsTrigger>
        <TabsTrigger value="logs">Logs</TabsTrigger>
      </TabsList>

      <TabsContent value="machine" className="space-y-4">
        {status.machines.map((m) => (
          <div key={m.machineId} className="space-y-4">
            <SellCard machine={m} slots={status.slots.filter((s) => s.machineId === m.machineId)} />
            <MachineCard machine={m} counts={status.openOrders} commands={status.commands.filter((c) => c.machineId === m.machineId)} />
          </div>
        ))}
      </TabsContent>

      <TabsContent value="slots">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Slots</CardTitle>
            <p className="text-xs text-muted-foreground">Left: what the machine reports. Right: the product, price and visibility members see. Our price is what gets charged — never the machine's.</p>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {status.slots.length === 0 ? (
              <p className="text-sm text-muted-foreground">No slots reported yet — press "Request slot report" on the Machine tab.</p>
            ) : (
              <Table>
                <TableHeader><TableRow><TableHead>Slot</TableHead><TableHead>Machine</TableHead><TableHead>Product</TableHead><TableHead>Price ($)</TableHead><TableHead>On sale</TableHead><TableHead>Members see</TableHead><TableHead></TableHead></TableRow></TableHeader>
                <TableBody>{status.slots.map((s) => <SlotRow key={`${s.machineId}-${s.slotNo}`} slot={s} />)}</TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="orders"><VendingOrdersPanel view="orders" /></TabsContent>
      <TabsContent value="sales"><VendingOrdersPanel view="sales" /></TabsContent>
      <TabsContent value="logs"><VendingOrdersPanel view="logs" /></TabsContent>
    </Tabs>
  );
}
