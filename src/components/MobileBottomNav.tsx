import { Link, useLocation } from "react-router-dom";
import { Home, CalendarPlus, UtensilsCrossed, Wallet, User } from "lucide-react";
import { cn } from "@/lib/utils";

// The pages reached from "Me" — that tab stays lit while on any of them.
export const ME_PAGES = [
  "/dashboard/me",
  "/dashboard/membership",
  "/dashboard/rewards",
  "/dashboard/tournaments",
  "/dashboard/settings",
  "/dashboard/inbox",
  "/dashboard/bookings",
];

const TABS = [
  { to: "/dashboard", label: "Home", icon: Home, active: (p: string) => p === "/dashboard" },
  { to: "/booking", label: "Book", icon: CalendarPlus, active: (p: string) => p.startsWith("/booking") },
  { to: "/dashboard/fnb", label: "F&B", icon: UtensilsCrossed, active: (p: string) => p.startsWith("/dashboard/fnb") },
  { to: "/dashboard/transactions", label: "Wallet", icon: Wallet, active: (p: string) => p.startsWith("/dashboard/transactions") },
  { to: "/dashboard/me", label: "Me", icon: User, active: (p: string) => ME_PAGES.some((m) => p.startsWith(m)) },
];

// Space to leave under a page's content on phones so the bar never covers it.
export const BOTTOM_NAV_PADDING =
  "pb-[calc(env(safe-area-inset-bottom,0px)+5.5rem)] sm:pb-[calc(env(safe-area-inset-bottom,0px)+5.5rem)] md:pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)]";

/** App-style tab bar for signed-in customers on phones (hidden from tablet width up). */
export function MobileBottomNav() {
  const { pathname } = useLocation();
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-card/95 backdrop-blur-md md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <ul className="grid grid-cols-5">
        {TABS.map(({ to, label, icon: Icon, active }) => {
          const on = active(pathname);
          return (
            <li key={to}>
              <Link
                to={to}
                aria-current={on ? "page" : undefined}
                className={cn(
                  "flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors active:scale-95",
                  on ? "text-accent" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className={cn("h-5 w-5", on && "stroke-[2.5]")} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
