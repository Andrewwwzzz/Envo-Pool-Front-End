import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle, Loader2, XCircle, AlertTriangle } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";

type VerifyStatus = "loading" | "confirmed" | "expired" | "processing" | "error";

const BookingSuccess = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const [status, setStatus] = useState<VerifyStatus>(sessionId ? "loading" : "error");

  useEffect(() => {
    if (!user || !sessionId) {
      return;
    }

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
          if (!cancelled) setStatus("error");
          return;
        }

        if (data.status === "expired") {
          queryClient.invalidateQueries({ queryKey: ["tables-with-status"] });
          queryClient.invalidateQueries({ queryKey: ["my-bookings"] });
          if (!cancelled) setStatus("expired");
          return;
        }

        if (data.status === "confirmed") {
          queryClient.invalidateQueries({ queryKey: ["tables-with-status"] });
          queryClient.invalidateQueries({ queryKey: ["table-day-bookings"] });
          queryClient.invalidateQueries({ queryKey: ["my-bookings"] });
          queryClient.invalidateQueries({ queryKey: ["profile"] });
          sessionStorage.removeItem("pending_booking_id");
          if (!cancelled) setStatus("confirmed");
          return;
        }

        if (data.status === "processing") {
          if (!cancelled) setStatus("processing");
          if (retryCount < MAX_RETRIES && !cancelled) {
            retryCount++;
            setTimeout(() => { if (!cancelled) verify(); }, RETRY_DELAY);
          } else {
            if (!cancelled) setStatus("error");
          }
          return;
        }

        // Unknown status — retry
        if (retryCount < MAX_RETRIES && !cancelled) {
          retryCount++;
          setTimeout(() => { if (!cancelled) verify(); }, RETRY_DELAY);
        } else {
          if (!cancelled) setStatus("error");
        }
      } catch {
        if (retryCount < MAX_RETRIES && !cancelled) {
          retryCount++;
          setTimeout(() => { if (!cancelled) verify(); }, RETRY_DELAY);
        } else {
          if (!cancelled) setStatus("error");
        }
      }
    };

    verify();

    return () => { cancelled = true; };
  }, [user, sessionId, queryClient]);

  return (
    <div className="min-h-screen bg-background dark flex items-center justify-center p-6">
      <Card className="card-premium max-w-md w-full text-center">
        <CardContent className="pt-10 pb-8 space-y-6">
          <div className="flex justify-center">
            {(status === "loading" || status === "processing") && (
              <Loader2 className="h-16 w-16 text-accent animate-spin" />
            )}
            {status === "confirmed" && (
              <CheckCircle className="h-16 w-16 text-primary" />
            )}
            {status === "expired" && (
              <AlertTriangle className="h-16 w-16 text-yellow-500" />
            )}
            {status === "error" && (
              <XCircle className="h-16 w-16 text-destructive" />
            )}
          </div>

          <div className="space-y-2">
            {status === "loading" && (
              <>
                <h1 className="text-2xl font-bold text-foreground">
                  Verifying Payment...
                </h1>
                <p className="text-muted-foreground">
                  Please wait while we check your payment status.
                </p>
              </>
            )}
            {status === "processing" && (
              <>
                <h1 className="text-2xl font-bold text-foreground">
                  Payment Received
                </h1>
                <p className="text-muted-foreground">
                  Confirming your booking... This may take a moment.
                </p>
              </>
            )}
            {status === "confirmed" && (
              <>
                <h1 className="text-2xl font-bold text-foreground">
                  Payment Successful
                </h1>
                <p className="text-muted-foreground">
                  Your booking is confirmed.
                </p>
              </>
            )}
            {status === "expired" && (
              <>
                <h1 className="text-2xl font-bold text-foreground">
                  Reservation Expired
                </h1>
                <p className="text-muted-foreground">
                  Your payment was received after the reservation expired. The payment has been automatically refunded. Please book again if you still want the table.
                </p>
              </>
            )}
            {status === "error" && (
              <>
                <h1 className="text-2xl font-bold text-foreground">
                  Verification Failed
                </h1>
                <p className="text-muted-foreground">
                  We couldn't verify your payment. Please check your bookings in the dashboard or try again.
                </p>
              </>
            )}
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
