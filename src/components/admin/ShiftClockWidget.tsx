import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Clock, Loader2, Users } from "lucide-react";
import { useShiftStatus, useOnShiftStaff, useClockIn, useClockOut } from "@/hooks/useShift";
import { fmtTimeSG } from "@/lib/sgTime";

export function ShiftClockWidget() {
  const { data: status, isLoading } = useShiftStatus();
  const { data: onShift = [] } = useOnShiftStaff();
  const clockIn = useClockIn();
  const clockOut = useClockOut();

  const busy = clockIn.isPending || clockOut.isPending;

  return (
    <div className="flex items-center gap-2">
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5">
            <Users className="h-3.5 w-3.5" />
            On shift {onShift.length > 0 ? `(${onShift.length})` : ""}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-64">
          <div className="text-sm font-medium mb-2">Currently on shift</div>
          {onShift.length === 0 ? (
            <p className="text-xs text-muted-foreground">No one is clocked in right now.</p>
          ) : (
            <div className="space-y-1.5">
              {onShift.map((s) => {
                const staff = typeof s.staffId === "object" ? s.staffId : null;
                return (
                  <div key={s._id} className="flex items-center justify-between text-xs">
                    <span>{staff?.name || "Unknown"}</span>
                    <span className="text-muted-foreground">since {fmtTimeSG(s.clockInAt)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </PopoverContent>
      </Popover>

      {status?.onShift ? (
        <Button
          size="sm"
          variant="default"
          className="gap-1.5 bg-green-600 hover:bg-green-700"
          disabled={busy || isLoading}
          onClick={() => clockOut.mutate()}
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Clock className="h-3.5 w-3.5" />}
          On Shift — Clock Out
        </Button>
      ) : (
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5"
          disabled={busy || isLoading}
          onClick={() => clockIn.mutate()}
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Clock className="h-3.5 w-3.5" />}
          Clock In
        </Button>
      )}
    </div>
  );
}
