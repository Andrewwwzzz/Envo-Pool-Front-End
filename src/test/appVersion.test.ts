import { describe, it, expect } from "vitest";
import { isOutdated, shouldReloadOnResume, RESUME_RELOAD_AFTER_MS } from "@/hooks/useAppVersion";

describe("app version check", () => {
  it("is outdated only when the deployed version differs from this build", () => {
    expect(isOutdated("abc123", "def456")).toBe(true);
    expect(isOutdated("abc123", "abc123")).toBe(false);
    expect(isOutdated("abc123", null)).toBe(false);
  });

  it("never flags the dev server", () => {
    expect(isOutdated("dev", "def456")).toBe(false);
  });

  it("reloads on reopening only after a long time away", () => {
    const base = { current: "abc123", remote: "def456", reloadedFor: null };
    expect(shouldReloadOnResume({ ...base, hiddenMs: RESUME_RELOAD_AFTER_MS })).toBe(true);
    // A quick trip to the bank app keeps the page (and any half-filled form)
    expect(shouldReloadOnResume({ ...base, hiddenMs: 5 * 60 * 1000 })).toBe(false);
  });

  it("doesn't reload when up to date or already reloaded for that version", () => {
    const hiddenMs = 2 * RESUME_RELOAD_AFTER_MS;
    expect(shouldReloadOnResume({ current: "abc123", remote: "abc123", hiddenMs, reloadedFor: null })).toBe(false);
    expect(shouldReloadOnResume({ current: "abc123", remote: "def456", hiddenMs, reloadedFor: "def456" })).toBe(false);
  });
});
