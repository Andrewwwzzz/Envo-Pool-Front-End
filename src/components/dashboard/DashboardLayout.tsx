import { Link, Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { Button } from "@/components/ui/button";
import { ArrowLeft, LogOut } from "lucide-react";
import { CampaignPopup } from "@/components/CampaignPopup";

const PAGE_TITLES: Record<string, string> = {
  "/dashboard/bookings": "My Bookings",
  "/dashboard/transactions": "Transactions",
  "/dashboard/settings": "Account Settings",
  "/dashboard/rewards": "My Rewards",
  "/dashboard/membership": "Membership",
  "/dashboard/fnb": "F&B",
};

export default function DashboardLayout() {
  const { user, loading, signOut } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground dark">Loading...</div>;
  }
  if (!user) return <Navigate to="/auth" replace />;

  const isHome = location.pathname === "/dashboard";
  const pageTitle = PAGE_TITLES[location.pathname];

  return (
    <div className="min-h-screen bg-background dark">
      <div className="fixed inset-0 opacity-[0.02]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, hsl(var(--foreground)) 1px, transparent 0)', backgroundSize: '40px 40px' }} />

      <header
        className="relative z-10 border-b border-border/50 bg-card/80 backdrop-blur-md px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-2"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 12px)" }}
      >
        <div className="flex items-center gap-3">
          {isHome ? (
            <Link to="/booking">
              <Button variant="outline" size="sm" className="border-accent text-accent hover:bg-accent hover:text-accent-foreground">
                <ArrowLeft className="mr-2 h-4 w-4" /> Back
              </Button>
            </Link>
          ) : (
            <Link to="/dashboard">
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground gap-2 pl-1">
                <ArrowLeft className="h-5 w-5" />
                <span className="text-sm font-medium">{pageTitle || "Dashboard"}</span>
              </Button>
            </Link>
          )}
          {isHome && (
            <h1 className="text-xl font-bold tracking-tight gold-gradient">Envo Pool</h1>
          )}
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-destructive"
          onClick={signOut}
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </header>

      <CampaignPopup />

      <main
        className="relative z-10 mx-auto max-w-4xl px-4 sm:px-6 pt-4 sm:pt-6 space-y-4 sm:space-y-6"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 1.5rem)" }}
      >
        <Outlet />
      </main>
    </div>
  );
}
