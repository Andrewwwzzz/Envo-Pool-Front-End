import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";
import { getCached, setCache } from "@/lib/queryCache";

export function useProfile() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const res = await apiFetch("/api/auth/me");
      if (!res.ok) throw new Error("Failed to fetch profile");
      const data = await res.json();
      const profile = {
        ...data.user,
        wallet_balance: data.user.walletBalance ?? 0,
        reward_points: data.user.rewardPoints ?? 0,
        total_spent: data.user.totalSpent ?? 0,
        date_of_birth: data.user.dateOfBirth ?? null,
        phone: data.user.phone ?? data.user.mobile ?? data.user.phoneNumber ?? data.user.kyc?.mobile ?? null,
      };
      setCache(`profile-${user.id}`, profile);
      return profile;
    },
    enabled: !!user,
    initialData: () => user ? getCached(`profile-${user.id}`) : undefined,
  });
}

export function useUserRole() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["user-role", user?.id],
    queryFn: async () => {
      if (!user) return null;
      return user.role === "admin" ? "admin" : "customer";
    },
    enabled: !!user,
  });
}

export function useUpdateProfile() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updates: { name?: string; username?: string; phone?: string; date_of_birth?: string }) => {
      if (!user) throw new Error("Not authenticated");
      const res = await apiFetch("/api/auth/update-profile", {
        method: "POST",
        body: JSON.stringify({
          userId: user.id,
          name: updates.name,
          username: updates.username,
          phone: updates.phone,
          dateOfBirth: updates.date_of_birth,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to update profile");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
  });
}
