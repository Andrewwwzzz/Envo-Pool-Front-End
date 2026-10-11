import { describe, it, expect } from "vitest";
import { topUpCanBeCredited, topUpLateCreditDeadline, TOPUP_EXPIRED_BADGE_CLASS } from "@/lib/topUpStatus";

const now = new Date("2026-10-12T12:00:00Z");
const hoursAgo = (h: number) => new Date(now.getTime() - h * 60 * 60 * 1000).toISOString();

describe("topUpCanBeCredited (mirrors the server's claimableFilter)", () => {
  it("allows pending requests", () => {
    expect(topUpCanBeCredited({ status: "pending" }, now)).toBe(true);
    expect(topUpCanBeCredited({ status: undefined }, now)).toBe(true);
  });

  it("allows a request expired within the last 48 hours", () => {
    expect(topUpCanBeCredited({ status: "expired", expiredAt: hoursAgo(1) }, now)).toBe(true);
    expect(topUpCanBeCredited({ status: "expired", expiredAt: hoursAgo(47.9) }, now)).toBe(true);
    expect(topUpCanBeCredited({ status: "expired", expiredAt: hoursAgo(48) }, now)).toBe(true); // server: expiredAt >= now - 48h
  });

  it("refuses a request expired more than 48 hours ago, or with no expiredAt", () => {
    expect(topUpCanBeCredited({ status: "expired", expiredAt: hoursAgo(48.1) }, now)).toBe(false);
    expect(topUpCanBeCredited({ status: "expired", expiredAt: null }, now)).toBe(false);
  });

  it("refuses processed requests", () => {
    for (const status of ["approved", "rejected", "cancelled"]) {
      expect(topUpCanBeCredited({ status, expiredAt: hoursAgo(1) }, now)).toBe(false);
    }
  });
});

describe("topUpLateCreditDeadline", () => {
  it("is 48 hours after expiry, only for expired requests", () => {
    expect(topUpLateCreditDeadline({ status: "expired", expiredAt: "2026-10-12T12:00:00Z" })?.toISOString()).toBe("2026-10-14T12:00:00.000Z");
    expect(topUpLateCreditDeadline({ status: "pending", expiredAt: "2026-10-12T12:00:00Z" })).toBeNull();
  });
});

describe("expired badge", () => {
  it("is grey, not the pending yellow", () => {
    expect(TOPUP_EXPIRED_BADGE_CLASS).toContain("text-muted-foreground");
    expect(TOPUP_EXPIRED_BADGE_CLASS).not.toContain("yellow");
  });
});
