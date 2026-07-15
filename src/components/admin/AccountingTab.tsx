import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api";
import { Download, FileText, Plus, Trash2, TrendingDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const EXPENSE_CATEGORIES: Record<string, string> = {
  rent:              "Rent",
  utilities:         "Utilities (Electricity / Water / Internet)",
  staff:             "Staff & Labour",
  equipment:         "Equipment & Maintenance",
  supplies:          "Supplies & Consumables",
  cogs:              "F&B Cost of Goods Sold",
  marketing:         "Marketing & Advertising",
  insurance:         "Insurance",
  licenses:          "Licenses & Permits",
  professional_fees: "Professional Fees (Accounting / Legal)",
  other:             "Other",
};

function thisMonthRange() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const lastDay = new Date(y, now.getMonth() + 1, 0).getDate();
  return { from: `${y}-${m}-01`, to: `${y}-${m}-${lastDay}` };
}

function useExpenses(from: string, to: string) {
  return useQuery<any[]>({
    queryKey: ["accounting-expenses", from, to],
    queryFn: async () => {
      const r = await apiFetch(`/api/accounting/expenses?from=${from}&to=${to}`);
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    enabled: !!from && !!to,
  });
}

function useAddExpense() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (data: { date: string; category: string; description: string; amount: string }) => {
      const r = await apiFetch("/api/accounting/expenses", { method: "POST", body: JSON.stringify({ ...data, amount: Number(data.amount) }) });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "Expense added" });
      qc.invalidateQueries({ queryKey: ["accounting-expenses"] });
    },
    onError: (e: any) => toast({ title: "Failed to add", description: e?.message, variant: "destructive" }),
  });
}

function useDeleteExpense() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: string) => {
      const r = await apiFetch(`/api/accounting/expenses/${id}`, { method: "DELETE" });
      if (!r.ok) throw new Error(await r.text());
    },
    onSuccess: () => {
      toast({ title: "Expense deleted" });
      qc.invalidateQueries({ queryKey: ["accounting-expenses"] });
    },
    onError: (e: any) => toast({ title: "Failed", description: e?.message, variant: "destructive" }),
  });
}

const EMPTY_FORM = { date: "", category: "", description: "", amount: "" };

export function AccountingTab() {
  const { toast } = useToast();
  const { from: df, to: dt } = thisMonthRange();
  const [from, setFrom] = useState(df);
  const [to, setTo] = useState(dt);
  const [form, setForm] = useState(EMPTY_FORM);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [csvLoading, setCsvLoading] = useState(false);

  const { data: expenses = [], isLoading } = useExpenses(from, to);
  const addExpense = useAddExpense();
  const deleteExpense = useDeleteExpense();

  const totalExpenses = useMemo(() => expenses.reduce((s: number, e: any) => s + e.amount, 0), [expenses]);
  const byCategory = useMemo(() => {
    const map: Record<string, number> = {};
    expenses.forEach((e: any) => { map[e.category] = (map[e.category] || 0) + e.amount; });
    return map;
  }, [expenses]);

  const setPreset = (preset: "this_month" | "last_month" | "this_year") => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    if (preset === "this_month") {
      const ld = new Date(y, m + 1, 0).getDate();
      setFrom(`${y}-${String(m + 1).padStart(2, "0")}-01`);
      setTo(`${y}-${String(m + 1).padStart(2, "0")}-${ld}`);
    } else if (preset === "last_month") {
      const lm = m === 0 ? 12 : m;
      const ly = m === 0 ? y - 1 : y;
      const ld = new Date(ly, lm, 0).getDate();
      setFrom(`${ly}-${String(lm).padStart(2, "0")}-01`);
      setTo(`${ly}-${String(lm).padStart(2, "0")}-${ld}`);
    } else {
      setFrom(`${y}-01-01`);
      setTo(`${y}-12-31`);
    }
  };

  const handleAdd = async () => {
    if (!form.date || !form.category || !form.amount) {
      toast({ title: "Date, category, and amount are required", variant: "destructive" });
      return;
    }
    await addExpense.mutateAsync(form);
    setForm(EMPTY_FORM);
  };

  const downloadFile = async (url: string, filename: string, setLoading: (v: boolean) => void, contentType: string) => {
    setLoading(true);
    try {
      const r = await apiFetch(url);
      if (!r.ok) throw new Error(await r.text());
      const blob = await r.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e: any) {
      toast({ title: "Download failed", description: e?.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">

      {/* ── Date range ── */}
      <Card className="card-premium">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileText className="h-5 w-5" /> Accounting Period
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => setPreset("this_month")}>This Month</Button>
            <Button size="sm" variant="outline" onClick={() => setPreset("last_month")}>Last Month</Button>
            <Button size="sm" variant="outline" onClick={() => setPreset("this_year")}>This Year</Button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>From</Label>
              <Input type="date" value={from} onChange={e => setFrom(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>To</Label>
              <Input type="date" value={to} onChange={e => setTo(e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Add expense ── */}
      <Card className="card-premium">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingDown className="h-4 w-4 text-red-400" /> Add Expense
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  {Object.entries(EXPENSE_CATEGORIES).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Amount (SGD)</Label>
              <Input type="number" min="0" step="0.01" placeholder="0.00" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Description <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Input placeholder="e.g. March rent" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
          </div>
          <Button onClick={handleAdd} disabled={addExpense.isPending} className="gap-2">
            <Plus className="h-4 w-4" />
            {addExpense.isPending ? "Adding…" : "Add Expense"}
          </Button>
        </CardContent>
      </Card>

      {/* ── Expense list ── */}
      <Card className="card-premium">
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-base">
            <span>Expenses — {from} to {to}</span>
            {totalExpenses > 0 && (
              <Badge variant="destructive" className="text-sm font-semibold">
                Total: ${totalExpenses.toFixed(2)}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Loading…</p>
          ) : expenses.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No expenses recorded for this period. Add some above.</p>
          ) : (
            <div className="space-y-4">
              {/* By category summary */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {Object.entries(byCategory).map(([cat, amt]) => (
                  <div key={cat} className="rounded-lg border border-border/50 p-2.5 bg-muted/20">
                    <p className="text-xs text-muted-foreground truncate">{EXPENSE_CATEGORIES[cat] || cat}</p>
                    <p className="text-sm font-semibold text-red-400">${(amt as number).toFixed(2)}</p>
                  </div>
                ))}
              </div>

              {/* Line items */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 pr-3 text-muted-foreground font-medium">Date</th>
                      <th className="text-left py-2 pr-3 text-muted-foreground font-medium">Category</th>
                      <th className="text-left py-2 pr-3 text-muted-foreground font-medium">Description</th>
                      <th className="text-right py-2 pr-3 text-muted-foreground font-medium">Amount</th>
                      <th className="py-2 w-8"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {expenses.map((e: any) => (
                      <tr key={e._id} className="hover:bg-muted/20 transition-colors">
                        <td className="py-2 pr-3 text-xs text-muted-foreground">{e.date?.slice(0, 10)}</td>
                        <td className="py-2 pr-3 text-xs">{EXPENSE_CATEGORIES[e.category] || e.category}</td>
                        <td className="py-2 pr-3 text-xs text-muted-foreground">{e.description || "—"}</td>
                        <td className="py-2 pr-3 text-right text-red-400 font-medium">${e.amount.toFixed(2)}</td>
                        <td className="py-2">
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => deleteExpense.mutate(e._id)} disabled={deleteExpense.isPending}>
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Report downloads ── */}
      <Card className="card-premium">
        <CardHeader>
          <CardTitle className="text-base">Generate Reports</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Both reports cover the selected period above and include all revenue from the system plus the expenses you entered.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={() => downloadFile(
                `/api/accounting/report?from=${from}&to=${to}`,
                `envo-pl-${from}-to-${to}.pdf`,
                setPdfLoading,
                "application/pdf"
              )}
              disabled={pdfLoading}
              className="gap-2 bg-accent text-accent-foreground hover:bg-accent/90"
            >
              <FileText className="h-4 w-4" />
              {pdfLoading ? "Generating…" : "Download P&L Report (PDF)"}
            </Button>
            <Button
              variant="outline"
              onClick={() => downloadFile(
                `/api/admin/export/transactions?from=${from}&to=${to}`,
                `envo-transactions-${from}-to-${to}.csv`,
                setCsvLoading,
                "text/csv"
              )}
              disabled={csvLoading}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              {csvLoading ? "Downloading…" : "Download Transaction CSV"}
            </Button>
          </div>
          <div className="p-3 rounded-lg bg-muted/40 text-xs text-muted-foreground space-y-1">
            <p><strong>P&L PDF</strong> — Full profit & loss: money received, revenue earned by type, your expenses, and net profit/loss.</p>
            <p><strong>Transaction CSV</strong> — Every individual transaction line for your own reconciliation or accountant.</p>
          </div>
        </CardContent>
      </Card>

    </div>
  );
}
