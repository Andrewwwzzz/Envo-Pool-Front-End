import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, RotateCcw, XCircle, Loader2, Eye, EyeOff, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  useLockerUnits,
  useLockerRentals,
  useCreateLockerUnit,
  useAssignLocker,
  useRenewLocker,
  useCancelLocker,
  useRegeneratePinLocker,
  useSeedLockerPins,
  type LockerUnit,
} from "@/hooks/useLockers";
import { useAdminCustomers } from "@/hooks/useAdmin";
import { fmtDateSG } from "@/lib/sgTime";
import ReasonDialog from "./ReasonDialog";
import { isCancelled } from "./DeletedBanner";

function AddLockerDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { toast } = useToast();
  const [number, setNumber] = useState("");
  const [price, setPrice] = useState("0");
  const [pin, setPin] = useState("");
  const [notes, setNotes] = useState("");
  const [showPin, setShowPin] = useState(false);
  const create = useCreateLockerUnit();

  const submit = async () => {
    if (!number.trim()) { toast({ title: "Locker number required", variant: "destructive" }); return; }
    try {
      await create.mutateAsync({ number: number.trim(), monthlyPrice: Number(price) || 0, pin: pin.trim() || undefined, notes: notes || undefined });
      toast({ title: "Locker added" });
      onOpenChange(false); setNumber(""); setPrice("0"); setPin(""); setNotes("");
    } catch (e: any) {
      toast({ title: "Failed", description: e?.message, variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Add Locker</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Locker Number</Label>
            <Input value={number} onChange={(e) => setNumber(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Monthly Price (SGD)</Label>
            <Input type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>PIN (leave blank to auto-generate)</Label>
            <div className="relative">
              <Input
                type={showPin ? "text" : "password"}
                inputMode="numeric"
                placeholder="e.g. 1234"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                maxLength={8}
                className="pr-10"
              />
              <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => setShowPin(v => !v)} tabIndex={-1}>
                {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={create.isPending}>
            {create.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Add
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AssignLockerDialog({
  open, onOpenChange, locker,
}: { open: boolean; onOpenChange: (v: boolean) => void; locker: LockerUnit | null }) {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [startDate, setStartDate] = useState("");
  const { data: customers = [] } = useAdminCustomers(search);
  const assign = useAssignLocker();

  const submit = async () => {
    if (!locker || !customerId) { toast({ title: "Customer required", variant: "destructive" }); return; }
    try {
      await assign.mutateAsync({ lockerId: (locker as any)._id ?? locker.id, customerId, startDate: startDate || undefined });
      toast({ title: "Locker assigned" });
      onOpenChange(false); setCustomerId(""); setStartDate(""); setSearch("");
    } catch (e: any) {
      toast({ title: "Failed", description: e?.message, variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Assign Locker {locker ? `#${(locker as any).lockerNumber ?? locker.number}` : ""}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Search Customer</Label>
            <Input placeholder="Name or email" value={search} onChange={(e) => setSearch(e.target.value)} />
            <div className="max-h-40 overflow-y-auto rounded-md border">
              {customers.slice(0, 20).map((c: any) => (
                <button
                  key={c.id} type="button"
                  onClick={() => setCustomerId(c.id)}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-muted ${customerId === c.id ? "bg-muted" : ""}`}
                >
                  <div className="font-medium">{c.name || c.legal_name || "—"}</div>
                  <div className="text-xs text-muted-foreground">{c.email}</div>
                </button>
              ))}
              {customers.length === 0 && <div className="px-3 py-2 text-xs text-muted-foreground">No customers</div>}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Start Date (optional)</Label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={assign.isPending}>
            {assign.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Assign
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function fmtDateOrDash(d?: string) {
  return d ? fmtDateSG(d) : "—";
}

export default function LockersTab() {
  const { toast } = useToast();
  const { data: lockers = [] } = useLockerUnits();
  const { data: rentals = [] } = useLockerRentals();
  const renew = useRenewLocker();
  const cancel = useCancelLocker();
  const regenPin = useRegeneratePinLocker();
  const seedPins = useSeedLockerPins();
  const [addOpen, setAddOpen] = useState(false);
  const [assignFor, setAssignFor] = useState<LockerUnit | null>(null);
  const [cancelTargetId, setCancelTargetId] = useState<string | null>(null);

  const doRenew = async (id: string) => {
    try { await renew.mutateAsync(id); toast({ title: "Renewed" }); }
    catch (e: any) { toast({ title: "Failed", description: e?.message, variant: "destructive" }); }
  };

  const doRegenPin = async (id: string, num: string | number) => {
    try {
      const res = await regenPin.mutateAsync(id);
      toast({ title: `New PIN for Locker #${num}: ${res.pin}` });
    }
    catch (e: any) { toast({ title: "Failed", description: e?.message, variant: "destructive" }); }
  };

  const doSeedPins = async () => {
    try {
      const res = await seedPins.mutateAsync();
      toast({ title: res.message ?? "PINs seeded" });
    }
    catch (e: any) { toast({ title: "Failed", description: e?.message, variant: "destructive" }); }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-base">Locker Units</CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={doSeedPins} disabled={seedPins.isPending}>
              {seedPins.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
              Seed Missing PINs
            </Button>
            <Button size="sm" onClick={() => setAddOpen(true)}><Plus className="h-4 w-4 mr-1" /> Add Locker</Button>
          </div>
        </CardHeader>
        <CardContent>
          {lockers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No lockers yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Number</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Monthly Price</TableHead>
                    <TableHead>PIN</TableHead>
                    <TableHead>Renter</TableHead>
                    <TableHead>Renewal</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lockers.map((l) => {
                    const anyL = l as any;
                    const rental = anyL.currentRentalId && typeof anyL.currentRentalId === "object" ? anyL.currentRentalId : null;
                    const rentalId = rental?._id ?? rental?.id ?? (typeof anyL.currentRentalId === "string" ? anyL.currentRentalId : l.rentalId);
                    const lockerNum = anyL.lockerNumber ?? l.number;
                    const renterUser = rental?.userId && typeof rental.userId === "object" ? rental.userId : null;
                    const renterName = renterUser?.name ?? renterUser?.legal_name ?? l.currentRenterName;
                    const renterEmail = renterUser?.email ?? l.currentRenterEmail;
                    const renewal = rental?.renewalDate ?? l.renewalDate;

                    const rentalActive = rental && !isCancelled(rental);
                    const isAvailable = !rentalActive && (l.status ?? "available") === "available";

                    return (
                      <TableRow key={l.id}>
                        <TableCell className="font-medium">#{lockerNum ?? "—"}</TableCell>
                        <TableCell>
                          <Badge variant={isAvailable ? "secondary" : "default"} className="capitalize">
                            {isAvailable ? "Available" : "Rented"}
                          </Badge>
                        </TableCell>
                        <TableCell>${l.monthlyPrice ?? 0}</TableCell>
                        <TableCell className="font-mono text-sm">{(anyL.pin) ? anyL.pin : <span className="text-muted-foreground text-xs">Not set</span>}</TableCell>
                        <TableCell>
                          {!isAvailable && renterName ? (
                            <>
                              <div className="font-medium">{renterName}</div>
                              {renterEmail && <div className="text-xs text-muted-foreground">{renterEmail}</div>}
                            </>
                          ) : "—"}
                        </TableCell>
                        <TableCell>{!isAvailable ? fmtDateOrDash(renewal) : "—"}</TableCell>
                        <TableCell className="text-right">
                          {isAvailable ? (
                            <div className="flex gap-1 justify-end">
                              <Button variant="ghost" size="sm" onClick={() => doRegenPin((anyL._id ?? l.id) as string, lockerNum)} title="Regenerate PIN">
                                <RefreshCw className="h-4 w-4" />
                              </Button>
                              <Button variant="outline" size="sm" onClick={() => setAssignFor(l)}>Assign</Button>
                            </div>
                          ) : (
                            <div className="flex gap-1 justify-end">
                              {rentalId && (
                                <>
                                  <Button variant="ghost" size="sm" onClick={() => doRenew(rentalId)}>
                                    <RotateCcw className="h-4 w-4" /> Renew
                                  </Button>
                                  <Button variant="ghost" size="sm" onClick={() => setCancelTargetId(rentalId)}>
                                    <XCircle className="h-4 w-4" /> Cancel
                                  </Button>
                                </>
                              )}
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>


      <Card>
        <CardHeader>
          <CardTitle className="text-base">Rental History</CardTitle>
        </CardHeader>
        <CardContent>
          {rentals.length === 0 ? (
            <p className="text-sm text-muted-foreground">No rentals yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Locker</TableHead>
                    <TableHead>Renter</TableHead>
                    <TableHead>Start</TableHead>
                    <TableHead>Renewal</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Cancelled</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rentals.map((r: any) => {
                    const id = r._id ?? r.id;
                    const cancelled = isCancelled(r);
                    const unit = r.lockerUnitId && typeof r.lockerUnitId === "object" ? r.lockerUnitId : null;
                    const lockerNum = unit?.lockerNumber ?? unit?.number ?? r.lockerNumber ?? "—";
                    const user = r.userId && typeof r.userId === "object" ? r.userId : null;
                    const renterName = user?.name ?? user?.legal_name ?? r.customerName ?? "—";
                    const renterEmail = user?.email ?? r.customerEmail ?? "";
                    const cancelledAt = r.cancelledAt ?? r.cancelled_at ?? r.updatedAt;
                    return (
                      <TableRow key={id} className={cancelled ? "text-muted-foreground" : ""}>
                        <TableCell className="font-medium">#{lockerNum}</TableCell>
                        <TableCell>
                          <div className="font-medium">{renterName}</div>
                          {renterEmail && <div className="text-xs text-muted-foreground">{renterEmail}</div>}
                        </TableCell>
                        <TableCell>{fmtDateOrDash(r.startDate)}</TableCell>
                        <TableCell>{fmtDateOrDash(r.renewalDate)}</TableCell>
                        <TableCell>
                          <Badge variant={cancelled ? "outline" : "default"} className="capitalize">
                            {cancelled ? "Cancelled" : "Active"}
                          </Badge>
                        </TableCell>
                        <TableCell>{cancelled ? fmtDateOrDash(cancelledAt) : "—"}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <AddLockerDialog open={addOpen} onOpenChange={setAddOpen} />
      <AssignLockerDialog open={!!assignFor} onOpenChange={(v) => !v && setAssignFor(null)} locker={assignFor} />

      <ReasonDialog
        open={!!cancelTargetId}
        onOpenChange={(o) => !o && setCancelTargetId(null)}
        title="Cancel Locker Rental"
        label="Reason for cancellation"
        placeholder="e.g. user requested early termination"
        confirmLabel="Cancel Rental"
        destructive
        loading={cancel.isPending}
        onConfirm={async (reason) => {
          if (!cancelTargetId) return;
          try {
            await cancel.mutateAsync({ rentalId: cancelTargetId, reason });
            toast({ title: "Cancelled" });
            setCancelTargetId(null);
          } catch (e: any) {
            toast({ title: "Failed", description: e?.message, variant: "destructive" });
          }
        }}
      />
    </div>
  );
}
