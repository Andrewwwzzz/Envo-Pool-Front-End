// "Linked to" on Admin → Payments → Top Ups → Transactions: what a bank
// PayNow alert paid for (definite links from the server's `linkedTo`), or
// what it might have paid for (`suggestions`) when nothing is linked.

export type PaynowLinkKind =
  | "topup" | "table_invoice" | "walkin" | "booking" | "fnb" | "membership" | "locker" | "other" | "split";

export interface PaynowLink {
  kind: PaynowLinkKind;
  label: string;
  id: string;
  refType?: string | null;
  transactionId?: string | null;
  customer?: { name: string; shortId?: string | null } | null;
  amount?: number | null;
  at?: string | null;
  how?: "auto" | "confirmed" | "staff_link" | "auto_check";
  reason?: string;
  parts?: PaynowLink[];
}

export const LINK_KIND_LABEL: Record<PaynowLinkKind, string> = {
  topup: "Wallet top-up",
  table_invoice: "Table invoice",
  walkin: "Walk-in",
  booking: "Booking",
  fnb: "F&B",
  membership: "Membership",
  locker: "Locker",
  other: "Payment",
  split: "Several payments",
};

/** How a definite link was made, in staff words. */
export function howLabel(how?: PaynowLink["how"]): string {
  if (how === "auto") return "auto-matched";
  if (how === "confirmed") return "match confirmed";
  if (how === "staff_link") return "linked by staff";
  if (how === "auto_check") return "matched automatically";
  return "";
}

/** The customer, unless the label already names them (top-ups do). */
export function customerSuffix(link: PaynowLink): string {
  const c = link.customer;
  if (!c?.name || link.label.includes(c.name)) return "";
  return ` · ${c.name}${c.shortId ? ` #${c.shortId}` : ""}`;
}

/** One line for a definite link: "Table 5 invoice · $29.40 · 01:46 (linked by staff)". */
export function linkText(link: PaynowLink): string {
  const how = howLabel(link.how);
  return `${link.label}${customerSuffix(link)}${how ? ` (${how})` : ""}`;
}

/** One line for a suggestion: "F&B · Fries — same amount, 2 min earlier". */
export function suggestionText(s: PaynowLink): string {
  return `${s.label}${customerSuffix(s)}${s.reason ? ` — ${s.reason}` : ""}`;
}

export const isLinked = (p: { linkedTo?: PaynowLink[] | null }) => Array.isArray(p.linkedTo) && p.linkedTo.length > 0;

/** A link can open a detail view when it has a recorded transaction behind it. */
export const canOpen = (link: PaynowLink) => !!link.transactionId && link.kind !== "split";

/** A bank alert row as the Transactions list receives it (other fields as stored). */
export interface GmailPaymentRow {
  _id: string;
  linkedTo?: PaynowLink[] | null;
  suggestions?: PaynowLink[] | null;
  [field: string]: unknown;
}

type SoloMatcher = (amount: number, at: string | null | undefined, payments: any[], chargeKey: string) => { payment: any; contested: boolean } | null;
type MixedMatcher = (chargeKey: string, payments: any[]) => { payment: any; contested: boolean } | null;
const CHARGE_TYPES = new Set(["Booking", "TimerSession", "FnbOrder"]);

/**
 * The charges a transfer with no definite link has turned green by itself (B35):
 * the same check as the PayNow icon (findMatchingGmailPayment / findMixedBillMatch,
 * passed in) run on each "Possible" suggestion — kept when that charge's automatic
 * match is this very transfer and uncontested. Charges staff resolved by hand
 * (`resolved` = "RefType:id" of any override) are left out: their icon isn't automatic.
 */
export function automaticMatches(
  p: GmailPaymentRow & { usedFor?: unknown },
  payments: any[] | undefined,
  resolved: Set<string>,
  solo: SoloMatcher,
  mixed: MixedMatcher,
): PaynowLink[] {
  if (!payments?.length || isLinked(p) || p.usedFor) return [];
  const mine = (m: { payment: any; contested: boolean } | null) => !!m && !m.contested && String(m.payment?._id) === String(p._id);
  const out: PaynowLink[] = [];
  for (const s of p.suggestions || []) {
    if (s.kind === "split") {
      const parts = s.parts || [];
      const keys = parts.map((x) => `${x.refType}:${x.id}`);
      if (parts.length && parts.every((x) => x.refType && CHARGE_TYPES.has(x.refType)) && keys.every((k) => !resolved.has(k) && mine(mixed(k, payments)))) {
        out.push({ ...s, how: "auto_check" });
      }
      continue;
    }
    if (!s.refType || !CHARGE_TYPES.has(s.refType)) continue;
    const key = `${s.refType}:${s.id}`;
    if (resolved.has(key)) continue;
    if (mine(solo(Number(s.amount), s.at, payments, key))) out.push({ ...s, how: "auto_check" });
  }
  return out;
}
