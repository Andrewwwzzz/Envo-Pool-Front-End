import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { useMyBookings, useTables } from "@/hooks/useBooking";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Wallet, Calendar, History, Settings, Gift, Crown,
  ShoppingBag, ArrowRight, TrendingUp, Star
} from "lucide-react";
import BookingDetailDialog from "@/components/BookingDetailDialog";
import TopUpWalletDialog from "@/components/dashboard/TopUpWalletDialog";
import { fmtDateSG as fmtDate, fmtTimeSG as fmtTime, nowSG } from "@/lib/sgTime";

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

const navBlocks = [
  { to: "/dashboard/bookings", label: "My Bookings", icon: Calendar, desc: "View & manage reservations", color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" },
  { to: "/dashboard/transactions", label: "Transactions", icon: History, desc: "Payment history", color: "text-purple-400", bg: "bg-purple-500/10 border-purple-500/20" },
  { to: "/dashboard/rewards", label: "My Rewards", icon: Gift, desc: "Points & reward codes", color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20" },
  { to: "/dashboard/membership", label: "Membership", icon: Crown, desc: "Plans & benefits", color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/20" },
  { to: "/dashboard/fnb", label: "F&B", icon: ShoppingBag, desc: "Order food & drinks", color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/20" },
  { to: "/dashboard/settings", label: "Account", icon: Settings, desc: "Profile & settings", color: "text-green-400", bg: "bg-green-500/10 border-green-500/20" },
];

export default function DashboardHome() {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const { data: bookings } = useMyBookings();
  const { data: tables } = useTables(null, null);
  const [selectedBooking, setSelectedBooking] = useState<any>(null);
  const [topUpOpen, setTopUpOpen] = useState(false);
  const navigate = useNavigate();

  const now = nowSG();
  const displayTotalSpent = profile?.total_spent ?? 0;
  const walletBalance = profile?.wallet_balance ?? profile?.walletBalance ?? 0;
  const rewardPoints = profile?.rewardPoints ?? 0;

  const getStartTime = (b: any) => b.startTime || b.start_time;
  const getEndTime = (b: any) => b.endTime || b.end_time;
  const getTableLabel = (b: any) => {
    const tid = b.tableId;
    if (tid && typeof tid === "object") {
      if (tid.name) return tid.name;
      const num = tid.tableNumber ?? tid.table_number;
      if (num !== undefined && num !== null) return `Table ${num}`;
      if (tid.hardware_id || tid.hardwareId) return `Table ${String(tid.hardware_id ?? tid.hardwareId).replace(/^T/i, "")}`;
    }
    if (typeof tid === "string") {
      if (/^T\d+$/i.test(tid)) return `Table ${tid.replace(/^T/i, "")}`;
      const match = (tables || []).find((t: any) => t.id === tid);
      if (match) {
        return match.hardware_id
          ? `Table ${String(match.hardware_id).replace(/^T/i, "")}`
          : `Table ${match.table_number ?? "?"}`;
      }
    }
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

  const upcoming = myBookings
    .filter((b: any) => {
      if (getStatus(b) !== "confirmed") return false;
      const start = new Date(getStartTime(b));
      return start > new Date();
    })
    .sort((a: any, b: any) => new Date(getStartTime(a)).getTime() - new Date(getStartTime(b)).getTime());
  const upcomingPreview = upcoming.slice(0, 3);

  const displayName = profile?.username || profile?.name || user?.name || "there";

  return (
    <>
      {/* Greeting */}
      <div className="mb-2">
        <h2 className="text-xl font-bold text-foreground">Hi, {displayName} 👋</h2>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <p className="text-sm text-muted-foreground">Welcome back to Envo Pool</p>
          {(profile?.shortId ?? (user as any)?.shortId) && (
            <span className="text-xs font-mono text-muted-foreground/60 bg-muted/40 border border-border/50 rounded px-1.5 py-0.5">
              ID: {profile?.shortId ?? (user as any)?.shortId}
            </span>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <Card className="card-premium cursor-pointer hover:border-accent/30 transition-colors" onClick={() => setTopUpOpen(true)}>
          <CardContent className="pt-3 pb-3 sm:pt-4 sm:pb-4 px-2 sm:px-6 text-center">
            <Wallet className="h-4 w-4 sm:h-5 sm:w-5 mx-auto text-accent mb-1 sm:mb-1.5" />
            <p className="text-sm sm:text-lg font-bold truncate">${walletBalance.toFixed(2)}</p>
            <p className="text-[9px] sm:text-[10px] text-muted-foreground uppercase tracking-wider">Wallet</p>
            <p className="text-[9px] sm:text-[10px] text-accent mt-0.5 sm:mt-1">Tap to top up</p>
          </CardContent>
        </Card>
        <Card className="card-premium">
          <CardContent className="pt-3 pb-3 sm:pt-4 sm:pb-4 px-2 sm:px-6 text-center">
            <Calendar className="h-4 w-4 sm:h-5 sm:w-5 mx-auto text-blue-400 mb-1 sm:mb-1.5" />
            <p className="text-sm sm:text-lg font-bold">{upcoming.length}</p>
            <p className="text-[9px] sm:text-[10px] text-muted-foreground uppercase tracking-wider">Upcoming</p>
          </CardContent>
        </Card>
        <Card className="card-premium">
          <CardContent className="pt-3 pb-3 sm:pt-4 sm:pb-4 px-2 sm:px-6 text-center">
            <Star className="h-4 w-4 sm:h-5 sm:w-5 mx-auto text-amber-400 mb-1 sm:mb-1.5" />
            <p className="text-sm sm:text-lg font-bold">{rewardPoints}</p>
            <p className="text-[9px] sm:text-[10px] text-muted-foreground uppercase tracking-wider">Points</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick actions */}
      <div>
        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">Quick Access</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {navBlocks.map((block) => (
            <Link key={block.to} to={block.to}>
              <Card className={`card-premium border hover:border-opacity-50 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] cursor-pointer h-full ${block.bg}`}>
                <CardContent className="pt-4 pb-4 px-4">
                  <block.icon className={`h-6 w-6 ${block.color} mb-2`} />
                  <p className="font-semibold text-sm text-foreground">{block.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{block.desc}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* Book a table CTA */}
      <Card className="card-premium border-accent/20 bg-accent/5">
        <CardContent className="p-4 flex items-center justify-between gap-4">
          <div>
            <p className="font-semibold text-foreground">Ready to play?</p>
            <p className="text-xs text-muted-foreground">Reserve your table now</p>
          </div>
          <Button
            className="bg-accent text-accent-foreground hover:bg-accent/90 flex-shrink-0"
            onClick={() => navigate("/booking")}
          >
            Book Now <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </CardContent>
      </Card>

      {/* Upcoming reservations */}
      {upcomingPreview.length > 0 && (
        <Card className="card-premium">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">Upcoming Reservations</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/dashboard/bookings" className="text-xs text-accent">View All <ArrowRight className="h-3 w-3 ml-1" /></Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {upcomingPreview.map((b: any) => (
                <div
                  key={b.id || b._id}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-lg border border-border/50 p-3 cursor-pointer hover:bg-primary/5 hover:border-primary/30 transition-colors"
                  onClick={() => setSelectedBooking(b)}
                >
                  <div className="min-w-0">
                    <p className="font-medium text-sm">{getTableLabel(b)}</p>
                    <p className="text-xs text-muted-foreground">
                      {fmtDate(getStartTime(b))} · {fmtTime(getStartTime(b))} – {fmtTime(getEndTime(b))}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">${getPrice(b).toFixed(2)}</span>
                    <Badge variant="outline" className={statusBadge[getStatus(b)] ?? ""}>
                      {statusLabel(getStatus(b))}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <TopUpWalletDialog
        open={topUpOpen}
        onOpenChange={setTopUpOpen}
        shortId={(user as any)?.shortId}
      />
      <BookingDetailDialog
        booking={selectedBooking}
        open={!!selectedBooking}
        onOpenChange={(open) => !open && setSelectedBooking(null)}
      />
    </>
  );
}
