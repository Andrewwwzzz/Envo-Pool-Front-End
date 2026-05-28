import { useProfile } from "@/hooks/useProfile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Crown, Lock } from "lucide-react";

export default function DashboardMembership() {
  const { data: profile } = useProfile();
  const membership = (profile as any)?.membership ?? null;
  const hasMembership = !!membership && (membership.active || membership.status === "active");

  if (!hasMembership) {
    return (
      <Card className="card-premium">
        <CardContent className="py-16 flex flex-col items-center text-center space-y-4">
          <div className="relative">
            <Crown className="h-16 w-16 text-muted-foreground/40" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Lock className="h-7 w-7 text-muted-foreground" />
            </div>
          </div>
          <div className="space-y-1">
            <h2 className="text-xl font-semibold">No active membership</h2>
            <p className="text-sm text-muted-foreground max-w-md">
              Unlock exclusive perks, priority bookings, and member-only rates with an Envo Pool membership.
            </p>
          </div>
          <Button variant="outline" disabled>
            Coming Soon
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="card-premium">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Crown className="h-5 w-5 text-accent" />
          {membership.planName || "Membership"}
          {membership.status && (
            <Badge variant="outline" className="ml-2 capitalize">{membership.status}</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-muted-foreground">
          Membership details will appear here. (Placeholder — content to be added.)
        </p>
      </CardContent>
    </Card>
  );
}
