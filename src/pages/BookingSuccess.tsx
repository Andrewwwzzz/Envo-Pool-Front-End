import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const FALLBACK_CONFIRM_WINDOW_MINUTES = 60;

const BookingSuccess = () => {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    const pendingBookingId = sessionStorage.getItem("pending_booking_id");
    const searchParams = new URLSearchParams(window.location.search);
    const externalBookingId =
      searchParams.get("bookingId") ||
      searchParams.get("booking_id") ||
      searchParams.get("id");

    const confirmMirroredBooking = async () => {
      let confirmed = false;

      if (pendingBookingId) {
        const { data, error } = await supabase
          .from("bookings")
          .update({ status: "confirmed" })
          .eq("id", pendingBookingId)
          .eq("user_id", user.id)
          .eq("status", "pending")
          .select("id");

        if (error) {
          console.error("Failed to confirm mirrored booking by session ID:", error);
        }

        confirmed = !!data?.length;
      }

      if (!confirmed && externalBookingId) {
        const { data, error } = await supabase
          .from("bookings")
          .update({ status: "confirmed" })
          .eq("payment_method", "stripe")
          .eq("payment_id", externalBookingId)
          .eq("user_id", user.id)
          .eq("status", "pending")
          .select("id");

        if (error) {
          console.error("Failed to confirm mirrored booking by external booking ID:", error);
        }

        confirmed = !!data?.length;
      }

      if (!confirmed) {
        const cutoff = new Date(
          Date.now() - FALLBACK_CONFIRM_WINDOW_MINUTES * 60 * 1000,
        ).toISOString();

        const { data: recentPending, error: pendingError } = await supabase
          .from("bookings")
          .select("id")
          .eq("user_id", user.id)
          .eq("payment_method", "stripe")
          .eq("status", "pending")
          .gte("created_at", cutoff)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (pendingError) {
          console.error("Failed to fetch recent pending booking:", pendingError);
        }

        if (recentPending?.id) {
          const { error: fallbackError } = await supabase
            .from("bookings")
            .update({ status: "confirmed" })
            .eq("id", recentPending.id)
            .eq("status", "pending");

          if (fallbackError) {
            console.error("Failed to confirm recent pending booking:", fallbackError);
          }
        }
      }

      sessionStorage.removeItem("pending_booking_id");
    };

    void confirmMirroredBooking();
  }, [user]);

  return (
    <div className="min-h-screen bg-background dark flex items-center justify-center p-6">
      <Card className="card-premium max-w-md w-full text-center">
        <CardContent className="pt-10 pb-8 space-y-6">
          <div className="flex justify-center">
            <CheckCircle className="h-16 w-16 text-primary" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-foreground">Payment Successful</h1>
            <p className="text-muted-foreground">Your booking is confirmed.</p>
          </div>
          <div className="flex flex-col gap-3 pt-4">
            <Link to="/dashboard">
              <Button className="w-full bg-accent text-accent-foreground hover:bg-accent/90">
                View My Bookings
              </Button>
            </Link>
            <Link to="/booking">
              <Button variant="outline" className="w-full">
                Book Another Table
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default BookingSuccess;
