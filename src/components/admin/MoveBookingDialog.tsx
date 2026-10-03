import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowRightLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAdminTables } from "@/hooks/useAdmin";
import { apiFetch } from "@/lib/api";
import { fmtTimeSG } from "@/lib/sgTime";

export function useMoveBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ bookingId, tableId }: { bookingId: string; tableId: string }) => {
      const res = await apiFetch(`/api/admin/bookings/${bookingId}/move`, { method: "POST", body: JSON.stringify({ tableId }) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Couldn't move the booking");
      return body as { message: string };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-bookings"] });
      qc.invalidateQueries({ queryKey: ["admin-tables"] });
      qc.invalidateQueries({ queryKey: ["tables-with-status"] });
    },
  });
}

/**
 * Moves a booking to another table — same booking, time, price and payment.
 * Use this instead of cancelling and rebooking, which recorded the payment twice.
 */
export function MoveBookingDialog({ booking, onOpenChange }: { booking: any | null; onOpenChange: (open: boolean) => void }) {
  const { toast } = useToast();
  const { data: tables = [] } = useAdminTables();
  const move = useMoveBooking();
  const [target, setTarget] = useState<string>("");

  const bookingId = booking?._id || booking?.id;
  const currentTableId = booking ? (typeof booking.tableId === "object" ? booking.tableId?._id || booking.tableId?.hardware_id : booking.tableId) : null;
  const current = (tables as any[]).find((t) => t.id === currentTableId || t.hardware_id === currentTableId);
  const start = booking?.startTime || booking?.start_time;
  const end = booking?.endTime || booking?.end_time;

  const close = (open: boolean) => { if (!open) setTarget(""); onOpenChange(open); };
  const confirm = () => {
    if (!bookingId || !target) return;
    move.mutate({ bookingId, tableId: target }, {
      onSuccess: (r) => { toast({ title: r.message || "Booking moved" }); close(false); },
      onError: (e: Error) => toast({ title: "Couldn't move booking", description: e.message, variant: "destructive" }),
    });
  };

  return (
    <Dialog open={!!booking} onOpenChange={close}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ArrowRightLeft className="h-5 w-5 text-primary" /> Move Booking</DialogTitle>
          <DialogDescription>
            {current ? `Table ${current.table_number}` : "This booking"}{start && end ? `, ${fmtTimeSG(start)}–${fmtTimeSG(end)}` : ""}. Same time, price and payment — only the table changes. No need to cancel and rebook.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-4 gap-2 py-2">
          {(tables as any[]).slice().sort((a, b) => a.table_number - b.table_number).map((t) => {
            const isCurrent = current && t.id === current.id;
            return (
              <Button
                key={t.id}
                type="button"
                size="sm"
                variant={target === t.id ? "default" : "outline"}
                disabled={isCurrent || t.status === "maintenance"}
                onClick={() => setTarget(t.id)}
                title={isCurrent ? "Current table" : t.status === "maintenance" ? "Under maintenance" : undefined}
              >
                {t.table_number}
              </Button>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground">If the new table is busy during this time, you'll be told and nothing changes.</p>
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
