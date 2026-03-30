import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useSearchParams } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { useSocket } from "@/hooks/useSocket";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Booking from "./pages/Booking";
import PaymentVerification from "./pages/PaymentVerification";
import BookingConfirmed from "./pages/BookingConfirmed";
import BookingRefunded from "./pages/BookingRefunded";
import Dashboard from "./pages/Dashboard";
import Admin from "./pages/Admin";
import Settings from "./pages/Settings";
import Terms from "./pages/Terms";
import NotFound from "./pages/NotFound";

// Legacy redirects — send old URLs to payment-verification (socket-driven)
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
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/booking" element={<Booking />} />
              <Route path="/payment-verification" element={<PaymentVerification />} />
              <Route path="/payment-success" element={<PaymentVerification />} />
              <Route path="/booking-confirmed" element={<BookingConfirmed />} />
              <Route path="/booking-refunded" element={<BookingRefunded />} />
              {/* Legacy redirects */}
              <Route path="/booking-success" element={<LegacyRedirect />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </SocketProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;