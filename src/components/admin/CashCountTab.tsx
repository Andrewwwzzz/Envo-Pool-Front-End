import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api";
import { Wallet, CheckCircle2, AlertTriangle, History } from "lucide-react";

type Phase = "opening" | "closing";
type ShiftType = "morning" | "night";

function useCashCountContext(phase: Phase, shiftType: ShiftType) {
  return useQuery({
    queryKey: ["cashcount-context", phase, shiftType],
    queryFn: async () => {
      const r = await apiFetch(`/api/cashcount/context?phase=${phase}`);
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
    onSuccess: (_data, _vars, _ctx) => {
      qc.invalidateQueries({ queryKey: ["cashcount-context"] });
      qc.invalidateQueries({ queryKey: ["cashcount-history"] });
    },
  });
}

function CashCountCard({ phase }: { phase: Phase }) {
  const { toast } = useToast();
  const [shiftType, setShiftType] = useState<ShiftType>("morning");
  const [counted, setCounted] = useState("");
  const [cashAfterMidnight, setCashAfterMidnight] = useState("");
  const [reason, setReason] = useState("");

  const { data: context, isLoading: contextLoading } = useCashCountContext(phase, shiftType);
  const submit = useSubmitCashCount();

  const isNightClosing = phase === "closing" && shiftType === "night";
  const countedNum = parseFloat(counted);
  const hasCounted = counted.trim() !== "" && !isNaN(countedNum);
  const afterMidnightNum = isNightClosing && cashAfterMidnight.trim() !== "" && !isNaN(parseFloat(cashAfterMidnight))
    ? parseFloat(cashAfterMidnight)
    : 0;
  // The after-midnight portion is physically in the drawer (counted) but
  // belongs to tomorrow's Cash Top-Ups — it must be excluded from tonight's
  // tally check, or a late top-up would look like an unexplained gain.
  const tallyPreview = hasCounted ? Math.round((countedNum - afterMidnightNum) * 100) / 100 : null;
  const expected = context?.expectedAmount ?? 0;
  const previewDiscrepancy = tallyPreview !== null && context ? Math.round((tallyPreview - expected) * 100) / 100 : null;
  const hasMismatch = previewDiscrepancy !== null && Math.abs(previewDiscrepancy) >= 0.01;

  const handleSubmit = async () => {
    if (!hasCounted || countedNum < 0) {
      toast({ title: "Enter the cash counted in the drawer", variant: "destructive" });
      return;
    }
    if (hasMismatch && !reason.trim()) {
      toast({ title: "There's a discrepancy — please write down the reason", variant: "destructive" });
      return;
    }
    try {
      const result = await submit.mutateAsync({
        phase,
        shiftType,
        countedAmount: countedNum,
        reason: reason.trim(),
        ...(phase === "closing" && shiftType === "night" && cashAfterMidnight.trim() !== ""
          ? { cashAfterMidnight: parseFloat(cashAfterMidnight) }
          : {}),
      });
      toast({
        title: Math.abs(result.discrepancy) < 0.01
          ? "Tallies — cash count logged"
          : `Discrepancy of $${Math.abs(result.discrepancy).toFixed(2)} logged`,
      });
      setCounted("");
      setReason("");
      setCashAfterMidnight("");
    } catch (e: any) {
      toast({ title: "Couldn't submit", description: e?.data?.error || e.message, variant: "destructive" });
    }
  };

  const title = phase === "opening" ? "Start of Shift — Verify Drawer" : "End of Shift — Cash Count";
  const Icon = phase === "opening" ? CheckCircle2 : Wallet;

  return (
    <Card className="card-premium">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="h-4 w-4 text-accent" /> {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Shift</Label>
            <div className="flex gap-2">
              <Button type="button" size="sm" variant={shiftType === "morning" ? "default" : "outline"} className="flex-1" onClick={() => setShiftType("morning")}>Morning</Button>
              <Button type="button" size="sm" variant={shiftType === "night" ? "default" : "outline"} className="flex-1" onClick={() => setShiftType("night")}>Night</Button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>{isNightClosing ? "Total Cash in Drawer" : "Cash in Drawer"} (SGD)</Label>
            <Input type="number" min="0" step="0.01" placeholder="0.00" value={counted} onChange={(e) => setCounted(e.target.value)} />
          </div>
        </div>

        {!contextLoading && context && (
          <div className="rounded-lg border border-border/50 bg-muted/20 p-3 text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{phase === "opening" ? "Should tally with" : "Yesterday's closing"}</span>
              <span className="font-medium">${context.baselineAmount.toFixed(2)}</span>
            </div>
            <div className="text-muted-foreground">{context.baselineLabel}</div>
            {phase === "closing" && (
              <div className="flex justify-between pt-1 border-t border-border/40 mt-1">
                <span className="text-muted-foreground">+ Today's Cash Top-Ups so far</span>
                <span className="font-medium">${context.topUpsToday.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between font-semibold pt-1 border-t border-border/40 mt-1">
              <span>Expected Amount</span>
              <span>${context.expectedAmount.toFixed(2)}</span>
            </div>
            {phase === "closing" && shiftType === "night" && context.priorShiftDiscrepancy !== undefined && Math.abs(context.priorShiftDiscrepancy) >= 0.01 && (
              <p className="text-amber-400 pt-1">
                Morning shift had a ${Math.abs(context.priorShiftDiscrepancy).toFixed(2)} discrepancy — check if it's the same issue.
              </p>
            )}
          </div>
        )}

        {isNightClosing && (
          <div className="space-y-1.5">
            <Label>Of that, collected after midnight <span className="text-muted-foreground text-xs">(optional)</span></Label>
            <Input type="number" min="0" step="0.01" placeholder="0.00" value={cashAfterMidnight} onChange={(e) => setCashAfterMidnight(e.target.value)} />
            <p className="text-xs text-muted-foreground">
              It's already in the drawer total above, but it belongs to tomorrow's Cash Top-Ups — this excludes it from tonight's tally so a late top-up doesn't look like an unexplained gain.
            </p>
          </div>
        )}

        {isNightClosing && hasCounted && afterMidnightNum > 0 && (
          <div className="flex justify-between text-xs px-1">
            <span className="text-muted-foreground">Cash Sales for tonight's tally</span>
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
            <Input placeholder="e.g. miscounted change, unrecorded cash sale..." value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
        )}

        <Button onClick={handleSubmit} disabled={submit.isPending || !hasCounted} className="w-full">
          {submit.isPending ? "Submitting..." : "Submit"}
        </Button>
      </CardContent>
    </Card>
  );
}

function CashCountHistory() {
  const { data: entries = [], isLoading } = useCashCountHistory();

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
                      <td className="py-2 pr-4 text-muted-foreground whitespace-nowrap">{e.submittedBy?.name || e.submittedBy?.username || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function CashCountTab() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CashCountCard phase="opening" />
        <CashCountCard phase="closing" />
      </div>
      <CashCountHistory />
    </div>
  );
}
