import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, RotateCcw, XCircle, Trash2, Loader2, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  useLockerUnits,
  useCreateLockerUnit,
  useAssignLocker,
  useRenewLocker,
  useCancelLocker,
  useDeleteLockerRental,
  type LockerUnit,
} from "@/hooks/useLockers";
import { useAdminCustomers } from "@/hooks/useAdmin";
import { fmtDateSG } from "@/lib/sgTime";
import ReasonDialog from "./ReasonDialog";
import DeletedBanner, { getDeletedInfo, isDeleted, isCancelled } from "./DeletedBanner";

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
  const { data: lockers = [] } = useLockerUnits(true);
  const renew = useRenewLocker();
  const cancel = useCancelLocker();
  const deleteRental = useDeleteLockerRental();
  const [addOpen, setAddOpen] = useState(false);
  const [assignFor, setAssignFor] = useState<LockerUnit | null>(null);
  const [cancelTargetId, setCancelTargetId] = useState<string | null>(null);
  const [deleteTargetRental, setDeleteTargetRental] = useState<{ rentalId: string; record: any } | null>(null);
  const [detailRecord, setDetailRecord] = useState<any | null>(null);
  const [showDeleted, setShowDeleted] = useState(false);

  const visibleLockers = useMemo(() => {
    return (lockers || []).filter((l: any) => {
      const rental = l.currentRentalId && typeof l.currentRentalId === "object" ? l.currentRentalId : null;
      const rentalDeleted = rental && isDeleted(rental);
      const lockerDeleted = isDeleted(l);
      const hasDeletedMarker = rentalDeleted || lockerDeleted;
      if (!showDeleted && hasDeletedMarker) return false;
      return true;
    });
  }, [lockers, showDeleted]);

  const doRenew = async (id: string) => {
    try { await renew.mutateAsync(id); toast({ title: "Renewed" }); }
    catch (e: any) { toast({ title: "Failed", description: e?.message, variant: "destructive" }); }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-base">Lockers</CardTitle>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={showDeleted ? "secondary" : "outline"}
              onClick={() => setShowDeleted((v) => !v)}
            >
              {showDeleted ? <EyeOff className="h-4 w-4 mr-1" /> : <Eye className="h-4 w-4 mr-1" />}
              {showDeleted ? "Hide Deleted" : "Show Deleted"}
            </Button>
            <Button size="sm" onClick={() => setAddOpen(true)}><Plus className="h-4 w-4" /> Add Locker</Button>
          </div>
        </CardHeader>
        <CardContent>
          {visibleLockers.length === 0 ? (
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
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleLockers.map((l) => {
                    const anyL = l as any;
                    const rental = anyL.currentRentalId && typeof anyL.currentRentalId === "object" ? anyL.currentRentalId : null;
                    const rentalId = rental?._id ?? rental?.id ?? (typeof anyL.currentRentalId === "string" ? anyL.currentRentalId : l.rentalId);
                    const lockerNum = anyL.lockerNumber ?? l.number;
                    const renterUser = rental?.userId && typeof rental.userId === "object" ? rental.userId : null;
                    const renterName = renterUser?.name ?? renterUser?.legal_name ?? l.currentRenterName;
                    const renterEmail = renterUser?.email ?? l.currentRenterEmail;
                    const renewal = rental?.renewalDate ?? l.renewalDate;
                    const renewalText = renewal
                      ? new Date(renewal).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Singapore" })
                      : "—";

                    const rentalDeleted = rental && isDeleted(rental);
                    const rentalCancelled = rental && !rentalDeleted && isCancelled(rental);
                    const isAvailable = !rentalDeleted && (l.status ?? "available") === "available" && !rentalId;

                    const rowCls = rentalDeleted
                      ? "text-muted-foreground cursor-pointer"
                      : "";
                    return (
                      <TableRow
                        key={l.id}
                        className={rowCls}
                        onClick={rentalDeleted ? () => setDetailRecord({ ...l, rental }) : undefined}
                      >
                        <TableCell className="font-medium">#{lockerNum ?? "—"}</TableCell>
                        <TableCell>
                          {rentalDeleted ? (
                            <Badge variant="outline" className="bg-muted">Deleted</Badge>
                          ) : (
                            <Badge variant={isAvailable ? "secondary" : "default"} className="capitalize">
                              {rentalCancelled ? "cancelled" : (l.status || (isAvailable ? "available" : "rented"))}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className={rentalDeleted ? "line-through" : ""}>${l.monthlyPrice ?? 0}</TableCell>
                        <TableCell>
                          {renterName ? (
                            <>
                              <div className="font-medium">{renterName}</div>
                              {renterEmail && <div className="text-xs text-muted-foreground">{renterEmail}</div>}
                            </>
                          ) : "—"}
                        </TableCell>
                        <TableCell>{renewalText}</TableCell>
                        <TableCell className="text-right">
                          {rentalDeleted ? null : isAvailable ? (
                            <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); setAssignFor(l); }}>Assign</Button>
                          ) : (
                            <div className="flex gap-1 justify-end">
                              {rentalId && !rentalCancelled && (
                                <>
                                  <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); doRenew(rentalId); }}>
                                    <RotateCcw className="h-4 w-4" /> Renew
                                  </Button>
                                  <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setCancelTargetId(rentalId); }}>
                                    <XCircle className="h-4 w-4" /> Cancel
                                  </Button>
                                </>
                              )}
                              {rentalId && rentalCancelled && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-destructive hover:text-destructive"
                                  onClick={(e) => { e.stopPropagation(); setDeleteTargetRental({ rentalId, record: { ...l, rental } }); }}
                                >
                                  <Trash2 className="h-4 w-4" /> Delete
                                </Button>
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

      <ReasonDialog
        open={!!deleteTargetRental}
        onOpenChange={(o) => !o && setDeleteTargetRental(null)}
        title="Delete Locker Rental Record?"
        description="This will permanently remove the rental record."
        label="Reason for deletion"
        placeholder="e.g. created in error"
        confirmLabel="Delete"
        destructive
        loading={deleteRental.isPending}
        onConfirm={async (reason) => {
          if (!deleteTargetRental) return;
          try {
            await deleteRental.mutateAsync({ rentalId: deleteTargetRental.rentalId, reason });
            toast({ title: "Rental deleted" });
            setDeleteTargetRental(null);
          } catch (e: any) {
            toast({ title: "Failed", description: e?.message, variant: "destructive" });
          }
        }}
      />

      <Dialog open={!!detailRecord} onOpenChange={(o) => !o && setDetailRecord(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Locker Rental Details</DialogTitle>
          </DialogHeader>
          {detailRecord && (
            <div className="space-y-3">
              <DeletedBanner info={getDeletedInfo(detailRecord.rental || detailRecord)} />
              <div className="opacity-70 text-sm space-y-1.5">
                <div className="flex justify-between"><span className="text-muted-foreground">Locker</span><span>#{detailRecord.lockerNumber ?? detailRecord.number ?? "—"}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Monthly Price</span><span>${detailRecord.monthlyPrice ?? 0}</span></div>
                {detailRecord.rental && (
                  <>
                    <div className="flex justify-between"><span className="text-muted-foreground">Start</span><span>{detailRecord.rental.startDate ? fmtDateSG(detailRecord.rental.startDate) : "—"}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Renewal</span><span>{detailRecord.rental.renewalDate ? fmtDateSG(detailRecord.rental.renewalDate) : "—"}</span></div>
                  </>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
