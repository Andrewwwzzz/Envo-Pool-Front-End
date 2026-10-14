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

describe("automaticMatches (B35)", async () => {
  const { automaticMatches } = await import("@/lib/paynowLinks");
  const { findMatchingGmailPayment, findMixedBillMatch } = await import("@/components/admin/PayNowVerifyIcon");
  const at = "2026-10-14T01:05:00.000Z";
  const order = (id: string, amount = 2.5): PaynowLink => ({ kind: "fnb", label: `F&B · item ${id}`, id, refType: "FnbOrder", amount, at, reason: "same amount, same minute" });
  const alert = (id: string, extra: Record<string, unknown> = {}) => ({ _id: id, amount: 2.5, transactionTimestamp: at, linkedTo: [], suggestions: [order("o1")], candidateCharges: ["FnbOrder:o1"], ...extra });
  const run = (p: any, all: any[], resolved = new Set<string>()) => automaticMatches(p, all, resolved, findMatchingGmailPayment, findMixedBillMatch);

  it("names the charge a free, uncontested transfer turned green", () => {
    const a = alert("a1");
    const got = run(a, [a]);
    expect(got.map((l) => l.id)).toEqual(["o1"]);
    expect(linkText(got[0])).toBe("F&B · item o1 (matched automatically)");
  });

  it("leaves it Not linked when the match is contested, already used, or resolved by hand", () => {
    const a = alert("a1", { candidateCharges: ["FnbOrder:o1", "FnbOrder:o2"] });
    expect(run(a, [a])).toEqual([]);                                  // two charges, one transfer
    const used = alert("a1", { usedFor: { kind: "topup" } });
    expect(run(used, [used])).toEqual([]);
    const b = alert("a1");
    expect(run(b, [b], new Set(["FnbOrder:o1"]))).toEqual([]);       // staff linked / confirmed / flagged it
    const linked = alert("a1", { linkedTo: [order("o9")] });
    expect(run(linked, [linked])).toEqual([]);
  });

  it("only claims the charge when this transfer is its nearest match", () => {
    const near = alert("near", { transactionTimestamp: at });
    const far = alert("far", { transactionTimestamp: "2026-10-14T01:15:00.000Z", candidateCharges: ["FnbOrder:o1"] });
    expect(run(far, [near, far])).toEqual([]);
  });

  it("matches a mixed bill when every part points at this transfer", () => {
    const split: PaynowLink = { kind: "split", label: "Table 5 invoice + F&B", id: "s1+o1", parts: [{ kind: "table_invoice", label: "Table 5 invoice", id: "s1", refType: "TimerSession" }, order("o1")], reason: "2 payments add up" };
    const a = { _id: "a1", amount: 12, transactionTimestamp: at, linkedTo: [], suggestions: [split], mixedBill: ["TimerSession:s1", "FnbOrder:o1"] };
    expect(run(a, [a]).map((l) => l.kind)).toEqual(["split"]);
    const rival = { ...a, _id: "a2" };
    expect(run(a, [a, rival])).toEqual([]);
  });
});
