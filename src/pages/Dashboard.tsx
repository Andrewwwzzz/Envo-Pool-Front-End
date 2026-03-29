import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate, Link } from "react-router-dom";
import { useProfile } from "@/hooks/useProfile";
import { useMyBookings } from "@/hooks/useBooking";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Wallet, Star, Calendar, History, LogOut, ArrowLeft, XCircle, Settings } from "lucide-react";
import BookingDetailDialog from "@/components/BookingDetailDialog";
import { useToast } from "@/hooks/use-toast";
import { getAuthHeaders } from "@/lib/api";

import { fmtDateSG as fmtDate, fmtTimeSG as fmtTime, fmtDateTimeSG as fmtDateTime } from "@/lib/sgTime";

const statusBadge: Record<string, string> = {
  confirmed: "bg-primary/10 text-primary border-primary/20",
  pending: "bg-accent/20 text-accent-foreground border-accent/30",
  pending_payment: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  cancelled: "bg-destructive/10 text-destructive border-destructive/20",
  completed: "bg-muted text-muted-foreground border-border",
};

const Dashboard = () => {
  const { user, loading, signOut } = useAuth();
  const { data: profile } = useProfile();
  const { data: bookings, isLoading: bookingsLoading } = useMyBookings();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedBooking, setSelectedBooking] = useState<any>(null);

  const cancelBooking = useMutation({
    mutationFn: async (bookingId: string) => {
      const res = await fetch(`https://api.envopoolsg.com/api/bookings/${bookingId}/cancel`, {
        method: "POST",
        headers: { ...getAuthHeaders() },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Failed to cancel booking");
      }
      return bookingId;
    },
    onMutate: async (bookingId) => {
      await queryClient.cancelQueries({ queryKey: ["my-bookings", user?.id] });
      const previous = queryClient.getQueryData(["my-bookings", user?.id]);
      queryClient.setQueryData(["my-bookings", user?.id], (old: any[] | undefined) =>
        old ? old.filter((b) => b.id !== bookingId && b._id !== bookingId) : []
      );
      return { previous };
    },
    onSuccess: () => {
      toast({ title: "Booking cancelled successfully" });
      queryClient.invalidateQueries({ queryKey: ["my-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["tables-with-status"] });
    },
    onError: (err: Error, _bookingId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["my-bookings", user?.id], context.previous);
      }
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const { data: transactionHistory } = useQuery({
    queryKey: ["transaction-history", user?.id],
    queryFn: async () => {
      if (!user) return [];

      const [walletRes, rewardRes, bookingsRes] = await Promise.all([
        supabase
          .from("wallet_transactions")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(30),
        supabase
          .from("reward_transactions")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(30),
        supabase
          .from("bookings")
          .select("id, final_price, payment_method, status, created_at, table_id, tables(table_number)")
          .eq("user_id", user.id)
          .eq("payment_method", "stripe")
          .in("status", ["confirmed", "completed"])
          .order("created_at", { ascending: false })
          .limit(30),
      ]);

      const items: Array<{
        id: string;
        date: string;
        label: string;
        sublabel: string;
        amount: string;
        positive: boolean;
        sortKey: number;
      }> = [];

      (walletRes.data || []).forEach((t) => {
        const typeLabel = t.type === "adjustment"
          ? "Admin Adjustment"
          : t.type === "booking_payment"
          ? "Wallet Payment"
          : t.type.replace(/_/g, " ");
        items.push({
          id: `w-${t.id}`,
          date: t.created_at,
          label: typeLabel.charAt(0).toUpperCase() + typeLabel.slice(1),
          sublabel: fmtDateTime(t.created_at),
          amount: `${t.amount >= 0 ? "+" : ""}$${Math.abs(t.amount).toFixed(2)}`,
          positive: t.amount >= 0,
          sortKey: new Date(t.created_at).getTime(),
        });
      });

      (bookingsRes.data || []).forEach((b: any) => {
        items.push({
          id: `s-${b.id}`,
          date: b.created_at,
          label: "Paynow Payment",
          sublabel: `Table ${b.tables?.table_number ?? "?"} · ${fmtDateTime(b.created_at)}`,
          amount: `-$${(b.final_price ?? 0).toFixed(2)}`,
          positive: false,
          sortKey: new Date(b.created_at).getTime(),
        });
      });

      (rewardRes.data || []).forEach((t) => {
        const label = t.type === "adjustment"
          ? "Admin Points Adjustment"
          : t.type === "earn"
          ? "Points Earned"
          : t.type === "redeem"
          ? "Points Redeemed"
          : t.type;
        items.push({
          id: `r-${t.id}`,
          date: t.created_at,
          label,
          sublabel: fmtDateTime(t.created_at),
          amount: `${t.points >= 0 ? "+" : ""}${t.points} pts`,
          positive: t.points >= 0,
          sortKey: new Date(t.created_at).getTime(),
        });
      });

      items.sort((a, b) => b.sortKey - a.sortKey);
      return items;
    },
    enabled: !!user,
  });

  if (loading) return <div className="flex min-h-screen items-center justify-center text-muted-foreground dark">Loading...</div>;
  if (!user) return <Navigate to="/auth" replace />;

  const now = new Date();
  const getStartTime = (b: any) => b.startTime || b.start_time;
  const getEndTime = (b: any) => b.endTime || b.end_time;
  const getTableLabel = (b: any) => b.tableId?.name || `Table ${(b as any).tables?.table_number || "?"}`;
  const getPrice = (b: any) => b.finalPrice ?? b.final_price ?? b.totalPrice ?? b.price ?? 0;
  const getStatus = (b: any) => b.status;

  const upcoming = (bookings || []).filter((b: any) => new Date(getStartTime(b)) >= now && getStatus(b) !== "cancelled" && getStatus(b) !== "expired");
  const past = (bookings || []).filter((b: any) => (new Date(getStartTime(b)) < now || getStatus(b) === "cancelled") && getStatus(b) !== "expired");

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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="card-premium">
            <CardContent className="pt-6 text-center">
              <Wallet className="h-6 w-6 mx-auto text-accent mb-2" />
              <p className="text-2xl font-bold">${profile?.wallet_balance?.toFixed(2) ?? "0.00"}</p>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mt-1">Wallet Balance</p>
            </CardContent>
          </Card>
          <Card className="card-premium">
            <CardContent className="pt-6 text-center">
              <Star className="h-6 w-6 mx-auto text-accent mb-2" />
              <p className="text-2xl font-bold">{profile?.reward_points ?? 0}</p>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mt-1">Reward Points</p>
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
              <p className="text-2xl font-bold">${profile?.total_spent?.toFixed(2) ?? "0.00"}</p>
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
                      <Badge variant="outline" className={statusBadge[getStatus(b)] ?? ""}>
                        {getStatus(b) === "pending_payment" ? "Pending Payment" : getStatus(b)}
                      </Badge>
                      {(getStatus(b) === "pending" || getStatus(b) === "pending_payment") && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={(e) => { e.stopPropagation(); cancelBooking.mutate(b.id || b._id); }}
                          disabled={cancelBooking.isPending}
                        >
                          <XCircle className="h-4 w-4" />
                        </Button>
                      )}
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
                      <Badge variant="outline" className={statusBadge[getStatus(b)] ?? ""}>{getStatus(b) === "pending_payment" ? "Pending Payment" : getStatus(b)}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Transaction History */}
        <Card className="card-premium">
          <CardHeader><CardTitle className="text-lg">Transaction History</CardTitle></CardHeader>
          <CardContent>
            {!transactionHistory?.length ? (
              <p className="text-muted-foreground text-sm">No transactions yet.</p>
            ) : (
              <div className="space-y-2">
                {transactionHistory.map((t) => (
                  <div key={t.id} className="flex items-center justify-between text-sm py-2 border-b border-border/50 last:border-0">
                    <div>
                      <p className="font-medium">{t.label}</p>
                      <p className="text-xs text-muted-foreground">{t.sublabel}</p>
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

export default Dashboard;