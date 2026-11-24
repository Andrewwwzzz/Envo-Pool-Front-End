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

  it("accepts the T3 form the input box suggests, and staff always see 'Table N'", () => {
    expect(isValidTable("T3")).toBe(true);
    expect(isValidTable("t4")).toBe(true);
    expect(isValidTable("T 7")).toBe(true);
    expect(isValidTable("T15")).toBe(false);
    expect(normalizeTableName("table5")).toBe("Table 5");
    expect(normalizeTableName("TABLE 2")).toBe("Table 2");
    expect(normalizeTableName("T 7")).toBe("Table 7");
  });
});
