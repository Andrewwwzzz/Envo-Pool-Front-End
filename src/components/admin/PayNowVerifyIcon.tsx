import { useState } from "react";
import { Mail, AlertTriangle, XCircle, Link2, Loader2 } from "lucide-react";
import { fmtTimeSG, fmtDateTimeSG } from "@/lib/sgTime";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAdminPaynowOverrides, useSetPaynowOverride, useClearPaynowOverride } from "@/hooks/useAdmin";

type RefType = "Booking" | "TimerSession" | "FnbOrder";

// Same tolerance/window used by the backend's own counter-payment collision
// check (paymentMatchingCron.js findCollidingCounterPayment) — reused here
// in reverse: given a booking/invoice/F&B order's paynow charge, look for a
// Gmail alert that's plausibly the same transfer. Walk-ins often have no
// linked account, so amount+time is the only thing there is to match on.
const PAYNOW_MATCH_WINDOW_MINUTES = 20;
const PAYNOW_MATCH_TOLERANCE = 0.005;

// A transfer counts for one thing only (D106). The server marks each transfer
// with usedFor (credited to a top-up, or linked to a charge by staff) and
// candidateCharges (PayNow charges of the same amount within the window that
// nobody has resolved by hand). A charge is verified automatically only by a
// free transfer, and only when there are at least as many free transfers as
// charges competing for them — otherwise it's "contested" and staff link the
// right one by hand.
export function findMatchingGmailPayment(
  amount: number,
  timestamp: string | Date | null | undefined,
  payments: any[] | undefined,
  chargeKey?: string
): { payment: any; contested: boolean } | null {
  if (!timestamp || !payments?.length || !(Number(amount) > 0)) return null;
  const t = new Date(timestamp).getTime();
  if (Number.isNaN(t)) return null;
  const windowMs = PAYNOW_MATCH_WINDOW_MINUTES * 60 * 1000;
  const mine = payments
    .filter((p) => !p.usedFor)
    .filter((p) => {
      const pt = new Date(p.transactionTimestamp).getTime();
      return Math.abs(pt - t) <= windowMs && Math.abs(Number(p.amount) - Number(amount)) <= PAYNOW_MATCH_TOLERANCE;
    })
    .sort((a, b) => Math.abs(new Date(a.transactionTimestamp).getTime() - t) - Math.abs(new Date(b.transactionTimestamp).getTime() - t));
  if (!mine.length) return null;
  const rivals = new Set<string>(chargeKey ? [chargeKey] : []);
  for (const p of mine) for (const k of p.candidateCharges || []) rivals.add(k);
  return { payment: mine[0], contested: mine.length < rivals.size };
}

// Small inline indicator for a paynow row — shown next to the payment
// method badge on Bookings/Invoices/F&B orders. Silent (renders nothing)
// for any other payment method. Clickable — opens an editor so staff can
// manually resolve it (link to a specific Gmail transfer, confirm paid
// with no record, flag as unpaid, or clear back to automatic).
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
  refType,
  refId,
}: {
  paymentMethod: string | null | undefined;
  amount: number;
  timestamp: string | Date | null | undefined;
  gmailPayments: any[] | undefined;
  groupAmount?: number;
  refType: RefType;
  refId: string | null | undefined;
}) {
  const [open, setOpen] = useState(false);
  const { data: overrides } = useAdminPaynowOverrides(true);

  if (String(paymentMethod || "").toLowerCase() !== "paynow") return null;

  const override = refId ? overrides?.find((o: any) => o.refType === refType && String(o.refId) === String(refId)) : null;
  const chargeKey = refId ? `${refType}:${refId}` : undefined;
  const soloMatch = findMatchingGmailPayment(amount, timestamp, gmailPayments, chargeKey);
  const groupMatch = !soloMatch && groupAmount && groupAmount !== amount ? findMatchingGmailPayment(groupAmount, timestamp, gmailPayments, chargeKey) : null;
  const found = soloMatch || groupMatch;
  const autoMatch = found && !found.contested ? found.payment : null;
  const contested = found?.contested ? found.payment : null;

  let icon: React.ReactNode;
  let title: string;

  if (override?.status === "flagged_unpaid") {
    icon = <XCircle className="h-3.5 w-3.5 text-destructive" />;
    title = `Flagged as NOT paid by ${override.verifiedBy?.name || override.verifiedBy?.email || "staff"}${override.note ? ` — ${override.note}` : ""}`;
  } else if (override?.status === "linked" && override.gmailPaymentId) {
    icon = <Link2 className="h-3.5 w-3.5 text-emerald-400" />;
    const g = override.gmailPaymentId;
    title = `Manually linked to $${Number(g.amount).toFixed(2)} from "${g.senderName || "unknown"}" at ${fmtTimeSG(g.transactionTimestamp)} — by ${override.verifiedBy?.name || override.verifiedBy?.email || "staff"}`;
  } else if (override?.status === "confirmed_paid") {
    icon = <Mail className="h-3.5 w-3.5 text-emerald-400" />;
    title = `Manually confirmed paid by ${override.verifiedBy?.name || override.verifiedBy?.email || "staff"}${override.note ? ` — ${override.note}` : ""}`;
  } else if (autoMatch) {
    const groupNote = !soloMatch ? " — matched as part of a combined payment with other orders on this table" : "";
    icon = <Mail className="h-3.5 w-3.5 text-emerald-400" />;
    title = `PayNow transfer verified — $${Number(autoMatch.amount).toFixed(2)} from "${autoMatch.senderName || "unknown"}" at ${fmtTimeSG(autoMatch.transactionTimestamp)}${groupNote}`;
  } else if (contested) {
    icon = <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />;
    title = `Possible duplicate — more than one PayNow charge could match the $${Number(contested.amount).toFixed(2)} transfer from "${contested.senderName || "unknown"}" at ${fmtTimeSG(contested.transactionTimestamp)}. Click to link the right one`;
  } else {
    icon = <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />;
    title = "No matching PayNow transfer found in Gmail within ±20 min — click to resolve manually";
  }

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        className="inline-block ml-1.5 align-text-bottom hover:opacity-70"
        title={title}
      >
        {icon}
      </button>
      {open && refId && (
        <PayNowVerifyDialog
          open={open}
          onOpenChange={setOpen}
          refType={refType}
          refId={refId}
          amount={amount}
          timestamp={timestamp}
          gmailPayments={gmailPayments}
          override={override}
          allOverrides={overrides || []}
        />
      )}
    </>
  );
}

function PayNowVerifyDialog({
  open,
  onOpenChange,
  refType,
  refId,
  amount,
  timestamp,
  gmailPayments,
  override,
  allOverrides,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  refType: RefType;
  refId: string;
  amount: number;
  timestamp: string | Date | null | undefined;
  gmailPayments: any[] | undefined;
  override: any;
  allOverrides: any[];
}) {
  const setOverride = useSetPaynowOverride();
  const clearOverride = useClearPaynowOverride();
  const [note, setNote] = useState("");
  // "confirm" = Confirm Paid with no bank record — needs a reason (D105, server enforces it too).
  const [mode, setMode] = useState<"list" | "flag" | "confirm">("list");
  const reasonOk = note.trim().length >= 5;

  // The transfer this charge is linked to (populated by the API).
  const linked = override?.status === "linked" ? override.gmailPaymentId : null;
  const linkedId = linked ? String(linked._id || linked) : null;
  // Transfers already linked to some other charge — so one transfer isn't
  // linked twice by mistake.
  const usedElsewhere = new Set(
    allOverrides
      .filter((o) => o.status === "linked" && o.gmailPaymentId && !(o.refType === refType && String(o.refId) === String(refId)))
      .map((o) => String(o.gmailPaymentId._id || o.gmailPaymentId))
  );

  const t = timestamp ? new Date(timestamp).getTime() : null;
  const nearest = (gmailPayments || [])
    .map((p) => ({ p, diff: t ? Math.abs(new Date(p.transactionTimestamp).getTime() - t) : Infinity }))
    .sort((a, b) => a.diff - b.diff)
    .slice(0, 15)
    .map((x) => x.p);
  // Always show the linked transfer, first.
  const linkedRow = linkedId ? (gmailPayments || []).find((p) => String(p._id) === linkedId) || (typeof linked === "object" ? linked : null) : null;
  const candidates = linkedRow ? [linkedRow, ...nearest.filter((p) => String(p._id) !== linkedId)] : nearest;
  const diffLabel = (paid: number) => {
    const d = Math.round((paid - amount) * 100) / 100;
    if (Math.abs(d) < 0.005) return "exact amount";
    return d < 0 ? `$${Math.abs(d).toFixed(2)} short` : `$${d.toFixed(2)} over`;
  };

  const linkTo = (gmailPaymentId: string) => {
    setOverride.mutate({ refType, refId, status: "linked", gmailPaymentId });
    onOpenChange(false);
  };
  const confirmPaid = () => {
    if (!reasonOk) return;
    setOverride.mutate({ refType, refId, status: "confirmed_paid", note: note.trim() });
    onOpenChange(false);
  };
  const flagUnpaid = () => {
    setOverride.mutate({ refType, refId, status: "flagged_unpaid", note: note || undefined });
    onOpenChange(false);
  };
  const clear = () => {
    clearOverride.mutate({ refType, refId });
    onOpenChange(false);
  };

  const busy = setOverride.isPending || clearOverride.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>Resolve PayNow Charge — ${amount.toFixed(2)}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {override && (
            <div className="rounded-md border border-border/50 p-2 text-xs text-muted-foreground">
              Current: <strong className="capitalize">{override.status.replace(/_/g, " ")}</strong>
              {linked && typeof linked === "object" && (
                <>
                  {" "}to <strong className="text-foreground">${Number(linked.amount).toFixed(2)}</strong> from <strong className="text-foreground">{linked.senderName || "unknown"}</strong> at {fmtDateTimeSG(linked.transactionTimestamp)}
                  {" "}<span className={Math.abs(Number(linked.amount) - amount) < 0.005 ? "text-emerald-500" : "text-amber-500"}>({diffLabel(Number(linked.amount))})</span>
                </>
              )}
              {override.note ? ` — ${override.note}` : ""}
              {override.verifiedBy && <span className="block mt-0.5">by {override.verifiedBy.name || override.verifiedBy.email}</span>}
            </div>
          )}

          {mode === "list" ? (
            <>
              <p className="text-xs text-muted-foreground">Link to a nearby Gmail transfer:</p>
              <div className="max-h-56 overflow-y-auto rounded-md border border-border divide-y divide-border/50">
                {candidates.length === 0 && (
                  <p className="text-xs text-muted-foreground p-2">No Gmail transfers found nearby.</p>
                )}
                {candidates.map((p) => {
                  const isLinked = String(p._id) === linkedId;
                  const elsewhere = usedElsewhere.has(String(p._id));
                  return (
                    <button
                      key={p._id}
                      type="button"
                      onClick={() => !isLinked && linkTo(p._id)}
                      disabled={busy || isLinked}
                      className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between gap-2 ${isLinked ? "bg-emerald-500/10 border-l-2 border-emerald-500" : "hover:bg-muted"}`}
                    >
                      <span>
                        ${Number(p.amount).toFixed(2)} — {p.senderName || "unknown"}
                        <span className="block text-xs text-muted-foreground">
                          {fmtDateTimeSG(p.transactionTimestamp)} · {diffLabel(Number(p.amount))}
                          {elsewhere && <span className="text-amber-500"> · already linked to another charge</span>}
                          {!elsewhere && p.usedFor?.kind === "topup" && <span className="text-amber-500"> · already credited to a wallet top-up</span>}
                        </span>
                      </span>
                      {isLinked ? (
                        <span className="text-xs font-medium text-emerald-500 shrink-0">Linked</span>
                      ) : (
                        <Link2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
              <div className="flex gap-2 pt-1">
                <Button size="sm" variant="outline" className="flex-1" onClick={() => { setNote(""); setMode("confirm"); }} disabled={busy}>
                  Confirm Paid (no record)
                </Button>
                <Button size="sm" variant="outline" className="flex-1 text-destructive hover:text-destructive" onClick={() => { setNote(""); setMode("flag"); }} disabled={busy}>
                  Flag Not Paid
                </Button>
              </div>
            </>
          ) : mode === "confirm" ? (
            <>
              <p className="text-xs text-muted-foreground">
                No bank transfer is linked to this charge. Only confirm it was paid after checking the bank app. The reason is saved in the logs.
              </p>
              <p className="text-xs text-muted-foreground">Reason (required):</p>
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. checked bank app — transfer from TAN AH KOW at 14:05" rows={3} />
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="flex-1" onClick={() => setMode("list")} disabled={busy}>
                  Back
                </Button>
                <Button size="sm" className="flex-1" onClick={confirmPaid} disabled={busy || !reasonOk}>
                  {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null} Confirm Paid
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">Reason (optional):</p>
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. checked bank app, no transfer received" rows={3} />
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="flex-1" onClick={() => setMode("list")} disabled={busy}>
                  Back
                </Button>
                <Button size="sm" variant="destructive" className="flex-1" onClick={flagUnpaid} disabled={busy}>
                  {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null} Flag Not Paid
                </Button>
              </div>
            </>
          )}
        </div>
        <DialogFooter>
          {override && (
            <Button size="sm" variant="ghost" onClick={clear} disabled={busy}>
              Clear override (revert to automatic)
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
