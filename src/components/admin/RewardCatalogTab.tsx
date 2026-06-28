import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, ToggleLeft, ToggleRight } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

interface CatalogItem {
  _id: string;
  name: string;
  description: string;
  category: string;
  rewardType: string;
  type: "milestone" | "points_exchange";
  milestoneThreshold: number | null;
  pointCost: number | null;
  tangible: boolean;
  expiryDays: number | null;
  discountValue: number | null;
  creditValue: number | null;
  isActive: boolean;
  sortOrder: number;
}

const CATEGORY_LABELS: Record<string, string> = {
  food_drinks: "Food & Drinks",
  store_credit: "Store Credit",
  booking_discount: "Booking Discount",
  merchandise: "Merchandise",
};

const CATEGORY_COLORS: Record<string, string> = {
  food_drinks: "bg-orange-500/20 text-orange-400",
  store_credit: "bg-blue-500/20 text-blue-400",
  booking_discount: "bg-green-500/20 text-green-400",
  merchandise: "bg-purple-500/20 text-purple-400",
};

const EMPTY_FORM = {
  name: "",
  description: "",
  category: "food_drinks",
  type: "points_exchange" as "milestone" | "points_exchange",
  milestoneThreshold: "",
  pointCost: "",
  tangible: true,
  expiryDays: "",
  discountValue: "",
  creditValue: "",
  sortOrder: "0",
};

function useAdminCatalog() {
  return useQuery({
    queryKey: ["reward-catalog-admin"],
    queryFn: async () => {
      const res = await apiFetch("/api/rewards/catalog/admin");
      if (!res.ok) throw new Error("Failed to load catalog");
      const data = await res.json();
      return (Array.isArray(data) ? data : []) as CatalogItem[];
    },
  });
}

export function RewardCatalogTab() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: items = [] } = useAdminCatalog();
  const [dialog, setDialog] = useState<"create" | "edit" | null>(null);
  const [selected, setSelected] = useState<CatalogItem | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const save = useMutation({
    mutationFn: async (payload: any) => {
      const url = selected ? `/api/rewards/catalog/${selected._id}` : "/api/rewards/catalog";
      const method = selected ? "PUT" : "POST";
      const res = await apiFetch(url, { method, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      return data;
    },
    onSuccess: () => {
      toast({ title: selected ? "Reward updated" : "Reward created" });
      qc.invalidateQueries({ queryKey: ["reward-catalog-admin"] });
      qc.invalidateQueries({ queryKey: ["reward-catalog"] });
      setDialog(null);
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const toggle = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const res = await apiFetch(`/api/rewards/catalog/${id}`, { method: "PUT", body: JSON.stringify({ isActive: !isActive }) });
      if (!res.ok) throw new Error("Failed to toggle");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Updated" });
      qc.invalidateQueries({ queryKey: ["reward-catalog-admin"] });
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiFetch(`/api/rewards/catalog/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Reward deleted" });
      qc.invalidateQueries({ queryKey: ["reward-catalog-admin"] });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const openCreate = () => {
    setSelected(null);
    setForm(EMPTY_FORM);
    setDialog("create");
  };

  const openEdit = (item: CatalogItem) => {
    setSelected(item);
    setForm({
      name: item.name,
      description: item.description || "",
      category: item.category,
      type: item.type,
      milestoneThreshold: item.milestoneThreshold != null ? String(item.milestoneThreshold) : "",
      pointCost: item.pointCost != null ? String(item.pointCost) : "",
      tangible: item.tangible,
      expiryDays: item.expiryDays != null ? String(item.expiryDays) : "",
      discountValue: item.discountValue != null ? String(item.discountValue) : "",
      creditValue: item.creditValue != null ? String(item.creditValue) : "",
      sortOrder: String(item.sortOrder || 0),
    });
    setDialog("edit");
  };

  const handleSave = () => {
    save.mutate({
      name: form.name,
      description: form.description,
      category: form.category,
      type: form.type,
      milestoneThreshold: form.milestoneThreshold ? Number(form.milestoneThreshold) : null,
      pointCost: form.pointCost ? Number(form.pointCost) : null,
      tangible: form.tangible,
      expiryDays: form.expiryDays ? Number(form.expiryDays) : null,
      discountValue: form.discountValue ? Number(form.discountValue) : null,
      creditValue: form.creditValue ? Number(form.creditValue) : null,
      sortOrder: Number(form.sortOrder),
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{items.length} catalog items</p>
        <Button size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90" onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1" /> Create Reward
        </Button>
      </div>

      <div className="space-y-2">
        {items.map((item) => (
          <Card key={item._id} className={`border-border/50 ${!item.isActive ? "opacity-60" : ""}`}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-foreground">{item.name}</p>
                    <Badge className={`text-xs ${CATEGORY_COLORS[item.category]}`}>{CATEGORY_LABELS[item.category]}</Badge>
                    <Badge variant="outline" className="text-xs">
                      {item.type === "milestone" ? "Milestone" : "Points Shop"}
                    </Badge>
                    {item.tangible && <Badge className="text-xs bg-amber-500/20 text-amber-400">Tangible</Badge>}
                    {!item.isActive && <Badge variant="outline" className="text-xs text-muted-foreground">Inactive</Badge>}
                  </div>
                  {item.description && <p className="text-xs text-muted-foreground mt-1">{item.description}</p>}
                  <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                    {item.type === "milestone" && <span>🏆 {item.milestoneThreshold} lifetime pts</span>}
                    {item.type === "points_exchange" && <span>💰 {item.pointCost} pts</span>}
                    {item.expiryDays && <span>Expires: {item.expiryDays}d</span>}
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <Button size="sm" variant="ghost" onClick={() => toggle.mutate({ id: item._id, isActive: item.isActive })}>
                    {item.isActive ? <ToggleRight className="h-4 w-4 text-green-400" /> : <ToggleLeft className="h-4 w-4 text-muted-foreground" />}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => openEdit(item)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => remove.mutate(item._id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {items.length === 0 && (
          <p className="text-center text-muted-foreground text-sm py-10">No rewards yet. Create your first one.</p>
        )}
      </div>

      {/* Create/Edit dialog */}
      <Dialog open={!!dialog} onOpenChange={() => setDialog(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selected ? "Edit Reward" : "Create Reward"}</DialogTitle>
            <p className="text-xs text-muted-foreground">Catalog items power milestones and the points shop.</p>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Free Drink" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Description</Label>
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Short description" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Category</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="food_drinks">Food & Drinks</SelectItem>
                    <SelectItem value="store_credit">Store Credit</SelectItem>
                    <SelectItem value="booking_discount">Booking Discount</SelectItem>
                    <SelectItem value="merchandise">Merchandise</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Type</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as any })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="milestone">Milestone (claim once)</SelectItem>
                    <SelectItem value="points_exchange">Points Shop (unlimited)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {form.type === "milestone" && (
              <div className="space-y-1.5">
                <Label className="text-xs">Lifetime points required</Label>
                <Input type="number" value={form.milestoneThreshold} onChange={(e) => setForm({ ...form, milestoneThreshold: e.target.value })} placeholder="e.g. 500" />
              </div>
            )}
            {form.type === "points_exchange" && (
              <div className="space-y-1.5">
                <Label className="text-xs">Points cost</Label>
                <Input type="number" value={form.pointCost} onChange={(e) => setForm({ ...form, pointCost: e.target.value })} placeholder="e.g. 200" />
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs">Expiry (days after redemption, leave blank = no expiry)</Label>
              <Input type="number" value={form.expiryDays} onChange={(e) => setForm({ ...form, expiryDays: e.target.value })} placeholder="e.g. 30" />
            </div>
            {form.category === "store_credit" && (
              <div className="space-y-1.5">
                <Label className="text-xs">Credit value ($)</Label>
                <Input type="number" value={form.creditValue} onChange={(e) => setForm({ ...form, creditValue: e.target.value })} placeholder="e.g. 5" />
              </div>
            )}
            {form.category === "booking_discount" && (
              <div className="space-y-1.5">
                <Label className="text-xs">Discount value (%)</Label>
                <Input type="number" value={form.discountValue} onChange={(e) => setForm({ ...form, discountValue: e.target.value })} placeholder="e.g. 10" />
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs">Sort order</Label>
              <Input type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: e.target.value })} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm">Tangible (collect in person)</Label>
                <p className="text-xs text-muted-foreground">Food, drinks, merchandise — staff marks redeemed</p>
              </div>
              <Switch checked={form.tangible} onCheckedChange={(v) => setForm({ ...form, tangible: v })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>Cancel</Button>
            <Button className="bg-accent text-accent-foreground hover:bg-accent/90" onClick={handleSave} disabled={save.isPending}>
              {save.isPending ? "Saving..." : selected ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
