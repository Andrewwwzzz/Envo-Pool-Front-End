import { describe, it, expect } from "vitest";
import { normalizeTableName, isValidTable } from "@/lib/fnbTable";

describe("table number", () => {
  it("normalizes the ways members type it", () => {
    expect(normalizeTableName(" 3 ")).toBe("Table 3");
    expect(normalizeTableName("t12")).toBe("Table 12");
    expect(normalizeTableName("Table 5")).toBe("Table 5");
  });

  it("accepts tables 1 to 14 only", () => {
    expect(isValidTable("1")).toBe(true);
    expect(isValidTable("Table 14")).toBe(true);
    expect(isValidTable("0")).toBe(false);
    expect(isValidTable("15")).toBe(false);
    expect(isValidTable("")).toBe(false);
    expect(isValidTable("bar")).toBe(false);
  });
});
