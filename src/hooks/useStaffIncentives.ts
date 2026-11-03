import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

// The month's bonus kinds come from the server (rates change by month), e.g. "membership", "topup500".
export type IncentiveKey = string;

export interface IncentiveRule {
  key: IncentiveKey;
  label: string;
  bonus: number;
  text: string;
}

export interface IncentiveItem {
  type: "membership" | "topup" | "package";
  key: IncentiveKey;
  bonus: number;
  staffId: string;
  staffName: string;
  customer: string;
  detail: string;
  at: string;
}

export interface StaffIncentiveRow {
  staffId: string;
  name: string;
  bonus: number;
  [key: IncentiveKey]: number | string;
}

export interface StaffIncentives {
  month: string;
  rules: IncentiveRule[];
  staff: StaffIncentiveRow[];
  items: IncentiveItem[];
  totalBonus: number;
}

/** month = "YYYY-MM" (SGT). */
export function useStaffIncentives(month: string) {
  return useQuery({
    queryKey: ["staff-incentives", month],
    queryFn: async (): Promise<StaffIncentives> => {
      const res = await apiFetch(`/api/admin/incentives?month=${month}`);
      if (!res.ok) throw new Error("Failed to load incentives");
      return res.json();
    },
    refetchInterval: 60_000,
  });
}
