import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api";

export type RewardType = "free_session" | "wallet_credit" | "free_item" | "booking_discount";
export type RewardReason = "reviews" | "social_follow" | "birthday" | "refund" | "other";

export interface Reward {
  id?: string;
  _id?: string;
  code: string;
  type: RewardType;
  value?: number;
  description: string;
  reason: RewardReason;
  expiresAt?: string | null;
  redeemed?: boolean;
  redeemedAt?: string | null;
  createdAt?: string;
  userId?: string;
}

export function useAdminRewards(userId?: string) {
  return useQuery({
    queryKey: ["admin-rewards", userId],
    queryFn: async () => {
      const res = await apiFetch(`/api/rewards/admin?userId=${userId}`);
      if (!res.ok) throw new Error("Failed to fetch rewards");
      const data = await res.json();
      return Array.isArray(data) ? data : (data?.rewards ?? []);
    },
    enabled: !!userId,
  });
}

export function useIssueReward() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (payload: {
      userId: string;
      type: RewardType;
      value?: number;
      description: string;
      reason: RewardReason | string;
      expiresAt?: string | null;
    }) => {
      const res = await apiFetch("/api/rewards/issue", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || data.message || "Failed to issue reward");
      return data as Reward & { code: string };
    },
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: ["admin-rewards", vars.userId] });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });
}

export function useMyRewards() {
  return useQuery({
    queryKey: ["my-rewards"],
    queryFn: async () => {
      const res = await apiFetch("/api/rewards/my");
      if (!res.ok) throw new Error("Failed to fetch rewards");
      const data = await res.json();
      return (Array.isArray(data) ? data : (data?.rewards ?? [])) as Reward[];
    },
  });
}

export function useRedeemCreditReward() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (code: string) => {
      const res = await apiFetch("/api/rewards/redeem-credit", {
        method: "POST",
        body: JSON.stringify({ code }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || data.message || "Failed to redeem reward");
      return data;
    },
    onSuccess: () => {
      toast({ title: "Reward redeemed", description: "Wallet has been credited." });
      queryClient.invalidateQueries({ queryKey: ["my-rewards"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["transaction-history"] });
    },
    onError: (err: Error) => {
      toast({ title: "Redemption failed", description: err.message, variant: "destructive" });
    },
  });
}

export async function validateRewardCode(code: string) {
  const res = await apiFetch(`/api/rewards/validate/${encodeURIComponent(code)}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || data.message || "Invalid reward code");
  return data as { valid: boolean; reward?: Reward; error?: string };
}
