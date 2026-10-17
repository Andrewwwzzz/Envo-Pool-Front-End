import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowRightLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAdminTables } from "@/hooks/useAdmin";
import { apiFetch } from "@/lib/api";
import { fmtTimeSG } from "@/lib/sgTime";

export function useMoveTable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ fromTableId, toTableId }: { fromTableId: string; toTableId: string }) => {
      const res = await apiFetch(`/api/admin/tables/${fromTableId}/move-timer`, { method: "POST", body: JSON.stringify({ tableId: toTableId }) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Couldn't move the table");
      return body as { message: string; fnbOrdersMoved: number };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-tables"] });
      qc.invalidateQueries({ queryKey: ["tables-with-status"] });
      // F&B charged to the table now belongs to the new table.
      qc.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).startsWith("fnb") });
    },
  });
}

/**
 * Moves a running (pro-rate) table to another table — the timer keeps going
 * from the same start time with the same rate, and F&B charged to the table
 * moves with it, so the new table's Close Table bills the whole session.
 * `unavailable` maps table id → why it can't take the session right now.
 */
export function MoveTableDialog({ table, unavailable, onOpenChange }: {
  table: { id: string; table_number: number; timer_started_at: string | null } | null;
  unavailable: Record<string, string>;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const { data: tables = [] } = useAdminTables();
  const move = useMoveTable();
  const [target, setTarget] = useState<string>("");

  const close = (open: boolean) => { if (!open) setTarget(""); onOpenChange(open); };
  const confirm = () => {
    if (!table || !target) return;
    move.mutate({ fromTableId: table.id, toTableId: target }, {
      onSuccess: (r) => {
        toast({
          title: r.message || "Table moved",
          description: r.fnbOrdersMoved > 0 ? `${r.fnbOrdersMoved} F&B order${r.fnbOrdersMoved === 1 ? "" : "s"} charged to the table moved too.` : undefined,
        });
        close(false);
      },
      onError: (e: Error) => toast({ title: "Couldn't move table", description: e.message, variant: "destructive" }),
    });
  };

  return (
    <Dialog open={!!table} onOpenChange={close}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ArrowRightLeft className="h-5 w-5 text-primary" /> Move Table</DialogTitle>
          <DialogDescription>
            {table ? `Table ${table.table_number}` : "This table"}{table?.timer_started_at ? `, open since ${fmtTimeSG(table.timer_started_at)}` : ""}. The timer keeps running from the same start time, at the same rate, and any F&B charged to the table moves with it. Close the new table as usual to bill the whole session.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-4 gap-2 py-2">
          {(tables as any[]).slice().sort((a, b) => a.table_number - b.table_number).map((t) => {
            const isCurrent = table && t.id === table.id;
            const reason = isCurrent ? "Current table" : unavailable[t.id];
            return (
              <Button
                key={t.id}
                type="button"
                size="sm"
                variant={target === t.id ? "default" : "outline"}
                disabled={!!reason}
                onClick={() => setTarget(t.id)}
                title={reason}
              >
                {t.table_number}
              </Button>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground">Tables in use, booked within 15 minutes or under maintenance can't be picked. If the new table becomes busy before you confirm, you'll be told and nothing changes.</p>
        <DialogFooter>
          <Button variant="outline" onClick={() => close(false)}>Cancel</Button>
          <Button onClick={confirm} disabled={!target || move.isPending}>
            {move.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Move to Table {(tables as any[]).find((t) => t.id === target)?.table_number ?? ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
