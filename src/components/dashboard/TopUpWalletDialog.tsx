import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

  const resetState = () => { setAmount(""); setMethod(null); setCashConfirmation(null); };
  const handleClose = (v: boolean) => { if (!v) resetState(); onOpenChange(v); };

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
            <p className="text-sm font-semibold">Step 1 — Choose Payment Method</p>
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
            <div className="space-y-3">
              <div className="flex justify-center">
                <img src={paynowQr} alt="PayNow QR code" className="w-56 h-auto" />
              </div>
              <div className="rounded-lg border border-purple-500/30 bg-purple-500/5 p-3 text-xs text-muted-foreground space-y-1">
                <p>
                  Pay using the <span className="text-foreground font-medium">PayNow account name registered to your profile</span> — your wallet will be credited automatically once the payment is detected, usually within <span className="text-foreground font-medium">1 minute</span>.
                </p>
                <p>No reference number needed.</p>
              </div>
            </div>
          )}

          {method && (
            <div className="space-y-2">
              <p className="text-sm font-semibold">
                Step 2 — {method === "cash" ? "Confirm Amount" : "Confirm Your Request"}
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
                  is being matched against your payment automatically.
                </p>
                <p className="text-muted-foreground">
                  This usually completes within <span className="text-foreground font-medium">1 minute</span> once your payment is made under your registered name. If it hasn't gone through after <span className="text-foreground font-medium">5 minutes</span>, please contact our admin.
                </p>
              </div>
              <Button
                asChild
                className="w-full bg-green-600 hover:bg-green-700 text-white"
                onClick={() => { setPaynowConfirmation(null); resetState(); }}
              >
                <a href="https://wa.me/6587627064" target="_blank" rel="noopener noreferrer">
                  Contact Admin on WhatsApp
                </a>
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}
