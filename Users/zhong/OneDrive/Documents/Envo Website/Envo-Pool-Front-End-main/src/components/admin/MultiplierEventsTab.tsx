import { useState } from "react";
import {
  useAdminMultipliers, useCreateMultiplier, useUpdateMultiplier, useToggleMultiplier,
  MultiplierEvent, isMultiplierLive,
} from "@/hooks/usePoints";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Zap } from "lucide-react";
import { fmtDateSG } from "@/lib/sgTime";

const EMPTY: Partial<MultiplierEvent> = { name: "", multiplier: 2, startDate: "", endDate: "", isActive: true };

export default function MultiplierEventsTab() {
  const { data: events = [], isLoading } = useAdminMultipliers();
  const create = useCreateMultiplier();
  const update = useUpdateMultiplier();
  const toggle = useToggleMultiplier();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<MultiplierEvent | null>(null);
  const [form, setForm] = useState<Partial<MultiplierEvent>>(EMPTY);

  const openCreate = () => { setEditing(null); setForm(EMPTY); setOpen(true); };
  const openEdit = (e: MultiplierEvent) => {
    setEditing(e);
    setForm({
      ...e,
      startDate: e.startDate ? new Date(e.startDate).toISOString().slice(0, 16) : "",
      endDate: e.endDate ? new Date(e.endDate).toISOString().slice(0, 16) : "",
    });
    setOpen(true);
  };

  const save = async () => {
    const payload: Partial<MultiplierEvent> = {
      ...form,
      multiplier: Number(form.multiplier) || 1,
      startDate: form.startDate ? new Date(form.startDate).toISOString() : undefined,
      endDate: form.endDate ? new Date(form.endDate).toISOString() : undefined,
    };
    if (editing) await update.mutateAsync({ id: (editing._id || editing.id)!, ...payload });
    else await create.mutateAsync(payload);
    setOpen(false);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2"><Zap className="h-5 w-5 text-accent" /> Multiplier Events</CardTitle>
          <Button size="sm" onClick={openCreate}><Plus className="mr-1 h-3.5 w-3.5" /> Create Event</Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading && !events.length ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : !events.length ? (
          <p className="text-sm text-muted-foreground">No multiplier events yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="pb-2 pr-4">Name</th>
                  <th className="pb-2 pr-4">Multiplier</th>
                  <th className="pb-2 pr-4">Start</th>
                  <th className="pb-2 pr-4">End</th>
                  <th className="pb-2 pr-4">Status</th>
                  <th className="pb-2 pr-4">Active</th>
                  <th className="pb-2"></th>
                </tr>
              </thead>
              <tbody>
                {events.map((e) => {
                  const live = isMultiplierLive(e);
                  return (
                    <tr key={e._id || e.id} className="border-b border-border last:border-0">
                      <td className="py-2 pr-4 font-medium">{e.name}</td>
                      <td className="py-2 pr-4 font-mono text-amber-400">{e.multiplier}x</td>
                      <td className="py-2 pr-4 whitespace-nowrap">{fmtDateSG(e.startDate)}</td>
                      <td className="py-2 pr-4 whitespace-nowrap">{fmtDateSG(e.endDate)}</td>
                      <td className="py-2 pr-4">
                        {live ? <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/40">Live</Badge> : <Badge variant="outline">Scheduled</Badge>}
                      </td>
                      <td className="py-2 pr-4">
                        <Switch checked={e.isActive} onCheckedChange={() => toggle.mutate((e._id || e.id)!)} />
                      </td>
                      <td className="py-2 text-right">
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEdit(e)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Event" : "Create Multiplier Event"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={form.name || ""} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Double Points Weekend" />
            </div>
            <div className="space-y-2">
              <Label>Multiplier (e.g. 2 for 2x)</Label>
              <Input type="number" min="1" step="0.5" value={form.multiplier ?? ""} onChange={(e) => setForm(f => ({ ...f, multiplier: Number(e.target.value) }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Start</Label>
                <Input type="datetime-local" value={form.startDate || ""} onChange={(e) => setForm(f => ({ ...f, startDate: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>End</Label>
                <Input type="datetime-local" value={form.endDate || ""} onChange={(e) => setForm(f => ({ ...f, endDate: e.target.value }))} />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-md border border-border p-3">
              <Label>Active</Label>
              <Switch checked={!!form.isActive} onCheckedChange={(v) => setForm(f => ({ ...f, isActive: v }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={create.isPending || update.isPending || !form.name || !form.startDate || !form.endDate}>
              {editing ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
