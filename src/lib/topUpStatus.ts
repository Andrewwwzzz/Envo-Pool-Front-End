/**
 * Top-up request status helpers shared by the admin Top Ups tab and the
 * customer's top-up history.
 *
 * The server marks a request still pending 1 hour after it was made as
 * "expired" (with an expiredAt date). For 48 hours after that, staff Approve
 * and Confirm Match still credit it like a pending one (the customer may have
 * paid late) — see TopUpRequest.claimableFilter on the server.
 */

export const TOPUP_LATE_PAYMENT_WINDOW_MS = 48 * 60 * 60 * 1000;

/** Grey badge for expired requests (pending stays yellow). */
export const TOPUP_EXPIRED_BADGE_CLASS = "bg-muted text-muted-foreground border-border";

interface TopUpLike {
  status?: string | null;
  expiredAt?: string | Date | null;
  expired_at?: string | Date | null;
}

/** When an expired request stops being creditable, or null if it isn't an expired request. */
export function topUpLateCreditDeadline(r: TopUpLike | null | undefined): Date | null {
  if (String(r?.status || "").toLowerCase() !== "expired") return null;
  const raw = r?.expiredAt ?? r?.expired_at;
  if (!raw) return null;
  const expiredAt = new Date(raw);
  if (isNaN(expiredAt.getTime())) return null;
  return new Date(expiredAt.getTime() + TOPUP_LATE_PAYMENT_WINDOW_MS);
}

/**
 * Whether staff can still credit this request (Approve / Confirm Match):
 * pending, or expired within the last 48 hours.
 */
export function topUpCanBeCredited(r: TopUpLike | null | undefined, now: Date = new Date()): boolean {
  const status = String(r?.status || "pending").toLowerCase();
  if (status === "pending") return true;
  const deadline = topUpLateCreditDeadline(r);
  return !!deadline && now.getTime() <= deadline.getTime();
}
