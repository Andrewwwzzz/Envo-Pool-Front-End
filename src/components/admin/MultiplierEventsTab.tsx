import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, ToggleLeft, ToggleRight, Zap } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { fmtDateSG } from "@/lib/sgTime";

interface MultiplierEvent {
  _id: string;
  name: string;
  description: string;
  multiplier: number;
  startDate: string;
  endDate: string;
  isActive: boolean;
}

const EMPTY_FORM = {
  name: "",
  description: "",
  multiplier: "2",
  startDate: "",
  endDate: "",
};

function useAdminMultipliers() {
  return useQuery({
    queryKey: ["multipliers-admin"],
    queryFn: async () => {
      const res = await apiFetch("/api/rewards/multipliers/admin");
      if (!res.ok) throw new Error("Failed to load events");
      const data = await res.json();
      return (Array.isArray(data) ? data : []) as MultiplierEvent[];
    },
  });
}

export function MultiplierEventsTab() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: events = [] } = useAdminMultipliers();
  const [dialog, setDialog] = useState<"create" | "edit" | null>(null);
  const [selected, setSelected] = useState<MultiplierEvent | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

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

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{events.length} events</p>
        <Button size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90" onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1" /> Create Event
        </Button>
      </div>

      <div className="space-y-2">
        {events.map((event) => (
          <Card key={event._id} className={`border-border/50 ${!event.isActive ? "opacity-60" : ""}`}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Zap className="h-4 w-4 text-accent" />
                    <p className="font-semibold text-foreground">{event.name}</p>
                    <Badge className="bg-accent/20 text-accent text-xs">{event.multiplier}x Points</Badge>
                    {isLive(event) && <Badge className="bg-green-500/20 text-green-400 text-xs">🔴 Live</Badge>}
                    {!event.isActive && <Badge variant="outline" className="text-xs text-muted-foreground">Inactive</Badge>}
                  </div>
                  {event.description && <p className="text-xs text-muted-foreground mt-1">{event.description}</p>}
                  <p className="text-xs text-muted-foreground mt-1">
                    {fmtDateSG(event.startDate)} → {fmtDateSG(event.endDate)}
                  </p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <Button size="sm" variant="ghost" onClick={() => toggle.mutate(event._id)}>
                    {event.isActive ? <ToggleRight className="h-4 w-4 text-green-400" /> : <ToggleLeft className="h-4 w-4 text-muted-foreground" />}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => openEdit(event)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {events.length === 0 && (
          <p className="text-center text-muted-foreground text-sm py-10">No multiplier events yet.</p>
        )}
      </div>

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
