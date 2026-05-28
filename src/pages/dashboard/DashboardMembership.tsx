import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Crown, Lock, Percent, Timer, Beer, KeyRound, Users } from "lucide-react";
import { useMyMembership, useMembershipPlans } from "@/hooks/useMembership";
import { useMyLocker } from "@/hooks/useLockers";
import { fmtDateSG } from "@/lib/sgTime";

function daysBetween(future?: string) {
  if (!future) return 0;
  const ms = new Date(future).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

export default function DashboardMembership() {
  const { data: membership } = useMyMembership();
  const { data: locker } = useMyLocker();
  const { data: plans = [] } = useMembershipPlans();

  const active = membership && (membership.status === "active" || membership.active);
  const plan = membership?.plan || membership;

  if (!active) {
    return (
      <div className="space-y-6">
        <Card className="card-premium">
          <CardContent className="py-12 flex flex-col items-center text-center space-y-4">
            <div className="relative">
              <Crown className="h-16 w-16 text-muted-foreground/40" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Lock className="h-7 w-7 text-muted-foreground" />
              </div>
            </div>
            <div className="space-y-1">
              <h2 className="text-xl font-semibold">No active membership</h2>
              <p className="text-sm text-muted-foreground max-w-md">
                Browse our plans below. Contact staff to subscribe.
              </p>
            </div>
          </CardContent>
        </Card>

        {plans.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2">
            {plans.map((p) => (
              <Card key={p.id} className="opacity-60">
                <CardHeader>
                  <CardTitle className="text-base flex items-center justify-between">
                    <span>{p.name}</span>
                    <span className="text-sm font-normal text-muted-foreground">${p.price}/{p.billingCycle}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {p.description && <p className="text-muted-foreground">{p.description}</p>}
                  <div className="flex flex-wrap gap-1">
                    {!!p.bookingDiscountPct && <Badge variant="secondary">{p.bookingDiscountPct}% off</Badge>}
                    {!!p.freeMinutesPerVisit && <Badge variant="secondary">{p.freeMinutesPerVisit}m free</Badge>}
                    {p.freeDrinkPerVisit && <Badge variant="secondary">Free drink</Badge>}
                    {p.lockerIncluded && <Badge variant="secondary">Locker</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground pt-2">Contact staff to subscribe</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  }

  const benefits: { icon: any; label: string }[] = [];
  if (plan?.bookingDiscountPct) benefits.push({ icon: Percent, label: `${plan.bookingDiscountPct}% off all bookings` });
  if (plan?.freeMinutesPerVisit) benefits.push({ icon: Timer, label: `${plan.freeMinutesPerVisit} mins free per visit` });
  if (plan?.freeDrinkPerVisit) benefits.push({ icon: Beer, label: "Free drink per visit" });
  if (plan?.lockerIncluded) benefits.push({ icon: KeyRound, label: "Locker included" });
  if (plan?.guestPassesPerMonth) benefits.push({ icon: Users, label: `${plan.guestPassesPerMonth} guest passes / month` });

  return (
    <div className="space-y-6">
      <Card className="card-premium">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Crown className="h-5 w-5 text-accent" />
            {plan?.name || "Membership"}
            <Badge variant="default" className="ml-2 capitalize">{membership.status || "active"}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-muted-foreground">Price</div>
              <div className="font-medium">${plan?.price ?? 0} / {plan?.billingCycle ?? "monthly"}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Renewal Date</div>
              <div className="font-medium">{membership.renewalDate ? fmtDateSG(membership.renewalDate) : "—"}</div>
            </div>
          </div>
          {benefits.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Benefits</div>
              <ul className="space-y-1.5">
                {benefits.map((b, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <b.icon className="h-4 w-4 text-accent" />
                    <span>{b.label}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      {locker ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-accent" />
              Your Locker — #{locker.number ?? locker.lockerNumber}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Renewal</span>
              <span>{locker.renewalDate ? fmtDateSG(locker.renewalDate) : "—"}</span>
            </div>
            {locker.renewalDate && (
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Days remaining</span>
                  <span>{daysBetween(locker.renewalDate)} days</span>
                </div>
                <Progress value={Math.min(100, (daysBetween(locker.renewalDate) / 30) * 100)} />
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-6 text-center text-sm text-muted-foreground">
            No locker assigned — contact staff
          </CardContent>
        </Card>
      )}
    </div>
  );
}
