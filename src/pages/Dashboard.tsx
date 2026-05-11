import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate, Link } from "react-router-dom";
import { useProfile } from "@/hooks/useProfile";
import { useMyBookings } from "@/hooks/useBooking";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch, getAuthHeaders } from "@/lib/api";
import { getCached, setCache } from "@/lib/queryCache";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Wallet, Calendar, History, LogOut, ArrowLeft, XCircle, Settings, Copy } from "lucide-react";
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
  if (user.isVerified === false) return <PendingVerificationCard onSignOut={signOut} />;

  const now = new Date();

  // Compute total_spent from confirmed bookings if backend returns 0
  const computedTotalSpent = (bookings || [])
    .filter((b: any) => b.status === "confirmed" || b.status === "completed")
    .reduce((sum: number, b: any) => sum + (b.amount ?? b.finalPrice ?? b.final_price ?? b.totalPrice ?? 0), 0);
  const displayTotalSpent = (profile?.total_spent && profile.total_spent > 0) ? profile.total_spent : computedTotalSpent;

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

      <header className="relative z-10 border-b border-border/50 bg-card/80 backdrop-blur-md px-6 py-4 flex items-center justify-between">
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

      <main className="relative z-10 mx-auto max-w-4xl p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
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
                    className={`flex items-center justify-between rounded-lg border border-border/50 p-4 transition-colors ${
                      getStatus(b) === "confirmed" ? "cursor-pointer hover:bg-primary/5 hover:border-primary/30" : "hover:bg-card/50"
                    }`}
                    onClick={() => getStatus(b) === "confirmed" && setSelectedBooking(b)}
                  >
                    <div>
                      <p className="font-medium">{getTableLabel(b)}</p>
                      <p className="text-sm text-muted-foreground">
                        {fmtDate(getStartTime(b))} {fmtTime(getStartTime(b))} – {fmtTime(getEndTime(b))}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
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
                    className={`flex items-center justify-between rounded-lg border border-border/50 p-4 transition-colors ${
                      getStatus(b) === "confirmed" || getStatus(b) === "completed" ? "cursor-pointer hover:bg-primary/5 hover:border-primary/30" : ""
                    }`}
                    onClick={() => (getStatus(b) === "confirmed" || getStatus(b) === "completed") && setSelectedBooking(b)}
                  >
                    <div>
                      <p className="font-medium">{getTableLabel(b)}</p>
                      <p className="text-sm text-muted-foreground">
                        {fmtDate(getStartTime(b))} {fmtTime(getStartTime(b))} – {fmtTime(getEndTime(b))}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
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
        onCancel={(bookingId) => {
          cancelBooking.mutate(bookingId);
          setSelectedBooking(null);
        }}
        cancelling={cancelBooking.isPending}
      />
    </div>
  );
};

const PAYNOW_NUMBER = "+65 XXXXXXXX";

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
  const [submitting, setSubmitting] = useState(false);

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
    setSubmitting(true);
    try {
      const res = await apiFetch("/api/transactions/topup/request", {
        method: "POST",
        body: JSON.stringify({ amount: amt }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.message || data?.error || "Failed to submit request");
      }
      setAmount("");
      qc.invalidateQueries({ queryKey: ["my-topup-requests"] });
      onOpenChange(false);
      toast({
        title: "Request submitted!",
        description: "We'll credit your wallet within 24 hours.",
      });
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Top Up Wallet</DialogTitle>
          <DialogDescription>Follow the steps below to top up your wallet via PayNow.</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Step 1 */}
          <div className="space-y-2">
            <p className="text-sm font-semibold">Step 1 — Your Payment Reference</p>
            <p className="text-xs text-muted-foreground">Use this as your PayNow reference</p>
            <div className="flex items-center gap-2">
              <div className="flex-1 px-4 py-3 rounded-lg bg-muted text-center">
                <p className="text-2xl font-bold font-mono tracking-widest">{shortId || "—"}</p>
              </div>
              <Button variant="outline" size="icon" onClick={copyRef} disabled={!shortId}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Step 2 */}
          <div className="space-y-2">
            <p className="text-sm font-semibold">Step 2 — Make Payment</p>
            <p className="text-sm text-muted-foreground">Transfer your desired amount via PayNow to:</p>
            <div className="px-4 py-3 rounded-lg bg-muted text-center">
              <p className="text-xl font-bold">{PAYNOW_NUMBER}</p>
            </div>
            <p className="text-xs text-muted-foreground">
              Use your 6-digit reference code above so we can identify your payment.
            </p>
          </div>

          {/* Step 3 */}
          <div className="space-y-2">
            <p className="text-sm font-semibold">Step 3 — Confirm Your Request</p>
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
              className="w-full bg-green-600 hover:bg-green-700 text-white"
            >
              I've Made Payment — Submit Request
            </Button>
          </div>

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
                    <Badge variant="outline" className={statusClass(r.status)}>
                      {statusText(r.status)}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default Dashboard;