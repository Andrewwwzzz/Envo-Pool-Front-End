import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import paynowQr from "@/assets/paynow-qr.png";

export default function TopUpWalletDialog({
  open,
  onOpenChange,
  shortId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  shortId?: string;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<"paynow" | "cash" | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [cashConfirmation, setCashConfirmation] = useState<{ amount: number } | null>(null);
  const [paynowConfirmation, setPaynowConfirmation] = useState<{ amount: number } | null>(null);
  const [chasing, setChasing] = useState(false);
  const [lastChaseAt, setLastChaseAt] = useState<Record<string, number>>(() => {
    try { return JSON.parse(localStorage.getItem("topup-chase-times") || "{}"); }
    catch { return {}; }
  });
  const CHASE_COOLDOWN_MS = 10 * 60 * 1000;

  const { data: requests } = useQuery({
    queryKey: ["my-topup-requests"],
    queryFn: async () => {
      const res = await apiFetch("/api/transactions/topup/my-requests");
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : data?.requests ?? [];
    },
    refetchInterval: 15000,
  });

  const pendingRequest = Array.isArray(requests)
    ? requests.find((r: any) => String(r.status || "").toLowerCase() === "pending") || null
    : null;
  const pendingMethod = String(
    pendingRequest?.method || pendingRequest?.paymentMethod || pendingRequest?.payment_method || ""
  ).toLowerCase();
  const pendingIsPaynow = pendingMethod === "paynow";

  const handleChase = async (reqId: string) => {
    const last = lastChaseAt[reqId] || 0;
    const remaining = CHASE_COOLDOWN_MS - (Date.now() - last);
    if (remaining > 0) {
      const mins = Math.ceil(remaining / 60000);
      toast({ title: `Please wait ${mins} min before sending another chaser`, variant: "destructive" });
      return;
    }
    setChasing(true);
    try {
      const res = await apiFetch("/api/transactions/topup/chase", {
        method: "POST",
        body: JSON.stringify({ requestId: reqId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.message || data?.error || "Failed to send chaser");
      }
      const updated = { ...lastChaseAt, [reqId]: Date.now() };
      setLastChaseAt(updated);
      try { localStorage.setItem("topup-chase-times", JSON.stringify(updated)); } catch {}
      toast({ title: "Chaser sent!", description: "Admins have been notified to review your top up." });
    } catch (e: any) {
      toast({ title: e?.message || "Failed to send chaser", variant: "destructive" });
    } finally {
      setChasing(false);
    }
  };

  const resetState = () => { setAmount(""); setMethod(null); setCashConfirmation(null); };
  const handleClose = (v: boolean) => { if (!v) resetState(); onOpenChange(v); };

  const copyRef = async () => {
    if (!shortId) return;
    try { await navigator.clipboard.writeText(shortId); toast({ title: "Reference copied" }); }
    catch { toast({ title: "Copy failed", variant: "destructive" }); }
  };

  const handleSubmit = async () => {
    const amt = Number(amount);
    if (!amt || amt < 10) { toast({ title: "Minimum top up is $10", variant: "destructive" }); return; }
    if (!method) { toast({ title: "Please select a payment method", variant: "destructive" }); return; }
    setSubmitting(true);
    try {
      const res = await apiFetch("/api/transactions/topup/request", {
        method: "POST",
        body: JSON.stringify({ amount: amt, method }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || data?.error || "Failed to submit request");
      qc.invalidateQueries({ queryKey: ["my-topup-requests"] });
      if (method === "cash") setCashConfirmation({ amount: amt });
      else setPaynowConfirmation({ amount: amt });
    } catch (e: any) {
      toast({ title: e?.message || "Failed to submit request", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const statusClass = (s: string) => {
    const v = String(s || "").toLowerCase();
    if (v === "approved") return "bg-green-500/10 text-green-400 border-green-500/30";
    if (v === "rejected") return "bg-destructive/10 text-destructive border-destructive/30";
    return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
  };
  const statusText = (s: string) => {
    const v = String(s || "pending").toLowerCase();
    return v.charAt(0).toUpperCase() + v.slice(1);
  };
  const methodBadgeClass = (m?: string | null) => {
    const v = String(m || "").toLowerCase();
    if (v === "cash") return "bg-blue-500/10 text-blue-400 border-blue-500/30";
    if (v === "paynow") return "bg-purple-500/10 text-purple-400 border-purple-500/30";
    return "bg-muted text-muted-foreground border-border";
  };
  const methodLabel = (m?: string | null) => {
    const v = String(m || "").toLowerCase();
    if (v === "cash") return "Cash";
    if (v === "paynow") return "PayNow";
    return "—";
  };

  if (cashConfirmation) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Cash Top Up Requested</DialogTitle>
            <DialogDescription>Please complete payment at the counter.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-4 space-y-3 text-sm">
              <p>
                Please head to the counter with your Short ID{" "}
                <span className="font-mono font-bold">#{shortId || "—"}</span> to pay{" "}
                <span className="font-bold">${cashConfirmation.amount.toFixed(2)}</span>.
              </p>
              <p className="text-muted-foreground">Staff will credit your wallet once payment is received.</p>
            </div>
            <Button className="w-full" onClick={() => handleClose(false)}>Done</Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Top Up Wallet</DialogTitle>
          <DialogDescription>Follow the steps below to top up your wallet.</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-2">
            <p className="text-sm font-semibold">Step 1 — Your Payment Reference</p>
            <p className="text-xs text-muted-foreground">Use this as your payment reference</p>
            <div className="flex items-center gap-2">
              <div className="flex-1 px-4 py-3 rounded-lg bg-muted text-center">
                <p className="text-2xl font-bold font-mono tracking-widest">{shortId || "—"}</p>
              </div>
              <Button variant="outline" size="icon" onClick={copyRef} disabled={!shortId}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-semibold">Step 2 — Choose Payment Method</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setMethod("paynow")}
                className={`rounded-lg border p-4 text-left transition-all ${
                  method === "paynow"
                    ? "border-purple-500 bg-purple-500/10 ring-2 ring-purple-500/30"
                    : "border-border hover:border-purple-500/50 hover:bg-muted/50"
                }`}
              >
                <div className="text-2xl mb-1">🏦</div>
                <div className="font-semibold">PayNow</div>
                <div className="text-xs text-muted-foreground">Scan QR code to transfer</div>
              </button>
              <button
                type="button"
                onClick={() => setMethod("cash")}
                className={`rounded-lg border p-4 text-left transition-all ${
                  method === "cash"
                    ? "border-blue-500 bg-blue-500/10 ring-2 ring-blue-500/30"
                    : "border-border hover:border-blue-500/50 hover:bg-muted/50"
                }`}
              >
                <div className="text-2xl mb-1">💵</div>
                <div className="font-semibold">Cash</div>
                <div className="text-xs text-muted-foreground">Pay at the counter</div>
              </button>
            </div>
          </div>

          {method === "paynow" && (
            <div className="space-y-2">
              <p className="text-sm font-semibold">Scan to Pay</p>
              <div className="px-4 py-3 rounded-lg bg-white flex justify-center">
                <img src={paynowQr} alt="PayNow QR code" className="w-56 h-auto" />
              </div>
              <p className="text-xs text-muted-foreground">
                Use your reference code above so we can identify your payment.
              </p>
            </div>
          )}

          {method && (
            <div className="space-y-2">
              <p className="text-sm font-semibold">
                Step 3 — {method === "cash" ? "Confirm Amount" : "Confirm Your Request"}
              </p>
              <Input
                type="number"
                min={10}
                step="1"
                placeholder="Amount (minimum $10)"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              <Button
                onClick={handleSubmit}
                disabled={submitting}
                className={`w-full text-white ${
                  method === "cash" ? "bg-blue-600 hover:bg-blue-700" : "bg-green-600 hover:bg-green-700"
                }`}
              >
                {method === "cash" ? "Request Cash Top Up" : "I've Made Payment — Submit Request"}
              </Button>
            </div>
          )}

          {pendingRequest && pendingIsPaynow && (
            <div className="space-y-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
              <p className="text-sm font-semibold">Step 4 — Waiting Too Long?</p>
              <p className="text-xs text-muted-foreground">
                If your pending top up of{" "}
                <span className="font-medium text-foreground">
                  ${Number(pendingRequest.amount || 0).toFixed(2)}
                </span>{" "}
                hasn't been approved yet, send a chaser to notify admins.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="w-full border-amber-500/50 hover:bg-amber-500/10"
                onClick={() => handleChase(pendingRequest._id || pendingRequest.id)}
                disabled={chasing}
              >
                {chasing ? "Sending…" : "Send Chaser to Admin"}
              </Button>
            </div>
          )}

          <div className="pt-2 border-t border-border/50">
            <p className="text-sm font-medium mb-2">My Top Up History</p>
            {!requests?.length ? (
              <p className="text-muted-foreground text-sm">No top up requests yet.</p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {requests.map((r: any) => (
                  <div key={r._id || r.id} className="flex items-start justify-between text-sm py-2 border-b border-border/50 last:border-0 gap-3">
                    <div className="min-w-0">
                      <p className="font-medium">${Number(r.amount || 0).toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(r.createdAt || r.created_at).toLocaleString("en-GB", {
                          day: "2-digit", month: "short", year: "numeric",
                          hour: "numeric", minute: "2-digit", hour12: true,
                          timeZone: "Asia/Singapore",
                        })}
                      </p>
                      {String(r.status || "").toLowerCase() === "rejected" && r.rejectionReason && (
                        <p className="text-xs text-destructive mt-1">Reason: {r.rejectionReason}</p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Badge variant="outline" className={statusClass(r.status)}>
                        {statusText(r.status)}
                      </Badge>
                      {r.method && (
                        <Badge variant="outline" className={methodBadgeClass(r.method)}>
                          {methodLabel(r.method)}
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <Dialog
          open={!!paynowConfirmation}
          onOpenChange={(v) => { if (!v) { setPaynowConfirmation(null); resetState(); } }}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Request Submitted</DialogTitle>
              <DialogDescription>Thanks! We've received your top up request.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="rounded-lg border border-purple-500/30 bg-purple-500/5 p-4 text-sm space-y-2">
                <p>
                  Your PayNow top up of{" "}
                  <span className="font-bold">${paynowConfirmation?.amount.toFixed(2)}</span>{" "}
                  is pending verification.
                </p>
                <p className="text-muted-foreground">
                  We'll credit your wallet within 24 hours. If it's taking too long, you can send a chaser to notify our admins.
                </p>
              </div>
              <Button
                asChild
                className="w-full bg-green-600 hover:bg-green-700 text-white"
                onClick={() => { setPaynowConfirmation(null); resetState(); }}
              >
                <a href="https://wa.me/6587627064" target="_blank" rel="noopener noreferrer">
                  Contact us on WhatsApp
                </a>
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}
