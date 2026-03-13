import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";

const BookingSuccess = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(true);

  useEffect(() => {
    if (!user) return;

    let cancelled = false;
    let retryCount = 0;
    const MAX_RETRIES = 6; // ~30 seconds total
    const RETRY_DELAY = 5000;

    const reconcile = async () => {
      // Find pending stripe bookings for this user
      const { data: pendingBookings, error } = await supabase
        .from("bookings")
        .select("id, table_id, start_time, end_time, payment_id")
        .eq("user_id", user.id)
        .eq("payment_method", "stripe")
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(5);

      if (error || !pendingBookings?.length) {
        setConfirming(false);
        return;
      }

      // Also fetch tables to get hardware_id mapping
      const tableIds = [...new Set(pendingBookings.map((b) => b.table_id))];
      const { data: tables } = await supabase
        .from("tables")
        .select("id, hardware_id")
        .in("id", tableIds);

      const tableMap = new Map(tables?.map((t) => [t.id, t.hardware_id]) || []);

      let anyConfirmed = false;

      for (const booking of pendingBookings) {
        const hardwareId = tableMap.get(booking.table_id);
        if (!hardwareId) continue;

        const start = new Date(booking.start_time);
        const end = new Date(booking.end_time);
        const durationHrs = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60));
        const startHour = start.getHours();
        const dateStr = `${start.getFullYear()}-${(start.getMonth() + 1).toString().padStart(2, "0")}-${start.getDate().toString().padStart(2, "0")}`;

        let allSessionsBooked = true;

        for (let i = 0; i < durationHrs; i++) {
          const sessionId = `${dateStr}-${(startHour + i).toString().padStart(2, "0")}`;
          try {
            const res = await fetch(
              `https://anytime-pool-api.onrender.com/api/bookings/availability?sessionId=${sessionId}&tableId=${hardwareId}`
            );
            if (res.ok) {
              const data = await res.json();
              // If the session is available, it means payment wasn't confirmed yet
              if (data.available === true) {
                allSessionsBooked = false;
                break;
              }
            } else {
              allSessionsBooked = false;
              break;
            }
          } catch {
            allSessionsBooked = false;
            break;
          }
        }

        if (allSessionsBooked) {
          // External API confirms booking is paid — update local mirror
          const { error: updateErr } = await supabase
            .from("bookings")
            .update({ status: "confirmed" })
            .eq("id", booking.id)
            .eq("status", "pending");

          if (!updateErr) {
            anyConfirmed = true;

            // Award reward points (1 pt per $1 spent)
            // Fetch the booking's final_price to calculate points
            const { data: confirmedBooking } = await supabase
              .from("bookings")
              .select("final_price")
              .eq("id", booking.id)
              .single();

            if (confirmedBooking && confirmedBooking.final_price > 0) {
              const earnedPoints = Math.floor(confirmedBooking.final_price);

              if (earnedPoints > 0) {
                // Insert reward transaction
                await supabase.from("reward_transactions").insert({
                  user_id: user.id,
                  type: "earn",
                  points: earnedPoints,
                  related_booking_id: booking.id,
                });

                // Update profile reward_points and total_spent
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
      }

      if (anyConfirmed) {
        queryClient.invalidateQueries({ queryKey: ["tables-with-status"] });
        queryClient.invalidateQueries({ queryKey: ["table-day-bookings"] });
        queryClient.invalidateQueries({ queryKey: ["my-bookings"] });
        sessionStorage.removeItem("pending_booking_id");
        setConfirming(false);
      } else if (retryCount < MAX_RETRIES && !cancelled) {
        // Webhook may not have fired yet, retry
        retryCount++;
        setTimeout(() => {
          if (!cancelled) reconcile();
        }, RETRY_DELAY);
      } else {
        setConfirming(false);
      }
    };

    reconcile();

    return () => {
      cancelled = true;
    };
  }, [user, queryClient]);

  return (
    <div className="min-h-screen bg-background dark flex items-center justify-center p-6">
      <Card className="card-premium max-w-md w-full text-center">
        <CardContent className="pt-10 pb-8 space-y-6">
          <div className="flex justify-center">
            {confirming ? (
              <Loader2 className="h-16 w-16 text-accent animate-spin" />
            ) : (
              <CheckCircle className="h-16 w-16 text-primary" />
            )}
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-foreground">
              {confirming ? "Confirming Payment..." : "Payment Successful"}
            </h1>
            <p className="text-muted-foreground">
              {confirming
                ? "Please wait while we verify your payment."
                : "Your booking is confirmed."}
            </p>
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
