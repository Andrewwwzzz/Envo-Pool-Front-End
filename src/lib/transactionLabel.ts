// Derive a human-readable description for a transaction based on its
// type, payment method, and (optionally) a list of membership plan prices.
//
// Backend will eventually return an optional `description` field on the
// Transaction model — when present we use it as-is. Otherwise we derive
// the label from type + method + amount.

export function deriveTransactionDescription(
  tx: {
    description?: string;
    type?: string;
    transactionType?: string;
    paymentMethod?: string;
    payment_method?: string;
    method?: string;
    amount?: number | string | { amount?: number };
  },
  membershipPrices: number[] = []
): string {
  if (tx?.description && String(tx.description).trim()) return String(tx.description);

  const rawType = String(tx?.type || tx?.transactionType || "").toLowerCase();
  const rawMethod = String(tx?.paymentMethod || tx?.payment_method || tx?.method || "").toLowerCase();

  const typeKey: "payment" | "topup" | "refund" | "other" =
    rawType === "booking_payment" || rawType === "wallet_deduct" || rawType === "payment"
      ? "payment"
      : rawType === "topup" || rawType === "top_up" || rawType === "deposit"
      ? "topup"
      : rawType === "refund"
      ? "refund"
      : "other";

  const methodKey =
    rawMethod === "stripe" ? "paynow" :
    rawMethod === "wallet" ? "wallet" :
    rawMethod === "cash" ? "cash" :
    rawMethod === "reward" || rawMethod === "rewards" || rawMethod === "points" ? "reward" :
    rawMethod === "paynow" ? "paynow" :
    rawMethod;

  const amtRaw =
    typeof tx?.amount === "object" ? (tx.amount?.amount ?? 0) :
    typeof tx?.amount === "number" ? tx.amount :
    Number(tx?.amount) || 0;
  const absAmt = Math.abs(amtRaw);

  if (typeKey === "payment") {
    if (methodKey === "wallet") {
      // Detect membership purchase by exact price match against any active plan.
      if (membershipPrices.some((p) => Math.abs(p - absAmt) < 0.005)) {
        return "Membership Purchase";
      }
      return "Table Booking";
    }
    if (methodKey === "reward") return "Reward Discount";
    if (methodKey === "paynow") return "Table Booking (PayNow)";
    return "Payment";
  }

  if (typeKey === "topup") {
    if (methodKey === "paynow") return "Wallet Top Up — PayNow";
    if (methodKey === "cash") return "Wallet Top Up — Cash";
    if (methodKey === "reward") return "Wallet Credit Redeemed";
    return "Wallet Top Up";
  }

  if (typeKey === "refund") return "Refund";

  return "";
}
