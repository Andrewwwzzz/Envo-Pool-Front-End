import { useState, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiFetch, BASE_URL } from "@/lib/api";
import { Download, FileText, Plus, Trash2, TrendingDown, Paperclip, Eye, X, RotateCcw, ChevronLeft, ChevronRight } from "lucide-react";
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

const INCOME_CATEGORIES: Record<string, string> = {
  bank_interest: "Bank Interest",
  grant:         "Grants / Subsidies",
  other_income:  "Other Income",
};

const ALL_CATEGORIES: Record<string, string> = { ...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES };

function thisMonthRange() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const lastDay = new Date(y, now.getMonth() + 1, 0).getDate();
  return { from: `${y}-${m}-01`, to: `${y}-${m}-${lastDay}` };
}

function useExpenses(from: string, to: string, deleted = false) {
  return useQuery<any[]>({
    queryKey: ["accounting-expenses", from, to, deleted],
    queryFn: async () => {
      const r = await apiFetch(`/api/accounting/expenses?from=${from}&to=${to}${deleted ? "&deleted=true" : ""}`);
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

function useUploadReceipt() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id, file }: { id: string; file: File }) => {
      const body = new FormData();
      body.append("receipt", file);
      const token = localStorage.getItem("token");
      const r = await fetch(`${BASE_URL}/api/accounting/expenses/${id}/receipt`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body,
      });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "Receipt uploaded" });
      qc.invalidateQueries({ queryKey: ["accounting-expenses"] });
    },
    onError: (e: any) => toast({ title: "Upload failed", description: e?.message, variant: "destructive" }),
  });
}

function useDeleteReceipt() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ expenseId, receiptId }: { expenseId: string; receiptId: string }) => {
      const r = await apiFetch(`/api/accounting/expenses/${expenseId}/receipt/${receiptId}`, { method: "DELETE" });
      if (!r.ok) throw new Error(await r.text());
    },
    onSuccess: () => {
      toast({ title: "Receipt removed" });
      qc.invalidateQueries({ queryKey: ["accounting-expenses"] });
    },
    onError: (e: any) => toast({ title: "Failed", description: e?.message, variant: "destructive" }),
  });
}

function useRestoreExpense() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: string) => {
      const r = await apiFetch(`/api/accounting/expenses/${id}/restore`, { method: "POST" });
      if (!r.ok) throw new Error(await r.text());
    },
    onSuccess: () => {
      toast({ title: "Expense restored" });
      qc.invalidateQueries({ queryKey: ["accounting-expenses"] });
    },
    onError: (e: any) => toast({ title: "Restore failed", description: e?.message, variant: "destructive" }),
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

  const [showDeleted, setShowDeleted] = useState(false);
  const [receiptModal, setReceiptModal] = useState<{
    expenseId: string;
    receipts: { _id: string; originalName: string }[];
    index: number;
    url: string;
    isImage: boolean;
    loading: boolean;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  const { data: expenses = [], isLoading } = useExpenses(from, to, showDeleted);
  const addExpense = useAddExpense();
  const deleteExpense = useDeleteExpense();
  const uploadReceipt = useUploadReceipt();
  const deleteReceipt = useDeleteReceipt();
  const restoreExpense = useRestoreExpense();

  const handleReceiptClick = (id: string) => {
    setUploadingId(id);
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uploadingId) return;
    await uploadReceipt.mutateAsync({ id: uploadingId, file });
    e.target.value = "";
    setUploadingId(null);
  };

  const loadReceiptAt = (expenseId: string, receipts: { _id: string; originalName: string }[], index: number) => {
    const rc = receipts[index];
    const token = localStorage.getItem("token");
    const url = `${BASE_URL}/api/accounting/expenses/${expenseId}/receipt/${rc._id}`;
    setReceiptModal(prev => prev ? { ...prev, loading: true, index } : { expenseId, receipts, index, url: "", isImage: false, loading: true });
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.blob())
      .then(blob => {
        if (receiptModal?.url) URL.revokeObjectURL(receiptModal.url);
        const objUrl = URL.createObjectURL(blob);
        setReceiptModal({ expenseId, receipts, index, url: objUrl, isImage: blob.type.startsWith("image/"), loading: false });
      });
  };

  const openReceipts = (expenseId: string, receipts: { _id: string; originalName: string }[]) => {
    if (!receipts.length) return;
    loadReceiptAt(expenseId, receipts, 0);
  };

  const totalExpenses   = useMemo(() => expenses.filter((e: any) => e.type !== "income").reduce((s: number, e: any) => s + e.amount, 0), [expenses]);
  const totalOtherIncome = useMemo(() => expenses.filter((e: any) => e.type === "income").reduce((s: number, e: any) => s + e.amount, 0), [expenses]);
  const byCategory = useMemo(() => {
    const map: Record<string, number> = {};
    expenses.filter((e: any) => e.type !== "income").forEach((e: any) => { map[e.category] = (map[e.category] || 0) + e.amount; });
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

      {/* ── Add expense / income ── */}
      <Card className="card-premium">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingDown className="h-4 w-4 text-red-400" /> Add Entry
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
                  <SelectGroup>
                    <SelectLabel>— Expenses —</SelectLabel>
                    {Object.entries(EXPENSE_CATEGORIES).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectGroup>
                  <SelectGroup>
                    <SelectLabel>— Other Income —</SelectLabel>
                    {Object.entries(INCOME_CATEGORIES).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectGroup>
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
          {form.category && INCOME_CATEGORIES[form.category] && (
            <p className="text-xs text-green-500">This will be recorded as Other Income and added to your P&L.</p>
          )}
          <Button onClick={handleAdd} disabled={addExpense.isPending} className="gap-2">
            <Plus className="h-4 w-4" />
            {addExpense.isPending ? "Adding…" : `Add ${form.category && INCOME_CATEGORIES[form.category] ? "Income" : "Expense"}`}
          </Button>
        </CardContent>
      </Card>

      {/* ── Expense list ── */}
      <Card className="card-premium">
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-base flex-wrap gap-2">
            <span>{showDeleted ? "Deleted Expenses" : "Expenses"} — {from} to {to}</span>
            <div className="flex items-center gap-2">
              {!showDeleted && totalExpenses > 0 && (
                <Badge variant="destructive" className="text-sm font-semibold">
                  Exp: ${totalExpenses.toFixed(2)}
                </Badge>
              )}
              {!showDeleted && totalOtherIncome > 0 && (
                <Badge className="text-sm font-semibold bg-green-600 text-white">
                  Inc: +${totalOtherIncome.toFixed(2)}
                </Badge>
              )}
              <Button
                size="sm"
                variant={showDeleted ? "destructive" : "outline"}
                className="gap-1.5 text-xs h-7"
                onClick={() => setShowDeleted(v => !v)}
              >
                <Trash2 className="h-3 w-3" />
                {showDeleted ? "Hide Deleted" : "Show Deleted"}
              </Button>
            </div>
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

              {/* hidden file input — shared across all rows */}
              <input ref={fileInputRef} type="file" accept=".jpg,.jpeg,.png,.webp,.pdf" className="hidden" onChange={handleFileChange} />

              {/* Line items */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 pr-3 text-muted-foreground font-medium">Date</th>
                      <th className="text-left py-2 pr-3 text-muted-foreground font-medium">Category</th>
                      <th className="text-left py-2 pr-3 text-muted-foreground font-medium">Description</th>
                      <th className="text-right py-2 pr-3 text-muted-foreground font-medium">Amount</th>
                      <th className="text-left py-2 pr-3 text-muted-foreground font-medium">{showDeleted ? "Deleted On" : "Receipt"}</th>
                      <th className="py-2 w-8"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {expenses.map((e: any) => {
                      return (
                        <tr key={e._id} className={`hover:bg-muted/20 transition-colors ${showDeleted ? "opacity-60" : ""}`}>
                          <td className="py-2 pr-3 text-xs text-muted-foreground">{e.date?.slice(0, 10)}</td>
                          <td className="py-2 pr-3 text-xs">{ALL_CATEGORIES[e.category] || e.category}</td>
                          <td className="py-2 pr-3 text-xs text-muted-foreground">{e.description || "—"}</td>
                          <td className={`py-2 pr-3 text-right font-medium text-xs ${e.type === "income" ? "text-green-400" : "text-red-400"}`}>
                            {e.type === "income" ? "+" : "−"}${e.amount.toFixed(2)}
                          </td>
                          {showDeleted ? (
                            <>
                              <td className="py-2 pr-3 text-xs text-muted-foreground">
                                {e.deletedAt ? new Date(e.deletedAt).toLocaleDateString("en-SG") : "—"}
                              </td>
                              <td className="py-2">
                                <Button size="icon" variant="ghost" className="h-7 w-7 text-green-500 hover:text-green-400" title="Restore" onClick={() => restoreExpense.mutate(e._id)} disabled={restoreExpense.isPending}>
                                  <RotateCcw className="h-3.5 w-3.5" />
                                </Button>
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="py-2 pr-3">
                                <div className="flex items-center gap-1">
                                  {(e.receipts ?? []).length > 0 && (
                                    <Button size="icon" variant="ghost" className="h-7 w-7 text-accent relative" title="View receipts" onClick={() => openReceipts(e._id, e.receipts)}>
                                      <Eye className="h-3.5 w-3.5" />
                                      {e.receipts.length > 1 && (
                                        <span className="absolute -top-1 -right-1 text-[9px] bg-accent text-accent-foreground rounded-full w-3.5 h-3.5 flex items-center justify-center font-bold leading-none">
                                          {e.receipts.length}
                                        </span>
                                      )}
                                    </Button>
                                  )}
                                  <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-foreground" title="Attach receipt" onClick={() => handleReceiptClick(e._id)} disabled={uploadReceipt.isPending && uploadingId === e._id}>
                                    <Paperclip className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </td>
                              <td className="py-2">
                                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => deleteExpense.mutate(e._id)} disabled={deleteExpense.isPending}>
                                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                </Button>
                              </td>
                            </>
                          )}
                        </tr>
                      );
                    })}
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

      {/* ── Receipt viewer modal ── */}
      <Dialog open={!!receiptModal} onOpenChange={open => { if (!open) { URL.revokeObjectURL(receiptModal?.url ?? ""); setReceiptModal(null); } }}>
        <DialogContent className="max-w-3xl w-full p-0 overflow-hidden">
          <DialogHeader className="px-4 pt-3 pb-2 flex flex-row items-center justify-between gap-2">
            <DialogTitle className="text-sm font-medium truncate flex-1">
              {receiptModal && receiptModal.receipts[receiptModal.index]?.originalName}
              {receiptModal && receiptModal.receipts.length > 1 && (
                <span className="ml-2 text-muted-foreground font-normal">{receiptModal.index + 1} / {receiptModal.receipts.length}</span>
              )}
            </DialogTitle>
            <Button
              size="sm" variant="ghost" className="text-destructive hover:text-destructive h-7 px-2 text-xs shrink-0"
              onClick={() => {
                if (!receiptModal) return;
                const rc = receiptModal.receipts[receiptModal.index];
                deleteReceipt.mutate({ expenseId: receiptModal.expenseId, receiptId: rc._id }, {
                  onSuccess: () => {
                    const remaining = receiptModal.receipts.filter(r => r._id !== rc._id);
                    if (!remaining.length) { URL.revokeObjectURL(receiptModal.url); setReceiptModal(null); return; }
                    const nextIndex = Math.min(receiptModal.index, remaining.length - 1);
                    loadReceiptAt(receiptModal.expenseId, remaining, nextIndex);
                  }
                });
              }}
              disabled={deleteReceipt.isPending}
            >
              <X className="h-3.5 w-3.5 mr-1" /> Remove
            </Button>
          </DialogHeader>

          <div className="relative w-full bg-black flex items-center justify-center" style={{ minHeight: "60vh", maxHeight: "72vh" }}>
            {receiptModal?.loading ? (
              <p className="text-white text-sm">Loading…</p>
            ) : receiptModal?.isImage ? (
              <img src={receiptModal.url} alt="" className="max-w-full max-h-[72vh] object-contain" />
            ) : (
              <iframe src={receiptModal?.url} title="" className="w-full border-0" style={{ height: "72vh" }} />
            )}

            {/* Prev / Next arrows */}
            {receiptModal && receiptModal.receipts.length > 1 && (
              <>
                <button
                  className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/80 text-white rounded-full p-1.5 disabled:opacity-30 transition"
                  onClick={() => loadReceiptAt(receiptModal.expenseId, receiptModal.receipts, receiptModal.index - 1)}
                  disabled={receiptModal.index === 0}
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/80 text-white rounded-full p-1.5 disabled:opacity-30 transition"
                  onClick={() => loadReceiptAt(receiptModal.expenseId, receiptModal.receipts, receiptModal.index + 1)}
                  disabled={receiptModal.index === receiptModal.receipts.length - 1}
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
