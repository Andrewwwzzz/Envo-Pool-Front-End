import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate, Link } from "react-router-dom";
import { useProfile } from "@/hooks/useProfile";
import { useMyBookings } from "@/hooks/useBooking";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch, getAuthHeaders } from "@/lib/api";
import { getCached, setCache } from "@/lib/queryCache";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Wallet, Calendar, History, LogOut, ArrowLeft, Settings, Copy } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import BookingDetailDialog from "@/components/BookingDetailDialog";
import PendingVerificationCard from "@/components/PendingVerificationCard";
import { useToast } from "@/hooks/use-toast";

import { fmtDateSG as fmtDate, fmtTimeSG as fmtTime, fmtDateTimeSG as fmtDateTime } from "@/lib/sgTime";

const statusBadge: Record<string, string> = {
  confirmed: "bg-primary/10 text-primary border-primary/20",
  pending: "bg-accent/20 text-accent-foreground border-accent/30",
  pending_payment: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  cancelled: "bg-destructive/10 text-destructive border-destructive/20",
  completed: "bg-muted text-muted-foreground border-border",
  expired: "bg-muted text-muted-foreground border-border",
};

const paymentBadge = (method?: string | null) => {
  if (!method) return null;
  const m = method.toLowerCase();
  if (m === "wallet") return { label: "Wallet", className: "bg-green-500/10 text-green-400 border-green-500/30" };
  if (m === "paynow" || m === "stripe") return { label: "PayNow", className: "bg-blue-500/10 text-blue-400 border-blue-500/30" };
  return null;
};

const statusLabel = (s: string) => {
  if (s === "pending_payment") return "Pending Payment";
  if (s === "expired") return "Expired";
  return s;
};

const Dashboard = () => {
  const { user, loading, signOut } = useAuth();
  const { data: profile } = useProfile();
  const { data: bookings, isLoading: bookingsLoading } = useMyBookings();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedBooking, setSelectedBooking] = useState<any>(null);
  const [showAllTx, setShowAllTx] = useState(false);
  const [topUpOpen, setTopUpOpen] = useState(false);

  const fmtNiceDate = (s: string) => {
    if (!s) return "";
    try {
      return new Date(s).toLocaleString("en-GB", {
        day: "2-digit", month: "short", year: "numeric",
        hour: "numeric", minute: "2-digit", hour12: true,
        timeZone: "Asia/Singapore",
      });
    } catch { return s; }
  };

  const txBadge = (key: string) =>
    key === "payment" ? "bg-destructive/10 text-destructive border-destructive/30"
    : key === "topup" ? "bg-green-500/10 text-green-400 border-green-500/30"
    : key === "refund" ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
    : "bg-muted text-muted-foreground border-border";


  const { data: transactionHistory } = useQuery({
    queryKey: ["transaction-history", user?.id],
    queryFn: async () => {
      if (!user) return [];

      const res = await apiFetch("/api/transactions/me");
      if (!res.ok) return [];
      const data = await res.json();

      const walletTxs = Array.isArray(data)
        ? data
        : Array.isArray(data?.transactions)
        ? data.transactions
        : Array.isArray(data?.walletTransactions)
        ? data.walletTransactions
        : [];

      const items: Array<{
        id: string;
        date: string;
        typeKey: "payment" | "topup" | "refund" | "other";
        typeLabel: string;
        method: string;
        sublabel: string;
        amount: string;
        positive: boolean;
        sortKey: number;
      }> = [];

      walletTxs.forEach((t: any) => {
        const rawType = String(t.type || t.transactionType || "").toLowerCase();
        let typeKey: "payment" | "topup" | "refund" | "other" = "other";
        let typeLabel = rawType ? rawType.replace(/_/g, " ") : "Transaction";
        if (rawType === "booking_payment" || rawType === "wallet_deduct" || rawType === "payment") {
          typeKey = "payment"; typeLabel = "Payment";
        } else if (rawType === "topup" || rawType === "top_up" || rawType === "deposit") {
          typeKey = "topup"; typeLabel = "Top Up";
        } else if (rawType === "refund") {
          typeKey = "refund"; typeLabel = "Refund";
        } else if (rawType === "adjustment") {
          typeLabel = "Admin Adjustment";
        }

        const amtRaw = typeof t.amount === "number" ? t.amount : Number(t.amount) || 0;
        // Normalize sign by type so payments are negative, topups positive
        const amt = typeKey === "payment"
          ? -Math.abs(amtRaw)
          : typeKey === "topup" || typeKey === "refund"
          ? Math.abs(amtRaw)
          : amtRaw;

        const rawMethod = String(t.paymentMethod || t.payment_method || t.method || "").toLowerCase();
        const method = rawMethod === "wallet"
          ? "Wallet"
          : rawMethod === "paynow" || rawMethod === "stripe"
          ? "PayNow"
          : rawMethod
          ? rawMethod.charAt(0).toUpperCase() + rawMethod.slice(1)
          : "";

        const dateStr = t.createdAt || t.created_at || t.date || "";
        items.push({
          id: `w-${t.id || t._id}`,
          date: dateStr,
          typeKey,
          typeLabel,
          method,
          sublabel: fmtDateTime(dateStr),
          amount: `${amt >= 0 ? "+" : "-"}$${Math.abs(amt).toFixed(2)}`,
          positive: amt >= 0,
          sortKey: new Date(dateStr).getTime(),
        });
      });

      items.sort((a, b) => b.sortKey - a.sortKey);
      setCache("transactions", items);
      return items;
    },
    enabled: !!user,
    initialData: () => getCached<any[]>("transactions") ?? [],
  });

  if (loading) return <div className="flex min-h-screen items-center justify-center text-muted-foreground dark">Loading...</div>;
  if (!user) return <Navigate to="/auth" replace />;
  

  const now = new Date();

  // Total spent comes directly from backend; 0 is a valid value
  const displayTotalSpent = profile?.total_spent ?? 0;

  const getStartTime = (b: any) => b.startTime || b.start_time;
  const getEndTime = (b: any) => b.endTime || b.end_time;
  const getTableLabel = (b: any) => {
    const tid = b.tableId;
    if (typeof tid === "string") return `Table ${tid.replace("T", "")}`;
    if (tid?.name) return tid.name;
    if (tid?.tableNumber ?? tid?.table_number) return `Table ${tid.tableNumber ?? tid.table_number}`;
    return "Table ?";
  };
  const getPrice = (b: any) => b.amount ?? b.finalPrice ?? b.final_price ?? b.totalPrice ?? 0;
  const getStatus = (b: any) => b.status;

  const currentUserId = (user as any)?._id || user?.id;
  const getBookingUserId = (b: any) => {
    const uid = b.userId ?? b.user_id ?? b.user;
    if (uid && typeof uid === "object") return uid._id || uid.id;
    return uid;
  };
  const myBookings = (bookings || []).filter((b: any) => {
    const uid = getBookingUserId(b);
    return !uid || !currentUserId || String(uid) === String(currentUserId);
  });

  const upcoming = myBookings.filter((b: any) => new Date(getStartTime(b)) >= now && getStatus(b) !== "cancelled");
  const past = myBookings.filter((b: any) => (new Date(getStartTime(b)) < now || getStatus(b) === "cancelled"));

  return (
    <div className="min-h-screen bg-background dark">
      <div className="fixed inset-0 opacity-[0.02]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, hsl(var(--foreground)) 1px, transparent 0)', backgroundSize: '40px 40px' }} />

      <header className="relative z-10 border-b border-border/50 bg-card/80 backdrop-blur-md px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <Link to="/booking">
            <Button variant="outline" size="sm" className="border-accent text-accent hover:bg-accent hover:text-accent-foreground"><ArrowLeft className="mr-2 h-4 w-4" /> Back</Button>
          </Link>
          <h1 className="text-xl font-bold tracking-tight gold-gradient">Envo Pool</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/settings">
            <Button variant="ghost" size="sm" className="text-muted-foreground">
              <Settings className="h-4 w-4" />
            </Button>
          </Link>
          <Button variant="ghost" size="sm" onClick={signOut} className="text-muted-foreground">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-4xl p-4 sm:p-6 space-y-4 sm:space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          <Card className="card-premium">
            <CardContent className="pt-6 text-center">
              <Wallet className="h-6 w-6 mx-auto text-accent mb-2" />
              <p className="text-2xl font-bold">${profile?.wallet_balance?.toFixed(2) ?? "0.00"}</p>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mt-1">Wallet Balance</p>
              <Button size="sm" variant="outline" className="mt-3" onClick={() => setTopUpOpen(true)}>
                Top Up Wallet
              </Button>
            </CardContent>
          </Card>
          <Card className="card-premium">
            <CardContent className="pt-6 text-center">
              <Calendar className="h-6 w-6 mx-auto text-accent mb-2" />
              <p className="text-2xl font-bold">{upcoming.length}</p>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mt-1">Upcoming</p>
            </CardContent>
          </Card>
          <Card className="card-premium">
            <CardContent className="pt-6 text-center">
              <History className="h-6 w-6 mx-auto text-accent mb-2" />
              <p className="text-2xl font-bold">${displayTotalSpent.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mt-1">Total Spent</p>
            </CardContent>
          </Card>
        </div>

        <Card className="card-premium">
          <CardHeader><CardTitle className="text-lg">Upcoming Reservations</CardTitle></CardHeader>
          <CardContent>
            {upcoming.length === 0 ? (
              <p className="text-muted-foreground text-sm">No upcoming reservations.</p>
            ) : (
              <div className="space-y-3">
                {upcoming.map((b: any) => (
                  <div
                    key={b.id || b._id}
                    className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3 rounded-lg border border-border/50 p-3 sm:p-4 transition-colors ${
                      getStatus(b) === "confirmed" ? "cursor-pointer hover:bg-primary/5 hover:border-primary/30" : "hover:bg-card/50"
                    }`}
                    onClick={() => getStatus(b) === "confirmed" && setSelectedBooking(b)}
                  >
                    <div className="min-w-0">
                      <p className="font-medium">{getTableLabel(b)}</p>
                      <p className="text-sm text-muted-foreground">
                        {fmtDate(getStartTime(b))} {fmtTime(getStartTime(b))} – {fmtTime(getEndTime(b))}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                      <span className="font-medium">${getPrice(b).toFixed(2)}</span>
                      {(() => {
                        const pb = paymentBadge(b.paymentMethod ?? b.payment_method);
                        return pb ? <Badge variant="outline" className={pb.className}>{pb.label}</Badge> : null;
                      })()}
                      <Badge variant="outline" className={statusBadge[getStatus(b)] ?? ""}>
                        {statusLabel(getStatus(b))}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Past Bookings */}
        <Card className="card-premium">
          <CardHeader><CardTitle className="text-lg">Past Reservations</CardTitle></CardHeader>
          <CardContent>
            {past.length === 0 ? (
              <p className="text-muted-foreground text-sm">No past reservations.</p>
            ) : (
              <div className="space-y-3">
                {past.slice(0, 10).map((b: any) => (
                  <div
                    key={b.id || b._id}
                    className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3 rounded-lg border border-border/50 p-3 sm:p-4 transition-colors ${
                      getStatus(b) === "confirmed" || getStatus(b) === "completed" ? "cursor-pointer hover:bg-primary/5 hover:border-primary/30" : ""
                    }`}
                    onClick={() => (getStatus(b) === "confirmed" || getStatus(b) === "completed") && setSelectedBooking(b)}
                  >
                    <div className="min-w-0">
                      <p className="font-medium">{getTableLabel(b)}</p>
                      <p className="text-sm text-muted-foreground">
                        {fmtDate(getStartTime(b))} {fmtTime(getStartTime(b))} – {fmtTime(getEndTime(b))}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                      <span className="font-medium">${getPrice(b).toFixed(2)}</span>
                      {(() => {
                        const pb = paymentBadge(b.paymentMethod ?? b.payment_method);
                        return pb ? <Badge variant="outline" className={pb.className}>{pb.label}</Badge> : null;
                      })()}
                      <Badge variant="outline" className={statusBadge[getStatus(b)] ?? ""}>{statusLabel(getStatus(b))}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Up Wallet Dialog */}
        <TopUpWalletDialog
          open={topUpOpen}
          onOpenChange={setTopUpOpen}
          shortId={(user as any)?.shortId}
        />

        {/* Transaction History */}
        <Card className="card-premium">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Transaction History</CardTitle>
            {transactionHistory && transactionHistory.length > 10 && (
              <Button variant="ghost" size="sm" onClick={() => setShowAllTx((v) => !v)}>
                {showAllTx ? "Show Less" : "View All"}
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {!transactionHistory?.length ? (
              <p className="text-muted-foreground text-sm">No transactions yet.</p>
            ) : (
              <div className="space-y-2">
                {(showAllTx ? transactionHistory : transactionHistory.slice(0, 10)).map((t: any) => (
                  <div key={t.id} className="flex items-center justify-between text-sm py-2 border-b border-border/50 last:border-0">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className={txBadge(t.typeKey)}>{t.typeLabel}</Badge>
                      <div>
                        <p className="text-xs text-muted-foreground">{fmtNiceDate(t.date)}</p>
                        {t.method && <p className="text-xs text-muted-foreground">{t.method}</p>}
                      </div>
                    </div>
                    <span className={t.positive ? "text-primary font-medium" : "text-destructive font-medium"}>
                      {t.amount}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      <BookingDetailDialog
        booking={selectedBooking}
        open={!!selectedBooking}
        onOpenChange={(open) => !open && setSelectedBooking(null)}
      />
    </div>
  );
};

import paynowQr from "@/assets/paynow-qr.png";

function TopUpWalletDialog({
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
  const CHASE_COOLDOWN_MS = 10 * 60 * 1000; // 10 min between chases per request

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
      toast({
        title: "Chaser sent!",
        description: "Admins have been notified to review your top up.",
      });
    } catch (e: any) {
      toast({ title: e?.message || "Failed to send chaser", variant: "destructive" });
    } finally {
      setChasing(false);
    }
  };

  const resetState = () => {
    setAmount("");
    setMethod(null);
    setCashConfirmation(null);
  };

  const handleClose = (v: boolean) => {
    if (!v) resetState();
    onOpenChange(v);
  };

  const copyRef = async () => {
    if (!shortId) return;
    try {
      await navigator.clipboard.writeText(shortId);
      toast({ title: "Reference copied" });
    } catch {
      toast({ title: "Copy failed", variant: "destructive" });
    }
  };

  const handleSubmit = async () => {
    const amt = Number(amount);
    if (!amt || amt < 10) {
      toast({ title: "Minimum top up is $10", variant: "destructive" });
      return;
    }
    if (!method) {
      toast({ title: "Please select a payment method", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiFetch("/api/transactions/topup/request", {
        method: "POST",
        body: JSON.stringify({ amount: amt, method, paymentMethod: method }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.message || data?.error || "Failed to submit request");
      }
      qc.invalidateQueries({ queryKey: ["my-topup-requests"] });
      if (method === "cash") {
        setCashConfirmation({ amount: amt });
      } else {
        setPaynowConfirmation({ amount: amt });
      }
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

  // Cash confirmation screen
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
              <p className="text-muted-foreground">
                Staff will credit your wallet once payment is received.
              </p>
            </div>
            <Button className="w-full" onClick={() => handleClose(false)}>
              Done
            </Button>
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
          {/* Step 1 */}
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

          {/* Step 2 — Method selection */}
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

          {/* PayNow QR — only when paynow selected */}
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

          {/* Step 3 — Amount + submit (only after method chosen) */}
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
                  method === "cash"
                    ? "bg-blue-600 hover:bg-blue-700"
                    : "bg-green-600 hover:bg-green-700"
                }`}
              >
                {method === "cash"
                  ? "Request Cash Top Up"
                  : "I've Made Payment — Submit Request"}
              </Button>
            </div>
          )}

          {/* Step 4 — Send chaser (PayNow only, after a pending request exists) */}
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

          {/* History */}
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

        {/* PayNow submission confirmation overlay */}
        <Dialog
          open={!!paynowConfirmation}
          onOpenChange={(v) => { if (!v) { setPaynowConfirmation(null); resetState(); } }}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Request Submitted</DialogTitle>
              <DialogDescription>
                Thanks! We've received your top up request.
              </DialogDescription>
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
                <a
                  href="https://wa.me/6587627064"
                  target="_blank"
                  rel="noopener noreferrer"
                >
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

export default Dashboard;