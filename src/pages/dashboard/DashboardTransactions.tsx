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
import { Timer, ArrowDownLeft, ArrowUpRight, RefreshCw, CreditCard, Zap } from "lucide-react";

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

  const getTypeConfig = (typeKey: string, isWalkin: boolean) => {
    if (isWalkin) return {
      icon: <Timer className="h-3.5 w-3.5" />,
      bg: "bg-amber-500/10",
      iconColor: "text-amber-400",
      border: "border-amber-500/20",
      label: "Walk-in",
      labelColor: "text-amber-400",
    };
    if (typeKey === "payment") return {
      icon: <ArrowUpRight className="h-3.5 w-3.5" />,
      bg: "bg-red-500/10",
      iconColor: "text-red-400",
      border: "border-red-500/20",
      label: "Payment",
      labelColor: "text-red-400",
    };
    if (typeKey === "topup") return {
      icon: <ArrowDownLeft className="h-3.5 w-3.5" />,
      bg: "bg-emerald-500/10",
      iconColor: "text-emerald-400",
      border: "border-emerald-500/20",
      label: "Top Up",
      labelColor: "text-emerald-400",
    };
    if (typeKey === "refund") return {
      icon: <RefreshCw className="h-3.5 w-3.5" />,
      bg: "bg-blue-500/10",
      iconColor: "text-blue-400",
      border: "border-blue-500/20",
      label: "Refund",
      labelColor: "text-blue-400",
    };
    return {
      icon: <CreditCard className="h-3.5 w-3.5" />,
      bg: "bg-muted",
      iconColor: "text-muted-foreground",
      border: "border-border",
      label: "Other",
      labelColor: "text-muted-foreground",
    };
  };

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

  // Group by date
  const groupedByDate: Record<string, typeof visible> = {};
  visible.forEach((t) => {
    const label = t.date
      ? new Date(t.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Singapore" })
      : "Unknown";
    if (!groupedByDate[label]) groupedByDate[label] = [];
    groupedByDate[label].push(t);
  });

  return (
    <div className="space-y-4">
      {walkinSession && (
        <Card className="card-premium border-accent/40 bg-accent/5">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-8 w-8 rounded-full bg-accent/15 flex items-center justify-center">
                <Zap className="h-4 w-4 text-accent" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Walk-in Session Active</p>
                <p className="text-xs text-muted-foreground">{getTableLabel((walkinSession as any).tableId)}</p>
              </div>
              <Badge variant="outline" className="ml-auto bg-accent/10 text-accent border-accent/30 text-xs">Live</Badge>
            </div>
            <div className="grid grid-cols-2 gap-3 bg-muted/30 rounded-lg p-3">
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-0.5">Elapsed</p>
                <p className="font-mono text-base font-bold text-foreground">{walkinElapsedLabel}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-0.5">Running Cost</p>
                <p className="font-mono text-base font-bold text-accent">${Number(walkinSession.runningCost ?? 0).toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="card-premium">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base font-semibold">Transaction History</CardTitle>
          {list.length > 10 && (
            <Button variant="ghost" size="sm" className="text-xs h-7 px-2" onClick={() => setShowAll((v) => !v)}>
              {showAll ? "Show Less" : "View All"}
            </Button>
          )}
        </CardHeader>
        <CardContent className="px-0 pb-2">
          {!list.length ? (
            <p className="text-muted-foreground text-sm px-4">No transactions yet.</p>
          ) : (
            <div>
              {Object.entries(groupedByDate).map(([dateLabel, txs]) => (
                <div key={dateLabel}>
                  {/* Date divider */}
                  <div className="flex items-center gap-2 px-4 py-2">
                    <span className="text-[11px] font-medium text-muted-foreground tracking-wide">{dateLabel}</span>
                    <div className="flex-1 h-px bg-border/50" />
                  </div>
                  {txs.map((t: any) => {
                    const desc = deriveTransactionDescription(
                      { description: t.description, type: t.rawType, paymentMethod: t.rawMethod, amount: t.amtRaw },
                      membershipPrices
                    );
                    const isWalkin = typeof t.description === "string" && /^walk-?in session/i.test(t.description.trim());
                    const cfg = getTypeConfig(t.typeKey, isWalkin);
                    const displayLabel = isWalkin ? t.description : (desc || t.typeLabel);
                    return (
                      <div
                        key={t.id}
                        className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/30 transition-colors"
                      >
                        {/* Icon */}
                        <div className={`h-8 w-8 rounded-full ${cfg.bg} border ${cfg.border} flex items-center justify-center shrink-0 ${cfg.iconColor}`}>
                          {cfg.icon}
                        </div>

                        {/* Details */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate leading-tight">{displayLabel}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className={`text-[11px] font-medium ${cfg.labelColor}`}>{cfg.label}</span>
                            {t.method && (
                              <>
                                <span className="text-muted-foreground/40 text-[10px]">•</span>
                                <span className="text-[11px] text-muted-foreground">{t.method}</span>
                              </>
                            )}
                            <span className="text-muted-foreground/40 text-[10px]">•</span>
                            <span className="text-[11px] text-muted-foreground">
                              {new Date(t.date).toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Singapore" })}
                            </span>
                          </div>
                        </div>

                        {/* Amount */}
                        <span className={`shrink-0 font-mono text-sm font-bold tabular-nums ${t.positive ? "text-emerald-400" : "text-foreground"}`}>
                          {t.amount}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
