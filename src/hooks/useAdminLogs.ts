import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { getCached, setCache } from "@/lib/queryCache";

export function useAdminTransactions() {
  return useQuery({
    queryKey: ["admin-transactions"],
    queryFn: async () => {
      const res = await apiFetch("/api/transactions");
      if (!res.ok) throw new Error("Failed to fetch transactions");
      const data = await res.json();
      setCache("admin-transactions", data);
      return data;
    },
    refetchInterval: 30000,
    initialData: () => getCached("admin-transactions"),
  });
}

export function useAdminBookingLogs() {
  return useQuery({
    queryKey: ["admin-booking-logs"],
    queryFn: async () => {
      const res = await apiFetch("/api/booking-logs");
      if (!res.ok) throw new Error("Failed to fetch booking logs");
      const data = await res.json();
      setCache("admin-booking-logs", data);
      return data;
    },
    refetchInterval: 30000,
    initialData: () => getCached("admin-booking-logs"),
  });
}

export function useAdminActivityLogs() {
  return useQuery({
    queryKey: ["admin-activity-logs"],
    queryFn: async () => {
      const res = await apiFetch("/api/admin-logs");
      if (!res.ok) throw new Error("Failed to fetch admin logs");
      const data = await res.json();
      setCache("admin-activity-logs", data);
      return data;
    },
    refetchInterval: 30000,
    initialData: () => getCached("admin-activity-logs"),
  });
}
