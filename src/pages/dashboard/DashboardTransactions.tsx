import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";
import { getCached, setCache } from "@/lib/queryCache";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { fmtDateTimeSG as fmtDateTime } from "@/lib/sgTime";
import { deriveTransactionDescription } from "@/lib/transactionLabel";
import { useMembershipPlans } from "@/hooks/useMembership";
import { useMyWalkinSession } from "@/hooks/useWalkin";
import { getTableLabel } from "@/lib/tableLabel";
import { Timer } from "lucide-react";

export default function DashboardTransactions() {
  const { user } = useAuth();
  const [showAll, setShowAll] = useState(true);
  const { data: plans } = useMembershipPlans();
  const membershipPrices = (plans || []).map((p: any) => Number(p.price)).filter((n) => !isNaN(n));
  const { data: walkinSession } = useMyWalkinSession();
  const [nowTick, setNowTick] = useState(Date.now());
  useEffect(() => {
    if (!walkinSession) return;
    const id = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, [walkinSession]);

  const walkinStartMs = walkinSession ? new Date(walkinSession.startedAt ?? walkinSession.startTime ?? Date.now()).getTime() : 0;
  const walkinElapsedSec = walkinSession ? Math.max(0, Math.floor((nowTick - walkinStartMs) / 1000)) : 0;
  const walkinElapsedLabel = (() => {
    const h = Math.floor(walkinElapsedSec / 3600);
    const m = Math.floor((walkinElapsedSec % 3600) / 60);
    const s = walkinElapsedSec % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  })();


  const fmtNiceDate = (s: string) => {
    if (!s) return "";
    try {
      return new Date(s).toLocaleString("en-GB", {
        day: "2-digit", month: "short", year: "numeric",
        hour: "numeric", minute: "2-digit", hour12: true,
        timeZone: "Asia/Singapore",
      });
    } catch { return s; }
  };

  const txBadge = (key: string) =>
    key === "payment" ? "bg-destructive/10 text-destructive border-destructive/30"
    : key === "topup" ? "bg-green-500/10 text-green-400 border-green-500/30"
    : key === "refund" ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
    : "bg-muted text-muted-foreground border-border";

  const { data: transactionHistory } = useQuery({
    queryKey: ["transaction-history", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const res = await apiFetch("/api/transactions/me");
      if (!res.ok) return [];
      const data = await res.json();
      const walletTxs = Array.isArray(data)
        ? data
        : Array.isArray(data?.transactions)
        ? data.transactions
        : Array.isArray(data?.walletTransactions)
        ? data.walletTransactions
        : [];

      const items: Array<any> = [];
      walletTxs.forEach((t: any) => {
        const rawType = String(t.type || t.transactionType || "").toLowerCase();
        let typeKey: "payment" | "topup" | "refund" | "other" = "other";
        let typeLabel = rawType ? rawType.replace(/_/g, " ") : "Transaction";
        if (rawType === "booking_payment" || rawType === "wallet_deduct" || rawType === "payment") {
          typeKey = "payment"; typeLabel = "Payment";
        } else if (rawType === "topup" || rawType === "top_up" || rawType === "deposit") {
          typeKey = "topup"; typeLabel = "Top Up";
        } else if (rawType === "refund") {
          typeKey = "refund"; typeLabel = "Refund";
        } else if (rawType === "adjustment") {
          typeLabel = "Admin Adjustment";
        }
        const amtRaw = typeof t.amount === "number" ? t.amount : Number(t.amount) || 0;
        const amt = typeKey === "payment"
          ? -Math.abs(amtRaw)
          : typeKey === "topup" || typeKey === "refund"
          ? Math.abs(amtRaw)
          : amtRaw;
        const rawMethod = String(t.paymentMethod || t.payment_method || t.method || "").toLowerCase();
        const method = rawMethod === "wallet"
          ? "Wallet"
          : rawMethod === "paynow" || rawMethod === "stripe"
          ? "PayNow"
          : rawMethod
          ? rawMethod.charAt(0).toUpperCase() + rawMethod.slice(1)
          : "";
        const dateStr = t.createdAt || t.created_at || t.date || "";
        items.push({
          id: `w-${t.id || t._id}`,
          date: dateStr,
          typeKey,
          typeLabel,
          method,
          rawMethod,
          rawType,
          amtRaw,
          description: t.description || "",
          sublabel: fmtDateTime(dateStr),
          amount: `${amt >= 0 ? "+" : "-"}$${Math.abs(amt).toFixed(2)}`,
          positive: amt >= 0,
          sortKey: new Date(dateStr).getTime(),
        });
      });
      items.sort((a, b) => b.sortKey - a.sortKey);
      setCache("transactions", items);
      return items;
    },
    enabled: !!user,
    initialData: () => getCached<any[]>("transactions") ?? [],
  });

  const list = transactionHistory ?? [];
  const visible = showAll ? list : list.slice(0, 10);

  return (
    <div className="space-y-4">
      {walkinSession && (
        <Card className="card-premium border-accent/40">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Timer className="h-4 w-4 text-accent" />
              Walk-in Session In Progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Table</p>
                <p className="font-medium">{getTableLabel((walkinSession as any).tableId)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Started</p>
                <p className="font-medium">{fmtNiceDate(String(walkinSession.startedAt ?? walkinSession.startTime ?? ""))}</p>
                <p className="text-xs text-muted-foreground font-mono mt-0.5">{walkinElapsedLabel}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Running Cost</p>
                <p className="font-mono text-lg font-bold">${Number(walkinSession.runningCost ?? 0).toFixed(2)}</p>
              </div>
            </div>
            <div className="mt-3">
              <Badge variant="outline" className="bg-accent/10 text-accent border-accent/30">In Progress</Badge>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="card-premium">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Transaction History</CardTitle>
          {list.length > 10 && (
            <Button variant="ghost" size="sm" onClick={() => setShowAll((v) => !v)}>
              {showAll ? "Show Less" : "View All"}
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {!list.length ? (
            <p className="text-muted-foreground text-sm">No transactions yet.</p>
          ) : (
            <div className="space-y-1.5">
              {visible.map((t: any) => {
                const desc = deriveTransactionDescription(
                  { description: t.description, type: t.rawType, paymentMethod: t.rawMethod, amount: t.amtRaw },
                  membershipPrices
                );
                const isWalkin = typeof t.description === "string" && /^walk-?in session/i.test(t.description.trim());
                return (
                  <div
                    key={t.id}
                    className="flex items-center justify-between gap-3 rounded-lg px-3 py-3 transition-colors hover:bg-muted/40 border border-transparent hover:border-border/60"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      {isWalkin ? (
                        <Badge variant="outline" className="shrink-0 bg-accent/10 text-accent border-accent/30 flex items-center gap-1">
                          <Timer className="h-3 w-3" /> Walk-in
                        </Badge>
                      ) : (
                        <Badge variant="outline" className={`shrink-0 ${txBadge(t.typeKey)}`}>{t.typeLabel}</Badge>
                      )}
                      <div className="min-w-0">
                        {(isWalkin ? t.description : desc) && (
                          <p className="text-sm font-medium text-foreground truncate">{isWalkin ? t.description : desc}</p>
                        )}
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                          <span>{fmtNiceDate(t.date)}</span>
                          {t.method && (
                            <>
                              <span className="opacity-50">·</span>
                              <span>{t.method}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <span className={`shrink-0 font-mono text-sm font-semibold ${t.positive ? "text-primary" : "text-destructive"}`}>
                      {t.amount}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
