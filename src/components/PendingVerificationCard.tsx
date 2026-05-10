import { Hourglass } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

interface Props {
  onSignOut: () => void;
}

const PendingVerificationCard = ({ onSignOut }: Props) => {
  return (
    <div className="min-h-screen bg-background dark flex items-center justify-center p-6">
      <Card className="card-premium max-w-md w-full text-center">
        <CardContent className="pt-10 pb-8 space-y-6">
          <div className="flex justify-center">
            <Hourglass className="h-16 w-16 text-accent" />
          </div>
          <div className="space-y-3">
            <h1 className="text-2xl font-bold text-foreground">
              Account Pending Verification
            </h1>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Your account is currently being reviewed by our team. You will be
              able to make bookings once your account has been verified. This
              usually takes less than 24 hours.
            </p>
          </div>
          <Button variant="outline" onClick={onSignOut} className="w-full">
            <LogOut className="mr-2 h-4 w-4" /> Sign Out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default PendingVerificationCard;
