import { Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle, XCircle } from "lucide-react";

const BookingConfirmed = () => {
  const [searchParams] = useSearchParams();
  const hasError = searchParams.get("error") === "true";

  if (hasError) {
    return (
      <div className="min-h-screen bg-background dark flex items-center justify-center p-6">
        <Card className="card-premium max-w-md w-full text-center">
          <CardContent className="pt-10 pb-8 space-y-6">
            <div className="flex justify-center">
              <XCircle className="h-16 w-16 text-destructive" />
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-foreground">Verification Failed</h1>
              <p className="text-muted-foreground">
                We couldn't verify your payment. Please check your bookings in the dashboard or try again.
              </p>
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
  }

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
              <Button variant="outline" className="w-full">Book Another Table</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default BookingConfirmed;
