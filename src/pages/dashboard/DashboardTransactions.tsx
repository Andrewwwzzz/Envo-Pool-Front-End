import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";
import { getCached, setCache } from "@/lib/queryCache";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { fmtDateTimeSG as fmtDateTime } from "@/lib/sgTime";
import { useMembershipPlans } from "@/hooks/useMembership";
import { useMyWalkinSession } from "@/hooks/useWalkin";
import { getTableLabel } from "@/lib/tableLabel";
import { Timer, ArrowDownLeft, ArrowUpRight, RefreshCw, CreditCard, Zap, ShieldCheck } from "lucide-react";

export default function DashboardTransactions() {
  const { user } = useAuth();
  const [showAll, setShowAll] = useState(true);
  const { data: plans } = useMembershipPlans();
  const membershipPrices = (plans || []).map((p: any) => Number(p.price)).filter((n: number) => !isNaN(n));
  const { data: walkinSession } = useMyWalkinSession();
  const [nowTick, setNowTick] = useState(Date.now());

  useEffect(() => {
    if (!walkinSession) return;
    const id = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, [walkinSession]);

  const walkinStartMs = walkinSession
    ? new Date((walkinSession as any).startedAt ?? (walkinSession as any).startTime ?? Date.now()).getTime()
    : 0;
  const walkinElapsedSec = walkinSession ? Math.max(0, Math.floor((nowTick - walkinStartMs) / 1000)) : 0;
  const walkinElapsedLabel = (() => {
    const h = Math.floor(walkinElapsedSec / 3600);
    const m = Math.floor((walkinElapsedSec % 3600) / 60);
    const s = walkinElapsedSec % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  })();

  // ── Derive a clean human-readable label ──────────────────────────────────
  const getLabel = (t: any, absAmt: number): string => {
    if (t.description && String(t.description).trim()) {
      // Fix double "Table Table" prefix from admin timer description
      return String(t.description).replace(/^Table\s+Table\b/i, "Table").trim();
    }
    const rawType = String(t.type || "").toLowerCase();
    const rawMethod = String(t.method || t.paymentMethod || "").toLowerCase();
    if (rawType === "topup") {
      if (rawMethod === "paynow" || rawMethod === "stripe") return "Wallet Top Up — PayNow";
      if (rawMethod === "cash") return "Wallet Top Up — Cash";
      return "Wallet Top Up";
    }
    if (rawType === "refund") return "Refund";
    // payment OR admin_charge — same display to customer
    const cat = String(t.category || "").toLowerCase();
    if (cat === "fnb") return "F&B Order";
    if (cat === "locker") return "Locker Rental";
    if (cat === "manual_timer") return "Walk-in Session";
    if (membershipPrices.some((p: number) => Math.abs(p - absAmt) < 0.005)) return "Membership Purchase";
    if (rawMethod === "paynow" || rawMethod === "stripe") return "Table Booking (PayNow)";
    return "Table Booking";
  };

  // ── Icon / colour config ─────────────────────────────────────────────────
  const getTypeConfig = (typeKey: string, isWalkin: boolean) => {
    if (isWalkin) return {
      icon: <Timer className="h-3.5 w-3.5" />,
      bg: "bg-amber-500/10", iconColor: "text-amber-400", border: "border-amber-500/20",
      label: "Walk-in", labelColor: "text-amber-400",
    };
    if (typeKey === "payment") return {
      icon: <ArrowUpRight className="h-3.5 w-3.5" />,
      bg: "bg-red-500/10", iconColor: "text-red-400", border: "border-red-500/20",
      label: "Payment", labelColor: "text-red-400",
    };
    if (typeKey === "topup") return {
      icon: <ArrowDownLeft className="h-3.5 w-3.5" />,
      bg: "bg-emerald-500/10", iconColor: "text-emerald-400", border: "border-emerald-500/20",
      label: "Top Up", labelColor: "text-emerald-400",
    };
    if (typeKey === "refund") return {
      icon: <RefreshCw className="h-3.5 w-3.5" />,
      bg: "bg-blue-500/10", iconColor: "text-blue-400", border: "border-blue-500/20",
      label: "Refund", labelColor: "text-blue-400",
    };
    return {
      icon: <CreditCard className="h-3.5 w-3.5" />,
      bg: "bg-muted", iconColor: "text-muted-foreground", border: "border-border",
      label: "Other", labelColor: "text-muted-foreground",
    };
  };

  const { data: transactionHistory } = useQuery({
    queryKey: ["transaction-history", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const res = await apiFetch("/api/transactions/me");
      if (!res.ok) return [];
      const data = await res.json();
      const walletTxs = Array.isArray(data) ? data
        : Array.isArray(data?.transactions) ? data.transactions
        : Array.isArray(data?.walletTransactions) ? data.walletTransactions
        : [];

      const items: Array<any> = [];
      walletTxs.forEach((t: any) => {
        const rawType = String(t.type || t.transactionType || "").toLowerCase();

        // admin_charge is treated identically to payment for the customer view
        let typeKey: "payment" | "topup" | "refund" | "other" = "other";
        if (
          rawType === "payment" ||
          rawType === "booking_payment" ||
          rawType === "wallet_deduct" ||
          rawType === "admin_charge"
        ) {
          typeKey = "payment";
        } else if (rawType === "topup" || rawType === "top_up" || rawType === "deposit") {
          typeKey = "topup";
        } else if (rawType === "refund") {
          typeKey = "refund";
        }

        const amtRaw = typeof t.amount === "number" ? t.amount : Number(t.amount) || 0;
        const absAmt = Math.abs(amtRaw);

        // Payments are debits (negative), topup/refund are credits (positive)
        const amt =
          typeKey === "payment" ? -absAmt
          : typeKey === "topup" || typeKey === "refund" ? absAmt
          : amtRaw;

        const rawMethod = String(t.paymentMethod || t.payment_method || t.method || "").toLowerCase();
        const method =
          rawMethod === "wallet" ? "Wallet"
          : rawMethod === "paynow" || rawMethod === "stripe" ? "PayNow"
          : rawMethod ? rawMethod.charAt(0).toUpperCase() + rawMethod.slice(1)
          : "";

        const dateStr = t.createdAt || t.created_at || t.date || "";
        const displayLabel = getLabel(t, absAmt);
        const isWalkin = /^walk-?in session/i.test(displayLabel);

        items.push({
          id: `w-${t.id || t._id}`,
          date: dateStr,
          typeKey,
          method,
          rawMethod,
          rawType,
          amtRaw,
          absAmt,
          displayLabel,
          isWalkin,
          amount: `${amt >= 0 ? "+" : "-"}$${absAmt.toFixed(2)}`,
          positive: amt >= 0,
          sortKey: new Date(dateStr).getTime(),
          adminActedFor: !!(t.adminActedFor ?? t.admin_acted_for),
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

  const groupedByDate: Record<string, typeof visible> = {};
  visible.forEach((t) => {
    const label = t.date
      ? new Date(t.date).toLocaleDateString("en-GB", {
          day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Singapore",
        })
      : "Unknown";
    if (!groupedByDate[label]) groupedByDate[label] = [];
    groupedByDate[label].push(t);
  });

  return (
    <div className="space-y-4">
      {/* Active walk-in banner */}
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
                <p className="font-mono text-base font-bold text-accent">
                  ${Number((walkinSession as any).runningCost ?? 0).toFixed(2)}
                </p>
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
                  {(txs as any[]).map((t: any) => {
                    const cfg = getTypeConfig(t.typeKey, t.isWalkin);
                    return (
                      <div key={t.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/30 transition-colors">
                        {/* Icon */}
                        <div className={`h-8 w-8 rounded-full ${cfg.bg} border ${cfg.border} flex items-center justify-center shrink-0 ${cfg.iconColor}`}>
                          {cfg.icon}
                        </div>

                        {/* Details */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate leading-tight">{t.displayLabel}</p>
                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            <span className={`text-[11px] font-medium ${cfg.labelColor}`}>{cfg.label}</span>
                            {t.method && (
                              <>
                                <span className="text-muted-foreground/40 text-[10px]">•</span>
                                <span className="text-[11px] text-muted-foreground">{t.method}</span>
                              </>
                            )}
                            <span className="text-muted-foreground/40 text-[10px]">•</span>
                            <span className="text-[11px] text-muted-foreground">
                              {new Date(t.date).toLocaleTimeString("en-GB", {
                                hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Singapore",
                              })}
                            </span>
                            {t.adminActedFor && (
                              <>
                                <span className="text-muted-foreground/40 text-[10px]">•</span>
                                <span
                                  className="inline-flex items-center gap-0.5 text-[10px] font-medium text-violet-400"
                                  title="Assisted by staff"
                                >
                                  <ShieldCheck className="h-3 w-3" />
                                  Staff
                                </span>
                              </>
                            )}
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
