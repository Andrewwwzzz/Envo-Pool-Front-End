import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

const BookingConfirmed = () => {
  const queryClient = useQueryClient();

  useEffect(() => {
    // Refetch all relevant data
    queryClient.invalidateQueries({ queryKey: ["my-bookings"] });
    queryClient.invalidateQueries({ queryKey: ["profile"] });
    queryClient.invalidateQueries({ queryKey: ["tables-with-status"] });
    queryClient.invalidateQueries({ queryKey: ["transaction-history"] });
  }, [queryClient]);

  return (
    <div className="min-h-screen bg-background dark flex items-center justify-center p-6">
      <Card className="card-premium max-w-md w-full text-center">
        <CardContent className="pt-10 pb-8 space-y-6">
          <div className="flex justify-center">
            <CheckCircle className="h-16 w-16 text-primary" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-foreground">Booking Confirmed</h1>
            <p className="text-muted-foreground">Your table has been reserved successfully.</p>
          </div>
          <div className="flex flex-col gap-3 pt-4">
            <Link to="/dashboard">
              <Button className="w-full bg-accent text-accent-foreground hover:bg-accent/90">
                View My Bookings
              </Button>
            </Link>
            <Link to="/booking">
              <Button variant="outline" className="w-full">Book Another Table</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default BookingConfirmed;
