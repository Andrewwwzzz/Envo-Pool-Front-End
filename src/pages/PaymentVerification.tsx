import { useEffect, useRef, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { onBookingUpdated } from "@/hooks/useSocket";
import { apiFetch } from "@/lib/api";

const MAX_MS = 10 * 60 * 1000;

const PaymentVerification = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const bookingId = searchParams.get("booking_id");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const expiredPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startRef = useRef<number>(Date.now());
  const [remaining, setRemaining] = useState(MAX_MS);

  const targetBookingId = bookingId || sessionStorage.getItem("pending_booking_id");

  const cleanup = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (expiredPollRef.current) clearInterval(expiredPollRef.current);
  };

  useEffect(() => {
    if (!user) return;

    const unsubscribe = onBookingUpdated((updatedBookingId, status) => {
      if (targetBookingId && updatedBookingId !== targetBookingId) return;

      if (status === "confirmed") {
        sessionStorage.removeItem("pending_booking_id");
        cleanup();
        navigate("/booking-confirmed", { replace: true });
      } else if (status === "expired") {
        sessionStorage.removeItem("pending_booking_id");
        cleanup();
        navigate("/booking-refunded", { replace: true });
      }
    });

    // Fallback poll every 5s: check for confirmed status
    if (targetBookingId) {
      pollRef.current = setInterval(async () => {
        try {
          const res = await apiFetch("/api/bookings");
          if (!res.ok) return;
          const allBookings = await res.json();
          const found = (allBookings || []).find(
            (b: any) => (b.id || b._id) === targetBookingId
          );
          if (found && found.status === "confirmed") {
            sessionStorage.removeItem("pending_booking_id");
            cleanup();
            navigate("/booking-confirmed", { replace: true });
          } else if (found && found.status === "expired") {
            sessionStorage.removeItem("pending_booking_id");
            cleanup();
            navigate("/booking-refunded", { replace: true });
          } else if (!found) {
            sessionStorage.removeItem("pending_booking_id");
            cleanup();
            navigate("/booking-refunded", { replace: true });
          }
        } catch (err) {
          console.error("Poll error:", err);
        }
      }, 5000);
    }

    // Countdown timer tick
    const tick = setInterval(() => {
      const elapsed = Date.now() - startRef.current;
      const left = Math.max(0, MAX_MS - elapsed);
      setRemaining(left);
      if (left <= 0) {
        clearInterval(tick);
        sessionStorage.removeItem("pending_booking_id");
        cleanup();
        navigate("/booking-refunded", { replace: true });
      }
    }, 1000);

    return () => {
      unsubscribe();
      cleanup();
      clearInterval(tick);
    };
  }, [user, targetBookingId, navigate]);

  if (!user) return null;

  const mins = Math.floor(remaining / 60000);
  const secs = Math.floor((remaining % 60000) / 1000);
  const timeStr = `${mins}:${secs.toString().padStart(2, "0")}`;

  const handleCancel = () => {
    sessionStorage.removeItem("pending_booking_id");
    cleanup();
    navigate("/booking", { replace: true });
  };

  return (
    <div className="min-h-screen bg-background dark flex items-center justify-center p-6">
      <Card className="card-premium max-w-md w-full text-center">
        <CardContent className="pt-10 pb-8 space-y-6">
          <div className="flex justify-center">
            <Loader2 className="h-16 w-16 text-primary animate-spin" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-foreground">Please Wait</h1>
            <p className="text-muted-foreground">Waiting for payment confirmation...</p>
            <p className="text-sm text-foreground font-medium mt-4">
              Payment window closes in {timeStr}
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Listening for payment confirmation via real-time updates...
            </p>
          </div>
          <Button variant="outline" onClick={handleCancel} className="w-full">
            Cancel and go back
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default PaymentVerification;
