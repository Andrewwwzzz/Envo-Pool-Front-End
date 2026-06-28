import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Gift, Copy, Sparkles, Zap, AlertTriangle, Check, Lock, Store, Trophy, History } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { fmtDateSG } from "@/lib/sgTime";
import { useProfile } from "@/hooks/useProfile";
import { useMyRewards, useRedeemCreditReward, Reward } from "@/hooks/useRewards";
import {
  useRewardCatalog, useMyMilestones, useExchangeReward, useClaimMilestone,
  usePointsHistory, useMultiplierEvents, isMultiplierLive,
  CATEGORY_LABELS, CATEGORY_BADGE, CatalogItem,
} from "@/hooks/usePoints";

const TYPE_LABELS: Record<string, string> = {
  free_session: "Free Session",
  wallet_credit: "Wallet Credit",
  free_item: "Free Item",
  booking_discount: "Discount",
};

export default function DashboardRewards() {
  const { toast } = useToast();
  const { data: profile } = useProfile();
  const { data: rewards = [] } = useMyRewards();
  const { data: catalog = [] } = useRewardCatalog();
  const { data: milestones = [] } = useMyMilestones();
  const { data: history = [] } = usePointsHistory();
  const { data: multipliers = [] } = useMultiplierEvents();
  const redeemCredit = useRedeemCreditReward();
  const exchange = useExchangeReward();
  const claim = useClaimMilestone();

  const [confirmExchange, setConfirmExchange] = useState<CatalogItem | null>(null);

  const currentPoints = Math.max(0, Math.floor(Number((profile as any)?.rewardPoints ?? (profile as any)?.reward_points ?? 0)));
  const lifetimePoints = Math.max(0, Math.floor(Number((profile as any)?.lifetimePoints ?? (profile as any)?.lifetime_points ?? currentPoints)));
  const pointsExpireAt = (profile as any)?.pointsExpireAt ?? (profile as any)?.points_expire_at ?? null;
  const expiryDays = pointsExpireAt ? Math.ceil((new Date(pointsExpireAt).getTime() - Date.now()) / 86400000) : null;
  const showExpiryWarning = currentPoints > 0 && expiryDays != null && expiryDays <= 30 && expiryDays >= 0;

  const liveMultiplier = multipliers.find(isMultiplierLive);

  const shop = useMemo(() => catalog.filter(c => c.isActive && c.type === "points_exchange"), [catalog]);

  const sortedMilestones = useMemo(
    () => [...milestones].sort((a, b) => (a.milestoneThreshold || 0) - (b.milestoneThreshold || 0)),
    [milestones]
  );
  const nextMilestone = sortedMilestones.find(m => !m.claimed && lifetimePoints < m.milestoneThreshold);
  const claimableMilestones = sortedMilestones.filter(m => !m.claimed && lifetimePoints >= m.milestoneThreshold);

  return (
    <div className="space-y-6">
      {/* Section 1 — Points Overview */}
      <Card className="card-premium">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-400" /> Points Overview
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
              <p className="text-xs text-muted-foreground">Current Balance</p>
              <p className="text-3xl font-bold text-amber-400 mt-1">{currentPoints.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground mt-1">points</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">Lifetime Earned</p>
              <p className="text-3xl font-bold text-foreground mt-1">{lifetimePoints.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground mt-1">all-time</p>
            </div>
          </div>

          {liveMultiplier && (
            <div className="rounded-lg border border-amber-500/40 bg-gradient-to-r from-amber-500/10 to-orange-500/10 p-4 flex items-center gap-3">
              <Zap className="h-6 w-6 text-amber-400 shrink-0" />
              <div>
                <p className="font-semibold">🎉 {liveMultiplier.name}</p>
                <p className="text-sm text-muted-foreground">{liveMultiplier.multiplier}x points on all bookings & walk-ins until {fmtDateSG(liveMultiplier.endDate)}</p>
              </div>
            </div>
          )}

          {showExpiryWarning && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
              <p className="text-sm">Your points expire in <strong>{expiryDays} day{expiryDays === 1 ? "" : "s"}</strong> — book a session or redeem before {fmtDateSG(pointsExpireAt)}.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Section 2 — Milestone Progress */}
      <Card className="card-premium">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Trophy className="h-5 w-5 text-amber-400" /> Milestones
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {nextMilestone ? (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Next: {nextMilestone.name}</span>
                <span className="font-mono">{lifetimePoints} / {nextMilestone.milestoneThreshold}</span>
              </div>
              <Progress value={Math.min(100, (lifetimePoints / nextMilestone.milestoneThreshold) * 100)} />
            </div>
          ) : sortedMilestones.length > 0 ? (
            <p className="text-sm text-muted-foreground">You've reached every milestone — incredible!</p>
          ) : (
            <p className="text-sm text-muted-foreground">No milestones available yet.</p>
          )}

          <div className="space-y-2">
            {sortedMilestones.map((m) => {
              const canClaim = !m.claimed && lifetimePoints >= m.milestoneThreshold;
              return (
                <div
                  key={m.catalogId}
                  className={`rounded-lg border p-3 flex items-center justify-between gap-3 ${
                    m.claimed ? "border-border bg-muted/20" :
                    canClaim ? "border-emerald-500/50 bg-emerald-500/5 animate-pulse" :
                    "border-border bg-muted/10 opacity-70"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {m.claimed ? <Check className="h-5 w-5 text-emerald-400 shrink-0" /> :
                      canClaim ? <Gift className="h-5 w-5 text-emerald-400 shrink-0" /> :
                      <Lock className="h-5 w-5 text-muted-foreground shrink-0" />}
                    <div className="min-w-0">
                      <p className="font-medium truncate">{m.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {m.milestoneThreshold.toLocaleString()} lifetime points
                        {m.claimed && m.claimedAt && ` · claimed ${fmtDateSG(m.claimedAt)}`}
                      </p>
                    </div>
                  </div>
                  {canClaim && (
                    <Button size="sm" onClick={() => claim.mutate(m._id || m.id)} disabled={claim.isPending}>
                      Claim
                    </Button>
                  )}
                  {m.claimed && <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30">Claimed</Badge>}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Section 3 — Points Exchange Shop */}
      <Card className="card-premium">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Store className="h-5 w-5 text-accent" /> Points Shop
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!shop.length ? (
            <p className="text-sm text-muted-foreground">No items in the shop right now. Check back soon!</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {shop.map((item) => {
                const cost = Number(item.pointCost) || 0;
                const affordable = currentPoints >= cost;
                return (
                  <div key={item._id || item.id} className="rounded-lg border border-border p-4 space-y-2 flex flex-col">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium">{item.name}</p>
                      <Badge variant="outline" className={CATEGORY_BADGE[item.category]}>{CATEGORY_LABELS[item.category]}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground flex-1">{item.description}</p>
                    <div className="flex items-center justify-between pt-2">
                      <span className="font-mono text-amber-400 font-semibold">{cost.toLocaleString()} pts</span>
                      <Button size="sm" disabled={!affordable || exchange.isPending} onClick={() => setConfirmExchange(item)}>
                        Redeem
                      </Button>
                    </div>
                    {!affordable && <p className="text-xs text-muted-foreground">Need {cost - currentPoints} more points</p>}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Section 4 — My Rewards (codes) */}
      <Card className="card-premium">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Gift className="h-5 w-5 text-accent" /> My Reward Codes
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!rewards.length ? (
            <p className="text-sm text-muted-foreground">No reward codes yet.</p>
          ) : (
            <div className="space-y-3">
              {rewards.map((r: Reward) => {
                const expired = r.expiresAt && new Date(r.expiresAt) < new Date();
                const allowed = Number((r as any).usesAllowed);
                const remaining = Number((r as any).usesRemaining);
                const isMulti = Number.isFinite(allowed) && allowed > 1;
                const multiExhausted = isMulti && Number.isFinite(remaining) && remaining <= 0;
                const isActive = !r.redeemed && !expired && !multiExhausted;
                const tangible = (r as any).tangible === true || (r as any).source === "milestone" && ["free_item"].includes(r.type);
                return (
                  <div key={r._id || r.id || r.code} className="rounded-lg border border-border p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div className="space-y-1">
                        <p className="font-medium">{r.description}</p>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="capitalize">{TYPE_LABELS[r.type] || r.type}</Badge>
                          {(r as any).source === "milestone" && <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/30">Milestone</Badge>}
                          {(r as any).source === "points_exchange" && <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/30">Points Shop</Badge>}
                          {expired ? <Badge variant="destructive">Expired</Badge>
                            : isMulti ? (multiExhausted ? <Badge variant="outline" className="bg-muted">Redeemed</Badge> : <Badge>{remaining}/{allowed} uses</Badge>)
                            : r.redeemed ? <Badge variant="outline" className="bg-muted">Redeemed</Badge>
                            : <Badge>Active</Badge>}
                          {r.expiresAt && <span className="text-xs text-muted-foreground">Expires {fmtDateSG(r.expiresAt)}</span>}
                        </div>
                      </div>
                      {isActive && r.type === "wallet_credit" && (r as any).source !== "points_exchange" && (
                        <Button size="sm" onClick={() => redeemCredit.mutate(r.code)} disabled={redeemCredit.isPending}>Redeem</Button>
                      )}
                    </div>
                    {isActive && tangible ? (
                      <div className="rounded-md bg-amber-500/10 border border-amber-500/30 px-3 py-2 text-xs text-amber-200">
                        🎁 Present this code at the counter — code <span className="font-mono">{r.code}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 rounded-md bg-muted/30 px-3 py-2">
                        <span className="font-mono text-sm flex-1">{r.code}</span>
                        <Button
                          size="sm" variant="ghost" className="h-7 w-7 p-0"
                          onClick={() => { navigator.clipboard.writeText(r.code); toast({ title: "Code copied" }); }}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Section 5 — Points History */}
      <Card className="card-premium">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <History className="h-5 w-5 text-accent" /> Points History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!history.length ? (
            <p className="text-sm text-muted-foreground">No activity yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="pb-2 pr-4">Date</th>
                    <th className="pb-2 pr-4">Description</th>
                    <th className="pb-2 pr-4 text-right">Points</th>
                    <th className="pb-2 pr-4 text-right">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h) => (
                    <tr key={h._id || h.id} className="border-b border-border last:border-0">
                      <td className="py-2 pr-4 whitespace-nowrap text-muted-foreground">{fmtDateSG(h.createdAt)}</td>
                      <td className="py-2 pr-4">{h.description}</td>
                      <td className={`py-2 pr-4 text-right font-mono ${h.points >= 0 ? "text-emerald-400" : "text-destructive"}`}>
                        {h.points >= 0 ? "+" : ""}{h.points.toLocaleString()}
                      </td>
                      <td className="py-2 pr-4 text-right font-mono">{Number(h.balance).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirm exchange */}
      <Dialog open={!!confirmExchange} onOpenChange={(o) => !o && setConfirmExchange(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Redeem {confirmExchange?.name}?</DialogTitle>
            <DialogDescription>
              This will spend <strong className="text-amber-400">{confirmExchange?.pointCost} points</strong> from your balance and generate a unique reward code tied to your account.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmExchange(null)}>Cancel</Button>
            <Button
              onClick={async () => {
                if (!confirmExchange) return;
                await exchange.mutateAsync((confirmExchange._id || confirmExchange.id)!);
                setConfirmExchange(null);
              }}
              disabled={exchange.isPending}
            >
              Confirm Redemption
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
