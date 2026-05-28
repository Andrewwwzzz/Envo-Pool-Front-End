import { useState } from "react";
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
import { Pencil, Trash2, Plus, XCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  useMembershipPlans,
  useCreateMembershipPlan,
  useUpdateMembershipPlan,
  useDeleteMembershipPlan,
  useAdminSubscriptions,
  useAssignMembership,
  useCancelMembership,
  type MembershipPlan,
} from "@/hooks/useMembership";
import { useAvailableLockers } from "@/hooks/useLockers";
import { useAdminCustomers } from "@/hooks/useAdmin";
import { fmtDateSG } from "@/lib/sgTime";

type PlanForm = {
  name: string;
  description: string;
  price: string;
  billingCycle: "monthly" | "annual";
  bookingDiscountPct: string;
  freeMinutesPerVisit: string;
  freeDrinkPerVisit: boolean;
  lockerIncluded: boolean;
  guestPassesPerMonth: string;
  sortOrder: string;
};

const emptyForm: PlanForm = {
  name: "",
  description: "",
  price: "0",
  billingCycle: "monthly",
  bookingDiscountPct: "0",
  freeMinutesPerVisit: "0",
  freeDrinkPerVisit: false,
  lockerIncluded: false,
  guestPassesPerMonth: "0",
  sortOrder: "0",
};

function toPayload(f: PlanForm): Partial<MembershipPlan> {
  return {
    name: f.name.trim(),
    description: f.description.trim(),
    price: Number(f.price) || 0,
    billingCycle: f.billingCycle,
    bookingDiscountPct: Number(f.bookingDiscountPct) || 0,
    freeMinutesPerVisit: Number(f.freeMinutesPerVisit) || 0,
    freeDrinkPerVisit: f.freeDrinkPerVisit,
    lockerIncluded: f.lockerIncluded,
    guestPassesPerMonth: Number(f.guestPassesPerMonth) || 0,
    sortOrder: Number(f.sortOrder) || 0,
  };
}

function fromPlan(p: MembershipPlan): PlanForm {
  return {
    name: p.name ?? "",
    description: p.description ?? "",
    price: String(p.price ?? 0),
    billingCycle: (p.billingCycle as any) ?? "monthly",
    bookingDiscountPct: String(p.bookingDiscountPct ?? 0),
    freeMinutesPerVisit: String(p.freeMinutesPerVisit ?? 0),
    freeDrinkPerVisit: !!p.freeDrinkPerVisit,
    lockerIncluded: !!p.lockerIncluded,
    guestPassesPerMonth: String(p.guestPassesPerMonth ?? 0),
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
              <div className="space-y-1.5">
                <Label className="text-xs">Guest Passes Per Month</Label>
                <Input type="number" min="0" value={form.guestPassesPerMonth} onChange={(e) => setForm({ ...form, guestPassesPerMonth: e.target.value })} />
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
  const [customerId, setCustomerId] = useState("");
  const [planId, setPlanId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [lockerId, setLockerId] = useState("");
  const { data: plans = [] } = useMembershipPlans();
  const { data: lockers = [] } = useAvailableLockers();
  const assign = useAssignMembership();

  const submit = async () => {
    if (!customerId || !planId) {
      toast({ title: "Customer and plan are required", variant: "destructive" });
      return;
    }
    try {
      await assign.mutateAsync({
        customerId,
        planId,
        startDate: startDate || undefined,
        lockerId: lockerId || undefined,
      });
      toast({ title: "Membership assigned" });
      onOpenChange(false);
      setCustomerId(""); setPlanId(""); setStartDate(""); setLockerId(""); setSearch("");
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
              {customers.slice(0, 20).map((c: any) => (
                <button
                  key={c.id}
                  type="button"
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
            <Label>Plan</Label>
            <Select value={planId} onValueChange={setPlanId}>
              <SelectTrigger><SelectValue placeholder="Select plan" /></SelectTrigger>
              <SelectContent>
                {plans.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name} — ${p.price}/{p.billingCycle}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Start Date (optional)</Label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Assign Locker (optional)</Label>
            <Select value={lockerId || "none"} onValueChange={(v) => setLockerId(v === "none" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {lockers.map((l) => (
                  <SelectItem key={l.id} value={l.id}>#{l.number} — ${l.monthlyPrice}/mo</SelectItem>
                ))}
              </SelectContent>
            </Select>
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

export default function MembershipTab() {
  const { toast } = useToast();
  const { data: plans = [] } = useMembershipPlans();
  const { data: subs = [] } = useAdminSubscriptions();
  const del = useDeleteMembershipPlan();
  const cancel = useCancelMembership();
  const [planDlgOpen, setPlanDlgOpen] = useState(false);
  const [editPlan, setEditPlan] = useState<MembershipPlan | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);

  const openCreate = () => { setEditPlan(null); setPlanDlgOpen(true); };
  const openEdit = (p: MembershipPlan) => {
    const id = (p as any).id ?? (p as any)._id;
    if (!id) { toast({ title: "Plan ID missing", variant: "destructive" }); return; }
    setEditPlan({ ...p, id });
    setPlanDlgOpen(true);
  };

  const removePlan = async (p: MembershipPlan) => {
    const id = (p as any).id ?? (p as any)._id;
    if (!id) { toast({ title: "Plan ID missing", variant: "destructive" }); return; }
    if (!confirm(`Delete plan "${p.name}"?`)) return;
    try { await del.mutateAsync(id); toast({ title: "Plan deleted" }); }
    catch (e: any) { toast({ title: "Failed", description: e?.message, variant: "destructive" }); }
  };

  const cancelSub = async (s: any) => {
    if (!confirm("Cancel this subscription?")) return;
    try { await cancel.mutateAsync(s.id); toast({ title: "Subscription cancelled" }); }
    catch (e: any) { toast({ title: "Failed", description: e?.message, variant: "destructive" }); }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Membership Plans</CardTitle>
          <Button size="sm" onClick={openCreate}><Plus className="h-4 w-4" /> Create Plan</Button>
        </CardHeader>
        <CardContent>
          {plans.length === 0 ? (
            <p className="text-sm text-muted-foreground">No plans yet.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {plans.map((p) => (
                <div key={p.id} className="rounded-md border p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-medium">{p.name}</div>
                      <div className="text-sm text-muted-foreground">${p.price} / {p.billingCycle}</div>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => removePlan(p)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </div>
                  {p.description && <p className="text-xs text-muted-foreground">{p.description}</p>}
                  <div className="flex flex-wrap gap-1">
                    {!!p.bookingDiscountPct && <Badge variant="secondary">{p.bookingDiscountPct}% off</Badge>}
                    {!!p.freeMinutesPerVisit && <Badge variant="secondary">{p.freeMinutesPerVisit}m free/visit</Badge>}
                    {p.freeDrinkPerVisit && <Badge variant="secondary">Free drink</Badge>}
                    {p.lockerIncluded && <Badge variant="secondary">Locker</Badge>}
                    {!!p.guestPassesPerMonth && <Badge variant="secondary">{p.guestPassesPerMonth} guest/mo</Badge>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Active Subscriptions</CardTitle>
          <Button size="sm" onClick={() => setAssignOpen(true)}><Plus className="h-4 w-4" /> Assign Membership</Button>
        </CardHeader>
        <CardContent>
          {subs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active subscriptions.</p>
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
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subs.map((s: any) => (
                    <TableRow key={s.id}>
                      <TableCell>
                        <div className="font-medium">{s.customerName || "—"}</div>
                        <div className="text-xs text-muted-foreground">{s.customerEmail}</div>
                      </TableCell>
                      <TableCell>{s.planName || "—"}</TableCell>
                      <TableCell>${s.price ?? 0}</TableCell>
                      <TableCell>{s.startDate ? fmtDateSG(s.startDate) : "—"}</TableCell>
                      <TableCell>{s.renewalDate ? fmtDateSG(s.renewalDate) : "—"}</TableCell>
                      <TableCell>
                        <Badge variant={s.status === "active" ? "default" : "secondary"} className="capitalize">{s.status || "—"}</Badge>
                      </TableCell>
                      <TableCell>{s.lockerNumber ? `#${s.lockerNumber}` : "—"}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => cancelSub(s)}>
                          <XCircle className="h-4 w-4" /> Cancel
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
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
    </div>
  );
}
