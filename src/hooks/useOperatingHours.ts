import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export interface DaySchedule {
  open: boolean;
  openTime: string; // "HH:MM"
  closeTime: string; // "HH:MM" — can be < openTime to mean past midnight
}

export type WeekSchedule = Record<string, DaySchedule>; // keys "0".."6", 0 = Sunday

export const DEFAULT_SCHEDULE: WeekSchedule = {
  "0": { open: true, openTime: "10:00", closeTime: "04:00" },
  "1": { open: true, openTime: "10:00", closeTime: "04:00" },
  "2": { open: true, openTime: "10:00", closeTime: "04:00" },
  "3": { open: true, openTime: "10:00", closeTime: "04:00" },
  "4": { open: true, openTime: "10:00", closeTime: "04:00" },
  "5": { open: true, openTime: "10:00", closeTime: "04:00" },
  "6": { open: true, openTime: "10:00", closeTime: "04:00" },
};

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
    queryFn: async (): Promise<WeekSchedule> => {
      try {
        const res = await apiFetch("/api/operating-hours");
        if (!res.ok) return DEFAULT_SCHEDULE;
        const json = await res.json();
        return normalize(json?.schedule ?? json);
      } catch {
        return DEFAULT_SCHEDULE;
      }
    },
    staleTime: 60_000,
  });
}

export function useSaveOperatingHours() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (schedule: WeekSchedule) => {
      const res = await apiFetch("/api/operating-hours", {
        method: "PUT",
        body: JSON.stringify({ schedule }),
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

// Returns true if the given slot (HH:MM, 30-min) on the selectedDate (local day-of-week)
// falls within the configured operating hours, accounting for past-midnight close times.
export function isSlotWithinHours(
  schedule: WeekSchedule | undefined,
  date: Date,
  slot: string,
): boolean {
  if (!schedule) return true;
  const [sh, sm] = slot.split(":").map(Number);
  const slotMin = sh * 60 + sm;

  const dow = date.getDay(); // 0 = Sunday
  const today = schedule[String(dow)];
  const prevDow = (dow + 6) % 7;
  const prev = schedule[String(prevDow)];

  const toMin = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };

  // Same-day window
  if (today?.open) {
    const openMin = toMin(today.openTime);
    const closeMin = toMin(today.closeTime);
    const sameDayEnd = closeMin > openMin ? closeMin : 24 * 60;
    if (slotMin >= openMin && slotMin < sameDayEnd) return true;
  }

  // Spill-over from previous day's past-midnight close
  if (prev?.open) {
    const pOpen = toMin(prev.openTime);
    const pClose = toMin(prev.closeTime);
    if (pClose <= pOpen && slotMin < pClose) return true;
  }

  return false;
}
