import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, RotateCcw, XCircle, Loader2, Trash2, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  useLockerUnits,
  useLockerRentals,
  useCreateLockerUnit,
  useAssignLocker,
  useRenewLocker,
  useCancelLocker,
  useDeleteLockerUnit,
  type LockerUnit,
} from "@/hooks/useLockers";
import { useAdminCustomers } from "@/hooks/useAdmin";
import { fmtDateSG } from "@/lib/sgTime";
import ReasonDialog from "./ReasonDialog";
import DeletedBanner, { isCancelled, isDeleted, getDeletedInfo } from "./DeletedBanner";

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

function fmtDateOrDash(d?: string) {
  return d ? fmtDateSG(d) : "—";
}

export default function LockersTab() {
  const { toast } = useToast();
  const [hideDeleted, setHideDeleted] = useState(false);
  const { data: lockers = [] } = useLockerUnits(hideDeleted ? "default" : "all");
  const { data: rentals = [] } = useLockerRentals();
  const renew = useRenewLocker();
  const cancel = useCancelLocker();
  const deleteUnit = useDeleteLockerUnit();
  const [addOpen, setAddOpen] = useState(false);
  const [assignFor, setAssignFor] = useState<LockerUnit | null>(null);
  const [cancelTargetId, setCancelTargetId] = useState<string | null>(null);
  const [deleteUnitTarget, setDeleteUnitTarget] = useState<LockerUnit | null>(null);
  const [detailRecord, setDetailRecord] = useState<any | null>(null);

  const doRenew = async (id: string) => {
    try { await renew.mutateAsync(id); toast({ title: "Renewed" }); }
    catch (e: any) { toast({ title: "Failed", description: e?.message, variant: "destructive" }); }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-base">Locker Units</CardTitle>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={hideDeleted ? "secondary" : "outline"}
              onClick={() => setHideDeleted((v) => !v)}
            >
              {hideDeleted ? <Eye className="h-4 w-4 mr-1" /> : <EyeOff className="h-4 w-4 mr-1" />}
              {hideDeleted ? "Show Deleted" : "Hide Deleted"}
            </Button>
            <Button size="sm" onClick={() => setAddOpen(true)}><Plus className="h-4 w-4" /> Add Locker</Button>
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
                    <TableHead>Renter</TableHead>
                    <TableHead>Renewal</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lockers.map((l) => {
                    const anyL = l as any;
                    const deleted = isDeleted(anyL);
                    const rental = anyL.currentRentalId && typeof anyL.currentRentalId === "object" ? anyL.currentRentalId : null;
                    const rentalId = rental?._id ?? rental?.id ?? (typeof anyL.currentRentalId === "string" ? anyL.currentRentalId : l.rentalId);
                    const lockerNum = anyL.lockerNumber ?? l.number;
                    const renterUser = rental?.userId && typeof rental.userId === "object" ? rental.userId : null;
                    const renterName = renterUser?.name ?? renterUser?.legal_name ?? l.currentRenterName;
                    const renterEmail = renterUser?.email ?? l.currentRenterEmail;
                    const renewal = rental?.renewalDate ?? l.renewalDate;

                    const rentalActive = rental && !isCancelled(rental);
                    const isAvailable = !deleted && !rentalActive && (l.status ?? "available") === "available";

                    return (
                      <TableRow
                        key={l.id}
                        className={deleted ? "text-muted-foreground cursor-pointer" : ""}
                        onClick={deleted ? () => setDetailRecord({ ...anyL, _kind: "locker", lockerNum }) : undefined}
                      >
                        <TableCell className={`font-medium ${deleted ? "line-through" : ""}`}>#{lockerNum ?? "—"}</TableCell>
                        <TableCell>
                          {deleted ? (
                            <Badge variant="outline" className="bg-muted whitespace-nowrap">Deleted</Badge>
                          ) : (
                            <Badge variant={isAvailable ? "secondary" : "default"} className="capitalize">
                              {isAvailable ? "Available" : "Rented"}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className={deleted ? "line-through" : ""}>${l.monthlyPrice ?? 0}</TableCell>
                        <TableCell>
                          {!deleted && !isAvailable && renterName ? (
                            <>
                              <div className="font-medium">{renterName}</div>
                              {renterEmail && <div className="text-xs text-muted-foreground">{renterEmail}</div>}
                            </>
                          ) : "—"}
                        </TableCell>
                        <TableCell>{!deleted && !isAvailable ? fmtDateOrDash(renewal) : "—"}</TableCell>
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          {deleted ? null : isAvailable ? (
                            <div className="flex gap-1 justify-end">
                              <Button variant="outline" size="sm" onClick={() => setAssignFor(l)}>Assign</Button>
                              <Button variant="ghost" size="sm" onClick={() => setDeleteUnitTarget(l)} title="Delete locker">
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
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

      <ReasonDialog
        open={!!deleteUnitTarget}
        onOpenChange={(o) => !o && setDeleteUnitTarget(null)}
        title={`Delete locker #${(deleteUnitTarget as any)?.lockerNumber ?? deleteUnitTarget?.number ?? ""}?`}
        label="Reason for deletion"
        placeholder="e.g. unit decommissioned"
        confirmLabel="Delete"
        destructive
        loading={deleteUnit.isPending}
        onConfirm={async (reason) => {
          if (!deleteUnitTarget) return;
          try {
            await deleteUnit.mutateAsync({ id: deleteUnitTarget.id, reason });
            toast({ title: "Locker deleted" });
            setDeleteUnitTarget(null);
          } catch (e: any) {
            toast({ title: "Failed", description: e?.message, variant: "destructive" });
          }
        }}
      />

      <Dialog open={!!detailRecord} onOpenChange={(o) => !o && setDetailRecord(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Locker #{detailRecord?.lockerNum ?? "—"}</DialogTitle>
          </DialogHeader>
          {detailRecord && (
            <div className="space-y-3">
              <DeletedBanner info={getDeletedInfo(detailRecord)} />
              <div className="opacity-70 text-sm space-y-1.5">
                <div className="flex justify-between gap-3"><span className="text-muted-foreground">Number</span><span>#{detailRecord.lockerNum ?? "—"}</span></div>
                <div className="flex justify-between gap-3"><span className="text-muted-foreground">Monthly Price</span><span>${detailRecord.monthlyPrice ?? 0}</span></div>
                {detailRecord.notes && <div className="flex justify-between gap-3"><span className="text-muted-foreground">Notes</span><span>{detailRecord.notes}</span></div>}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
