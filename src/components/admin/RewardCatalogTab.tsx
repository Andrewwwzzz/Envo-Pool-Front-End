import { useState } from "react";
import {
  useAdminRewardCatalog, useCreateCatalogItem, useUpdateCatalogItem,
  useToggleCatalogItem, useDeleteCatalogItem,
  CatalogItem, CatalogCategory, CatalogType, CATEGORY_LABELS, CATEGORY_BADGE,
} from "@/hooks/usePoints";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Package } from "lucide-react";

const EMPTY: Partial<CatalogItem> = {
  name: "", description: "", category: "food_drinks", type: "points_exchange",
  tangible: true, isActive: true, pointCost: 100, milestoneThreshold: null,
  expiryDays: null, discountValue: null, creditValue: null,
};

export default function RewardCatalogTab() {
  const { data: items = [], isLoading } = useAdminRewardCatalog();
  const create = useCreateCatalogItem();
  const update = useUpdateCatalogItem();
  const toggle = useToggleCatalogItem();
  const del = useDeleteCatalogItem();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CatalogItem | null>(null);
  const [form, setForm] = useState<Partial<CatalogItem>>(EMPTY);

  const openCreate = () => { setEditing(null); setForm(EMPTY); setOpen(true); };
  const openEdit = (i: CatalogItem) => { setEditing(i); setForm({ ...i }); setOpen(true); };

  const save = async () => {
    const payload: Partial<CatalogItem> = {
      ...form,
      milestoneThreshold: form.type === "milestone" ? Number(form.milestoneThreshold) || 0 : null,
      pointCost: form.type === "points_exchange" ? Number(form.pointCost) || 0 : null,
      expiryDays: form.expiryDays != null && form.expiryDays !== ("" as any) ? Number(form.expiryDays) : null,
      discountValue: form.category === "booking_discount" ? Number(form.discountValue) || 0 : null,
      creditValue: form.category === "store_credit" ? Number(form.creditValue) || 0 : null,
    };
    if (editing) await update.mutateAsync({ id: (editing._id || editing.id)!, ...payload });
    else await create.mutateAsync(payload);
    setOpen(false);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2"><Package className="h-5 w-5 text-accent" /> Reward Catalog</CardTitle>
          <Button size="sm" onClick={openCreate}><Plus className="mr-1 h-3.5 w-3.5" /> Create Reward</Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading && !items.length ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : !items.length ? (
          <p className="text-sm text-muted-foreground">No catalog items yet. Create your first reward.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="pb-2 pr-4">Name</th>
                  <th className="pb-2 pr-4">Category</th>
                  <th className="pb-2 pr-4">Type</th>
                  <th className="pb-2 pr-4">Cost / Threshold</th>
                  <th className="pb-2 pr-4">Tangible</th>
                  <th className="pb-2 pr-4">Active</th>
                  <th className="pb-2"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((i) => (
                  <tr key={i._id || i.id} className="border-b border-border last:border-0">
                    <td className="py-2 pr-4">
                      <div className="font-medium">{i.name}</div>
                      <div className="text-xs text-muted-foreground line-clamp-1">{i.description}</div>
                    </td>
                    <td className="py-2 pr-4">
                      <Badge variant="outline" className={CATEGORY_BADGE[i.category]}>{CATEGORY_LABELS[i.category]}</Badge>
                    </td>
                    <td className="py-2 pr-4 capitalize">{i.type === "milestone" ? "Milestone" : "Points Exchange"}</td>
                    <td className="py-2 pr-4 font-mono text-amber-400">
                      {i.type === "milestone" ? `${i.milestoneThreshold} lifetime` : `${i.pointCost} pts`}
                    </td>
                    <td className="py-2 pr-4">{i.tangible ? "Yes" : "No"}</td>
                    <td className="py-2 pr-4">
                      <Switch checked={i.isActive} onCheckedChange={() => toggle.toggle(i)} />
                    </td>
                    <td className="py-2 text-right whitespace-nowrap">
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEdit(i)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm" variant="ghost"
                        className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                        onClick={() => { if (confirm(`Delete "${i.name}"?`)) del.mutate((i._id || i.id)!); }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Reward" : "Create Reward"}</DialogTitle>
            <DialogDescription>Catalog items power milestones and the points shop.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={form.name || ""} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea rows={2} value={form.description || ""} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={form.category} onValueChange={(v) => setForm(f => ({ ...f, category: v as CatalogCategory, tangible: v === "food_drinks" || v === "merchandise" }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(CATEGORY_LABELS) as CatalogCategory[]).map(k => (
                      <SelectItem key={k} value={k}>{CATEGORY_LABELS[k]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={form.type} onValueChange={(v) => setForm(f => ({ ...f, type: v as CatalogType }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="points_exchange">Points Exchange (shop)</SelectItem>
                    <SelectItem value="milestone">Milestone (claim once)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {form.type === "milestone" ? (
              <div className="space-y-2">
                <Label>Lifetime points required</Label>
                <Input type="number" min="0" value={form.milestoneThreshold ?? ""} onChange={(e) => setForm(f => ({ ...f, milestoneThreshold: Number(e.target.value) }))} />
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Point cost</Label>
                <Input type="number" min="0" value={form.pointCost ?? ""} onChange={(e) => setForm(f => ({ ...f, pointCost: Number(e.target.value) }))} />
              </div>
            )}
            {form.category === "booking_discount" && (
              <div className="space-y-2">
                <Label>Discount %</Label>
                <Input type="number" min="0" max="100" value={form.discountValue ?? ""} onChange={(e) => setForm(f => ({ ...f, discountValue: Number(e.target.value) }))} />
              </div>
            )}
            {form.category === "store_credit" && (
              <div className="space-y-2">
                <Label>Credit amount ($)</Label>
                <Input type="number" min="0" step="0.01" value={form.creditValue ?? ""} onChange={(e) => setForm(f => ({ ...f, creditValue: Number(e.target.value) }))} />
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Expiry (days after redemption)</Label>
                <Input type="number" min="0" placeholder="No expiry" value={form.expiryDays ?? ""} onChange={(e) => setForm(f => ({ ...f, expiryDays: e.target.value === "" ? null : Number(e.target.value) }))} />
              </div>
              <div className="space-y-2">
                <Label>Tangible (collect in person)</Label>
                <div className="h-10 flex items-center">
                  <Switch checked={!!form.tangible} onCheckedChange={(v) => setForm(f => ({ ...f, tangible: v }))} />
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between rounded-md border border-border p-3">
              <Label>Active</Label>
              <Switch checked={!!form.isActive} onCheckedChange={(v) => setForm(f => ({ ...f, isActive: v }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={create.isPending || update.isPending || !form.name}>
              {editing ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
