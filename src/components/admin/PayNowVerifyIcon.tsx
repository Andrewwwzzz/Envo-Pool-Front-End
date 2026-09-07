import { Mail, AlertTriangle } from "lucide-react";
import { fmtTimeSG } from "@/lib/sgTime";

// Same tolerance/window used by the backend's own counter-payment collision
// check (paymentMatchingCron.js findCollidingCounterPayment) — reused here
// in reverse: given a booking/invoice/F&B order's paynow charge, look for a
// Gmail alert that's plausibly the same transfer. Walk-ins often have no
// linked account, so amount+time is the only thing there is to match on.
const PAYNOW_MATCH_WINDOW_MINUTES = 20;
const PAYNOW_MATCH_TOLERANCE = 0.005;

export function findMatchingGmailPayment(
  amount: number,
  timestamp: string | Date | null | undefined,
  payments: any[] | undefined
) {
  if (!timestamp || !payments?.length || !(Number(amount) > 0)) return null;
  const t = new Date(timestamp).getTime();
  if (Number.isNaN(t)) return null;
  const windowMs = PAYNOW_MATCH_WINDOW_MINUTES * 60 * 1000;
  return (
    payments.find((p) => {
      const pt = new Date(p.transactionTimestamp).getTime();
      return Math.abs(pt - t) <= windowMs && Math.abs(Number(p.amount) - Number(amount)) <= PAYNOW_MATCH_TOLERANCE;
    }) || null
  );
}

// Small inline indicator for a paynow row — shown next to the payment
// method badge on Bookings/Invoices/F&B orders. Silent (renders nothing)
// for any other payment method.
//
// groupAmount (F&B only): a customer often orders a few items separately
// then pays for all of them in one transfer — no single order's price
// matches the transfer amount on its own. If provided, this is the sum of
// this order + other nearby same-table paynow orders; it's tried as a
// fallback when the order's own price doesn't match anything by itself.
export function PayNowVerifyIcon({
  paymentMethod,
  amount,
  timestamp,
  gmailPayments,
  groupAmount,
}: {
  paymentMethod: string | null | undefined;
  amount: number;
  timestamp: string | Date | null | undefined;
  gmailPayments: any[] | undefined;
  groupAmount?: number;
}) {
  if (String(paymentMethod || "").toLowerCase() !== "paynow") return null;
  const soloMatch = findMatchingGmailPayment(amount, timestamp, gmailPayments);
  const match = soloMatch || (groupAmount && groupAmount !== amount ? findMatchingGmailPayment(groupAmount, timestamp, gmailPayments) : null);
  if (match) {
    const groupNote = !soloMatch ? " — matched as part of a combined payment with other orders on this table" : "";
    return (
      <span
        className="inline-block ml-1.5 align-text-bottom"
        title={`PayNow transfer verified — $${Number(match.amount).toFixed(2)} from "${match.senderName || "unknown"}" at ${fmtTimeSG(match.transactionTimestamp)}${groupNote}`}
      >
        <Mail className="h-3.5 w-3.5 text-emerald-400" />
      </span>
    );
  }
  return (
    <span
      className="inline-block ml-1.5 align-text-bottom"
      title="No matching PayNow transfer found in Gmail within ±20 min — verify manually (checked this order alone and combined with other same-table orders nearby)"
    >
      <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
    </span>
  );
}
