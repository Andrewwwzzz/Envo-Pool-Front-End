import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pencil, Trash2, Plus, Loader2, KeyRound, Eye, EyeOff, CalendarOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  useMembershipPlans,
  useCreateMembershipPlan,
  useUpdateMembershipPlan,
  useDeleteMembershipPlan,
  useToggleMembershipPlanActive,
  useAdminSubscriptions,
  useAssignMembership,
  useDeleteMembership,
  useAssignMembershipLocker,
  useUpdateLockerPin,
  type MembershipPlan,
} from "@/hooks/useMembership";
import { useAvailableLockers } from "@/hooks/useLockers";

import { useAdminCustomers } from "@/hooks/useAdmin";
import { fmtDateSG } from "@/lib/sgTime";
import ReasonDialog from "./ReasonDialog";
import DeletedBanner, { getDeletedInfo, isDeleted } from "./DeletedBanner";

type PlanForm = {
  name: string;
  description: string;
  price: string;
  billingCycle: "monthly" | "annual";
  bookingDiscountPct: string;
  freeMinutesPerVisit: string;
  freeMinutesDays: number[];
  freeMinutesExcludePH: boolean;
  freeDrinkPerVisit: boolean;
  lockerIncluded: boolean;
  sortOrder: string;
};

// Index = day of week (0=Sun..6=Sat), matches backend toSGT().dayOfWeek convention
const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const emptyForm: PlanForm = {
  name: "",
  description: "",
  price: "0",
  billingCycle: "monthly",
  bookingDiscountPct: "0",
  freeMinutesPerVisit: "0",
  freeMinutesDays: [],
  freeMinutesExcludePH: false,
  freeDrinkPerVisit: false,
  lockerIncluded: false,
  sortOrder: "0",
};

function toPayload(f: PlanForm): any {
  return {
    name: f.name.trim(),
    description: f.description.trim(),
    price: Number(f.price) || 0,
    billingCycle: f.billingCycle,
    sortOrder: Number(f.sortOrder) || 0,
    benefits: {
      bookingDiscount: Number(f.bookingDiscountPct) || 0,
      freeMinutesPerVisit: Number(f.freeMinutesPerVisit) || 0,
      freeMinutesDays: f.freeMinutesDays,
      freeMinutesExcludePH: Boolean(f.freeMinutesExcludePH),
      freeDrinkPerVisit: Boolean(f.freeDrinkPerVisit),
      lockerIncluded: Boolean(f.lockerIncluded),
    },
  };
}

function fromPlan(p: MembershipPlan): PlanForm {
  const b: any = (p as any).benefits ?? {};
  return {
    name: p.name ?? "",
    description: p.description ?? "",
    price: String(p.price ?? 0),
    billingCycle: (p.billingCycle as any) ?? "monthly",
    bookingDiscountPct: String(b.bookingDiscount ?? p.bookingDiscountPct ?? 0),
    freeMinutesPerVisit: String(b.freeMinutesPerVisit ?? p.freeMinutesPerVisit ?? 0),
    freeMinutesDays: Array.isArray(b.freeMinutesDays) ? b.freeMinutesDays : [],
    freeMinutesExcludePH: !!b.freeMinutesExcludePH,
    freeDrinkPerVisit: !!(b.freeDrinkPerVisit ?? p.freeDrinkPerVisit),
    lockerIncluded: !!(b.lockerIncluded ?? p.lockerIncluded),
    sortOrder: String(p.sortOrder ?? 0),
  };
}

function PlanFormDialog({
  open,
  onOpenChange,
  plan,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  plan?: MembershipPlan | null;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState<PlanForm>(plan ? fromPlan(plan) : emptyForm);
  const create = useCreateMembershipPlan();
  const update = useUpdateMembershipPlan();
  const saving = create.isPending || update.isPending;

  const submit = async () => {
    if (!form.name.trim()) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }
    try {
      if (plan) {
        await update.mutateAsync({ id: plan.id, data: toPayload(form) });
        toast({ title: "Plan updated" });
      } else {
        await create.mutateAsync(toPayload(form));
        toast({ title: "Plan created" });
      }
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Failed", description: e?.message, variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{plan ? "Edit Plan" : "Create Plan"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Price (SGD)</Label>
              <Input type="number" min="0" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Billing Cycle</Label>
              <Select value={form.billingCycle} onValueChange={(v: any) => setForm({ ...form, billingCycle: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="annual">Annual</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="rounded-md border p-3 space-y-3">
            <div className="text-sm font-medium">Benefits</div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Booking Discount %</Label>
                <Input type="number" min="0" max="100" value={form.bookingDiscountPct} onChange={(e) => setForm({ ...form, bookingDiscountPct: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Free Minutes Per Visit</Label>
                <Input type="number" min="0" value={form.freeMinutesPerVisit} onChange={(e) => setForm({ ...form, freeMinutesPerVisit: e.target.value })} />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label className="text-xs">Free Minutes Available On</Label>
                <div className="flex gap-1 flex-wrap">
                  {WEEKDAY_LABELS.map((label, idx) => {
                    const active = form.freeMinutesDays.includes(idx);
                    return (
                      <Button
                        key={idx}
                        type="button"
                        size="sm"
                        variant={active ? "default" : "outline"}
                        className={`h-8 px-2.5 text-xs ${active ? "bg-accent text-accent-foreground hover:bg-accent/90" : ""}`}
                        onClick={() => {
                          const next = active
                            ? form.freeMinutesDays.filter((d) => d !== idx)
                            : [...form.freeMinutesDays, idx];
                          setForm({ ...form, freeMinutesDays: next });
                        }}
                      >
                        {label}
                      </Button>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground">
                  {form.freeMinutesDays.length === 0 ? "No days selected — applies every day" : "Free minutes only apply on selected days"}
                </p>
              </div>
              <div className="col-span-2 flex items-center justify-between">
                <Label className="text-xs">Exclude Public Holidays &amp; PH Eve</Label>
                <Switch checked={form.freeMinutesExcludePH} onCheckedChange={(v) => setForm({ ...form, freeMinutesExcludePH: v })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Sort Order</Label>
                <Input type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: e.target.value })} />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">Free Drink/Snack Per Visit</Label>
              <Switch checked={form.freeDrinkPerVisit} onCheckedChange={(v) => setForm({ ...form, freeDrinkPerVisit: v })} />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">Locker Included</Label>
              <Switch checked={form.lockerIncluded} onCheckedChange={(v) => setForm({ ...form, lockerIncluded: v })} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {plan ? "Save" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AssignMembershipDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const { data: customers = [] } = useAdminCustomers(search);
  const [userId, setUserId] = useState("");
  const [planId, setPlanId] = useState("");
  const [startDate, setStartDate] = useState("");
  const { data: plans = [] } = useMembershipPlans();
  const assign = useAssignMembership();

  const submit = async () => {
    if (!userId || !planId) {
      toast({ title: "Customer and plan are required", variant: "destructive" });
      return;
    }
    console.log("[AssignMembership] submitting", { userId, planId, startDate });
    try {
      await assign.mutateAsync({
        userId,
        planId,
        startDate: startDate || undefined,
      } as any);
      toast({ title: "Membership assigned" });
      onOpenChange(false);
      setUserId(""); setPlanId(""); setStartDate(""); setSearch("");
    } catch (e: any) {
      toast({ title: "Failed", description: e?.message, variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Assign Membership</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Search Customer</Label>
            <Input placeholder="Name or email" value={search} onChange={(e) => setSearch(e.target.value)} />
            <div className="max-h-40 overflow-y-auto rounded-md border">
              {customers.slice(0, 20).map((c: any) => {
                const cid = c._id ?? c.id ?? c.user_id;
                const selected = userId && cid === userId;
                return (
                  <button
                    key={cid}
                    type="button"
                    onClick={() => {
                      console.log("[AssignMembership] selected customer", { cid, customer: c });
                      if (!cid) return;
                      setUserId(cid);
                    }}
                    className={`w-full text-left px-3 py-2 text-sm border-l-2 transition-colors ${
                      selected
                        ? "bg-primary/10 border-primary"
                        : "border-transparent hover:bg-muted"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-medium truncate">{c.name || c.legal_name || "—"}</div>
                        <div className="text-xs text-muted-foreground truncate">{c.email}</div>
                      </div>
                      {selected && <span className="text-xs font-medium text-primary shrink-0">Selected</span>}
                    </div>
                  </button>
                );
              })}
              {customers.length === 0 && <div className="px-3 py-2 text-xs text-muted-foreground">No customers</div>}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Plan</Label>
            <Select value={planId} onValueChange={setPlanId}>
              <SelectTrigger><SelectValue placeholder="Select plan" /></SelectTrigger>
              <SelectContent>
                {plans.map((p) => {
                  const pid = (p as any)._id ?? p.id;
                  return (
                    <SelectItem key={pid} value={pid}>{p.name} — ${p.price}/{p.billingCycle}</SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Start Date (optional)</Label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={assign.isPending}>
            {assign.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Assign
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LockerCell({ sub }: { sub: any }) {
  const { toast } = useToast();
  const [assignOpen, setAssignOpen] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);
  const [lockerUnitId, setLockerUnitId] = useState("");
  const [pin, setPin] = useState("");
  const { data: available = [] } = useAvailableLockers();
  const assignLocker = useAssignMembershipLocker();
  const updatePin = useUpdateLockerPin();

  const membershipId = sub._id ?? sub.id;
  const rental = typeof sub.lockerRentalId === "object" ? sub.lockerRentalId : null;
  const hasLocker = !!sub.lockerRentalId;
  const rentalId = rental?._id ?? rental?.id ?? (typeof sub.lockerRentalId === "string" ? sub.lockerRentalId : null);
  const lockerNumber =
    rental?.lockerUnitId?.lockerNumber ??
    rental?.lockerUnitId?.number ??
    rental?.lockerNumber ??
    sub.lockerNumber ??
    sub.locker?.lockerNumber ??
    sub.locker?.number;
  const currentPin = rental?.pin ?? sub.lockerPin ?? sub.pin ?? "";

  const submitAssign = async () => {
    if (!lockerUnitId) {
      toast({ title: "Select a locker", variant: "destructive" });
      return;
    }
    if (pin && !/^\d{4,6}$/.test(pin)) {
      toast({ title: "PIN must be 4-6 digits", variant: "destructive" });
      return;
    }
    try {
      await assignLocker.mutateAsync({ membershipId, lockerUnitId, pin: pin || undefined });
      toast({ title: "Locker assigned" });
      setAssignOpen(false);
      setLockerUnitId(""); setPin("");
    } catch (e: any) {
      toast({ title: "Failed", description: e?.message, variant: "destructive" });
    }
  };

  const submitPin = async () => {
    if (!rentalId) { toast({ title: "Rental ID missing", variant: "destructive" }); return; }
    if (!/^\d{4,6}$/.test(pin)) {
      toast({ title: "PIN must be 4-6 digits", variant: "destructive" });
      return;
    }
    try {
      await updatePin.mutateAsync({ rentalId, pin });
      toast({ title: "PIN updated" });
      setPinOpen(false);
      setPin("");
    } catch (e: any) {
      toast({ title: "Failed", description: e?.message, variant: "destructive" });
    }
  };

  if (!hasLocker) {
    return (
      <>
        <Button variant="outline" size="sm" onClick={() => setAssignOpen(true)}>
          <KeyRound className="h-3.5 w-3.5" /> Assign Locker
        </Button>
        <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Assign Locker</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Locker</Label>
                <Select value={lockerUnitId} onValueChange={setLockerUnitId}>
                  <SelectTrigger><SelectValue placeholder="Select an available locker" /></SelectTrigger>
                  <SelectContent>
                    {available.map((l) => {
                      const id = (l as any)._id ?? l.id;
                      const num = (l as any).lockerNumber ?? (l as any).number;
                      return <SelectItem key={id} value={id}>Locker #{num}</SelectItem>;
                    })}
                    {available.length === 0 && (
                      <div className="px-3 py-2 text-xs text-muted-foreground">No available lockers</div>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>PIN (optional, 4-6 digits)</Label>
                <Input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                  placeholder="e.g. 1234"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAssignOpen(false)}>Cancel</Button>
              <Button onClick={submitAssign} disabled={assignLocker.isPending}>
                {assignLocker.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Assign
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <>
      <div className="flex items-center gap-2 text-sm">
        <span className="font-medium">Locker #{lockerNumber ?? "—"}</span>
        {currentPin && <span className="text-xs text-muted-foreground">PIN: {currentPin}</span>}
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => { setPin(String(currentPin || "")); setPinOpen(true); }}
          title="Edit PIN"
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      </div>
      <Dialog open={pinOpen} onOpenChange={setPinOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Update Locker PIN</DialogTitle></DialogHeader>
          <div className="space-y-1.5">
            <Label>PIN (4-6 digits)</Label>
            <Input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPinOpen(false)}>Cancel</Button>
            <Button onClick={submitPin} disabled={updatePin.isPending}>
              {updatePin.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function MembershipTab() {
  const { toast } = useToast();
  const { data: plans = [] } = useMembershipPlans("all");
  const [hideDeleted, setHideDeleted] = useState(false);
  const { data: subs = [] } = useAdminSubscriptions(hideDeleted ? "default" : "all");
  const { data: customers = [] } = useAdminCustomers("");
  const del = useDeleteMembershipPlan();
  const toggleActive = useToggleMembershipPlanActive();
  const deleteSub = useDeleteMembership();
  const [planDlgOpen, setPlanDlgOpen] = useState(false);
  const [editPlan, setEditPlan] = useState<MembershipPlan | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [detailRecord, setDetailRecord] = useState<any | null>(null);
  const [deletePlanTarget, setDeletePlanTarget] = useState<MembershipPlan | null>(null);
  const [detailPlan, setDetailPlan] = useState<MembershipPlan | null>(null);
  const [hidePlanDeleted, setHidePlanDeleted] = useState(false);

  const visibleSubs = subs || [];
  const visiblePlans = hidePlanDeleted ? plans.filter((p: any) => !isDeleted(p)) : plans;

  const openCreate = () => { setEditPlan(null); setPlanDlgOpen(true); };
  const openEdit = (p: MembershipPlan) => {
    const id = (p as any).id ?? (p as any)._id;
    if (!id) { toast({ title: "Plan ID missing", variant: "destructive" }); return; }
    setEditPlan({ ...p, id });
    setPlanDlgOpen(true);
  };


  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-base">Membership Plans</CardTitle>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={hidePlanDeleted ? "outline" : "secondary"}
              onClick={() => setHidePlanDeleted((v) => !v)}
            >
              {hidePlanDeleted ? <EyeOff className="h-4 w-4 mr-1" /> : <Eye className="h-4 w-4 mr-1" />}
              {hidePlanDeleted ? "Show Deleted" : "Hide Deleted"}
            </Button>
            <Button size="sm" onClick={openCreate}><Plus className="h-4 w-4" /> Create Plan</Button>
          </div>
        </CardHeader>
        <CardContent>
          {visiblePlans.length === 0 ? (
            <p className="text-sm text-muted-foreground">No plans yet.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {visiblePlans.map((p) => {
                const planIsActive = (p as any).isActive !== false;
                const planId = (p as any).id ?? (p as any)._id;
                const planDeleted = isDeleted(p as any);
                return (
                <div key={p.id} className={`rounded-md border p-3 space-y-2 ${planDeleted ? "opacity-50" : !planIsActive ? "opacity-60" : ""}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`font-medium ${planDeleted ? "line-through text-muted-foreground" : ""}`}>{p.name}</span>
                        {planDeleted && <Badge variant="outline" className="text-xs text-destructive border-destructive/40">Deleted</Badge>}
                        {!planDeleted && !planIsActive && <Badge variant="outline" className="text-xs text-muted-foreground">Inactive</Badge>}
                      </div>
                      <div className="text-sm text-muted-foreground">${p.price} / {p.billingCycle}</div>
                    </div>
                    {!planDeleted && (
                      <div className="flex gap-1">
                        <Button
                          variant="ghost" size="icon"
                          title={planIsActive ? "Deactivate (hide from purchase)" : "Activate"}
                          onClick={() => toggleActive.mutate({ id: planId, activate: !planIsActive })}
                        >
                          {planIsActive ? <CalendarOff className="h-4 w-4 text-muted-foreground" /> : <Plus className="h-4 w-4 text-green-500" />}
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeletePlanTarget(p)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    )}
                  </div>
                  {p.description && <p className="text-xs text-muted-foreground whitespace-pre-line">{p.description}</p>}
                  <div className="flex flex-wrap gap-1">
                    {!!p.bookingDiscountPct && <Badge variant="secondary">{p.bookingDiscountPct}% off</Badge>}
                    {!!p.freeMinutesPerVisit && (
                      <Badge variant="secondary">
                        {p.freeMinutesPerVisit}m free/visit
                        {(() => {
                          const days: number[] = (p as any).benefits?.freeMinutesDays ?? (p as any).freeMinutesDays ?? [];
                          const excludePH = (p as any).benefits?.freeMinutesExcludePH ?? (p as any).freeMinutesExcludePH ?? false;
                          if (days.length === 0 && !excludePH) return "";
                          const dayLabels = days.length > 0 ? days.map((d) => WEEKDAY_LABELS[d]).join("/") : "all days";
                          return ` (${dayLabels}${excludePH ? ", excl. PH" : ""})`;
                        })()}
                      </Badge>
                    )}
                    {p.freeDrinkPerVisit && <Badge variant="secondary">Free drink</Badge>}
                    {p.lockerIncluded && <Badge variant="secondary">Locker</Badge>}
                    {!!p.guestPassesPerMonth && <Badge variant="secondary">{p.guestPassesPerMonth} guest/mo</Badge>}
                  </div>
                </div>
              ); })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-base">Subscriptions</CardTitle>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={hideDeleted ? "secondary" : "outline"}
              onClick={() => setHideDeleted((v) => !v)}
            >
              {hideDeleted ? <Eye className="h-4 w-4 mr-1" /> : <EyeOff className="h-4 w-4 mr-1" />}
              {hideDeleted ? "Show Deleted" : "Hide Deleted"}
            </Button>

            <Button size="sm" onClick={() => setAssignOpen(true)}><Plus className="h-4 w-4" /> Assign Membership</Button>
          </div>
        </CardHeader>
        <CardContent>
          {visibleSubs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No subscriptions.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Start</TableHead>
                    <TableHead>Renewal</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Locker</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleSubs.map((s: any) => {
                    const user = typeof s.userId === "object" && s.userId ? s.userId : null;
                    const plan = typeof s.planId === "object" && s.planId ? s.planId : null;
                    const customerName = user?.name || user?.legal_name || s.customerName || "—";
                    const customerEmail = user?.email || s.customerEmail || "";
                    const planName = plan?.name || s.planName || "—";
                    const price = s.pricePaid ?? plan?.price ?? s.price ?? 0;
                    const rowId = s._id ?? s.id;
                    const deleted = isDeleted(s);
                    return (
                      <TableRow
                        key={rowId}
                        className={deleted ? "text-muted-foreground cursor-pointer" : ""}
                        onClick={deleted ? () => setDetailRecord(s) : undefined}
                      >
                        <TableCell>
                          <div className="font-medium">{customerName}</div>
                          <div className="text-xs text-muted-foreground">{customerEmail}</div>
                        </TableCell>
                        <TableCell>{planName}</TableCell>
                        <TableCell className={deleted ? "line-through" : ""}>${price}</TableCell>
                        <TableCell>{s.startDate ? fmtDateSG(s.startDate) : "—"}</TableCell>
                        <TableCell>{s.renewalDate ? fmtDateSG(s.renewalDate) : "—"}</TableCell>
                        <TableCell>
                          {deleted ? (
                            <Badge variant="outline" className="bg-muted">Deleted</Badge>
                          ) : (
                            <Badge variant={s.status === "active" ? "default" : "secondary"} className="capitalize">{s.status || "—"}</Badge>
                          )}
                        </TableCell>
                        <TableCell>{!deleted ? <LockerCell sub={s} /> : "—"}</TableCell>
                        <TableCell className="text-right">
                          {!deleted && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              onClick={(e) => { e.stopPropagation(); setDeleteTarget(s); }}
                              title="Delete membership"
                            >
                              <Trash2 className="h-4 w-4" /> Delete
                            </Button>
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

      {planDlgOpen && (
        <PlanFormDialog
          open={planDlgOpen}
          onOpenChange={setPlanDlgOpen}
          plan={editPlan}
        />
      )}
      <AssignMembershipDialog open={assignOpen} onOpenChange={setAssignOpen} />

      <ReasonDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="Delete Membership Record?"
        description="This will permanently remove the record from active lists."
        label="Reason for deletion"
        placeholder="e.g. duplicate entry"
        confirmLabel="Delete"
        destructive
        loading={deleteSub.isPending}
        onConfirm={async (reason) => {
          if (!deleteTarget) return;
          try {
            await deleteSub.mutateAsync({ id: deleteTarget._id ?? deleteTarget.id, reason });
            toast({ title: "Membership deleted" });
            setDeleteTarget(null);
          } catch (e: any) {
            toast({ title: "Failed", description: e?.message, variant: "destructive" });
          }
        }}
      />

      <ReasonDialog
        open={!!deletePlanTarget}
        onOpenChange={(o) => !o && setDeletePlanTarget(null)}
        title="Delete Plan?"
        description="Plans with active members cannot be deleted. This will hide the plan from new sign-ups."
        label="Reason for deletion"
        placeholder="e.g. discontinued promotion"
        confirmLabel="Delete"
        destructive
        loading={del.isPending}
        onConfirm={async (reason) => {
          if (!deletePlanTarget) return;
          const id = (deletePlanTarget as any).id ?? (deletePlanTarget as any)._id;
          try {
            await del.mutateAsync({ id, reason });
            toast({ title: "Plan deleted" });
            setDeletePlanTarget(null);
          } catch (e: any) {
            toast({ title: "Failed to delete plan", description: e?.message, variant: "destructive" });
          }
        }}
      />


      <Dialog open={!!detailRecord} onOpenChange={(o) => !o && setDetailRecord(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Membership Details</DialogTitle>
          </DialogHeader>
          {detailRecord && (
            <div className="space-y-3">
              <DeletedBanner info={getDeletedInfo(detailRecord, customers)} />
              <div className="opacity-70 text-sm space-y-1.5">
                {(() => {
                  const user = typeof detailRecord.userId === "object" ? detailRecord.userId : null;
                  const plan = typeof detailRecord.planId === "object" ? detailRecord.planId : null;
                  return (
                    <>
                      <DetailRow label="Customer" value={`${user?.name || user?.legal_name || detailRecord.customerName || "—"} (${user?.email || detailRecord.customerEmail || "—"})`} />
                      <DetailRow label="Plan" value={plan?.name || detailRecord.planName || "—"} />
                      <DetailRow label="Price" value={`$${detailRecord.pricePaid ?? plan?.price ?? detailRecord.price ?? 0}`} />
                      <DetailRow label="Start" value={detailRecord.startDate ? fmtDateSG(detailRecord.startDate) : "—"} />
                      <DetailRow label="Renewal" value={detailRecord.renewalDate ? fmtDateSG(detailRecord.renewalDate) : "—"} />
                    </>
                  );
                })()}
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

