import { useEffect, useState, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { onBookingUpdated } from "@/hooks/useSocket";
import { apiFetch } from "@/lib/api";

const PaymentVerification = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const bookingId = searchParams.get("booking_id");
  const [message, setMessage] = useState("Waiting for payment confirmation...");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!user) return;

    const targetBookingId = bookingId || sessionStorage.getItem("pending_booking_id");

    // Listen for socket events for this booking
    const unsubscribe = onBookingUpdated((updatedBookingId, status) => {
      if (targetBookingId && updatedBookingId !== targetBookingId) return;

      if (status === "confirmed") {
        sessionStorage.removeItem("pending_booking_id");
        navigate("/booking-confirmed", { replace: true });
      }
    });

    // Fallback: poll every 10s to check if booking still exists
    // Backend DELETES expired bookings, so if it's gone → redirect to refunded
    if (targetBookingId) {
      pollRef.current = setInterval(async () => {
        try {
          const res = await apiFetch("/api/bookings");
          if (res.ok) {
            const allBookings = await res.json();
            const found = (allBookings || []).find(
              (b: any) => (b.id || b._id) === targetBookingId
            );
            if (!found) {
              // Booking was deleted by backend (expired)
              sessionStorage.removeItem("pending_booking_id");
              navigate("/booking-refunded", { replace: true });
            } else if (found.status === "confirmed") {
              sessionStorage.removeItem("pending_booking_id");
              navigate("/booking-confirmed", { replace: true });
            }
          }
        } catch {
          // Ignore fetch errors, keep waiting
        }
      }, 10000);
    }

    // Ultimate timeout — after 5 minutes, redirect to dashboard
    const timeout = setTimeout(() => {
      setMessage("Taking longer than expected. Please check your dashboard.");
      setTimeout(() => {
        navigate("/dashboard", { replace: true });
      }, 3000);
    }, 5 * 60 * 1000);

    return () => {
      unsubscribe();
      if (pollRef.current) clearInterval(pollRef.current);
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
