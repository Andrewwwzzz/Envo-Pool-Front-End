import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { useStaffIncentives, IncentiveKey } from "@/hooks/useStaffIncentives";
import { fmtDateTimeSG } from "@/lib/sgTime";

const LABELS: Record<IncentiveKey, string> = {
  membership: "New membership",
  topup250: "Top-up $250+",
  topup500: "Top-up $500",
  package3h: "3h package",
  package5h: "5h package",
};
const KEYS: IncentiveKey[] = ["membership", "topup250", "topup500", "package3h", "package5h"];

// Current SGT month plus the previous five, newest first.
function recentMonths(): string[] {
  const now = new Date(Date.now() + 8 * 3600e3);
  const out: string[] = [];
  for (let i = 0; i < 6; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    out.push(d.toISOString().slice(0, 7));
  }
  return out;
}

const monthLabel = (m: string) => new Date(`${m}-01T12:00:00Z`).toLocaleDateString("en-SG", { month: "long", year: "numeric" });

export default function IncentivesTab() {
  const months = useMemo(recentMonths, []);
  const [month, setMonth] = useState(months[0]);
  const [staffFilter, setStaffFilter] = useState<string | null>(null);
  const { data, isLoading, error } = useStaffIncentives(month);

  const items = (data?.items ?? []).filter((i) => !staffFilter || i.staffId === staffFilter);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Staff Incentives</h2>
          <p className="text-sm text-muted-foreground">Bonuses earned from sales staff made themselves. Updates automatically.</p>
        </div>
        <Select value={month} onValueChange={(m) => { setMonth(m); setStaffFilter(null); }}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            {months.map((m) => <SelectItem key={m} value={m}>{monthLabel(m)}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">How bonuses are earned</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 text-sm">
            <Rule amount={data?.rules.membership ?? 5} text="New membership sold — assigned with Wallet, Cash or PayNow payment (not locker plans, free ones or extensions)" />
            <Rule amount={data?.rules.topup250 ?? 5} text="Top-up of $250–$499 submitted by staff for the customer, once approved" />
            <Rule amount={data?.rules.topup500 ?? 15} text="Top-up of $500 submitted by staff for the customer, once approved" />
            <Rule amount={data?.rules.package3h ?? 2} text="3-hour package (DAY3H / EVE3H) booked through Book Now" />
            <Rule amount={data?.rules.package5h ?? 5} text="5-hour package (DAY5H) booked through Book Now" />
            <p className="text-xs text-muted-foreground self-center">Customers' own online top-ups and bookings don't count. Cancelled bookings and deleted memberships drop off automatically.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-base">{monthLabel(month)}</CardTitle>
          {data && <Badge variant="secondary">Total ${data.totalBonus.toFixed(2)}</Badge>}
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
          ) : error ? (
            <p className="text-sm text-destructive">Couldn't load incentives.</p>
          ) : !data?.staff.length ? (
            <p className="text-sm text-muted-foreground">No bonuses earned yet this month.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">Staff</th>
                    {KEYS.map((k) => <th key={k} className="py-2 pr-3 font-medium text-right whitespace-nowrap">{LABELS[k]}</th>)}
                    <th className="py-2 font-medium text-right">Bonus</th>
                  </tr>
                </thead>
                <tbody>
                  {data.staff.map((s) => (
                    <tr
                      key={s.staffId}
                      className={`border-b border-border/50 cursor-pointer hover:bg-muted/40 ${staffFilter === s.staffId ? "bg-muted/60" : ""}`}
                      onClick={() => setStaffFilter(staffFilter === s.staffId ? null : s.staffId)}
                    >
                      <td className="py-2.5 pr-3 font-medium">{s.name}</td>
                      {KEYS.map((k) => <td key={k} className="py-2.5 pr-3 text-right tabular-nums">{s[k] || "—"}</td>)}
                      <td className="py-2.5 text-right font-semibold tabular-nums">${s.bonus.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-xs text-muted-foreground mt-2">Tap a name to see only their sales below.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {!!data?.items.length && (
        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-base">
              Every sale{staffFilter ? ` — ${data.staff.find((s) => s.staffId === staffFilter)?.name ?? ""}` : ""}
            </CardTitle>
            {staffFilter && <Button size="sm" variant="ghost" onClick={() => setStaffFilter(null)}>Show everyone</Button>}
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">When</th>
                    <th className="py-2 pr-3 font-medium">Staff</th>
                    <th className="py-2 pr-3 font-medium">Type</th>
                    <th className="py-2 pr-3 font-medium">Customer</th>
                    <th className="py-2 pr-3 font-medium">Details</th>
                    <th className="py-2 font-medium text-right">Bonus</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((i, idx) => (
                    <tr key={idx} className="border-b border-border/50">
                      <td className="py-2 pr-3 whitespace-nowrap text-muted-foreground">{fmtDateTimeSG(i.at)}</td>
                      <td className="py-2 pr-3">{i.staffName}</td>
                      <td className="py-2 pr-3 whitespace-nowrap">{LABELS[i.key]}</td>
                      <td className="py-2 pr-3">{i.customer}</td>
                      <td className="py-2 pr-3 text-muted-foreground">{i.detail}</td>
                      <td className="py-2 text-right tabular-nums">${i.bonus.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Rule({ amount, text }: { amount: number; text: string }) {
  return (
    <div className="flex items-start gap-3 rounded-md border border-border px-3 py-2">
      <span className="font-semibold text-primary tabular-nums">${amount}</span>
      <span className="text-muted-foreground">{text}</span>
    </div>
  );
}
