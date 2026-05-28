import { useState } from "react";
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

export default function DashboardTransactions() {
  const { user } = useAuth();
  const [showAll, setShowAll] = useState(true);
  const { data: plans } = useMembershipPlans();
  const membershipPrices = (plans || []).map((p: any) => Number(p.price)).filter((n) => !isNaN(n));

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
          <div className="space-y-2">
            {visible.map((t: any) => {
              const desc = deriveTransactionDescription(
                { description: t.description, type: t.rawType, paymentMethod: t.rawMethod, amount: t.amtRaw },
                membershipPrices
              );
              return (
                <div key={t.id} className="flex items-center justify-between text-sm py-2 border-b border-border/50 last:border-0">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className={txBadge(t.typeKey)}>{t.typeLabel}</Badge>
                    <div>
                      {desc && <p className="text-sm font-medium text-foreground">{desc}</p>}
                      <p className="text-xs text-muted-foreground">{fmtNiceDate(t.date)}</p>
                      {t.method && <p className="text-xs text-muted-foreground">{t.method}</p>}
                    </div>
                  </div>
                  <span className={t.positive ? "text-primary font-medium" : "text-destructive font-medium"}>
                    {t.amount}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
