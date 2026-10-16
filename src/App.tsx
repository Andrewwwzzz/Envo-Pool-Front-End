import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useSearchParams } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { useSocket } from "@/hooks/useSocket";
import { lazy, Suspense, type ComponentType } from "react";
import Index from "./pages/Index";
import ErrorBoundary from "./components/ErrorBoundary";
import { RouteSeo } from "./components/RouteSeo";

// Every page except the homepage is loaded on demand, so the homepage
// doesn't download the admin dashboard, booking page etc. up front.
// If a page's file has gone missing (a new version was deployed while this
// tab was open), reload once to pick up the new version instead of erroring.
function page<T extends ComponentType<any>>(load: () => Promise<{ default: T }>) {
  return lazy(() =>
    load().catch((err) => {
      const key = "envo:chunk-reload";
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, "1");
        window.location.reload();
        return new Promise<{ default: T }>(() => {});
      }
      throw err;
    }).then((m) => { sessionStorage.removeItem("envo:chunk-reload"); return m; })
  );
}
const Auth = page(() => import("./pages/Auth"));
const Booking = page(() => import("./pages/Booking"));
const PaymentVerification = page(() => import("./pages/PaymentVerification"));
const BookingConfirmed = page(() => import("./pages/BookingConfirmed"));
const BookingRefunded = page(() => import("./pages/BookingRefunded"));
const DashboardLayout = page(() => import("./components/dashboard/DashboardLayout"));
const DashboardHome = page(() => import("./pages/dashboard/DashboardHome"));
const DashboardTransactions = page(() => import("./pages/dashboard/DashboardTransactions"));
const DashboardSettings = page(() => import("./pages/dashboard/DashboardSettings"));
const DashboardRewards = page(() => import("./pages/dashboard/DashboardRewards"));
const DashboardMembership = page(() => import("./pages/dashboard/DashboardMembership"));
const DashboardFnb = page(() => import("./pages/dashboard/DashboardFnb"));
const DashboardBookings = page(() => import("./pages/dashboard/DashboardBookings"));
const DashboardInbox = page(() => import("./pages/dashboard/DashboardInbox"));
const Admin = page(() => import("./pages/Admin"));
const Terms = page(() => import("./pages/Terms"));
const Tournaments = page(() => import("./pages/Tournaments"));
const TournamentDetail = page(() => import("./pages/TournamentDetail"));
const DashboardTournaments = page(() => import("./pages/dashboard/DashboardTournaments"));
const Kyc = page(() => import("./pages/Kyc"));
const NotFound = page(() => import("./pages/NotFound"));

const PageLoading = () => (
  <div className="flex min-h-screen items-center justify-center bg-background">
    <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" aria-label="Loading" />
  </div>
);
import AppUpdateBanner from "./components/AppUpdateBanner";
import { NotificationTapTracker } from "./components/NotificationTapTracker";

// Legacy redirects â€” send old URLs to payment-verification (socket-driven)
const LegacyRedirect = () => {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session_id");
  return <Navigate to={`/payment-verification${sessionId ? `?session_id=${sessionId}` : ""}`} replace />;
};

const queryClient = new QueryClient();

const SocketProvider = ({ children }: { children: React.ReactNode }) => {
  useSocket();
  return <>{children}</>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <SocketProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <AppUpdateBanner />
          <BrowserRouter>
            <NotificationTapTracker />
            <RouteSeo />
            <ErrorBoundary label="this page">
              <Suspense fallback={<PageLoading />}>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/login" element={<Navigate to="/auth" replace />} />
                <Route path="/booking" element={<Booking />} />
                <Route path="/payment-verification" element={<PaymentVerification />} />
                <Route path="/payment-success" element={<PaymentVerification />} />
                <Route path="/booking-confirmed" element={<BookingConfirmed />} />
                <Route path="/booking-refunded" element={<BookingRefunded />} />
                {/* Legacy redirects */}
                <Route path="/booking-success" element={<LegacyRedirect />} />
                <Route path="/dashboard" element={<DashboardLayout />}>
                  <Route index element={<DashboardHome />} />
                  <Route path="transactions" element={<DashboardTransactions />} />
                  <Route path="settings" element={<DashboardSettings />} />
                  <Route path="rewards" element={<DashboardRewards />} />
                  <Route path="membership" element={<DashboardMembership />} />
                  <Route path="fnb" element={<DashboardFnb />} />
                  <Route path="bookings" element={<DashboardBookings />} />
                  <Route path="inbox" element={<DashboardInbox />} />
                  <Route path="tournaments" element={<DashboardTournaments />} />
                </Route>
                <Route path="/settings" element={<Navigate to="/dashboard/settings" replace />} />
                <Route
                  path="/admin"
                  element={
                    <ErrorBoundary label="the Admin panel">
                      <Admin />
                    </ErrorBoundary>
                  }
                />
                <Route path="/terms" element={<Terms />} />
                <Route path="/tournaments" element={<Tournaments />} />
                <Route path="/tournaments/:id" element={<TournamentDetail />} />
                <Route path="/kyc" element={<Kyc />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
              </Suspense>
            </ErrorBoundary>
          </BrowserRouter>
        </TooltipProvider>
      </SocketProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
