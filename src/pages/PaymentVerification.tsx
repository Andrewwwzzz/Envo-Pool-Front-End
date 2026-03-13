import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";

const PaymentVerification = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const [message, setMessage] = useState("Verifying your booking...");

  useEffect(() => {
    if (!sessionId) {
      navigate("/booking", { replace: true });
      return;
    }

    if (!user) return;

    let cancelled = false;
    let retryCount = 0;
    const MAX_RETRIES = 30;
    const RETRY_DELAY = 2000;

    const verify = async () => {
      try {
        const res = await fetch(
          `https://anytime-pool-api.onrender.com/api/payments/verify-session?session_id=${sessionId}`
        );

        if (!res.ok) {
          if (retryCount < MAX_RETRIES && !cancelled) {
            retryCount++;
            setTimeout(() => { if (!cancelled) verify(); }, RETRY_DELAY);
            return;
          }
          if (!cancelled) navigate("/booking-confirmed?error=true", { replace: true });
          return;
        }

        const data = await res.json();

        if (data.status === "confirmed") {
          await reconcileBookings();
          if (!cancelled) navigate("/booking-confirmed", { replace: true });
          return;
        }

        if (data.status === "expired") {
          await markBookingsExpired();
          if (!cancelled) navigate("/booking-refunded", { replace: true });
          return;
        }

        if (data.status === "processing") {
          if (!cancelled) setMessage("Payment received, confirming your booking...");
          if (retryCount < MAX_RETRIES && !cancelled) {
            retryCount++;
            setTimeout(() => { if (!cancelled) verify(); }, RETRY_DELAY);
          } else {
            if (!cancelled) navigate("/booking-confirmed?error=true", { replace: true });
          }
          return;
        }

        // Unknown status — retry
        if (retryCount < MAX_RETRIES && !cancelled) {
          retryCount++;
          setTimeout(() => { if (!cancelled) verify(); }, RETRY_DELAY);
        } else {
          if (!cancelled) navigate("/booking-confirmed?error=true", { replace: true });
        }
      } catch {
        if (retryCount < MAX_RETRIES && !cancelled) {
          retryCount++;
          setTimeout(() => { if (!cancelled) verify(); }, RETRY_DELAY);
        } else {
          if (!cancelled) navigate("/booking-confirmed?error=true", { replace: true });
        }
      }
    };

    const markBookingsExpired = async () => {
      await supabase
        .from("bookings")
        .update({ status: "expired" })
        .eq("user_id", user.id)
        .eq("payment_method", "stripe")
        .eq("status", "pending");

      queryClient.invalidateQueries({ queryKey: ["tables-with-status"] });
      queryClient.invalidateQueries({ queryKey: ["my-bookings"] });
    };

    const reconcileBookings = async () => {
      const { data: pendingBookings } = await supabase
        .from("bookings")
        .select("id, table_id, start_time, end_time, payment_id")
        .eq("user_id", user.id)
        .eq("payment_method", "stripe")
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(5);

      if (!pendingBookings?.length) return;

      for (const booking of pendingBookings) {
        const { error: updateErr } = await supabase
          .from("bookings")
          .update({ status: "confirmed" })
          .eq("id", booking.id)
          .eq("status", "pending");

        if (!updateErr) {
          const { data: confirmedBooking } = await supabase
            .from("bookings")
            .select("final_price")
            .eq("id", booking.id)
            .single();

          if (confirmedBooking && confirmedBooking.final_price > 0) {
            const earnedPoints = Math.floor(confirmedBooking.final_price);

            if (earnedPoints > 0) {
              await supabase.from("reward_transactions").insert({
                user_id: user.id,
                type: "earn",
                points: earnedPoints,
                related_booking_id: booking.id,
              });

              const { data: profile } = await supabase
                .from("profiles")
                .select("reward_points, total_spent")
                .eq("user_id", user.id)
                .single();

              if (profile) {
                await supabase
                  .from("profiles")
                  .update({
                    reward_points: (profile.reward_points || 0) + earnedPoints,
                    total_spent: (profile.total_spent || 0) + confirmedBooking.final_price,
                  })
                  .eq("user_id", user.id);
              }
            }
          }
        }
      }

      queryClient.invalidateQueries({ queryKey: ["tables-with-status"] });
      queryClient.invalidateQueries({ queryKey: ["table-day-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["my-bookings"] });
      sessionStorage.removeItem("pending_booking_id");
    };

    verify();

    return () => { cancelled = true; };
  }, [user, sessionId, queryClient, navigate]);

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
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PaymentVerification;
