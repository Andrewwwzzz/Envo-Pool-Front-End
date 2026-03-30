import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { onBookingUpdated } from "@/hooks/useSocket";

const PaymentVerification = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const bookingId = searchParams.get("booking_id");
  const [message, setMessage] = useState("Waiting for payment confirmation...");

  useEffect(() => {
    if (!user) return;

    // If no booking_id to listen for, just show waiting and rely on socket
    const targetBookingId = bookingId || sessionStorage.getItem("pending_booking_id");

    // Listen for socket events for this booking
    const unsubscribe = onBookingUpdated((updatedBookingId, status) => {
      // If we have a target booking ID, only react to that one
      if (targetBookingId && updatedBookingId !== targetBookingId) return;

      if (status === "confirmed") {
        sessionStorage.removeItem("pending_booking_id");
        navigate("/booking-confirmed", { replace: true });
      } else if (status === "expired") {
        sessionStorage.removeItem("pending_booking_id");
        navigate("/booking-refunded", { replace: true });
      }
    });

    // Timeout fallback — after 5 minutes, redirect to dashboard
    const timeout = setTimeout(() => {
      setMessage("Taking longer than expected. Please check your dashboard.");
      setTimeout(() => {
        navigate("/dashboard", { replace: true });
      }, 3000);
    }, 5 * 60 * 1000);

    return () => {
      unsubscribe();
      clearTimeout(timeout);
    };
  }, [user, bookingId, navigate]);

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background dark flex items-center justify-center p-6">
      <Card className="card-premium max-w-md w-full text-center">
        <CardContent className="pt-10 pb-8 space-y-6">
          <div className="flex justify-center">
            <Loader2 className="h-16 w-16 text-accent animate-spin" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-foreground">Please Wait</h1>
            <p className="text-muted-foreground">{message}</p>
            <p className="text-xs text-muted-foreground mt-4">
              Listening for payment confirmation via real-time updates...
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PaymentVerification;
