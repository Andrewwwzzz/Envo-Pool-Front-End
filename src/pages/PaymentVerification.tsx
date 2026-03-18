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
        const { data, error } = await supabase.functions.invoke(
          "verify-stripe-booking",
          { body: { session_id: sessionId } }
        );

        if (error) {
          if (retryCount < MAX_RETRIES && !cancelled) {
            retryCount++;
            setTimeout(() => { if (!cancelled) verify(); }, RETRY_DELAY);
            return;
          }
          if (!cancelled) navigate("/booking-confirmed?error=true", { replace: true });
          return;
        }

        if (data.status === "confirmed") {
          queryClient.invalidateQueries({ queryKey: ["tables-with-status"] });
          queryClient.invalidateQueries({ queryKey: ["table-day-bookings"] });
          queryClient.invalidateQueries({ queryKey: ["my-bookings"] });
          queryClient.invalidateQueries({ queryKey: ["profile"] });
          sessionStorage.removeItem("pending_booking_id");
          if (!cancelled) navigate("/booking-confirmed", { replace: true });
          return;
        }

        if (data.status === "expired") {
          queryClient.invalidateQueries({ queryKey: ["tables-with-status"] });
          queryClient.invalidateQueries({ queryKey: ["my-bookings"] });
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
