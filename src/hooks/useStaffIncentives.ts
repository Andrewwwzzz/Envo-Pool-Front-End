import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export type IncentiveKey = "membership" | "topup250" | "topup500" | "package3h" | "package5h";

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

export interface StaffIncentiveRow extends Record<IncentiveKey, number> {
  staffId: string;
  name: string;
  bonus: number;
}

export interface StaffIncentives {
  month: string;
  rules: Record<IncentiveKey, number>;
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
