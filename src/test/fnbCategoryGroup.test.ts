import { describe, it, expect } from "vitest";
import { getCategoryGroup, CATEGORY_GROUP_TABS } from "@/hooks/useFnb";

describe("menu category tabs", () => {
  it("puts beers and soju under Alcohol, not Drinks", () => {
    expect(getCategoryGroup("beer")).toBe("alcohol");
    expect(getCategoryGroup("soft_drinks")).toBe("drinks");
  });

  it("puts snacks under Food now that the Snacks tab is gone", () => {
    expect(getCategoryGroup("finger_food")).toBe("food");
    expect(getCategoryGroup("snacks")).toBe("food");
    expect(getCategoryGroup("others")).toBe("others");
  });

  it("shows All, Drinks, Alcohol, Food, Others in that order", () => {
    expect(CATEGORY_GROUP_TABS.map((t) => t.label)).toEqual(["All", "Drinks", "Alcohol", "Food", "Others"]);
  });
});
