import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { useMyBookings, useTables } from "@/hooks/useBooking";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Wallet, Calendar, History } from "lucide-react";
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

export default function DashboardHome() {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const { data: bookings } = useMyBookings();
  const { data: tables } = useTables(null, null);
  const [selectedBooking, setSelectedBooking] = useState<any>(null);
  const [topUpOpen, setTopUpOpen] = useState(false);

  const now = nowSG();
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

  const upcoming = myBookings
    .filter((b: any) => {
      if (getStatus(b) !== "confirmed") return false;
      const start = new Date(getStartTime(b));
      return start > new Date();
    })
    .sort((a: any, b: any) => new Date(getStartTime(a)).getTime() - new Date(getStartTime(b)).getTime());
  const upcomingPreview = upcoming.slice(0, 5);

  return (
    <>
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
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Upcoming Reservations</CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/dashboard/bookings">View All Bookings</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {upcomingPreview.length === 0 ? (
            <p className="text-muted-foreground text-sm">No upcoming reservations.</p>
          ) : (
            <div className="space-y-3">
              {upcomingPreview.map((b: any) => (
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
