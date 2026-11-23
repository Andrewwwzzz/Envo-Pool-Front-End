import { useMemo, useState, useEffect } from "react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import {
  bookingDaySlots, slotKeyToDate, keyToMinutes, minutesToKey, formatClock, type BookingDaySlot,
} from "@/lib/bookingDay";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { isSlotWithinHours, type WeekSchedule } from "@/hooks/useOperatingHours";

type SlotState = "available" | "booked" | "pending" | "past" | "maintenance" | "closed" | "private-only";

interface TimeSlot extends BookingDaySlot {
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
  operatingHours?: WeekSchedule;
  phDates?: Set<string>;
  phCloseTime?: string;
  hasPrivateMembership?: boolean;
  startSlot: string | null;
  endSlot: string | null;
  onSelectStart: (slot: string) => void;
  onSelectEnd: (slot: string) => void;
}

const PENDING_LOCK_MINUTES = 10;
const SLOT_MIN = 30;

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

// "1h 30m", "2h", "30m"
function duration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 && m > 0 ? `${h}h ${m}m` : h > 0 ? `${h}h` : `${m}m`;
}

function getDisplayName(userName: string | null | undefined, state: SlotState): string | null {
  if (!userName || userName === "Anonymous") return null;
  return state === "booked" ? `Booked by ${userName}` : `Pending by ${userName}`;
}

export function TimeSlotPicker({
  date,
  bookedSlots,
  maintenanceWindows = [],
  operatingHours,
  phDates,
  phCloseTime,
  hasPrivateMembership = false,
  startSlot,
  endSlot,
  onSelectStart,
  onSelectEnd,
}: TimeSlotPickerProps) {
  const [expiredKey, setExpiredKey] = useState(0);
  const [openInfoSlot, setOpenInfoSlot] = useState<string | null>(null);
  // Re-check "past" slots every minute while the page stays open.
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 60000);
    return () => clearInterval(id);
  }, []);

  const slotAvailability: TimeSlot[] = useMemo(() => {
    const pendingCutoffMs = Date.now() - PENDING_LOCK_MINUTES * 60 * 1000;
    const none = { userName: null, expiresAt: null, maintenanceReason: null };

    return bookingDaySlots(date).map((slot) => {
      const slotStart = slotKeyToDate(date, slot.key);
      const slotEnd = new Date(slotStart.getTime() + 30 * 60 * 1000);

      // A slot is only "past" once it has fully ended — the current half-hour stays selectable.
      if (slotEnd.getTime() <= nowMs) return { ...slot, available: false, state: "past" as const, ...none };

      // Opening hours are checked on the calendar date the slot falls on (after midnight = next date).
      if (operatingHours) {
        const hoursResult = isSlotWithinHours(operatingHours, slot.calendarDate, slot.clock, phDates, phCloseTime, hasPrivateMembership);
        if (hoursResult === false) return { ...slot, available: false, state: "closed" as const, ...none };
        if (hoursResult === "private-only") return { ...slot, available: false, state: "private-only" as const, ...none };
      }

      const overlaps = (from: string | undefined, to: string | undefined) => {
        const a = new Date(from || ""), b = new Date(to || "");
        return !isNaN(a.getTime()) && !isNaN(b.getTime()) && a < slotEnd && b > slotStart;
      };

      const maintenance = maintenanceWindows.find((w) => overlaps(w.startTime || w.start_time, w.endTime || w.end_time));
      if (maintenance) {
        return { ...slot, available: false, state: "maintenance" as const, ...none, maintenanceReason: maintenance.reason || "Maintenance" };
      }

      const confirmedBooking = bookedSlots.find((b) => b.status === "confirmed" && overlaps(b.start_time, b.end_time));
      if (confirmedBooking) {
        return { ...slot, available: false, state: "booked" as const, ...none, userName: confirmedBooking.user_name };
      }

      const pendingBooking = bookedSlots.find((b) =>
        b.status === "pending" && new Date(b.created_at).getTime() > pendingCutoffMs && overlaps(b.start_time, b.end_time));
      if (pendingBooking) {
        return { ...slot, available: false, state: "pending" as const, ...none, userName: pendingBooking.user_name, expiresAt: pendingBooking.expires_at };
      }

      return { ...slot, available: true, state: "available" as const, ...none };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, bookedSlots, maintenanceWindows, operatingHours, phDates, phCloseTime, hasPrivateMembership, nowMs, expiredKey]);

  const startMin = startSlot ? keyToMinutes(startSlot) : null;
  const endMin = startMin !== null && endSlot ? keyToMinutes(endSlot) : null;

  const select = (from: number | null, to: number | null) => {
    onSelectStart(from === null ? "" : minutesToKey(from));
    onSelectEnd(to === null ? "" : minutesToKey(to));
  };

  // A selected half-hour that's no longer free (someone else booked it, or it passed) clears the selection.
  useEffect(() => {
    if (startMin === null || endMin === null) return;
    const blocked = slotAvailability.some((s) => s.offsetMin >= startMin && s.offsetMin < endMin && !s.available);
    const missing = !slotAvailability.some((s) => s.offsetMin === startMin);
    if (blocked || missing) select(null, null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startMin, endMin, slotAvailability]);

  // Each slot is a half-hour, tapped on its own. The half-hours chosen must be next to
  // each other: tapping the one just before or after the selection adds it, tapping the
  // first or last one removes it, and tapping anywhere else starts a new selection there.
  const handleSlotClick = (slot: TimeSlot) => {
    if (!slot.available) return;
    const m = slot.offsetMin;
    if (startMin === null || endMin === null) return select(m, m + SLOT_MIN);
    if (m === endMin) return select(startMin, endMin + SLOT_MIN);
    if (m === startMin - SLOT_MIN) return select(m, endMin);
    if (m === startMin && m === endMin - SLOT_MIN) return select(null, null);
    if (m === endMin - SLOT_MIN) return select(startMin, m);
    if (m === startMin) return select(startMin + SLOT_MIN, endMin);
    if (m > startMin && m < endMin) return; // a middle half-hour: remove from either end instead
    select(m, m + SLOT_MIN);
  };

  const isInRange = (slot: TimeSlot) =>
    startMin !== null && endMin !== null && slot.offsetMin >= startMin && slot.offsetMin < endMin;

  const handleExpired = () => {
    setExpiredKey((k) => k + 1);
  };

  return (
    <TooltipProvider delayDuration={200}>
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <Label className="text-base">
            {format(date, "EEEE, d MMM yyyy")} — Available Slots
          </Label>
          <p className="text-xs text-muted-foreground mt-0.5">From 6:00 AM, through midnight, to 6:00 AM the next morning.</p>
        </div>
        {startMin !== null && endMin !== null && (
          <span className="text-sm text-accent font-medium text-right whitespace-nowrap">
            {formatClock(startMin)} – {formatClock(endMin)} · {duration(endMin - startMin)}
          </span>
        )}
      </div>

      <p className="text-sm text-muted-foreground">
        {startMin === null
          ? "Tap each half-hour you want to play. Each slot is 30 minutes."
          : "Tap the next slot to add 30 minutes, or the first/last selected slot to remove it."}
      </p>

      <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-1.5">
        {slotAvailability.map((slot, index) => {
          const inRange = isInRange(slot);
          const isStartSlot = startSlot === slot.key;
          const displayName = getDisplayName(slot.userName, slot.state);
          const isInfoOpen = openInfoSlot === slot.key;
          // Divider where the night crosses midnight onto the next date.
          const midnightDivider = slot.nextDay && !slotAvailability[index - 1]?.nextDay ? (
            <div key="after-midnight" className="col-span-full flex items-center gap-2 pt-2 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              After midnight — {format(slot.calendarDate, "EEE d MMM")}
              <span className="h-px flex-1 bg-border" />
            </div>
          ) : null;

          const slotButton = (
            <button
              key={slot.key}
              onClick={() => handleSlotClick(slot)}
              disabled={!slot.available}
              className={cn(
                "rounded-lg border px-1 py-2 text-xs font-medium transition-all duration-150 flex flex-col items-center gap-0.5 w-full",
                slot.state === "past" && "opacity-30 cursor-not-allowed bg-muted border-border text-muted-foreground line-through",
                slot.state === "closed" && "opacity-40 cursor-not-allowed bg-muted border-border text-muted-foreground",
                slot.state === "private-only" && "opacity-50 cursor-not-allowed bg-purple-500/5 border-purple-500/30 text-purple-400",
                slot.state === "booked" && "cursor-not-allowed border-destructive/40 bg-destructive/10 text-destructive",
                slot.state === "pending" && "cursor-not-allowed border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400",
                slot.state === "maintenance" && "cursor-not-allowed border-destructive/40 bg-destructive/10 text-destructive",
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

          if (slot.state === "maintenance" || slot.state === "pending" || slot.state === "booked" || slot.state === "closed" || slot.state === "private-only") {
            const tooltipText =
              slot.state === "private-only"
                ? "VIP Members Only — contact admin to join"
                : slot.state === "closed"
                ? "Outside operating hours"
                : slot.state === "maintenance"
                ? (slot.maintenanceReason || "No reason provided")
                : displayName
                  ? slot.state === "pending" && slot.expiresAt
                    ? `${displayName} — may become available soon`
                    : displayName
                  : slot.state === "pending"
                    ? "This table is currently being reserved. It may become available if payment is not completed."
                    : "This slot is booked.";

            const withInfo = (
              <Tooltip key={slot.key} open={isInfoOpen} onOpenChange={(o) => setOpenInfoSlot(o ? slot.key : null)}>
                <TooltipTrigger asChild>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setOpenInfoSlot((cur) => (cur === slot.key ? null : slot.key))}
                    className="w-full"
                  >
                    {slotButton}
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" align="center" className="max-w-[220px] text-center">
                  {tooltipText}
                </TooltipContent>
              </Tooltip>
            );
            return midnightDivider ? [midnightDivider, withInfo] : withInfo;
          }

          return midnightDivider ? [midnightDivider, slotButton] : slotButton;
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
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded border border-purple-500/30 bg-purple-500/5" /> VIP Members Only
        </span>
      </div>
    </div>
    </TooltipProvider>
  );
}
