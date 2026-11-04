import { describe, it, expect, vi } from "vitest";
import { ReactNode } from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const responses: Record<string, unknown> = {};

vi.mock("@/lib/api", () => ({
  BASE_URL: "https://api.test",
  apiFetch: vi.fn(async (path: string) => {
    const body = responses[path];
    return { ok: body !== undefined, json: async () => body ?? { error: "not found" } };
  }),
}));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

import { useVendingMenu, useVendingOrder, fmtCents, isOrderFinal, vendingImageSrc } from "@/hooks/useVending";

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("vending helpers", () => {
  it("formats cents as dollars", () => {
    expect(fmtCents(250)).toBe("$2.50");
    expect(fmtCents(0)).toBe("$0.00");
    expect(fmtCents(1000)).toBe("$10.00");
  });

  it("knows which order statuses are final", () => {
    expect(isOrderFinal("queued")).toBe(false);
    expect(isOrderFinal("sent")).toBe(false);
    expect(isOrderFinal("dispensed")).toBe(true);
    expect(isOrderFinal("refunded")).toBe(true);
    expect(isOrderFinal("needs_review")).toBe(true);
    expect(isOrderFinal(undefined)).toBe(false);
  });

  it("prefixes backend-relative photos and leaves full URLs alone", () => {
    expect(vendingImageSrc({ imageUrl: "/api/fnb/products/1/image?v=2" })).toBe("https://api.test/api/fnb/products/1/image?v=2");
    expect(vendingImageSrc({ imageUrl: "https://cdn.example.com/coke.png" })).toBe("https://cdn.example.com/coke.png");
    expect(vendingImageSrc({ imageUrl: null })).toBeNull();
  });
});

describe("useVendingMenu", () => {
  it("returns the machine's items and free-drink state", async () => {
    responses["/api/vending/products"] = {
      machines: [{ machineId: "2205200016", online: true }],
      items: [{ machineId: "2205200016", slotNo: 30, name: "Coke", priceCents: 250, inStock: true, freeDrinkEligible: false, machineOnline: true }],
      freeDrink: { hasBenefit: true, redeemedToday: false },
      pickupCodeMinutes: 30,
    };
    const { result } = renderHook(() => useVendingMenu(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.items[0].name).toBe("Coke");
    expect(result.current.data?.machines[0].online).toBe(true);
  });
});

describe("useVendingOrder", () => {
  it("does nothing without an id and loads the order with one", async () => {
    const idle = renderHook(() => useVendingOrder(null), { wrapper });
    expect(idle.result.current.fetchStatus).toBe("idle");

    responses["/api/vending/orders/abc"] = { order: { _id: "abc", status: "dispensed", message: "Dispensed — enjoy!", productName: "Coke", priceCents: 250 } };
    const { result } = renderHook(() => useVendingOrder("abc"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.status).toBe("dispensed");
  });
});
