import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export interface DaySchedule {
  open: boolean;
  openTime: string; // "HH:MM"
  closeTime: string; // "HH:MM" — can be < openTime to mean past midnight (public cut-off)
}

export type WeekSchedule = Record<string, DaySchedule>; // keys "0".."6", 0 = Sunday

export interface OperatingHoursData {
  schedule: WeekSchedule;
  phCloseTime: string; // public close time override for PH and PH-eve days (e.g. "02:00")
}

export const DEFAULT_SCHEDULE: WeekSchedule = {
  "0": { open: true, openTime: "10:00", closeTime: "02:00" }, // Sunday
  "1": { open: true, openTime: "10:00", closeTime: "01:00" },
  "2": { open: true, openTime: "10:00", closeTime: "01:00" },
  "3": { open: true, openTime: "10:00", closeTime: "01:00" },
  "4": { open: true, openTime: "10:00", closeTime: "01:00" },
  "5": { open: true, openTime: "10:00", closeTime: "01:00" },
  "6": { open: true, openTime: "10:00", closeTime: "01:00" }, // Saturday
};

export const DEFAULT_PH_CLOSE = "02:00";

export const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function normalize(schedule: any): WeekSchedule {
  const out: WeekSchedule = { ...DEFAULT_SCHEDULE };
  if (schedule && typeof schedule === "object") {
    for (let i = 0; i < 7; i++) {
      const key = String(i);
      const day = schedule[key] ?? schedule[i];
      if (day) {
        out[key] = {
          open: day.open !== false,
          openTime: typeof day.openTime === "string" ? day.openTime : DEFAULT_SCHEDULE[key].openTime,
          closeTime: typeof day.closeTime === "string" ? day.closeTime : DEFAULT_SCHEDULE[key].closeTime,
        };
      }
    }
  }
  return out;
}

export function useOperatingHours() {
  return useQuery({
    queryKey: ["operating-hours"],
    queryFn: async (): Promise<OperatingHoursData> => {
      try {
        const res = await apiFetch("/api/operating-hours");
        if (!res.ok) return { schedule: DEFAULT_SCHEDULE, phCloseTime: DEFAULT_PH_CLOSE };
        const json = await res.json();
        return {
          schedule: normalize(json?.schedule ?? json),
          phCloseTime: typeof json?.phCloseTime === "string" ? json.phCloseTime : DEFAULT_PH_CLOSE,
        };
      } catch {
        return { schedule: DEFAULT_SCHEDULE, phCloseTime: DEFAULT_PH_CLOSE };
      }
    },
    staleTime: 60_000,
  });
}

export function useSaveOperatingHours() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { schedule: WeekSchedule; phCloseTime: string }) => {
      const res = await apiFetch("/api/operating-hours", {
        method: "PUT",
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.text().catch(() => "");
        throw new Error(err || "Failed to save operating hours");
      }
      return res.json().catch(() => ({}));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["operating-hours"] });
    },
  });
}

// Returns true if slot is within public hours, "private-only" if it's in the after-hours window,
// or false if the venue is closed that day entirely.
// phDates: Set of "YYYY-MM-DD" SGT date strings for public holidays.
// phCloseTime: override close time for PH/PH-eve days.
// hasPrivate: if true, "private-only" slots are treated as available (returns true).
export function isSlotWithinHours(
  schedule: WeekSchedule | undefined,
  date: Date,
  slot: string,
  phDates?: Set<string>,
  phCloseTime?: string,
  hasPrivate?: boolean,
): boolean | "private-only" {
  if (!schedule) return true;
  const [sh, sm] = slot.split(":").map(Number);
  const slotMin = sh * 60 + sm;

  const dow = date.getDay(); // 0 = Sunday
  const today = schedule[String(dow)];
  const prevDow = (dow + 6) % 7;
  const prev = schedule[String(prevDow)];

  if (!today?.open && !prev?.open) return false;

  const toMin = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };

  // Compute the SGT date string for this date (for PH check)
  const pad = (n: number) => String(n).padStart(2, "0");
  const dateStr = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

  // Check if this calendar date or the NEXT is a PH (PH-eve)
  let isPHOrEve = false;
  if (phDates && phDates.size > 0) {
    const nextDate = new Date(date.getTime() + 24 * 60 * 60 * 1000);
    const nextStr = `${nextDate.getFullYear()}-${pad(nextDate.getMonth() + 1)}-${pad(nextDate.getDate())}`;
    isPHOrEve = phDates.has(dateStr) || phDates.has(nextStr);
  }

  // Effective close time for today's session
  const getEffectiveClose = (daySchedule: DaySchedule) => {
    if (isPHOrEve && phCloseTime) return phCloseTime;
    return daySchedule.closeTime;
  };

  // Same-day window
  if (today?.open) {
    const openMin = toMin(today.openTime);
    const effectiveClose = getEffectiveClose(today);
    const closeMin = toMin(effectiveClose);
    const sameDayEnd = closeMin > openMin ? closeMin : 24 * 60;
    if (slotMin >= openMin && slotMin < sameDayEnd) return true;
  }

  // Spill-over from previous day's past-midnight close
  if (prev?.open) {
    const pOpen = toMin(prev.openTime);

    // Effective close for prev day (check if YESTERDAY was PH/PH-eve)
    const prevDate = new Date(date.getTime() - 24 * 60 * 60 * 1000);
    const prevDateStr = `${prevDate.getFullYear()}-${pad(prevDate.getMonth() + 1)}-${pad(prevDate.getDate())}`;
    let prevIsPH = false;
    if (phDates && phDates.size > 0) {
      prevIsPH = phDates.has(prevDateStr) || phDates.has(dateStr);
    }
    const prevEffectiveClose = (prevIsPH && phCloseTime) ? phCloseTime : prev.closeTime;
    const pClose = toMin(prevEffectiveClose);

    if (pClose <= pOpen) {
      // This slot is in the overnight spill from yesterday
      if (slotMin < pClose) return true;
      // Slot is after close but before open (the private-only window)
      if (slotMin >= pClose && slotMin < toMin(today?.openTime || "10:00")) {
        if (hasPrivate) return true;
        return "private-only";
      }
    }
  }

  return false;
}
