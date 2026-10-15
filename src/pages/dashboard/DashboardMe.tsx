import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar, Crown, Gift, Trophy, Inbox, Settings, Shield, LogOut, ChevronRight, Wallet, Star } from "lucide-react";

const ROWS = [
  { to: "/dashboard/bookings", label: "My Bookings", desc: "View & manage reservations", icon: Calendar, color: "text-blue-400" },
  { to: "/dashboard/membership", label: "Membership", desc: "Plans & benefits", icon: Crown, color: "text-yellow-400" },
  { to: "/dashboard/rewards", label: "My Rewards", desc: "Points & reward codes", icon: Gift, color: "text-amber-400" },
  { to: "/dashboard/tournaments", label: "Tournaments", desc: "Your tournament sign-ups", icon: Trophy, color: "text-rose-400" },
  { to: "/dashboard/inbox", label: "Inbox", desc: "Messages from Envo", icon: Inbox, color: "text-sky-400" },
  { to: "/dashboard/settings", label: "Account", desc: "Profile & settings", icon: Settings, color: "text-green-400" },
];

/** "Me" tab: the customer's account and everything that isn't a main tab. */
export default function DashboardMe() {
  const { user, signOut } = useAuth();
  const { data: profile } = useProfile();
  const name = profile?.username || profile?.name || user?.name || "";
  const shortId = profile?.shortId ?? user?.shortId;
  const wallet = profile?.wallet_balance ?? profile?.walletBalance ?? 0;
  const points = profile?.rewardPoints ?? 0;
  const isAdmin = user?.isAdmin === true;

  return (
    <>
      <Card className="card-premium">
        <CardContent className="p-4 space-y-3">
          <div>
            <p className="text-lg font-bold text-foreground truncate">{name}</p>
            {shortId && (
              <span className="text-xs font-mono text-muted-foreground/70 bg-muted/40 border border-border/50 rounded px-1.5 py-0.5">ID: {shortId}</span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Link to="/dashboard/transactions" className="rounded-lg border border-border/50 p-3 hover:border-accent/40 transition-colors">
              <Wallet className="h-4 w-4 text-accent mb-1" />
              <p className="font-bold">${Number(wallet).toFixed(2)}</p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Wallet</p>
            </Link>
            <Link to="/dashboard/rewards" className="rounded-lg border border-border/50 p-3 hover:border-accent/40 transition-colors">
              <Star className="h-4 w-4 text-amber-400 mb-1" />
              <p className="font-bold">{points}</p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Points</p>
            </Link>
          </div>
        </CardContent>
      </Card>

      <Card className="card-premium overflow-hidden">
        <ul className="divide-y divide-border/50">
          {ROWS.map(({ to, label, desc, icon: Icon, color }) => (
            <li key={to}>
              <Link to={to} className="flex items-center gap-3 px-4 py-3.5 hover:bg-primary/5 active:bg-primary/10 transition-colors">
                <Icon className={`h-5 w-5 shrink-0 ${color}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">{label}</p>
                  <p className="text-xs text-muted-foreground truncate">{desc}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            </li>
          ))}
          {isAdmin && (
            <li>
              <Link to="/admin" className="flex items-center gap-3 px-4 py-3.5 hover:bg-primary/5 active:bg-primary/10 transition-colors">
                <Shield className="h-5 w-5 shrink-0 text-accent" />
                <p className="flex-1 text-sm font-medium text-foreground">Admin panel</p>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            </li>
          )}
          <li>
            <button type="button" onClick={signOut} className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-destructive/5 active:bg-destructive/10 transition-colors">
              <LogOut className="h-5 w-5 shrink-0 text-destructive" />
              <p className="text-sm font-medium text-destructive">Sign out</p>
            </button>
          </li>
        </ul>
      </Card>
    </>
  );
}
