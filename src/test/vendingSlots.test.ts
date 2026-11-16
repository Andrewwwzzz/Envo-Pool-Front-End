import { describe, it, expect } from "vitest";
import { sortSlots, sellableDrinks, sellableByCategory, slotAvailable, stableSlotOrder, orderSlots } from "@/lib/vendingSlots";
import type { VendingSlot } from "@/hooks/useVending";

const slot = (over: Partial<VendingSlot> & { slotNo: number }): VendingSlot => ({
  _id: `s${over.slotNo}`, machineId: "M1", productRef: null, displayName: null, imageUrl: null, priceCents: null,
  enabled: true, reservedCount: 0, status: "0", quantity: 5, capacity: 10, name: null, machinePrice: null, lastReportAt: null,
  ...over,
});
const product = (id: string, name: string, category: string, sellingPrice = 2) => ({ _id: id, name, category, sellingPrice });

describe("slotAvailable", () => {
  it("is quantity minus reservations, and zero on a faulty slot", () => {
    expect(slotAvailable(slot({ slotNo: 1, quantity: 5, reservedCount: 2 }))).toBe(3);
    expect(slotAvailable(slot({ slotNo: 1, quantity: 1, reservedCount: 2 }))).toBe(0);
    expect(slotAvailable(slot({ slotNo: 1, quantity: 5, status: "255" }))).toBe(0);
    expect(slotAvailable(slot({ slotNo: 1, quantity: null, status: null }))).toBe(0);
  });

  it("is zero for a stuck slot, while another slot of the same drink still sells", () => {
    expect(slotAvailable(slot({ slotNo: 1, quantity: 5, stuckAt: "2026-11-16T10:00:00Z" }))).toBe(0);
    const drinks = sellableDrinks([
      slot({ slotNo: 30, productRef: product("a", "Chrysanthemum", "soft_drinks"), quantity: 2, stuckAt: "2026-11-16T10:00:00Z" }),
      slot({ slotNo: 31, productRef: product("a", "Chrysanthemum", "soft_drinks"), quantity: 3 }),
    ]);
    expect(drinks).toHaveLength(1);
    expect(drinks[0].available).toBe(3);
  });
});

describe("sortSlots", () => {
  const slots = [
    slot({ slotNo: 1, productRef: product("b", "Tiger", "beer") }),
    slot({ slotNo: 2, productRef: product("a", "Pokka Green Tea", "soft_drinks") }),
    slot({ slotNo: 3 }),
    slot({ slotNo: 4, productRef: product("c", "Chrysanthemum", "soft_drinks") }),
    slot({ slotNo: 5, productRef: product("a", "Pokka Green Tea", "soft_drinks") }),
  ];

  it("by type: soft drinks before beer, name within type, slot within name, empty slots last", () => {
    expect(sortSlots(slots, "type").map((s) => s.slotNo)).toEqual([4, 2, 5, 1, 3]);
  });

  it("by slot: plain slot order", () => {
    expect(sortSlots([...slots].reverse(), "slot").map((s) => s.slotNo)).toEqual([1, 2, 3, 4, 5]);
  });

  it("does not mutate the input", () => {
    const copy = [...slots];
    sortSlots(slots, "type");
    expect(slots).toEqual(copy);
  });
});

describe("sellableDrinks", () => {
  it("adds up stock across slots of one drink and skips disabled or unassigned slots", () => {
    const drinks = sellableDrinks([
      slot({ slotNo: 1, productRef: product("a", "Green Tea", "soft_drinks", 2.5), quantity: 3 }),
      slot({ slotNo: 3, productRef: product("a", "Green Tea", "soft_drinks", 2.5), quantity: 2, reservedCount: 1 }),
      slot({ slotNo: 2, productRef: product("a", "Green Tea", "soft_drinks", 2.5), quantity: 9, enabled: false }),
      slot({ slotNo: 4 }),
      slot({ slotNo: 5, productRef: product("b", "Tiger", "beer", 6), priceCents: 650, quantity: 0 }),
    ]);
    expect(drinks).toEqual([
      { productId: "a", name: "Green Tea", category: "soft_drinks", priceCents: 250, available: 4, slots: [1, 3] },
      { productId: "b", name: "Tiger", category: "beer", priceCents: 650, available: 0, slots: [5] },
    ]);
  });

  it("groups by type in menu order with labels", () => {
    const groups = sellableByCategory([
      slot({ slotNo: 1, productRef: product("b", "Tiger", "beer") }),
      slot({ slotNo: 2, productRef: product("a", "Coke", "soft_drinks") }),
    ]);
    expect(groups.map((g) => g.label)).toEqual(["Soft drinks", "Beer"]);
    expect(groups[0].drinks[0].name).toBe("Coke");
  });
});

describe("stableSlotOrder", () => {
  it("keeps a row in place after its product changes, until the sort is redone", () => {
    const before = [
      slot({ slotNo: 54, productRef: product("c", "Coca Cola", "soft_drinks") }),
      slot({ slotNo: 55, productRef: product("c", "Coca Cola", "soft_drinks") }),
      slot({ slotNo: 60, productRef: product("z", "Zesta", "soft_drinks") }),
    ];
    const keys = stableSlotOrder(before, "type", null);
    expect(orderSlots(before, keys).map((s) => s.slotNo)).toEqual([54, 55, 60]);
    // Slot 54 changed to a drink that sorts last: it stays first on screen.
    const after = [slot({ slotNo: 54, productRef: product("z2", "Zzz Soda", "soft_drinks") }), before[1], before[2]];
    expect(orderSlots(after, stableSlotOrder(after, "type", keys)).map((s) => s.slotNo)).toEqual([54, 55, 60]);
    // A fresh sort moves it.
    expect(orderSlots(after, stableSlotOrder(after, "type", null)).map((s) => s.slotNo)).toEqual([55, 60, 54]);
  });
});
