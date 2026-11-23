import { describe, it, expect } from "vitest";
import { foodBundleSavings, cartUnits } from "@/lib/fnbBundle";

const cfg = { enabled: true, size: 3, price: 10.5 };
const food = (price: number, qty = 1) => ({ category: "finger_food", price, qty });

describe("foodBundleSavings", () => {
  it("takes $1.50 off three $4 foods", () => {
    expect(foodBundleSavings(cartUnits([food(4, 3)]), cfg)).toEqual({ savings: 1.5, bundles: 1 });
  });

  it("gives nothing for two foods", () => {
    expect(foodBundleSavings(cartUnits([food(4, 2)]), cfg)).toEqual({ savings: 0, bundles: 0 });
  });

  it("ignores drinks and snacks when counting foods", () => {
    const lines = [food(4, 2), { category: "soft_drinks", price: 2, qty: 3 }, { category: "snacks", price: 3, qty: 1 }];
    expect(foodBundleSavings(cartUnits(lines), cfg).bundles).toBe(0);
  });

  it("makes one bundle per full group of three", () => {
    expect(foodBundleSavings(cartUnits([food(4, 7)]), cfg)).toEqual({ savings: 3, bundles: 2 });
  });

  it("skips a group that is already cheaper (happy hour)", () => {
    expect(foodBundleSavings(cartUnits([food(3, 3)]), cfg).savings).toBe(0);
  });

  it("does nothing when the bundle is switched off", () => {
    expect(foodBundleSavings(cartUnits([food(4, 3)]), { ...cfg, enabled: false }).savings).toBe(0);
  });
});
