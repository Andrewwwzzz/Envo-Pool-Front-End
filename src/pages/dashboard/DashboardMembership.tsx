import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Crown, Lock, Percent, Timer, Beer, KeyRound, Loader2, Eye, EyeOff, PiggyBank, CircleDot } from "lucide-react";
import { toast } from "sonner";
import {
  useMyMembership,
  useMembershipPlans,
  useSubscribeMembership,
  useCancelMyMembership,
  useRenewMembership,
  type MembershipPlan,
} from "@/hooks/useMembership";
import { useProfile } from "@/hooks/useProfile";
import { fmtDateSG } from "@/lib/sgTime";

function daysBetween(future?: string) {
  if (!future) return 0;
  const ms = new Date(future).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

function getMembershipId(m: any): string | undefined {
  return m?.id ?? m?._id;
}

function LockerCard({ lockerRental }: { lockerRental: any }) {
  const [showPin, setShowPin] = useState(false);
  const lockerNum =
    lockerRental?.lockerUnitId?.lockerNumber ??
    lockerRental?.lockerUnitId?.number ??
    lockerRental?.lockerNumber;
  const lockerPin = lockerRental?.pin;
  const lockerRenewal = lockerRental?.renewalDate;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-accent" />
          Your Locker — #{lockerNum ?? "—"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground">PIN</span>
          {lockerPin ? (
            <div className="flex items-center gap-2">
              <span className="font-mono">{showPin ? lockerPin : "••••"}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => setShowPin((v) => !v)}
                aria-label={showPin ? "Hide PIN" : "Show PIN"}
              >
                {showPin ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </Button>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">PIN not set — contact staff</span>
          )}
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Renewal</span>
          <span>{lockerRenewal ? fmtDateSG(lockerRenewal) : "—"}</span>
        </div>
        {lockerRenewal && (
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Days remaining</span>
              <span>{daysBetween(lockerRenewal)} days</span>
            </div>
            <Progress value={Math.min(100, (daysBetween(lockerRenewal) / 30) * 100)} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MembershipCard({
  membership,
  walletBalance,
  onCancel,
  onRenew,
}: {
  membership: any;
  walletBalance: number;
  onCancel: (m: any) => void;
  onRenew: (m: any) => void;
}) {
  const status: string = String(membership?.status ?? (membership?.active ? "active" : "")).toLowerCase();
  const plan = membership?.plan || membership;
  const benefitsObj = (plan?.benefits ?? {}) as any;
  const bookingDiscount = benefitsObj.bookingDiscount ?? plan?.bookingDiscountPct ?? 0;
  const freeMinutesPerVisit = benefitsObj.freeMinutesPerVisit ?? plan?.freeMinutesPerVisit ?? 0;
  const freeDrinkPerVisit = benefitsObj.freeDrinkPerVisit ?? plan?.freeDrinkPerVisit ?? false;
  const lockerIncluded = benefitsObj.lockerIncluded ?? plan?.lockerIncluded ?? false;

  const endDate = membership?.endDate ?? membership?.cancelledUntil ?? membership?.renewalDate;
  const endDatePassed = endDate ? new Date(endDate).getTime() < Date.now() : false;
  const isActive = status === "active" || (!status && membership?.active);
  const isCancelled = status === "cancelled";
  const isExpired = status === "expired" || (isCancelled && endDatePassed);

  const statusBadgeVariant: "default" | "secondary" | "destructive" =
    isActive && !isExpired ? "default" : isCancelled && !isExpired ? "secondary" : "destructive";
  const statusLabel = isExpired ? "Expired" : isCancelled ? "Cancelled" : "Active";
  const canCancel = isActive && !isExpired;
  const showRenew = isExpired;

  const planPrice = Number(plan?.price ?? 0);
  const planCycle = plan?.billingCycle ?? "monthly";
  const canAffordRenew = walletBalance >= planPrice;
  const dimmed = isExpired ? "opacity-60" : "";

  const lastVisitDate = membership?.lastVisitDate;
  const visitedToday = (() => {
    if (!lastVisitDate) return false;
    const sgFmt = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "Asia/Singapore" });
    return sgFmt(new Date(lastVisitDate)) === sgFmt(new Date());
  })();

  return (
    <Card className={`card-premium ${dimmed}`}>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2 flex-wrap">
          <Crown className="h-5 w-5 text-accent" />
          {plan?.name || "Membership"}
          <Badge variant={statusBadgeVariant} className="ml-2">{statusLabel}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-xs text-muted-foreground">Price</div>
            <div className="font-medium">${plan?.price ?? 0} / {plan?.billingCycle ?? "monthly"}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">
              {isExpired ? "Ended" : isCancelled ? "Active Until" : "Renewal Date"}
            </div>
            <div className="font-medium">
              {isExpired && endDate
                ? fmtDateSG(endDate)
                : isCancelled && endDate
                ? `Active until ${fmtDateSG(endDate)}`
                : membership?.renewalDate
                ? `Renews ${fmtDateSG(membership.renewalDate)}`
                : "—"}
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Benefits</div>
          <ul className="space-y-1.5">
            {bookingDiscount > 0 && (
              <li className="flex items-start gap-2">
                <Percent className="h-4 w-4 text-accent mt-0.5" />
                <span>
                  <span className="font-medium">{bookingDiscount}% off all bookings</span>
                  <span className="text-muted-foreground"> — auto-applied at checkout</span>
                </span>
              </li>
            )}
            {freeMinutesPerVisit > 0 && (
              <li className="flex items-start gap-2">
                <Timer className="h-4 w-4 text-accent mt-0.5" />
                <span>
                  <span className="font-medium">{freeMinutesPerVisit} mins free per visit</span>
                  <span className="text-muted-foreground"> — auto-applied daily</span>
                </span>
              </li>
            )}
            {freeDrinkPerVisit && (
              <li className="flex items-start gap-2">
                <Beer className="h-4 w-4 text-accent mt-0.5" />
                <span>Free drink / snack per visit</span>
              </li>
            )}
            {lockerIncluded && (
              <li className="flex items-start gap-2">
                <KeyRound className="h-4 w-4 text-accent mt-0.5" />
                <span>Locker included</span>
              </li>
            )}
          </ul>
        </div>

        {freeMinutesPerVisit > 0 && isActive && !isExpired && (
          <div className="flex items-center gap-2 rounded-md border border-border/50 bg-muted/40 px-3 py-2 text-xs">
            <CircleDot className="h-3.5 w-3.5 text-accent" />
            {visitedToday ? (
              <span>Free minutes used today</span>
            ) : (
              <span>{freeMinutesPerVisit} mins free on your next visit</span>
            )}
          </div>
        )}

        {showRenew && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-md border border-destructive/40 bg-destructive/5 p-3">
            <div className="space-y-0.5">
              <div className="text-sm font-medium">Your membership has expired</div>
              <div className="text-xs text-muted-foreground">
                Wallet balance: ${walletBalance.toFixed(2)}
                {!canAffordRenew && " — top up to renew"}
              </div>
            </div>
            <Button disabled={!canAffordRenew} onClick={() => onRenew(membership)}>
              Renew for ${planPrice}/{planCycle}
            </Button>
          </div>
        )}

        {canCancel && (
          <div className="flex justify-end pt-2">
            <Button
              variant="outline"
              size="sm"
              className="border-destructive text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => onCancel(membership)}
            >
              Cancel Membership
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function DashboardMembership() {
  const { data } = useMyMembership();
  const memberships = data?.memberships ?? [];
  const totalSaved = Number(data?.totalSaved ?? 0);

  const { data: plans = [] } = useMembershipPlans();
  const { data: profile } = useProfile();
  const subscribe = useSubscribeMembership();
  const cancelMine = useCancelMyMembership();
  const renewMine = useRenewMembership();

  const [confirmPlan, setConfirmPlan] = useState<MembershipPlan | null>(null);
  const [cancelTarget, setCancelTarget] = useState<any | null>(null);
  const [renewTarget, setRenewTarget] = useState<any | null>(null);

  const walletBalance = Number(profile?.wallet_balance ?? 0);

  const handleConfirmSubscribe = async () => {
    if (!confirmPlan) return;
    const planId = (confirmPlan as any).id ?? (confirmPlan as any)._id;
    if (!planId) {
      toast.error("Plan ID missing");
      return;
    }
    try {
      await subscribe.mutateAsync(planId);
      toast.success("Successfully subscribed!");
      setConfirmPlan(null);
    } catch (e: any) {
      toast.error(e?.message || "Failed to subscribe");
    }
  };

  const handleCancel = async () => {
    if (!cancelTarget) return;
    try {
      await cancelMine.mutateAsync(getMembershipId(cancelTarget));
      toast.success("Membership cancelled");
      setCancelTarget(null);
    } catch (e: any) {
      toast.error(e?.message || "Failed to cancel membership");
    }
  };

  const handleRenew = async () => {
    if (!renewTarget) return;
    try {
      await renewMine.mutateAsync(getMembershipId(renewTarget));
      toast.success("Membership renewed!");
      setRenewTarget(null);
    } catch (e: any) {
      toast.error(e?.message || "Failed to renew membership");
    }
  };

  const lockerRentals = memberships
    .map((m: any) => m?.lockerRentalId)
    .filter((lr: any) => lr && typeof lr === "object" && (lr._id || lr.id));

  const cancelTargetEnd =
    cancelTarget?.endDate ?? cancelTarget?.cancelledUntil ?? cancelTarget?.renewalDate;
  const renewTargetPlan = renewTarget?.plan || renewTarget;
  const renewTargetPrice = Number(renewTargetPlan?.price ?? 0);

  if (memberships.length === 0) {
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
                Choose a plan below to subscribe instantly using your wallet balance.
              </p>
              <p className="text-xs text-muted-foreground pt-2">
                Wallet balance:{" "}
                <span className="font-medium text-foreground">${walletBalance.toFixed(2)}</span>
              </p>
            </div>
          </CardContent>
        </Card>

        {plans.length > 0 && (
          <TooltipProvider>
            <div className="grid gap-3 sm:grid-cols-2">
              {plans.map((p) => {
                const price = Number(p.price ?? 0);
                const canAfford = walletBalance >= price;
                const btn = (
                  <Button
                    className="w-full"
                    disabled={!canAfford || subscribe.isPending}
                    onClick={() => setConfirmPlan(p)}
                  >
                    Subscribe
                  </Button>
                );
                return (
                  <Card key={(p as any).id ?? (p as any)._id}>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center justify-between">
                        <span>{p.name}</span>
                        <span className="text-sm font-normal text-muted-foreground">
                          ${p.price}/{p.billingCycle}
                        </span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                      {p.description && <p className="text-muted-foreground">{p.description}</p>}
                      <div className="flex flex-wrap gap-1">
                        {!!p.bookingDiscountPct && (
                          <Badge variant="secondary">{p.bookingDiscountPct}% off</Badge>
                        )}
                        {!!p.freeMinutesPerVisit && (
                          <Badge variant="secondary">{p.freeMinutesPerVisit}m free</Badge>
                        )}
                        {p.freeDrinkPerVisit && <Badge variant="secondary">Free drink</Badge>}
                        {p.lockerIncluded && <Badge variant="secondary">Locker</Badge>}
                      </div>
                      {canAfford ? (
                        btn
                      ) : (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="block w-full">{btn}</span>
                          </TooltipTrigger>
                          <TooltipContent>
                            Insufficient wallet balance — top up first
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TooltipProvider>
        )}

        <AlertDialog open={!!confirmPlan} onOpenChange={(o) => !o && setConfirmPlan(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Subscribe to {confirmPlan?.name}?</AlertDialogTitle>
              <AlertDialogDescription>
                Subscribe to {confirmPlan?.name} for $
                {Number(confirmPlan?.price ?? 0).toFixed(2)}/
                {confirmPlan?.billingCycle ?? "month"}? This will deduct $
                {Number(confirmPlan?.price ?? 0).toFixed(2)} from your wallet (current balance: $
                {walletBalance.toFixed(2)}).
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={subscribe.isPending}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  handleConfirmSubscribe();
                }}
                disabled={subscribe.isPending}
              >
                {subscribe.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Confirm
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <PiggyBank className="h-5 w-5 text-accent" />
            <span className="text-muted-foreground">Total Saved</span>
          </div>
          <span className="text-2xl font-semibold">${totalSaved.toFixed(2)}</span>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {memberships.map((m: any) => (
          <MembershipCard
            key={getMembershipId(m) ?? Math.random()}
            membership={m}
            walletBalance={walletBalance}
            onCancel={setCancelTarget}
            onRenew={setRenewTarget}
          />
        ))}
      </div>

      {lockerRentals.map((lr: any, i: number) => (
        <LockerCard key={lr._id ?? lr.id ?? i} lockerRental={lr} />
      ))}

      <AlertDialog open={!!cancelTarget} onOpenChange={(o) => !o && setCancelTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this membership?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure? Your membership stays active until{" "}
              {cancelTargetEnd ? fmtDateSG(cancelTargetEnd) : "the end of the billing period"}.
              You won't be charged again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelMine.isPending}>Keep Membership</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleCancel();
              }}
              disabled={cancelMine.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {cancelMine.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Cancel Membership
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!renewTarget} onOpenChange={(o) => !o && setRenewTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Renew {renewTargetPlan?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Renew {renewTargetPlan?.name} for ${renewTargetPrice.toFixed(2)}? This deducts from
              your wallet (current balance: ${walletBalance.toFixed(2)}).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={renewMine.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleRenew();
              }}
              disabled={renewMine.isPending}
            >
              {renewMine.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Confirm Renewal
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
