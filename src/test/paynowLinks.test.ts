import { describe, it, expect } from "vitest";
import { linkText, suggestionText, howLabel, isLinked, canOpen, customerSuffix, type PaynowLink } from "@/lib/paynowLinks";

const topup: PaynowLink = { kind: "topup", label: "Wallet top-up · DANIEL #457375", id: "r1", customer: { name: "DANIEL", shortId: "457375" }, how: "auto", transactionId: "t1" };
const invoice: PaynowLink = { kind: "table_invoice", label: "Table 5 invoice · $29.40 · 01:46", id: "s1", customer: null, how: "staff_link", transactionId: "t2" };

describe("paynow link formatting", () => {
  it("labels how a link was made", () => {
    expect(howLabel("auto")).toBe("auto-matched");
    expect(howLabel("confirmed")).toBe("match confirmed");
    expect(howLabel("staff_link")).toBe("linked by staff");
    expect(howLabel(undefined)).toBe("");
  });

  it("formats definite links without repeating the customer", () => {
    expect(linkText(topup)).toBe("Wallet top-up · DANIEL #457375 (auto-matched)");
    expect(linkText(invoice)).toBe("Table 5 invoice · $29.40 · 01:46 (linked by staff)");
    const booking: PaynowLink = { kind: "booking", label: "Booking · Table 3 · Sun 11 Oct 20:00", id: "b1", customer: { name: "Alice", shortId: null }, how: "staff_link" };
    expect(customerSuffix(booking)).toBe(" · Alice");
    expect(linkText(booking)).toBe("Booking · Table 3 · Sun 11 Oct 20:00 · Alice (linked by staff)");
  });

  it("formats suggestions with their reason", () => {
    const s: PaynowLink = { kind: "fnb", label: "F&B · 2× Coca Cola", id: "o1", customer: { name: "Bob", shortId: "123456" }, reason: "same amount, 2 min earlier" };
    expect(suggestionText(s)).toBe("F&B · 2× Coca Cola · Bob #123456 — same amount, 2 min earlier");
    const split: PaynowLink = { kind: "split", label: "Table 5 invoice · $20.00 · 19:58 + F&B · Nachos ($15.00)", id: "a+b", reason: "2 payments add up to $35.00, within 6 min" };
    expect(suggestionText(split)).toBe("Table 5 invoice · $20.00 · 19:58 + F&B · Nachos ($15.00) — 2 payments add up to $35.00, within 6 min");
    expect(canOpen(split)).toBe(false);
  });

  it("knows linked vs not linked, and what can be opened", () => {
    expect(isLinked({ linkedTo: [topup] })).toBe(true);
    expect(isLinked({ linkedTo: [] })).toBe(false);
    expect(isLinked({})).toBe(false);
    expect(canOpen(invoice)).toBe(true);
    expect(canOpen({ ...invoice, transactionId: null })).toBe(false);
  });
});
