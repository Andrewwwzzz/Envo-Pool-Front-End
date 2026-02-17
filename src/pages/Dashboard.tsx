import { useAuth } from "@/contexts/AuthContext";
import { Navigate, Link } from "react-router-dom";
import { useProfile } from "@/hooks/useProfile";
import { useMyBookings } from "@/hooks/useBooking";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Wallet, Star, Calendar, History, LogOut, ArrowLeft, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const SG_TZ = "Asia/Singapore";
const fmtDate = (d: string) => new Date(d).toLocaleDateString("en-GB", { timeZone: SG_TZ, day: "2-digit", month: "2-digit", year: "numeric" });
const fmtTime = (d: string) => new Date(d).toLocaleTimeString("en-GB", { timeZone: SG_TZ, hour: "2-digit", minute: "2-digit" });
const fmtDateTime = (d: string) => `${fmtDate(d)} ${fmtTime(d)}`;

const statusBadge: Record<string, string> = {
  confirmed: "bg-primary/10 text-primary border-primary/20",
  pending: "bg-accent/20 text-accent-foreground border-accent/30",
  cancelled: "bg-destructive/10 text-destructive border-destructive/20",
  completed: "bg-muted text-muted-foreground border-border",
};

const Dashboard = () => {
  const { user, loading, signOut } = useAuth();
  const { data: profile } = useProfile();
  const { data: bookings, isLoading: bookingsLoading } = useMyBookings();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const cancelBooking = useMutation({
    mutationFn: async (bookingId: string) => {
      const { error } = await supabase.from("bookings").delete().eq("id", bookingId);
      if (error) throw error;
      return bookingId;
    },
    onMutate: async (bookingId) => {
      await queryClient.cancelQueries({ queryKey: ["my-bookings", user?.id] });
      const previous = queryClient.getQueryData(["my-bookings", user?.id]);
      queryClient.setQueryData(["my-bookings", user?.id], (old: any[] | undefined) =>
        old ? old.filter((b) => b.id !== bookingId) : []
      );
      return { previous };
    },
    onSuccess: () => {
      toast({ title: "Booking cancelled successfully" });
      queryClient.invalidateQueries({ queryKey: ["my-bookings"], refetchType: "none" });
      queryClient.invalidateQueries({ queryKey: ["tables-with-status"] });
    },
    onError: (err: Error, _bookingId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["my-bookings", user?.id], context.previous);
      }
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const { data: walletTxns } = useQuery({
    queryKey: ["wallet-txns", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("wallet_transactions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20);
      return data || [];
    },
    enabled: !!user,
  });

  const { data: rewardTxns } = useQuery({
    queryKey: ["reward-txns", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("reward_transactions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20);
      return data || [];
    },
    enabled: !!user,
  });

  if (loading) return <div className="flex min-h-screen items-center justify-center text-muted-foreground dark">Loading...</div>;
  if (!user) return <Navigate to="/auth" replace />;

  const now = new Date();
  const upcoming = (bookings || []).filter((b) => new Date(b.start_time) >= now && b.status !== "cancelled");
  const past = (bookings || []).filter((b) => new Date(b.start_time) < now || b.status === "cancelled");

  return (
    <div className="min-h-screen bg-background dark">
      <div className="fixed inset-0 opacity-[0.02]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, hsl(var(--foreground)) 1px, transparent 0)', backgroundSize: '40px 40px' }} />

      <header className="relative z-10 border-b border-border/50 bg-card/80 backdrop-blur-md px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/booking">
            <Button variant="ghost" size="sm"><ArrowLeft className="mr-2 h-4 w-4" /> Back</Button>
          </Link>
          <h1 className="text-xl font-bold tracking-tight gold-gradient">My Dashboard</h1>
        </div>
        <Button variant="ghost" size="sm" onClick={signOut} className="text-muted-foreground">
          <LogOut className="h-4 w-4" />
        </Button>
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
              <Calendar className="h-6 w-6 mx-auto text-primary mb-2" />
              <p className="text-2xl font-bold">{upcoming.length}</p>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mt-1">Upcoming</p>
            </CardContent>
          </Card>
          <Card className="card-premium">
            <CardContent className="pt-6 text-center">
              <History className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
              <p className="text-2xl font-bold">${profile?.total_spent?.toFixed(2) ?? "0.00"}</p>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mt-1">Total Spent</p>
            </CardContent>
          </Card>
        </div>

        {/* Upcoming Bookings */}
        <Card className="card-premium">
          <CardHeader><CardTitle className="text-lg">Upcoming Reservations</CardTitle></CardHeader>
          <CardContent>
            {upcoming.length === 0 ? (
              <p className="text-muted-foreground text-sm">No upcoming reservations.</p>
            ) : (
              <div className="space-y-3">
                {upcoming.map((b) => (
                  <div key={b.id} className="flex items-center justify-between rounded-lg border border-border/50 p-4 hover:bg-card/50 transition-colors">
                    <div>
                      <p className="font-medium">Table {(b as any).tables?.table_number ?? "?"}</p>
                      <p className="text-sm text-muted-foreground">
                        {fmtDate(b.start_time)} {fmtTime(b.start_time)} – {fmtTime(b.end_time)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-medium">${b.final_price?.toFixed(2) ?? b.price?.toFixed(2)}</span>
                      <Badge variant="outline" className={statusBadge[b.status] ?? ""}>{b.status}</Badge>
                      {b.status === "pending" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => cancelBooking.mutate(b.id)}
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
                {past.slice(0, 10).map((b) => (
                  <div key={b.id} className="flex items-center justify-between rounded-lg border border-border/50 p-4">
                    <div>
                      <p className="font-medium">Table {(b as any).tables?.table_number ?? "?"}</p>
                      <p className="text-sm text-muted-foreground">
                        {fmtDate(b.start_time)} {fmtTime(b.start_time)} – {fmtTime(b.end_time)} · {b.duration_hours}h
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-medium">${b.final_price?.toFixed(2) ?? b.price?.toFixed(2)}</span>
                      <Badge variant="outline" className={statusBadge[b.status] ?? ""}>{b.status}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Wallet Transactions */}
        <Card className="card-premium">
          <CardHeader><CardTitle className="text-lg">Wallet Transactions</CardTitle></CardHeader>
          <CardContent>
            {!walletTxns?.length ? (
              <p className="text-muted-foreground text-sm">No transactions yet.</p>
            ) : (
              <div className="space-y-2">
                {walletTxns.map((t) => (
                  <div key={t.id} className="flex items-center justify-between text-sm py-2 border-b border-border/50 last:border-0">
                    <div>
                      <p className="font-medium capitalize">{t.type === "adjustment" ? "Admin Adjustment" : t.type.replace("_", " ")}</p>
                      <p className="text-xs text-muted-foreground">{fmtDateTime(t.created_at)}</p>
                    </div>
                    <span className={t.amount >= 0 ? "text-primary font-medium" : "text-destructive font-medium"}>
                      {t.amount >= 0 ? "+" : ""}${t.amount.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Reward Transactions */}
        <Card className="card-premium">
          <CardHeader><CardTitle className="text-lg">Reward Points History</CardTitle></CardHeader>
          <CardContent>
            {!rewardTxns?.length ? (
              <p className="text-muted-foreground text-sm">No reward history yet.</p>
            ) : (
              <div className="space-y-2">
                {rewardTxns.map((t) => (
                  <div key={t.id} className="flex items-center justify-between text-sm py-2 border-b border-border/50 last:border-0">
                    <div>
                      <p className="font-medium capitalize">{t.type === "adjustment" ? "Admin Adjustment" : t.type}</p>
                      <p className="text-xs text-muted-foreground">{fmtDateTime(t.created_at)}</p>
                    </div>
                    <span className={t.points >= 0 ? "text-primary font-medium" : "text-destructive font-medium"}>
                      {t.points >= 0 ? "+" : ""}{t.points} pts
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Dashboard;
