import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle, Star } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { onPointsUpdated } from "@/hooks/useSocket";
import { useToast } from "@/hooks/use-toast";

const BookingConfirmed = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [earnedPoints, setEarnedPoints] = useState<number | null>(null);

  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: ["my-bookings"] });
    queryClient.invalidateQueries({ queryKey: ["profile"] });
    queryClient.invalidateQueries({ queryKey: ["tables-with-status"] });
    queryClient.invalidateQueries({ queryKey: ["transaction-history"] });
  }, [queryClient]);

  useEffect(() => {
    const unsub = onPointsUpdated((earned, _total) => {
      setEarnedPoints(earned);
      toast({ title: `You earned ${earned} points! 🎉` });
    });
    return unsub;
  }, [toast]);

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

          {earnedPoints !== null && earnedPoints > 0 && (
            <div className="flex items-center justify-center gap-2 rounded-lg border border-accent/30 bg-accent/10 p-4">
              <Star className="h-5 w-5 text-accent" />
              <span className="text-accent font-semibold">You earned {earnedPoints} points!</span>
            </div>
          )}

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
