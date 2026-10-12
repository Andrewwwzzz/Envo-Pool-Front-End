import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { getCached, setCache } from "@/lib/queryCache";

/** Whole transaction list — heavy (every transaction ever). Pass enabled=false when not needed. */
export function useAdminTransactions(enabled = true) {
  return useQuery({
    enabled,
    queryKey: ["admin-transactions"],
    queryFn: async () => {
      const res = await apiFetch("/api/transactions");
      if (!res.ok) throw new Error("Failed to fetch transactions");
      const data = await res.json();
      setCache("admin-transactions", data);
      return data;
    },
    refetchInterval: 10000,
    refetchOnWindowFocus: true,
    initialData: () => getCached("admin-transactions"),
  });
}

export function useAdminBookingLogs() {
  return useQuery({
    queryKey: ["admin-booking-logs"],
    queryFn: async () => {
      const res = await apiFetch("/api/logs/booking");
      if (!res.ok) throw new Error("Failed to fetch booking logs");
      const data = await res.json();
      setCache("admin-booking-logs", data);
      return data;
    },
    refetchInterval: 10000,
    refetchOnWindowFocus: true,
    initialData: () => getCached("admin-booking-logs"),
  });
}

// ── Paged versions for Team → Logs: newest page first, "Load more" for older ──

const LOG_PAGE = 100;
type Row = { _id?: string; id?: string; createdAt?: string };
const cursorOf = (row: Row | undefined) =>
  row?.createdAt ? `before=${encodeURIComponent(row.createdAt)}&beforeId=${row._id || row.id || ""}` : undefined;

/** Search and filters for a log list (D10): q, from, to, type / action. Empty values are left out. */
export type LogFilters = Record<string, string>;
const filterQs = (f?: LogFilters) => Object.entries(f || {}).filter(([, v]) => v).map(([k, v]) => `&${k}=${encodeURIComponent(v)}`).join("");

function usePagedLog<T extends Row>(key: string, path: string, pick: (body: unknown) => { rows: T[]; hasMore: boolean }, filters?: LogFilters) {
  return useInfiniteQuery({
    queryKey: [key, filters || {}],
    initialPageParam: "",
    queryFn: async ({ pageParam }) => {
      const res = await apiFetch(`${path}?limit=${LOG_PAGE}${filterQs(filters)}${pageParam ? `&${pageParam}` : ""}`);
      if (!res.ok) throw new Error(`Failed to fetch ${path}`);
      return pick(await res.json());
    },
    getNextPageParam: (last) => (last.hasMore ? cursorOf(last.rows[last.rows.length - 1]) : undefined),
    refetchInterval: 10000,
    refetchOnWindowFocus: true,
  });
}

export const usePagedTransactions = (filters?: LogFilters) =>
  usePagedLog("admin-transactions-paged", "/api/transactions", (b) => {
    // An older server ignores ?limit and returns the whole list — show it as one page.
    if (Array.isArray(b)) return { rows: b as Row[], hasMore: false };
    const page = b as { transactions?: Row[]; hasMore?: boolean };
    return { rows: page.transactions ?? [], hasMore: !!page.hasMore };
  }, filters);
export const usePagedBookingLogs = (filters?: LogFilters) =>
  usePagedLog("admin-booking-logs-paged", "/api/logs/booking", (b) => ({ rows: Array.isArray(b) ? (b as Row[]) : [], hasMore: Array.isArray(b) && b.length === LOG_PAGE }), filters);
export const usePagedActivityLogs = (filters?: LogFilters) =>
  usePagedLog("admin-activity-logs-paged", "/api/logs/admin", (b) => ({ rows: Array.isArray(b) ? (b as Row[]) : [], hasMore: Array.isArray(b) && b.length === LOG_PAGE }), filters);

export function useAdminActivityLogs() {
  return useQuery({
    queryKey: ["admin-activity-logs"],
    queryFn: async () => {
      const res = await apiFetch("/api/logs/admin");
      if (!res.ok) throw new Error("Failed to fetch admin logs");
      const data = await res.json();
      setCache("admin-activity-logs", data);
      return data;
    },
    refetchInterval: 10000,
    refetchOnWindowFocus: true,
    initialData: () => getCached("admin-activity-logs"),
  });
}
