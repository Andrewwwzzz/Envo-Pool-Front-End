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
  const { user, refreshUser } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updates: { name?: string; username?: string; phone?: string; date_of_birth?: string }) => {
      if (!user) throw new Error("Not authenticated");
      const payload: Record<string, string> = { userId: user.id };
      // Username is a separate display field — never overwrite the legal `name`.
      if (updates.username !== undefined) payload.username = updates.username;
      if (updates.name !== undefined) payload.name = updates.name;
      if (updates.phone !== undefined) payload.phone = updates.phone;
      if (updates.date_of_birth !== undefined) payload.dateOfBirth = updates.date_of_birth;
      const res = await apiFetch("/api/auth/update-profile", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to update profile");
      }
      return res.json().catch(() => ({}));
    },
    onSuccess: async () => {
      await refreshUser();
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["table-day-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["my-bookings"] });
    },
  });
}
