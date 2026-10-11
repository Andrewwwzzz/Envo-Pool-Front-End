import { describe, it, expect, vi, beforeEach } from "vitest";
import { ReactNode } from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const responses: Record<string, unknown> = {};

vi.mock("@/lib/api", () => ({
  apiFetch: vi.fn(async (path: string) => {
    const body = responses[path];
    return { ok: body !== undefined, json: async () => body };
  }),
}));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: null }) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

import { useTables, bookingIsForTable } from "@/hooks/useBooking";

const T1 = { _id: "66aa00000000000000000001", hardware_id: "T1", tableNumber: 1 };
const T2 = { _id: "66aa00000000000000000002", hardware_id: "T2", tableNumber: 2 };
const T3 = { _id: "66aa00000000000000000003", hardware_id: "T3", tableNumber: 3 };
const T4 = { _id: "66aa00000000000000000004", hardware_id: "T4", tableNumber: 4 };

const start = new Date("2026-10-12T12:00:00+08:00");
const end = new Date("2026-10-12T14:00:00+08:00");
const booking = (tableId: unknown, status = "confirmed") => ({
  tableId,
  status,
  startTime: "2026-10-12T04:30:00.000Z", // 12:30 SGT
  endTime: "2026-10-12T05:30:00.000Z",
});

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("bookingIsForTable", () => {
  it("matches a booking stored under the table's _id or its hardware_id", () => {
    expect(bookingIsForTable(booking(T1._id), T1._id, T1.hardware_id)).toBe(true);
    expect(bookingIsForTable(booking("T1"), T1._id, T1.hardware_id)).toBe(true);
    expect(bookingIsForTable(booking({ _id: T1._id }), T1._id, T1.hardware_id)).toBe(true);
    expect(bookingIsForTable(booking({ hardware_id: "T1" }), T1._id, T1.hardware_id)).toBe(true);
    expect(bookingIsForTable(booking("T2"), T1._id, T1.hardware_id)).toBe(false);
    expect(bookingIsForTable(booking(null), T1._id, null)).toBe(false);
  });
});

describe("useTables", () => {
  beforeEach(() => {
    localStorage.clear();
    for (const k of Object.keys(responses)) delete responses[k];
  });

  it("marks a table booked whether the booking stored its _id or its hardware_id", async () => {
    responses["/api/tables"] = [T1, T2, T3, T4];
    responses["/api/bookings"] = [
      booking(T1._id), // online booking — by _id
      booking("T2"), // staff Book Now — by hardware_id
      booking({ _id: T3._id, hardware_id: "T3" }, "pending_payment"), // populated
    ];

    const { result } = renderHook(() => useTables(start, end), { wrapper });
    await waitFor(() => expect(result.current.isFetched).toBe(true));

    const status = Object.fromEntries((result.current.data ?? []).map((t) => [t.hardware_id, t.status]));
    expect(status).toEqual({ T1: "Booked", T2: "Booked", T3: "Pending Payment", T4: "Available" });
  });
});
