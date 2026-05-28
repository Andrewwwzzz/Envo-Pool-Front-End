import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Gift, Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { fmtDateSG } from "@/lib/sgTime";
import { useMyRewards, useRedeemCreditReward, Reward } from "@/hooks/useRewards";

const TYPE_LABELS: Record<string, string> = {
  free_session: "Free Session (1 hr)",
  wallet_credit: "Wallet Credit",
  free_item: "Free Item",
  booking_discount: "Discount",
};

export default function DashboardRewards() {
  const { data: rewards, isLoading } = useMyRewards();
  const redeem = useRedeemCreditReward();
  const { toast } = useToast();
  const list = (rewards ?? []) as Reward[];

  return (
    <Card className="card-premium">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Gift className="h-5 w-5 text-accent" />
          My Rewards
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : list.length === 0 ? (
          <p className="text-sm text-muted-foreground">No rewards yet. Earn rewards via reviews, referrals & more!</p>
        ) : (
          <div className="space-y-3">
            {list.map((r) => {
              const expired = r.expiresAt && new Date(r.expiresAt) < new Date();
              const allowed = Number((r as any).usesAllowed);
              const remaining = Number((r as any).usesRemaining);
              const isMulti = Number.isFinite(allowed) && allowed > 1;
              const multiExhausted = isMulti && Number.isFinite(remaining) && remaining <= 0;
              const isActive = !r.redeemed && !expired && !multiExhausted;
              return (
                <div key={r._id || r.id || r.code} className="rounded-lg border border-border p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div className="space-y-1">
                      <p className="font-medium">{r.description}</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="capitalize">{TYPE_LABELS[r.type] || r.type}</Badge>
                        {expired ? (
                          <Badge variant="destructive">Expired</Badge>
                        ) : isMulti ? (
                          multiExhausted
                            ? <Badge variant="outline" className="bg-muted">Redeemed</Badge>
                            : <Badge>{remaining}/{allowed} uses remaining</Badge>
                        ) : r.redeemed ? (
                          <Badge variant="outline" className="bg-muted">Redeemed</Badge>
                        ) : (
                          <Badge>Active</Badge>
                        )}
                        {r.expiresAt && (
                          <span className="text-xs text-muted-foreground">Expires {fmtDateSG(r.expiresAt)}</span>
                        )}
                      </div>
                    </div>
                    {isActive && r.type === "wallet_credit" && (
                      <Button size="sm" onClick={() => redeem.mutate(r.code)} disabled={redeem.isPending}>
                        Redeem
                      </Button>
                    )}
                  </div>
                  <div className="flex items-center gap-1 rounded-md bg-muted/30 px-3 py-2">
                    <span className="font-mono text-sm flex-1">{r.code}</span>
                    <Button
                      size="sm" variant="ghost" className="h-7 w-7 p-0"
                      onClick={() => { navigator.clipboard.writeText(r.code); toast({ title: "Code copied" }); }}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
