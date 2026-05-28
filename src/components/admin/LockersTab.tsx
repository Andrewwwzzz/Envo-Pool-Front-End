import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, RotateCcw, XCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  useLockerUnits,
  useCreateLockerUnit,
  useAssignLocker,
  useRenewLocker,
  useCancelLocker,
  type LockerUnit,
} from "@/hooks/useLockers";
import { useAdminCustomers } from "@/hooks/useAdmin";
import { fmtDateSG } from "@/lib/sgTime";

function AddLockerDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { toast } = useToast();
  const [number, setNumber] = useState("");
  const [price, setPrice] = useState("0");
  const [notes, setNotes] = useState("");
  const create = useCreateLockerUnit();

  const submit = async () => {
    if (!number.trim()) { toast({ title: "Locker number required", variant: "destructive" }); return; }
    try {
      await create.mutateAsync({ number: number.trim(), monthlyPrice: Number(price) || 0, notes: notes || undefined });
      toast({ title: "Locker added" });
      onOpenChange(false); setNumber(""); setPrice("0"); setNotes("");
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
      await assign.mutateAsync({ lockerId: locker.id, customerId, startDate: startDate || undefined });
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

export default function LockersTab() {
  const { toast } = useToast();
  const { data: lockers = [] } = useLockerUnits();
  const renew = useRenewLocker();
  const cancel = useCancelLocker();
  const [addOpen, setAddOpen] = useState(false);
  const [assignFor, setAssignFor] = useState<LockerUnit | null>(null);

  const doRenew = async (id: string) => {
    try { await renew.mutateAsync(id); toast({ title: "Renewed" }); }
    catch (e: any) { toast({ title: "Failed", description: e?.message, variant: "destructive" }); }
  };
  const doCancel = async (id: string) => {
    if (!confirm("Cancel this rental?")) return;
    try { await cancel.mutateAsync(id); toast({ title: "Cancelled" }); }
    catch (e: any) { toast({ title: "Failed", description: e?.message, variant: "destructive" }); }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Lockers</CardTitle>
          <Button size="sm" onClick={() => setAddOpen(true)}><Plus className="h-4 w-4" /> Add Locker</Button>
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
                    <TableHead>Renter</TableHead>
                    <TableHead>Renewal</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lockers.map((l) => {
                    const anyL = l as any;
                    const rental = anyL.currentRentalId && typeof anyL.currentRentalId === "object" ? anyL.currentRentalId : null;
                    const rentalId = rental?._id ?? rental?.id ?? (typeof anyL.currentRentalId === "string" ? anyL.currentRentalId : l.rentalId);
                    const isAvailable = (l.status ?? "available") === "available" && !rentalId;
                    const lockerNum = anyL.lockerNumber ?? l.number;
                    const renterUser = rental?.userId && typeof rental.userId === "object" ? rental.userId : null;
                    const renterName = renterUser?.name ?? renterUser?.legal_name ?? l.currentRenterName;
                    const renterEmail = renterUser?.email ?? l.currentRenterEmail;
                    const renewal = rental?.renewalDate ?? l.renewalDate;
                    const renewalText = renewal
                      ? new Date(renewal).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Singapore" })
                      : "—";
                    return (
                      <TableRow key={l.id}>
                        <TableCell className="font-medium">#{lockerNum ?? "—"}</TableCell>
                        <TableCell>
                          <Badge variant={isAvailable ? "secondary" : "default"} className="capitalize">{l.status || (isAvailable ? "available" : "rented")}</Badge>
                        </TableCell>
                        <TableCell>${l.monthlyPrice ?? 0}</TableCell>
                        <TableCell>
                          {renterName ? (
                            <>
                              <div className="font-medium">{renterName}</div>
                              {renterEmail && <div className="text-xs text-muted-foreground">{renterEmail}</div>}
                            </>
                          ) : "—"}
                        </TableCell>
                        <TableCell>{renewalText}</TableCell>
                        <TableCell>
                          {isAvailable ? (
                            <Button variant="outline" size="sm" onClick={() => setAssignFor(l)}>Assign</Button>
                          ) : (
                            <div className="flex gap-1">
                              {rentalId && (
                                <>
                                  <Button variant="ghost" size="sm" onClick={() => doRenew(rentalId)}>
                                    <RotateCcw className="h-4 w-4" /> Renew
                                  </Button>
                                  <Button variant="ghost" size="sm" onClick={() => doCancel(rentalId)}>
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

      <AddLockerDialog open={addOpen} onOpenChange={setAddOpen} />
      <AssignLockerDialog open={!!assignFor} onOpenChange={(v) => !v && setAssignFor(null)} locker={assignFor} />
    </div>
  );
}
