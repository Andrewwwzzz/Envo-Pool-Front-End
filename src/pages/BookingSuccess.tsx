import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const BookingSuccess = () => {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    const searchParams = new URLSearchParams(window.location.search);
    const externalBookingId =
      searchParams.get("bookingId") ||
      searchParams.get("booking_id") ||
      searchParams.get("id");

    const statusParam = (
      searchParams.get("status") ||
      searchParams.get("payment_status") ||
      searchParams.get("result") ||
      searchParams.get("redirect_status") ||
      ""
    ).toLowerCase();

    const canceledParam = (
      searchParams.get("canceled") ||
      searchParams.get("cancelled") ||
      ""
    ).toLowerCase();

    const hasExplicitSuccess = [
      "success",
      "paid",
      "succeeded",
      "true",
      "1",
      "complete",
    ].includes(statusParam);

    const isCanceled = ["1", "true", "cancel", "canceled", "cancelled"].includes(canceledParam);

    const confirmMirroredBooking = async () => {
      // Only confirm when we have a booking ID + explicit success signal
      if (!externalBookingId || !hasExplicitSuccess || isCanceled) {
        sessionStorage.removeItem("pending_booking_id");
        return;
      }

      const { error } = await supabase
        .from("bookings")
        .update({ status: "confirmed" })
        .eq("payment_method", "stripe")
        .eq("payment_id", externalBookingId)
        .eq("user_id", user.id)
        .eq("status", "pending");

      if (error) {
        console.error("Failed to confirm mirrored booking by external booking ID:", error);
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
