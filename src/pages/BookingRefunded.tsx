import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";

const BookingRefunded = () => {
  return (
    <div className="min-h-screen bg-background dark flex items-center justify-center p-6">
      <Card className="card-premium max-w-md w-full text-center">
        <CardContent className="pt-10 pb-8 space-y-6">
          <div className="flex justify-center">
            <AlertTriangle className="h-16 w-16 text-yellow-500" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-foreground">Reservation Expired</h1>
            <p className="text-muted-foreground">
              Your payment could not be confirmed in time. If you were charged, a refund has been initiated and will appear within 3-5 business days.
            </p>
          </div>
          <div className="flex flex-col gap-3 pt-4">
            <Link to="/booking">
              <Button className="w-full bg-accent text-accent-foreground hover:bg-accent/90">
                Try Again
              </Button>
            </Link>
            <Link to="/dashboard">
              <Button variant="outline" className="w-full">View My Bookings</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default BookingRefunded;
