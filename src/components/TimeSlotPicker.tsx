import { useMemo, useState, useEffect } from "react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { isTodaySG, nowSGMinutes, sgSlotToUTC } from "@/lib/sgTime";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type SlotState = "available" | "booked" | "pending" | "past" | "maintenance";

interface TimeSlot {
  time: string;
  label: string;
  available: boolean;
  state: SlotState;
  userName?: string | null;
  expiresAt?: string | null;
  maintenanceReason?: string | null;
}

interface BookedSlot {
  start_time: string;
  end_time: string;
  status: string;
  created_at: string;
  expires_at?: string | null;
  user_name?: string | null;
}

interface MaintenanceWindow {
  startTime?: string;
  endTime?: string;
  start_time?: string;
  end_time?: string;
  reason?: string | null;
}

interface TimeSlotPickerProps {
  date: Date;
  bookedSlots: BookedSlot[];
  maintenanceWindows?: MaintenanceWindow[];
  startSlot: string | null;
  endSlot: string | null;
  onSelectStart: (slot: string) => void;
  onSelectEnd: (slot: string) => void;
}

const PENDING_LOCK_MINUTES = 10;

function generateSlots(): { time: string; label: string }[] {
  const slots: { time: string; label: string }[] = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 30) {
      const time = `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
      const hour12 = h % 12 || 12;
      const ampm = h < 12 ? "AM" : "PM";
      const label = `${hour12}:${m.toString().padStart(2, "0")} ${ampm}`;
      slots.push({ time, label });
    }
  }
  return slots;
}

const ALL_SLOTS = generateSlots();

function slotToMinutes(slot: string): number {
  const [h, m] = slot.split(":").map(Number);
  return h * 60 + m;
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return "0:00";
  const totalSec = Math.ceil(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, "0")}`;
}

function CountdownTimer({ expiresAt, onExpired }: { expiresAt: string; onExpired: () => void }) {
  const [remaining, setRemaining] = useState(() => new Date(expiresAt).getTime() - Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      const diff = new Date(expiresAt).getTime() - Date.now();
      setRemaining(diff);
      if (diff <= 0) {
        clearInterval(interval);
        onExpired();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [expiresAt, onExpired]);

  if (remaining <= 0) return null;
  return <span className="text-[10px] font-mono">{formatCountdown(remaining)}</span>;
}

function getDisplayName(userName: string | null | undefined, state: SlotState): string | null {
  if (!userName || userName === "Anonymous") return null;
  return state === "booked" ? `Booked by ${userName}` : `Pending by ${userName}`;
}

export function TimeSlotPicker({
  date,
  bookedSlots,
  maintenanceWindows = [],
  startSlot,
  endSlot,
  onSelectStart,
  onSelectEnd,
}: TimeSlotPickerProps) {
  const isToday = isTodaySG(date);
  const nowMinutes = nowSGMinutes();
  const [expiredKey, setExpiredKey] = useState(0);

  const slotAvailability = useMemo(() => {
    const currentTimeMs = Date.now();

    return ALL_SLOTS.map((slot) => {
      const slotMin = slotToMinutes(slot.time);
      const slotEndMin = slotMin + 30;

      // A slot is only "past" once it has fully ended. The slot containing the
      // current minute (e.g. 9:00 slot at 9:01) remains selectable.
      if (isToday && slotEndMin <= nowMinutes) {
        return { ...slot, available: false, state: "past" as const, userName: null, expiresAt: null, maintenanceReason: null };
      }

      const slotStartStr = `${Math.floor(slotMin / 60).toString().padStart(2, "0")}:${(slotMin % 60).toString().padStart(2, "0")}`;
      const slotEndStr = `${Math.floor(slotEndMin / 60).toString().padStart(2, "0")}:${(slotEndMin % 60).toString().padStart(2, "0")}`;
      const slotStart = sgSlotToUTC(date, slotStartStr);
      const slotEnd = sgSlotToUTC(date, slotEndStr);

      // Check maintenance windows first
      const maintenance = maintenanceWindows.find((w) => {
        const wStart = new Date(w.startTime || w.start_time || "");
        const wEnd = new Date(w.endTime || w.end_time || "");
        if (isNaN(wStart.getTime()) || isNaN(wEnd.getTime())) return false;
        return wStart < slotEnd && wEnd > slotStart;
      });

      if (maintenance) {
        return { ...slot, available: false, state: "maintenance" as const, userName: null, expiresAt: null, maintenanceReason: maintenance.reason || "Maintenance" };
      }

      // Check confirmed
      const confirmedBooking = bookedSlots.find((b) => {
        if (b.status !== "confirmed") return false;
        const bStart = new Date(b.start_time);
        const bEnd = new Date(b.end_time);
        const overlaps = bStart < slotEnd && bEnd > slotStart;
        if (overlaps) console.log("SLOT BLOCKED (confirmed):", slot.time, "by booking", b.start_time, "→", b.end_time);
        return overlaps;
      });

      if (confirmedBooking) {
        return { ...slot, available: false, state: "booked" as const, userName: confirmedBooking.user_name, expiresAt: null, maintenanceReason: null };
      }

      // Check pending
      const pendingCutoffMs = currentTimeMs - PENDING_LOCK_MINUTES * 60 * 1000;
      const pendingBooking = bookedSlots.find((b) => {
        if (b.status !== "pending") return false;
        if (new Date(b.created_at).getTime() <= pendingCutoffMs) return false;
        const bStart = new Date(b.start_time);
        const bEnd = new Date(b.end_time);
        const overlaps = bStart < slotEnd && bEnd > slotStart;
        if (overlaps) console.log("SLOT BLOCKED (pending):", slot.time, "by booking", b.start_time, "→", b.end_time);
        return overlaps;
      });

      if (pendingBooking) {
        return { ...slot, available: false, state: "pending" as const, userName: pendingBooking.user_name, expiresAt: pendingBooking.expires_at, maintenanceReason: null };
      }

      return { ...slot, available: true, state: "available" as const, userName: null, expiresAt: null, maintenanceReason: null };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, bookedSlots, maintenanceWindows, isToday, nowMinutes, expiredKey]);

  const startMinutes = startSlot ? slotToMinutes(startSlot) : null;
  const endMinutes = endSlot ? slotToMinutes(endSlot) : null;

  const handleSlotClick = (slot: TimeSlot) => {
    if (!slot.available) return;

    if (!startSlot || (startSlot && endSlot)) {
      onSelectStart(slot.time);
      onSelectEnd("");
      return;
    }

    const clickedMin = slotToMinutes(slot.time);
    if (clickedMin <= slotToMinutes(startSlot)) {
      onSelectStart(slot.time);
      onSelectEnd("");
      return;
    }

    const allAvailable = slotAvailability.every((s) => {
      const sMin = slotToMinutes(s.time);
      if (sMin >= slotToMinutes(startSlot) && sMin < clickedMin) {
        return s.available;
      }
      return true;
    });

    if (!allAvailable) {
      onSelectStart(slot.time);
      onSelectEnd("");
      return;
    }

    const endTime = `${Math.floor((clickedMin + 30) / 60).toString().padStart(2, "0")}:${((clickedMin + 30) % 60).toString().padStart(2, "0")}`;
    onSelectEnd(endTime);
  };

  const isInRange = (slotTime: string) => {
    if (startMinutes === null || endMinutes === null) return false;
    const min = slotToMinutes(slotTime);
    return min >= startMinutes && min < endMinutes;
  };

  const isStart = (slotTime: string) => startSlot === slotTime;

  const duration = startSlot && endSlot
    ? (() => {
        const mins = slotToMinutes(endSlot) - slotToMinutes(startSlot);
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        return h > 0 && m > 0 ? `${h}h ${m}m` : h > 0 ? `${h}h` : `${m}m`;
      })()
    : null;

  const handleExpired = () => {
    setExpiredKey((k) => k + 1);
  };

  return (
    <TooltipProvider delayDuration={200}>
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-base">
          {format(date, "EEEE, d MMM yyyy")} — Available Slots
        </Label>
        {duration && (
          <span className="text-sm text-accent font-medium">
            Duration: {duration}
          </span>
        )}
      </div>

      {!startSlot && (
        <p className="text-sm text-muted-foreground">Click a slot to set your start time</p>
      )}
      {startSlot && !endSlot && (
        <p className="text-sm text-muted-foreground">Click another slot to set your end time</p>
      )}

      <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-1.5">
        {slotAvailability.map((slot) => {
          const inRange = isInRange(slot.time);
          const isStartSlot = isStart(slot.time);
          const displayName = getDisplayName(slot.userName, slot.state);

          const slotButton = (
            <button
              key={slot.time}
              onClick={() => handleSlotClick(slot)}
              disabled={!slot.available}
              className={cn(
                "rounded-lg border px-1 py-2 text-xs font-medium transition-all duration-150 flex flex-col items-center gap-0.5",
                slot.state === "past" && "opacity-30 cursor-not-allowed bg-muted border-border text-muted-foreground line-through",
                slot.state === "booked" && "cursor-not-allowed border-destructive/40 bg-destructive/10 text-destructive",
                slot.state === "pending" && "cursor-not-allowed border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400",
                slot.available && !inRange && !isStartSlot && "border-emerald-500/40 bg-emerald-500/5 hover:border-accent/50 hover:bg-accent/5 cursor-pointer text-foreground",
                isStartSlot && "border-accent bg-accent text-accent-foreground ring-2 ring-accent/30",
                inRange && !isStartSlot && "border-accent bg-accent/30 text-accent-foreground ring-1 ring-accent/40",
              )}
            >
              <span>{slot.label}</span>
              {slot.state === "pending" && slot.expiresAt && (
                <CountdownTimer expiresAt={slot.expiresAt} onExpired={handleExpired} />
              )}
            </button>
          );

          if (slot.state === "pending" || slot.state === "booked") {
            const tooltipText = displayName
              ? slot.state === "pending" && slot.expiresAt
                ? `${displayName} — may become available soon`
                : displayName
              : slot.state === "pending"
                ? "This table is currently being reserved. It may become available if payment is not completed."
                : "This slot is booked.";

            return (
              <Tooltip key={slot.time}>
                <TooltipTrigger asChild>{slotButton}</TooltipTrigger>
                <TooltipContent className="max-w-[220px] text-center">
                  {tooltipText}
                </TooltipContent>
              </Tooltip>
            );
          }

          return slotButton;
        })}
      </div>

      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground pt-1">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded border border-emerald-500/60 bg-emerald-500/20" /> Available
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-accent" /> Selected
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded border border-destructive/40 bg-destructive/10" /> Booked
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded border border-amber-500/40 bg-amber-500/10" /> Pending Payment
        </span>
      </div>
    </div>
    </TooltipProvider>
  );
}
