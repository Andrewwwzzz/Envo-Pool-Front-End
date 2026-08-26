import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api";
import { Wallet, CheckCircle2, AlertTriangle, History, Pencil } from "lucide-react";

type Phase = "opening" | "closing";
type ShiftType = "morning" | "night";

interface CountValues {
  shiftType: ShiftType;
  date: string; // "" = use server default
  counted: string;
  cashAfterMidnight: string;
  reason: string;
}

const EMPTY_VALUES: CountValues = { shiftType: "morning", date: "", counted: "", cashAfterMidnight: "", reason: "" };

function useCashCountContext(phase: Phase, shiftType: ShiftType, date: string, excludeId?: string) {
  return useQuery({
    queryKey: ["cashcount-context", phase, shiftType, date, excludeId],
    queryFn: async () => {
      const params = new URLSearchParams({ phase, shiftType });
      if (date) params.set("date", date);
      if (excludeId) params.set("excludeId", excludeId);
      const r = await apiFetch(`/api/cashcount/context?${params.toString()}`);
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    refetchInterval: 60000,
  });
}

function useCashCountHistory() {
  return useQuery<any[]>({
    queryKey: ["cashcount-history"],
    queryFn: async () => {
      const r = await apiFetch(`/api/cashcount?limit=100`);
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
  });
}

function useSubmitCashCount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const r = await apiFetch(`/api/cashcount`, { method: "POST", body: JSON.stringify(body) });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw Object.assign(new Error(data.error || "Failed to submit"), { data });
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cashcount-context"] });
      qc.invalidateQueries({ queryKey: ["cashcount-history"] });
    },
  });
}

function useEditCashCount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, body }: { id: string; body: Record<string, unknown> }) => {
      const r = await apiFetch(`/api/cashcount/${id}`, { method: "PATCH", body: JSON.stringify(body) });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw Object.assign(new Error(data.error || "Failed to save"), { data });
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cashcount-context"] });
      qc.invalidateQueries({ queryKey: ["cashcount-history"] });
    },
  });
}

// Shared counting form used both for a fresh submission and for editing an
// existing entry — the live preview (expected amount, tally/mismatch) works
// the same way in both cases.
function CashCountForm({
  phase,
  values,
  onChange,
  excludeId,
  onSubmit,
  submitLabel,
  isPending,
}: {
  phase: Phase;
  values: CountValues;
  onChange: (v: CountValues) => void;
  excludeId?: string;
  onSubmit: (payload: Record<string, unknown>) => Promise<void>;
  submitLabel: string;
  isPending: boolean;
}) {
  const { toast } = useToast();
  const { shiftType, date, counted, cashAfterMidnight, reason } = values;
  const isNightClosing = phase === "closing" && shiftType === "night";

  const { data: context, isLoading: contextLoading } = useCashCountContext(phase, shiftType, date, excludeId);

  const countedNum = parseFloat(counted);
  const hasCounted = counted.trim() !== "" && !isNaN(countedNum);
  const afterMidnightNum = isNightClosing && cashAfterMidnight.trim() !== "" && !isNaN(parseFloat(cashAfterMidnight))
    ? parseFloat(cashAfterMidnight)
    : 0;
  // The after-midnight portion is physically in the drawer (counted) but
  // belongs to that next day's Cash Top-Ups — it must be excluded from this
  // shift's tally, or a late top-up would look like an unexplained gain.
  const tallyPreview = hasCounted ? Math.round((countedNum - afterMidnightNum) * 100) / 100 : null;
  const expected = context?.expectedAmount ?? 0;
  const previewDiscrepancy = tallyPreview !== null && context ? Math.round((tallyPreview - expected) * 100) / 100 : null;
  const hasMismatch = previewDiscrepancy !== null && Math.abs(previewDiscrepancy) >= 0.01;

  const set = (patch: Partial<CountValues>) => onChange({ ...values, ...patch });

  const handleSubmit = async () => {
    if (!hasCounted || countedNum < 0) {
      toast({ title: "Enter the cash counted in the drawer", variant: "destructive" });
      return;
    }
    if (hasMismatch && !reason.trim()) {
      toast({ title: "There's a discrepancy — please write down the reason", variant: "destructive" });
      return;
    }
    await onSubmit({
      shiftType,
      countedAmount: countedNum,
      reason: reason.trim(),
      ...(date ? { date } : {}),
      ...(isNightClosing && cashAfterMidnight.trim() !== "" ? { cashAfterMidnight: parseFloat(cashAfterMidnight) } : {}),
    });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Shift</Label>
          <div className="flex gap-2">
            <Button type="button" size="sm" variant={shiftType === "morning" ? "default" : "outline"} className="flex-1" onClick={() => set({ shiftType: "morning", date: "" })}>Morning</Button>
            <Button type="button" size="sm" variant={shiftType === "night" ? "default" : "outline"} className="flex-1" onClick={() => set({ shiftType: "night", date: "" })}>Night</Button>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>{isNightClosing ? "Total Cash in Drawer" : "Cash in Drawer"} (SGD)</Label>
          <Input type="number" min="0" step="0.01" placeholder="0.00" value={counted} onChange={(e) => set({ counted: e.target.value })} />
        </div>
      </div>

      {phase === "closing" && (
        <div className="space-y-1.5">
          <Label>Business Date <span className="text-muted-foreground text-xs">(the day this shift's sales count toward)</span></Label>
          <Input type="date" value={date || context?.date || ""} onChange={(e) => set({ date: e.target.value })} />
          {isNightClosing && (
            <p className="text-xs text-muted-foreground">
              Closing after midnight? This still defaults to last night's date — change it if that's wrong.
            </p>
          )}
        </div>
      )}

      {!contextLoading && context && (
        <div className="rounded-lg border border-border/50 bg-muted/20 p-3 text-xs space-y-1">
          <div className="flex justify-between">
            <span className="text-muted-foreground">{phase === "opening" ? "Should tally with" : "Previous closing"}</span>
            <span className="font-medium">${context.baselineAmount.toFixed(2)}</span>
          </div>
          <div className="text-muted-foreground">{context.baselineLabel}</div>
          {phase === "closing" && (
            <div className="flex justify-between pt-1 border-t border-border/40 mt-1">
              <span className="text-muted-foreground">+ Cash Top-Ups for {context.date}</span>
              <span className="font-medium">${context.topUpsToday.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between font-semibold pt-1 border-t border-border/40 mt-1">
            <span>Expected Amount</span>
            <span>${context.expectedAmount.toFixed(2)}</span>
          </div>
          {isNightClosing && context.priorShiftDiscrepancy !== undefined && Math.abs(context.priorShiftDiscrepancy) >= 0.01 && (
            <p className="text-amber-400 pt-1">
              Morning shift had a ${Math.abs(context.priorShiftDiscrepancy).toFixed(2)} discrepancy — check if it's the same issue.
            </p>
          )}
        </div>
      )}

      {isNightClosing && (
        <div className="space-y-1.5">
          <Label>Of that, collected after midnight <span className="text-muted-foreground text-xs">(optional)</span></Label>
          <Input type="number" min="0" step="0.01" placeholder="0.00" value={cashAfterMidnight} onChange={(e) => set({ cashAfterMidnight: e.target.value })} />
          <p className="text-xs text-muted-foreground">
            It's already in the drawer total above, but it belongs to the next day's Cash Top-Ups — this excludes it from this shift's tally so a late top-up doesn't look like an unexplained gain.
          </p>
        </div>
      )}

      {isNightClosing && hasCounted && afterMidnightNum > 0 && (
        <div className="flex justify-between text-xs px-1">
          <span className="text-muted-foreground">Cash Sales for this shift's tally</span>
          <span className="font-medium">${tallyPreview!.toFixed(2)}</span>
        </div>
      )}

      {hasCounted && context && (
        <div className={`rounded-lg p-3 text-sm font-medium flex items-center gap-2 ${hasMismatch ? "bg-destructive/10 text-destructive border border-destructive/30" : "bg-green-500/10 text-green-400 border border-green-500/30"}`}>
          {hasMismatch ? <AlertTriangle className="h-4 w-4 shrink-0" /> : <CheckCircle2 className="h-4 w-4 shrink-0" />}
          {hasMismatch
            ? `Off by $${Math.abs(previewDiscrepancy!).toFixed(2)} ${previewDiscrepancy! > 0 ? "(over)" : "(short)"}`
            : "Tallies — no discrepancy"}
        </div>
      )}

      {hasMismatch && (
        <div className="space-y-1.5">
          <Label>Reason for Discrepancy</Label>
          <Input placeholder="e.g. miscounted change, unrecorded cash sale..." value={reason} onChange={(e) => set({ reason: e.target.value })} />
        </div>
      )}

      <Button onClick={handleSubmit} disabled={isPending || !hasCounted} className="w-full">
        {isPending ? "Saving..." : submitLabel}
      </Button>
    </div>
  );
}

function CashCountCard({ phase }: { phase: Phase }) {
  const { toast } = useToast();
  const [values, setValues] = useState<CountValues>(EMPTY_VALUES);
  const submit = useSubmitCashCount();

  const title = phase === "opening" ? "Start of Shift — Verify Drawer" : "End of Shift — Cash Count";
  const Icon = phase === "opening" ? CheckCircle2 : Wallet;

  return (
    <Card className="card-premium">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="h-4 w-4 text-accent" /> {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <CashCountForm
          phase={phase}
          values={values}
          onChange={setValues}
          submitLabel="Submit"
          isPending={submit.isPending}
          onSubmit={async (payload) => {
            try {
              const result = await submit.mutateAsync({ phase, ...payload });
              toast({
                title: Math.abs(result.discrepancy) < 0.01
                  ? "Tallies — cash count logged"
                  : `Discrepancy of $${Math.abs(result.discrepancy).toFixed(2)} logged`,
              });
              setValues(EMPTY_VALUES);
            } catch (e: any) {
              toast({ title: "Couldn't submit", description: e?.data?.error || e.message, variant: "destructive" });
            }
          }}
        />
      </CardContent>
    </Card>
  );
}

function EditCashCountDialog({ entry, onClose }: { entry: any | null; onClose: () => void }) {
  const { toast } = useToast();
  const editMutation = useEditCashCount();
  const [values, setValues] = useState<CountValues>(EMPTY_VALUES);

  useEffect(() => {
    if (entry) {
      setValues({
        shiftType: entry.shiftType,
        date: entry.date,
        counted: String(entry.countedAmount),
        cashAfterMidnight: entry.cashAfterMidnight ? String(entry.cashAfterMidnight) : "",
        reason: entry.reason || "",
      });
    }
  }, [entry]);

  if (!entry) return null;

  return (
    <Dialog open={!!entry} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Cash Count — {entry.date}</DialogTitle>
        </DialogHeader>
        <CashCountForm
          phase={entry.phase}
          values={values}
          onChange={setValues}
          excludeId={entry._id}
          submitLabel="Save Changes"
          isPending={editMutation.isPending}
          onSubmit={async (payload) => {
            try {
              await editMutation.mutateAsync({ id: entry._id, body: payload });
              toast({ title: "Cash count entry updated" });
              onClose();
            } catch (e: any) {
              toast({ title: "Couldn't save", description: e?.data?.error || e.message, variant: "destructive" });
            }
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

function CashCountHistory({ isMaster }: { isMaster: boolean }) {
  const { data: entries = [], isLoading } = useCashCountHistory();
  const [editing, setEditing] = useState<any | null>(null);

  return (
    <Card className="card-premium">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><History className="h-4 w-4" /> Cash Count History</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Loading…</p>
        ) : entries.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">No cash counts logged yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">Date</th>
                  <th className="pb-2 pr-4 font-medium">Shift</th>
                  <th className="pb-2 pr-4 font-medium">Phase</th>
                  <th className="pb-2 pr-4 font-medium text-right">Counted</th>
                  <th className="pb-2 pr-4 font-medium text-right">Expected</th>
                  <th className="pb-2 pr-4 font-medium">Result</th>
                  <th className="pb-2 pr-4 font-medium">Reason</th>
                  <th className="pb-2 pr-4 font-medium">By</th>
                  {isMaster && <th className="pb-2 w-8"></th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {entries.map((e: any) => {
                  const tallies = Math.abs(e.discrepancy) < 0.01;
                  return (
                    <tr key={e._id}>
                      <td className="py-2 pr-4 whitespace-nowrap">{e.date}</td>
                      <td className="py-2 pr-4 capitalize">{e.shiftType}</td>
                      <td className="py-2 pr-4 capitalize">{e.phase}</td>
                      <td className="py-2 pr-4 text-right font-mono">
                        ${e.countedAmount.toFixed(2)}
                        {e.cashAfterMidnight > 0 && (
                          <div className="text-[10px] text-muted-foreground font-sans">
                            incl. ${e.cashAfterMidnight.toFixed(2)} after midnight
                          </div>
                        )}
                      </td>
                      <td className="py-2 pr-4 text-right font-mono text-muted-foreground">${e.expectedAmount.toFixed(2)}</td>
                      <td className="py-2 pr-4">
                        {tallies ? (
                          <Badge variant="outline" className="bg-green-500/10 text-green-400 border-green-500/30">Tally</Badge>
                        ) : (
                          <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30">
                            {e.discrepancy > 0 ? "+" : "-"}${Math.abs(e.discrepancy).toFixed(2)}
                          </Badge>
                        )}
                      </td>
                      <td className="py-2 pr-4 text-muted-foreground max-w-[200px] truncate" title={e.reason}>{e.reason || "—"}</td>
                      <td className="py-2 pr-4 text-muted-foreground whitespace-nowrap">
                        {e.submittedBy?.name || e.submittedBy?.username || "—"}
                        {e.editedBy && (
                          <div className="text-[10px]" title={e.editedAt ? new Date(e.editedAt).toLocaleString("en-SG") : ""}>
                            edited by {e.editedBy?.name || e.editedBy?.username}
                          </div>
                        )}
                      </td>
                      {isMaster && (
                        <td className="py-2">
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditing(e)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
      <EditCashCountDialog entry={editing} onClose={() => setEditing(null)} />
    </Card>
  );
}

export function CashCountTab() {
  const { user } = useAuth();
  const isMaster = (user as any)?.isMaster ?? false;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CashCountCard phase="opening" />
        <CashCountCard phase="closing" />
      </div>
      <CashCountHistory isMaster={isMaster} />
    </div>
  );
}
