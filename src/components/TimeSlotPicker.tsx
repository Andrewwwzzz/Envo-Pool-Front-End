import { useMemo } from "react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { isTodaySG, nowSGMinutes } from "@/lib/sgTime";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type SlotState = "available" | "booked" | "pending" | "past";

interface TimeSlot {
  time: string; // "HH:MM"
  label: string;
  available: boolean;
  state: SlotState;
}

interface BookedSlot {
  start_time: string;
  end_time: string;
  status: string;
  created_at: string;
}

interface TimeSlotPickerProps {
  date: Date;
  bookedSlots: BookedSlot[];
  startSlot: string | null;
  endSlot: string | null;
  onSelectStart: (slot: string) => void;
  onSelectEnd: (slot: string) => void;
}

const PENDING_LOCK_MINUTES = 5;

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

export function TimeSlotPicker({
  date,
  bookedSlots,
  startSlot,
  endSlot,
  onSelectStart,
  onSelectEnd,
}: TimeSlotPickerProps) {
  const isToday = isTodaySG(date);
  const nowMinutes = nowSGMinutes();

  const slotAvailability = useMemo(() => {
    const currentTimeMs = Date.now();

    return ALL_SLOTS.map((slot) => {
      const slotMin = slotToMinutes(slot.time);
      const slotEndMin = slotMin + 30;

      // Past time today
      if (isToday && slotMin < nowMinutes) {
        return { ...slot, available: false, state: "past" as const };
      }

      // Build slot start/end as Date objects for comparison with bookings
      const slotStart = new Date(date);
      slotStart.setHours(Math.floor(slotMin / 60), slotMin % 60, 0, 0);
      const slotEnd = new Date(date);
      slotEnd.setHours(Math.floor(slotEndMin / 60), slotEndMin % 60, 0, 0);

      // Check against booked slots
      const hasConfirmed = bookedSlots.some((b) => {
        if (b.status !== "confirmed") return false;

        const bStart = new Date(b.start_time);
        const bEnd = new Date(b.end_time);
        return !(slotStart >= bEnd || slotEnd <= bStart);
      });

      if (hasConfirmed) {
        return { ...slot, available: false, state: "booked" as const };
      }

      const hasActivePending = bookedSlots.some((b) => {
        if (b.status !== "pending") return false;

        const bStart = new Date(b.start_time);
        const bEnd = new Date(b.end_time);
        if (slotStart >= bEnd || slotEnd <= bStart) return false;

        const created = new Date(b.created_at);
        const elapsed = (currentTimeMs - created.getTime()) / (1000 * 60);
        return elapsed <= PENDING_LOCK_MINUTES;
      });

      if (hasActivePending) {
        return { ...slot, available: false, state: "pending" as const };
      }

      return { ...slot, available: true, state: "available" as const };
    });
  }, [date, bookedSlots, isToday, nowMinutes]);

  const startMinutes = startSlot ? slotToMinutes(startSlot) : null;
  const endMinutes = endSlot ? slotToMinutes(endSlot) : null;

  const handleSlotClick = (slot: TimeSlot) => {
    if (!slot.available) return;

    if (!startSlot || (startSlot && endSlot)) {
      // Start fresh selection
      onSelectStart(slot.time);
      onSelectEnd("");
      return;
    }

    // We have a start but no end
    const clickedMin = slotToMinutes(slot.time);
    if (clickedMin <= slotToMinutes(startSlot)) {
      // Clicked before start, reset
      onSelectStart(slot.time);
      onSelectEnd("");
      return;
    }

    // Check all slots between start and clicked are available
    const allAvailable = slotAvailability.every((s) => {
      const sMin = slotToMinutes(s.time);
      if (sMin >= slotToMinutes(startSlot) && sMin < clickedMin) {
        return s.available;
      }
      return true;
    });

    if (!allAvailable) {
      // Can't span over booked slots, restart
      onSelectStart(slot.time);
      onSelectEnd("");
      return;
    }

    // End slot is the END time, so it's the next 30-min mark after the clicked slot
    const endTime = `${Math.floor((clickedMin + 30) / 60).toString().padStart(2, "0")}:${((clickedMin + 30) % 60).toString().padStart(2, "0")}`;
    onSelectEnd(endTime);
  };

  const isInRange = (slotTime: string) => {
    if (startMinutes === null || endMinutes === null) return false;
    const min = slotToMinutes(slotTime);
    return min >= startMinutes && min < endMinutes;
  };

  const isStart = (slotTime: string) => startSlot === slotTime;

  // Duration display
  const duration = startSlot && endSlot
    ? (() => {
        const mins = slotToMinutes(endSlot) - slotToMinutes(startSlot);
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        return h > 0 && m > 0 ? `${h}h ${m}m` : h > 0 ? `${h}h` : `${m}m`;
      })()
    : null;

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

          const slotButton = (
            <button
              key={slot.time}
              onClick={() => handleSlotClick(slot)}
              disabled={!slot.available}
              className={cn(
                "rounded-lg border px-1 py-2 text-xs font-medium transition-all duration-150",
                slot.state === "past" && "opacity-30 cursor-not-allowed bg-muted border-border text-muted-foreground line-through",
                slot.state === "booked" && "cursor-not-allowed border-destructive/40 bg-destructive/10 text-destructive",
                slot.state === "pending" && "cursor-not-allowed border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400",
                slot.available && !inRange && !isStartSlot && "border-border hover:border-accent/50 hover:bg-accent/5 cursor-pointer text-foreground",
                isStartSlot && "border-accent bg-accent text-accent-foreground ring-2 ring-accent/30",
                inRange && !isStartSlot && "border-accent bg-accent/30 text-accent-foreground ring-1 ring-accent/40",
              )}
            >
              {slot.label}
            </button>
          );

          if (slot.state === "pending") {
            return (
              <Tooltip key={slot.time}>
                <TooltipTrigger asChild>{slotButton}</TooltipTrigger>
                <TooltipContent className="max-w-[220px] text-center">
                  This table is currently being reserved. It may become available if payment is not completed.
                </TooltipContent>
              </Tooltip>
            );
          }

          return slotButton;
        })}
      </div>

      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground pt-1">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded border border-border" /> Available
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-accent" /> Selected
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded border border-destructive/40 bg-destructive/10" /> Booked
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded border border-amber-500/40 bg-amber-500/10" /> Pending payment
        </span>
      </div>
    </div>
    </TooltipProvider>
  );
}
