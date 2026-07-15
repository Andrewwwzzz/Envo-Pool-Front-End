import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api";
import { Download, FileText } from "lucide-react";
import { getSGDateStr } from "@/lib/sgTime";

function thisMonthRange() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const lastDay = new Date(y, now.getMonth() + 1, 0).getDate();
  return { from: `${y}-${m}-01`, to: `${y}-${m}-${lastDay}` };
}

export function AccountingTab() {
  const { toast } = useToast();
  const { from: defaultFrom, to: defaultTo } = thisMonthRange();
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    if (!from || !to) {
      toast({ title: "Please select a date range", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const res = await apiFetch(`/api/admin/export/transactions?from=${from}&to=${to}`);
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `envo-transactions-${from}-to-${to}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Export downloaded" });
    } catch (e: any) {
      toast({ title: "Export failed", description: e?.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const setPreset = (preset: "this_month" | "last_month" | "this_year") => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    if (preset === "this_month") {
      const lastDay = new Date(y, m + 1, 0).getDate();
      setFrom(`${y}-${String(m + 1).padStart(2, "0")}-01`);
      setTo(`${y}-${String(m + 1).padStart(2, "0")}-${lastDay}`);
    } else if (preset === "last_month") {
      const lm = m === 0 ? 12 : m;
      const ly = m === 0 ? y - 1 : y;
      const lastDay = new Date(ly, lm, 0).getDate();
      setFrom(`${ly}-${String(lm).padStart(2, "0")}-01`);
      setTo(`${ly}-${String(lm).padStart(2, "0")}-${lastDay}`);
    } else {
      setFrom(`${y}-01-01`);
      setTo(`${y}-12-31`);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="card-premium">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileText className="h-5 w-5" />
            Transaction CSV Export
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Download all transactions as a CSV file. Open in Excel or Google Sheets for your accounts.
            All dates and times are in Singapore Time (SGT).
          </p>

          {/* Quick presets */}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => setPreset("this_month")}>This Month</Button>
            <Button size="sm" variant="outline" onClick={() => setPreset("last_month")}>Last Month</Button>
            <Button size="sm" variant="outline" onClick={() => setPreset("this_year")}>This Year</Button>
          </div>

          {/* Custom range */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>From</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>To</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>

          <Button onClick={handleExport} disabled={loading} className="gap-2">
            <Download className="h-4 w-4" />
            {loading ? "Downloading…" : "Download CSV"}
          </Button>
        </CardContent>
      </Card>

      <Card className="card-premium">
        <CardHeader>
          <CardTitle className="text-base">What's in the CSV</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="text-sm w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-1.5 pr-4 font-medium text-muted-foreground">Column</th>
                  <th className="text-left py-1.5 font-medium text-muted-foreground">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {[
                  ["Date (SGT)", "Transaction date in Singapore time"],
                  ["Time (SGT)", "Transaction time in Singapore time"],
                  ["Customer Name", "Name on account"],
                  ["Customer Email", "Customer's email address"],
                  ["Type", "Wallet Top-Up / Payment / Refund / Admin Charge"],
                  ["Category", "F&B / Walk-in / Locker / Merchandise (for admin charges)"],
                  ["Direction", "IN = money received, OUT = money spent from wallet"],
                  ["Amount (SGD)", "Transaction amount in SGD"],
                  ["Method", "Wallet / PayNow / Cash"],
                  ["Description", "Notes entered at time of transaction"],
                ].map(([col, desc]) => (
                  <tr key={col}>
                    <td className="py-1.5 pr-4 font-mono text-xs text-accent">{col}</td>
                    <td className="py-1.5 text-muted-foreground">{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 p-3 rounded-lg bg-muted/40 text-xs text-muted-foreground space-y-1">
            <p><strong>Tip:</strong> For your P&L — filter Direction = IN for total money received; filter Type = Wallet Top-Up to see actual cash collected (PayNow + Cash).</p>
            <p><strong>Expenses</strong> (rent, utilities, salaries) are not in this system — enter those manually in your accounting software.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
