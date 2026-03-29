import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export function useAdminTransactions() {
  return useQuery({
    queryKey: ["admin-transactions"],
    queryFn: async () => {
      const res = await apiFetch("/api/transactions");
      if (!res.ok) throw new Error("Failed to fetch transactions");
      return await res.json();
    },
    refetchInterval: 30000,
  });
}

export function useAdminBookingLogs() {
  return useQuery({
    queryKey: ["admin-booking-logs"],
    queryFn: async () => {
      const res = await apiFetch("/api/booking-logs");
      if (!res.ok) throw new Error("Failed to fetch booking logs");
      return await res.json();
    },
    refetchInterval: 30000,
  });
}

export function useAdminActivityLogs() {
  return useQuery({
    queryKey: ["admin-activity-logs"],
    queryFn: async () => {
      const res = await apiFetch("/api/admin-logs");
      if (!res.ok) throw new Error("Failed to fetch admin logs");
      return await res.json();
    },
    refetchInterval: 30000,
  });
}
