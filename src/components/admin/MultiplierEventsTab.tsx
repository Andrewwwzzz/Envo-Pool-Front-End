import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, ToggleLeft, ToggleRight, Zap, Trash2, Eye, EyeOff } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { fmtDateSG, fmtDateTimeSG } from "@/lib/sgTime";
import { isDeleted as checkDeleted } from "@/components/admin/DeletedBanner";

interface MultiplierEvent {
  _id: string;
  name: string;
  description: string;
  multiplier: number;
  startDate: string;
  endDate: string;
  isActive: boolean;
  isDeleted?: boolean;
  deletedAt?: string;
}

const EMPTY_FORM = {
  name: "",
  description: "",
  multiplier: "2",
  startDate: "",
  endDate: "",
};

function useAdminMultipliers(showDeleted: boolean) {
  return useQuery({
    queryKey: ["multipliers-admin", showDeleted],
    queryFn: async () => {
      const qs = showDeleted ? "?showDeleted=true" : "";
      const res = await apiFetch(`/api/rewards/multipliers/admin${qs}`);
      if (!res.ok) throw new Error("Failed to load events");
      const data = await res.json();
      return (Array.isArray(data) ? data : []) as MultiplierEvent[];
    },
  });
}

export function MultiplierEventsTab() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [showDeleted, setShowDeleted] = useState(false);
  const { data: events = [] } = useAdminMultipliers(showDeleted);
  const [dialog, setDialog] = useState<"create" | "edit" | null>(null);
  const [selected, setSelected] = useState<MultiplierEvent | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: async (payload: any) => {
      const url = selected ? `/api/rewards/multipliers/${selected._id}` : "/api/rewards/multipliers";
      const method = selected ? "PUT" : "POST";
      const res = await apiFetch(url, { method, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      return data;
    },
    onSuccess: () => {
      toast({ title: selected ? "Event updated" : "Event created" });
      qc.invalidateQueries({ queryKey: ["multipliers-admin"] });
      qc.invalidateQueries({ queryKey: ["multiplier-events"] });
      setDialog(null);
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const toggle = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiFetch(`/api/rewards/multipliers/${id}/toggle`, { method: "PATCH" });
      if (!res.ok) throw new Error("Failed to toggle");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Event updated" });
      qc.invalidateQueries({ queryKey: ["multipliers-admin"] });
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiFetch(`/api/rewards/multipliers/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Event deleted" });
      qc.invalidateQueries({ queryKey: ["multipliers-admin"] });
      qc.invalidateQueries({ queryKey: ["multiplier-events"] });
      setConfirmDeleteId(null);
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const openCreate = () => {
    setSelected(null);
    setForm(EMPTY_FORM);
    setDialog("create");
  };

  const openEdit = (event: MultiplierEvent) => {
    setSelected(event);
    setForm({
      name: event.name,
      description: event.description || "",
      multiplier: String(event.multiplier),
      startDate: event.startDate ? event.startDate.slice(0, 16) : "",
      endDate: event.endDate ? event.endDate.slice(0, 16) : "",
    });
    setDialog("edit");
  };

  const isLive = (event: MultiplierEvent) => {
    const now = new Date();
    return event.isActive && new Date(event.startDate) <= now && new Date(event.endDate) >= now;
  };

  const activeCount = events.filter(e => !checkDeleted(e)).length;
  const deletedCount = events.filter(e => checkDeleted(e)).length;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <p className="text-sm text-muted-foreground">
          {activeCount} event{activeCount !== 1 ? "s" : ""}
          {deletedCount > 0 && <span className="text-destructive/70 ml-2">· {deletedCount} deleted</span>}
        </p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setShowDeleted(v => !v)}>
            {showDeleted ? <EyeOff className="h-4 w-4 mr-1" /> : <Eye className="h-4 w-4 mr-1" />}
            {showDeleted ? "Hide Deleted" : "Show Deleted"}
          </Button>
          <Button size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1" /> Create Event
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        {events.map((event) => {
          const deleted = checkDeleted(event);
          return (
            <Card key={event._id} className={`border-border/50 ${deleted ? "opacity-60 border-destructive/30" : !event.isActive ? "opacity-60" : ""}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Zap className="h-4 w-4 text-accent" />
                      <p className="font-semibold text-foreground">{event.name}</p>
                      <Badge className="bg-accent/20 text-accent text-xs">{event.multiplier}x Points</Badge>
                      {!deleted && isLive(event) && <Badge className="bg-green-500/20 text-green-400 text-xs">🔴 Live</Badge>}
                      {!deleted && !event.isActive && <Badge variant="outline" className="text-xs text-muted-foreground">Inactive</Badge>}
                      {deleted && <Badge variant="destructive" className="text-xs">Deleted</Badge>}
                    </div>
                    {event.description && <p className="text-xs text-muted-foreground mt-1">{event.description}</p>}
                    <p className="text-xs text-muted-foreground mt-1">
                      {fmtDateSG(event.startDate)} → {fmtDateSG(event.endDate)}
                    </p>
                    {deleted && event.deletedAt && (
                      <p className="text-xs text-destructive/70 mt-1">Deleted {fmtDateTimeSG(event.deletedAt)}</p>
                    )}
                  </div>
                  {!deleted && (
                    <div className="flex gap-2 flex-shrink-0">
                      <Button size="sm" variant="ghost" onClick={() => toggle.mutate(event._id)}>
                        {event.isActive ? <ToggleRight className="h-4 w-4 text-green-400" /> : <ToggleLeft className="h-4 w-4 text-muted-foreground" />}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => openEdit(event)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => setConfirmDeleteId(event._id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
        {events.length === 0 && (
          <p className="text-center text-muted-foreground text-sm py-10">No multiplier events yet.</p>
        )}
      </div>

      {/* Confirm delete */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-background rounded-lg border p-6 max-w-sm w-full space-y-4 shadow-xl">
            <p className="font-semibold">Delete this event?</p>
            <p className="text-sm text-muted-foreground">It will be soft-deleted. You can view it with "Show Deleted".</p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setConfirmDeleteId(null)}>Cancel</Button>
              <Button variant="destructive" onClick={() => remove.mutate(confirmDeleteId)} disabled={remove.isPending}>
                {remove.isPending ? "Deleting…" : "Delete"}
              </Button>
            </div>
          </div>
        </div>
      )}

      <Dialog open={!!dialog} onOpenChange={() => setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selected ? "Edit Event" : "Create Multiplier Event"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Double Points Weekend" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Description (optional)</Label>
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Short description" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Multiplier (e.g. 2 = double points)</Label>
              <Input type="number" min="1" step="0.5" value={form.multiplier} onChange={(e) => setForm({ ...form, multiplier: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Start Date & Time</Label>
                <Input type="datetime-local" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">End Date & Time</Label>
                <Input type="datetime-local" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>Cancel</Button>
            <Button className="bg-accent text-accent-foreground hover:bg-accent/90" onClick={() => save.mutate({ ...form, multiplier: Number(form.multiplier) })} disabled={save.isPending}>
              {save.isPending ? "Saving..." : selected ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
