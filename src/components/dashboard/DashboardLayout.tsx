import { Link, NavLink, Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { ArrowLeft, Menu, LogOut, LayoutDashboard, History, Settings as SettingsIcon, Gift, Crown } from "lucide-react";

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/dashboard/transactions", label: "Transactions", icon: History },
  { to: "/dashboard/settings", label: "Account Settings", icon: SettingsIcon },
  { to: "/dashboard/rewards", label: "My Rewards", icon: Gift },
  { to: "/dashboard/membership", label: "Membership", icon: Crown },
];

export default function DashboardLayout() {
  const { user, loading, signOut } = useAuth();
  const { data: profile } = useProfile();
  const location = useLocation();

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground dark">Loading...</div>;
  }
  if (!user) return <Navigate to="/auth" replace />;

  const displayName = profile?.username || profile?.name || user.name || "Account";

  return (
    <div className="min-h-screen bg-background dark">
      <div className="fixed inset-0 opacity-[0.02]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, hsl(var(--foreground)) 1px, transparent 0)', backgroundSize: '40px 40px' }} />

      <header className="relative z-10 border-b border-border/50 bg-card/80 backdrop-blur-md px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <Link to="/booking">
            <Button variant="outline" size="sm" className="border-accent text-accent hover:bg-accent hover:text-accent-foreground">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Button>
          </Link>
          <h1 className="text-xl font-bold tracking-tight gold-gradient">Envo Pool</h1>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="text-muted-foreground">
              <Menu className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="truncate">{displayName}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = item.end
                ? location.pathname === item.to
                : location.pathname.startsWith(item.to);
              return (
                <DropdownMenuItem key={item.to} asChild>
                  <NavLink
                    to={item.to}
                    end={item.end}
                    className={`flex items-center gap-2 w-full cursor-pointer ${isActive ? "bg-accent/30 text-accent-foreground" : ""}`}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </NavLink>
                </DropdownMenuItem>
              );
            })}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={signOut} className="text-destructive focus:text-destructive cursor-pointer">
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      <main className="relative z-10 mx-auto max-w-4xl p-4 sm:p-6 space-y-4 sm:space-y-6">
        <Outlet />
      </main>
    </div>
  );
}
