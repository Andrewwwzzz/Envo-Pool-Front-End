import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Gift, Copy, Sparkles, Zap, AlertTriangle, Check, Lock, Store, Trophy, History, ShoppingBag } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { fmtDateSG } from "@/lib/sgTime";
import { useProfile } from "@/hooks/useProfile";
import { useMyRewards, useRedeemCreditReward, useRedeemStoreCredit, useRedeemMembershipReward, Reward } from "@/hooks/useRewards";
import { usePlaceOrder } from "@/hooks/useFnb";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import {
  useRewardCatalog, useMyMilestones, useExchangeReward, useClaimMilestone,
  usePointsHistory, useMultiplierEvents, isMultiplierLive,
  CATEGORY_LABELS, CATEGORY_BADGE, CatalogItem,
} from "@/hooks/usePoints";
import { useVendingMenu } from "@/hooks/useVending";
import { OrderProgressDialog } from "@/components/dashboard/VendingMenu";

// Table delivery is off: an F&B reward is either dropped by the vending
// machine (when it holds that item) or collected at the counter.
const COUNTER_LABEL = "Counter";

const TYPE_LABELS: Record<string, string> = {
  free_session: "Free Session",
  wallet_credit: "Wallet Credit",
  free_item: "Free Item",
  booking_discount: "Discount",
};

/** Hook to fulfil an existing F&B reward (milestone-issued tangible free_item) */
function useFulfilFnbReward() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ rewardId, tableName, collect }: { rewardId: string; tableName?: string; collect?: "vending" | "counter" }) => {
      const res = await apiFetch(`/api/rewards/fulfil-fnb/${rewardId}`, {
        method: "POST",
        body: JSON.stringify({ tableName, collect }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to place order");
      return data as { message: string; isVendingOrder?: boolean; order?: { _id: string } };
    },
    onSuccess: (data) => {
      toast({ title: data.isVendingOrder ? "Sent to the vending machine" : "Order placed!", description: data.message });
      qc.invalidateQueries({ queryKey: ["my-rewards"] });
      qc.invalidateQueries({ queryKey: ["fnb-orders-my"] });
      qc.invalidateQueries({ queryKey: ["vending-orders-my"] });
      qc.invalidateQueries({ queryKey: ["vending-menu"] });
    },
    onError: (err: Error) => {
      toast({ title: "Order failed", description: err.message, variant: "destructive" });
    },
  });
}

export default function DashboardRewards() {
  const { toast } = useToast();
  const { data: profile } = useProfile();
  const { data: rewards = [] } = useMyRewards();
  const { data: catalog = [] } = useRewardCatalog();
  const { data: milestones = [] } = useMyMilestones();
  const { data: history = [] } = usePointsHistory();
  const { data: multipliers = [] } = useMultiplierEvents();
  const redeemCredit = useRedeemCreditReward();
  const redeemStoreCredit = useRedeemStoreCredit();
  const redeemMembership = useRedeemMembershipReward();
  const [confirmMembershipReward, setConfirmMembershipReward] = useState<Reward | null>(null);
  const exchange = useExchangeReward();
  const claim = useClaimMilestone();
  const fulfilFnb = useFulfilFnbReward();
  // Which menu items the machine can drop right now
  const { data: vendingMenu } = useVendingMenu();
  const vendable = (productId?: string | null) =>
    !!productId && (vendingMenu?.items ?? []).some((i) => String(i.productId) === String(productId) && i.inStock && i.machineOnline);
  const [vendOrderId, setVendOrderId] = useState<string | null>(null);
  const rewardIdOf = (r: Reward) => { const o = r as unknown as { _id?: string; id?: string }; return (o._id || o.id)!; };
  // A milestone-issued reward links to its catalog item, which links to the product
  const rewardProductId = (r: Reward | null) => {
    if (!r) return null;
    const raw = (r as unknown as { catalogId?: string | { _id?: string; fnbProductId?: string } }).catalogId;
    if (raw && typeof raw === "object") return raw.fnbProductId ?? catalog.find((c) => (c._id || c.id) === raw._id)?.fnbProductId ?? null;
    return catalog.find((c) => (c._id || c.id) === raw)?.fnbProductId ?? null;
  };

  // Points-shop exchange dialog
  const [confirmExchange, setConfirmExchange] = useState<CatalogItem | null>(null);
  const [fnbTableInput, setFnbTableInput] = useState("");

  // "Place Order Now" dialog for existing F&B reward entries
  const [fnbOrderReward, setFnbOrderReward] = useState<Reward | null>(null);
  const [fnbOrderTable, setFnbOrderTable] = useState("");

  const currentPoints = Math.max(0, Math.floor(Number((profile as any)?.rewardPoints ?? (profile as any)?.reward_points ?? 0)));
  const lifetimePoints = Math.max(0, Math.floor(Number((profile as any)?.lifetimePoints ?? (profile as any)?.lifetime_points ?? currentPoints)));
  const pointsExpireAt = (profile as any)?.pointsExpiryDate ?? (profile as any)?.pointsExpireAt ?? (profile as any)?.points_expire_at ?? null;
  const expiryDays = pointsExpireAt ? Math.ceil((new Date(pointsExpireAt).getTime() - Date.now()) / 86400000) : null;
  const showExpiryWarning = currentPoints > 0 && expiryDays != null && expiryDays <= 30 && expiryDays >= 0;

  const liveMultiplier = multipliers.find(isMultiplierLive);
  const shop = useMemo(() => catalog.filter(c => c.isActive && c.type === "points_exchange"), [catalog]);

  const sortedMilestones = useMemo(
    () => [...milestones].sort((a, b) => (a.milestoneThreshold || 0) - (b.milestoneThreshold || 0)),
    [milestones]
  );
  const nextMilestone = sortedMilestones.find(m => !m.claimed && lifetimePoints < m.milestoneThreshold);

  /** True if reward is a tangible F&B item that can be ordered for table delivery
   *  (must be linked to an actual menu item via fnbProductId). */
  const isFnbReward = (r: Reward) =>
    r.type === "free_item" &&
    ((r as any).tangible === true || (r as any).catalogId?.tangible === true) &&
    (r as any).catalogId?.category === "food_drinks" &&
    !!(r as any).catalogId?.fnbProductId;

  /** True if reward is tangible merchandise — must be collected from staff at
   *  the counter, since there's no order/delivery flow for physical items. */
  /** Rewarded memberships the customer activates themselves (top-up promo free
   *  months and milestone memberships) — same rule as the server
   *  (utils/membershipRewards.js). A locker month activates the Locker plan;
   *  the physical locker and PIN are given at the counter. */
  const membershipRewardKinds = (r: Reward | null): ("regular" | "locker")[] | null => {
    if (!r) return null;
    const source = (r as any).source;
    const d = String(r.description || "").trim();
    if (source === "topup_promo") {
      if (d === "Free 1-Month Standard Membership") return ["regular"];
      if (d === "Free 1-Month Standard Membership + Locker") return ["regular", "locker"];
      return null;
    }
    if (source === "milestone") {
      if (/^free 1-month locker membership\b/i.test(d)) return ["locker"];
      if (/^free 1-month membership\b/i.test(d)) return ["regular"];
    }
    return null;
  };
  const isMembershipReward = (r: Reward) => !!membershipRewardKinds(r);
  const hasLocker = (r: Reward | null) => !!membershipRewardKinds(r)?.includes("locker");

  const isMerchandiseReward = (r: Reward) =>
    r.type === "free_item" &&
    ((r as any).tangible === true || (r as any).catalogId?.tangible === true) &&
    (r as any).catalogId?.category !== "food_drinks";

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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
              <p className="text-xs text-muted-foreground">Current Balance</p>
              <p className="text-3xl font-bold text-amber-400 mt-1">{currentPoints.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground mt-1">points</p>
              {pointsExpireAt && currentPoints > 0 && (
                <p className={`text-xs mt-2 font-medium ${expiryDays != null && expiryDays <= 30 ? "text-destructive" : "text-muted-foreground"}`}>
                  Expires {fmtDateSG(pointsExpireAt)}
                </p>
              )}
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

      {/* Section 2 — Milestones */}
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
                        {Number(m.milestoneThreshold ?? 0).toLocaleString()} lifetime points
                        {m.claimed && m.claimedAt && ` · claimed ${fmtDateSG(m.claimedAt)}`}
                      </p>
                    </div>
                  </div>
                  {canClaim && (
                    <Button size="sm" onClick={() => claim.mutate(m.catalogId || m._id || m.id)} disabled={claim.isPending}>
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

      {/* Section 3 — Points Shop */}
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
                const isFnb = item.category === "food_drinks";
                return (
                  <div key={item._id || item.id} className="rounded-lg border border-border p-4 space-y-2 flex flex-col">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium">{item.name}</p>
                      <Badge variant="outline" className={CATEGORY_BADGE[item.category]}>{CATEGORY_LABELS[item.category]}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground flex-1">{item.description}</p>
                    {isFnb && (
                      <p className="text-xs text-blue-400/80">{vendable(item.fnbProductId) ? "🍹 Drops from the vending machine, or collect at the counter" : "🍹 Collect at the counter"}</p>
                    )}
                    <div className="flex items-center justify-between pt-2">
                      <span className="font-mono text-amber-400 font-semibold">{cost.toLocaleString()} pts</span>
                      <Button size="sm" disabled={!affordable || exchange.isPending} onClick={() => setConfirmExchange(item)}>
                        {isFnb ? "Order Now" : "Redeem"}
                      </Button>
                    </div>
                    {!affordable && <p className="text-xs text-muted-foreground">Need {(cost - currentPoints).toLocaleString()} more points</p>}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Section 4 — My Reward Codes */}
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
                const fnb = isFnbReward(r);
                const membershipReward = isMembershipReward(r);
                const merch = !membershipReward && isMerchandiseReward(r);
                const discount = r.type === "booking_discount";

                return (
                  <div key={r._id || r.id || r.code} className="rounded-lg border border-border p-4 space-y-2">
                    {/* Header row */}
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
                      {/* Wallet credit — self-redeem button. Points-shop-claimed
                          credit has no code to redeem by, so it uses the
                          id-based route instead. */}
                      {isActive && r.type === "wallet_credit" && (r as any).source !== "points_exchange" && (
                        <Button size="sm" onClick={() => redeemCredit.mutate(r.code)} disabled={redeemCredit.isPending}>Redeem</Button>
                      )}
                      {isActive && r.type === "wallet_credit" && (r as any).source === "points_exchange" && (
                        <Button size="sm" onClick={() => redeemStoreCredit.mutate(r._id || (r as any).id)} disabled={redeemStoreCredit.isPending}>Redeem</Button>
                      )}
                    </div>

                    {/* ── F&B tangible rewards: "Place Order Now" instead of code ── */}
                    {membershipReward ? (
                      isActive ? (
                        <div className="rounded-md bg-emerald-500/10 border border-emerald-500/30 px-3 py-2.5 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2 min-w-0">
                            <Sparkles className="h-4 w-4 text-emerald-400 shrink-0" />
                            <p className="text-xs text-emerald-300">
                              {hasLocker(r)
                                ? "Activate it yourself now, then collect your locker and PIN at the counter."
                                : "Activate your free 1-month membership instantly — no need to see staff."}
                            </p>
                          </div>
                          <Button size="sm" className="shrink-0" onClick={() => setConfirmMembershipReward(r)}>
                            Activate
                          </Button>
                        </div>
                      ) : (
                        <div className="rounded-md bg-muted/20 border border-border px-3 py-2 text-xs text-muted-foreground flex items-center gap-2">
                          <Sparkles className="h-3.5 w-3.5 shrink-0" />
                          {r.redeemed ? "Membership activated." : "This reward has expired."}
                        </div>
                      )
                    ) : fnb ? (
                      isActive ? (
                        <div className="rounded-md bg-blue-500/10 border border-blue-500/30 px-3 py-2.5 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2 min-w-0">
                            <ShoppingBag className="h-4 w-4 text-blue-400 shrink-0" />
                            <p className="text-xs text-blue-300">Ready to order — we'll deliver it to your table.</p>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-blue-500/40 text-blue-300 hover:bg-blue-500/10 shrink-0"
                            onClick={() => setFnbOrderReward(r)}
                          >
                            Place Order
                          </Button>
                        </div>
                      ) : (
                        <div className="rounded-md bg-muted/20 border border-border px-3 py-2 text-xs text-muted-foreground flex items-center gap-2">
                          <ShoppingBag className="h-3.5 w-3.5 shrink-0" />
                          {r.redeemed ? "Order has been placed and fulfilled." : "This reward has expired."}
                        </div>
                      )
                    ) : merch ? (
                      /* ── Tangible merchandise: no order flow — collect at counter ── */
                      isActive ? (
                        <div className="rounded-md bg-amber-500/10 border border-amber-500/30 px-3 py-2.5 flex items-center gap-2">
                          <Gift className="h-4 w-4 text-amber-400 shrink-0" />
                          <p className="text-xs text-amber-300">Head over to the counter and show this to our staff to redeem.</p>
                        </div>
                      ) : (
                        <div className="rounded-md bg-muted/20 border border-border px-3 py-2 text-xs text-muted-foreground flex items-center gap-2">
                          <Gift className="h-3.5 w-3.5 shrink-0" />
                          {r.redeemed ? "Already redeemed at the counter." : "This reward has expired."}
                        </div>
                      )
                    ) : discount ? (
                      /* ── Discount codes: copyable code + booking-payment instruction ── */
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-1 rounded-md bg-muted/30 px-3 py-2">
                          <span className="font-mono text-sm flex-1">{r.code}</span>
                          <Button
                            size="sm" variant="ghost" className="h-7 w-7 p-0"
                            onClick={() => { navigator.clipboard.writeText(r.code); toast({ title: "Code copied" }); }}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                        {isActive && (
                          <p className="text-xs text-muted-foreground px-1">Enter this code at checkout when making a booking payment to apply your discount.</p>
                        )}
                      </div>
                    ) : (
                      /* ── All other codes (free session, wallet credit, etc.) ── */
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
                      <td className={`py-2 pr-4 text-right font-mono ${(h.points ?? 0) >= 0 ? "text-emerald-400" : "text-destructive"}`}>
                        {(h.points ?? 0) >= 0 ? "+" : ""}{Number(h.points ?? 0).toLocaleString()}
                      </td>
                      <td className="py-2 pr-4 text-right font-mono">{Number(h.balance ?? 0).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Dialog: confirm points-shop exchange ── */}
      <Dialog open={!!confirmExchange} onOpenChange={(o) => { if (!o) { setConfirmExchange(null); setFnbTableInput(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Redeem — {confirmExchange?.name}</DialogTitle>
            <DialogDescription>
              {confirmExchange?.category === "food_drinks"
                ? <>This will spend <strong className="text-amber-400">{confirmExchange?.pointCost} points</strong>. {vendable(confirmExchange?.fnbProductId) ? "Choose where to collect it: the vending machine drops it right away, or pick it up at the counter." : "Collect it at the counter when it's ready."}</>
                : <>This will spend <strong className="text-amber-400">{confirmExchange?.pointCost} points</strong>. A discount code will be added to your My Reward Codes — use it at checkout when paying for a booking.</>
              }
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setConfirmExchange(null); setFnbTableInput(""); }}>Cancel</Button>
            {confirmExchange?.category === "food_drinks" ? (
              <>
                <Button
                  variant={vendable(confirmExchange?.fnbProductId) ? "outline" : "default"}
                  disabled={exchange.isPending}
                  onClick={async () => {
                    if (!confirmExchange) return;
                    await exchange.mutateAsync({ catalogId: (confirmExchange._id || confirmExchange.id)!, tableId: COUNTER_LABEL, tableName: COUNTER_LABEL, collect: "counter" });
                    setConfirmExchange(null);
                  }}
                >
                  Collect at counter
                </Button>
                {vendable(confirmExchange?.fnbProductId) && (
                  <Button
                    disabled={exchange.isPending}
                    onClick={async () => {
                      if (!confirmExchange) return;
                      const data = await exchange.mutateAsync({ catalogId: (confirmExchange._id || confirmExchange.id)!, collect: "vending" });
                      setConfirmExchange(null);
                      if (data?.order?._id) setVendOrderId(data.order._id);
                    }}
                  >
                    <Store className="h-4 w-4 mr-1" /> Vending machine
                  </Button>
                )}
              </>
            ) : (
              <Button
                disabled={exchange.isPending}
                onClick={async () => {
                  if (!confirmExchange) return;
                  await exchange.mutateAsync({ catalogId: (confirmExchange._id || confirmExchange.id)! });
                  setConfirmExchange(null);
                }}
              >
                Confirm Redemption
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: confirm free membership redemption ── */}
      <Dialog open={!!confirmMembershipReward} onOpenChange={(o) => { if (!o) setConfirmMembershipReward(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirmMembershipReward?.description || "Activate Free Membership"}</DialogTitle>
            <DialogDescription className="space-y-2">
              {membershipRewardKinds(confirmMembershipReward)?.includes("regular") && (
                <span className="block">Your free month of Standard Membership starts right away. If you're already a member, we'll add one free month to your current membership instead.</span>
              )}
              {hasLocker(confirmMembershipReward) && (
                <span className="block">Your locker month starts now (or is added to your current locker). Collect your locker and PIN from staff at the counter.</span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmMembershipReward(null)}>Cancel</Button>
            <Button
              disabled={redeemMembership.isPending}
              onClick={async () => {
                if (!confirmMembershipReward) return;
                const id = (confirmMembershipReward as any)._id || (confirmMembershipReward as any).id;
                try { await redeemMembership.mutateAsync(id); } catch { /* toast already shown */ }
                setConfirmMembershipReward(null);
              }}
            >
              {redeemMembership.isPending ? "Activating..." : "Activate Now"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: place order for existing F&B reward (milestone-issued) ── */}
      <Dialog open={!!fnbOrderReward} onOpenChange={(o) => { if (!o) { setFnbOrderReward(null); setFnbOrderTable(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Place Order — {fnbOrderReward?.description}</DialogTitle>
            <DialogDescription>
              {vendable(rewardProductId(fnbOrderReward))
                ? <>Where would you like <strong>{fnbOrderReward?.description}</strong>? The vending machine drops it right away, or pick it up at the counter.</>
                : <><strong>{fnbOrderReward?.description}</strong> will be ready for you at the counter.</>}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setFnbOrderReward(null); setFnbOrderTable(""); }}>Cancel</Button>
            <Button
              variant={vendable(rewardProductId(fnbOrderReward)) ? "outline" : "default"}
              disabled={fulfilFnb.isPending}
              onClick={async () => {
                if (!fnbOrderReward) return;
                await fulfilFnb.mutateAsync({ rewardId: rewardIdOf(fnbOrderReward), tableName: COUNTER_LABEL, collect: "counter" });
                setFnbOrderReward(null);
              }}
            >
              Collect at counter
            </Button>
            {vendable(rewardProductId(fnbOrderReward)) && (
              <Button
                disabled={fulfilFnb.isPending}
                onClick={async () => {
                  if (!fnbOrderReward) return;
                  const data = await fulfilFnb.mutateAsync({ rewardId: rewardIdOf(fnbOrderReward), collect: "vending" });
                  setFnbOrderReward(null);
                  if (data?.order?._id) setVendOrderId(data.order._id);
                }}
              >
                <Store className="h-4 w-4 mr-1" /> Vending machine
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Follows a reward sent to the vending machine until it drops (or is given back) */}
      <OrderProgressDialog orderId={vendOrderId} onClose={() => setVendOrderId(null)} />
    </div>
  );
}
