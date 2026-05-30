import { useMemo, useState } from "react";
import { useAdminRewards, useIssueReward, useDeleteReward, RewardType, RewardReason } from "@/hooks/useRewards";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Gift, Copy, Loader2, Check, Trash2, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { fmtDateSG } from "@/lib/sgTime";
import ReasonDialog from "./ReasonDialog";
import DeletedBanner, { getDeletedInfo, isDeleted } from "./DeletedBanner";
import { useAdminCustomers } from "@/hooks/useAdmin";

const TYPE_LABELS: Record<RewardType, string> = {
  free_session: "Free Session (1 hr)",
  wallet_credit: "Wallet Credit",
  free_item: "Free Item",
  booking_discount: "Booking Discount",
};

const REASON_LABELS: Record<RewardReason, string> = {
  reviews: "Reviews",
  social_follow: "Social Follow",
  birthday: "Birthday",
  refund: "Refund",
  other: "Other",
};

export default function CustomerRewardsSection({ userId }: { userId: string }) {
  const { toast } = useToast();
  const { data: rewards, isLoading } = useAdminRewards(userId);
  const issueReward = useIssueReward();
  const deleteReward = useDeleteReward();
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [detailRecord, setDetailRecord] = useState<any | null>(null);
  const [showDeleted, setShowDeleted] = useState(false);

  const visibleRewards = useMemo(
    () => (rewards || []).filter((r: any) => showDeleted || !isDeleted(r)),
    [rewards, showDeleted],
  );

  const [open, setOpen] = useState(false);
  const [type, setType] = useState<RewardType>("free_session");
  const [value, setValue] = useState("1");
  const [description, setDescription] = useState("");
  const [reason, setReason] = useState<RewardReason>("reviews");
  const [otherReason, setOtherReason] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [qty, setQty] = useState("1");
  const [issueMode, setIssueMode] = useState<"single" | "multi" | "unlimited">("single");
  const [issuedCodes, setIssuedCodes] = useState<string[] | null>(null);

  const valueLabel =
    type === "free_session" ? "Sessions (1 hr each)" :
    type === "wallet_credit" ? "Amount ($)" :
    type === "booking_discount" ? "Percent off (%)" : null;

  const reset = () => {
    setType("free_session"); setValue("1"); setDescription(""); setReason("reviews"); setOtherReason(""); setExpiresAt("");
    setQty("1"); setIssueMode("single");
  };

  const submit = async () => {
    if (!description.trim()) {
      toast({ title: "Description required", variant: "destructive" });
      return;
    }
    if (reason === "other" && !otherReason.trim()) {
      toast({ title: "Please specify the reason", variant: "destructive" });
      return;
    }
    const isWalletCredit = type === "wallet_credit";
    const mode = isWalletCredit ? "single" : issueMode;
    const qtyNum = mode === "multi"
      ? Math.max(1, Math.min(100, parseInt(qty) || 1))
      : 1;
    const payload: any = {
      userId,
      type,
      description: description.trim(),
      reason: reason === "other" ? otherReason.trim() : reason,
      expiresAt: expiresAt || null,
      qty: mode === "unlimited" ? 0 : qtyNum,
      multiUse: mode !== "single",
      unlimited: mode === "unlimited",
    };
    if (type !== "free_item") {
      const v = parseFloat(value);
      if (!Number.isFinite(v) || v <= 0) {
        toast({ title: "Invalid value", variant: "destructive" });
        return;
      }
      payload.value = v;
    }
    try {
      const result: any = await issueReward.mutateAsync(payload);
      setOpen(false);
      reset();
      const codes: string[] = Array.isArray(result?.codes) && result.codes.length
        ? result.codes
        : (result?.rewards?.map((r: any) => r.code).filter(Boolean) ||
           (result?.code ? [result.code] : (result?.reward?.code ? [result.reward.code] : [])));
      if (codes.length) setIssuedCodes(codes);
      else toast({ title: "Reward issued" });
    } catch {}
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Gift className="h-4 w-4 text-accent" /> Rewards
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={showDeleted ? "secondary" : "outline"}
              onClick={() => setShowDeleted((v) => !v)}
            >
              {showDeleted ? <EyeOff className="h-3 w-3 mr-1" /> : <Eye className="h-3 w-3 mr-1" />}
              {showDeleted ? "Hide Deleted" : "Show Deleted"}
            </Button>
            <Button size="sm" onClick={() => setOpen(true)}>
              <Gift className="mr-1 h-3 w-3" /> Issue Reward
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-muted-foreground text-sm">Loading rewards…</p>
        ) : !visibleRewards.length ? (
          <p className="text-muted-foreground text-sm">No rewards to show.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="pb-2 pr-4">Code</th>
                  <th className="pb-2 pr-4">Type</th>
                  <th className="pb-2 pr-4">Description</th>
                  <th className="pb-2 pr-4">Issued</th>
                  <th className="pb-2">Status</th>
                  <th className="pb-2"></th>
                </tr>
              </thead>
              <tbody>
                {visibleRewards.map((r: any) => {
                  const deleted = isDeleted(r);
                  return (
                    <tr
                      key={r._id || r.id || r.code}
                      className={`border-b border-border last:border-0 ${deleted ? "text-muted-foreground cursor-pointer" : ""}`}
                      onClick={deleted ? () => setDetailRecord(r) : undefined}
                    >
                      <td className="py-2 pr-4">
                        <div className="flex items-center gap-1">
                          <span className={`font-mono text-xs ${deleted ? "line-through" : ""}`}>{r.code}</span>
                          {!deleted && (
                            <Button
                              size="sm" variant="ghost" className="h-6 w-6 p-0"
                              onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(r.code); toast({ title: "Code copied" }); }}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </td>
                      <td className="py-2 pr-4">
                        <Badge variant="outline" className="capitalize">{TYPE_LABELS[r.type as RewardType] || r.type}</Badge>
                      </td>
                      <td className={`py-2 pr-4 ${deleted ? "line-through" : ""}`}>{r.description}</td>
                      <td className="py-2 pr-4">{fmtDateSG(r.createdAt || r.created_at)}</td>
                      <td className="py-2">
                        {deleted ? (
                          <Badge variant="outline" className="bg-muted">Deleted</Badge>
                        ) : (() => {
                          if (r.unlimited) return <Badge>Unlimited uses</Badge>;
                          const allowed = Number(r.usesAllowed);
                          const remaining = Number(r.usesRemaining);
                          const isMulti = Number.isFinite(allowed) && allowed > 1;
                          if (isMulti) {
                            if (Number.isFinite(remaining) && remaining <= 0) {
                              return <Badge variant="outline" className="bg-muted">Redeemed</Badge>;
                            }
                            return <Badge>{remaining}/{allowed} uses remaining</Badge>;
                          }
                          return r.redeemed
                            ? <Badge variant="outline" className="bg-muted">Redeemed</Badge>
                            : <Badge>Active</Badge>;
                        })()}
                      </td>
                      <td className="py-2 text-right">
                        {!deleted && !r.redeemed && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                            onClick={(e) => { e.stopPropagation(); setDeleteTarget(r); }}
                            disabled={deleteReward.isPending}
                            title="Delete reward"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      <ReasonDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="Delete reward?"
        description="This action cannot be undone."
        label="Reason for deletion"
        placeholder="e.g. issued in error"
        confirmLabel="Delete"
        destructive
        loading={deleteReward.isPending}
        onConfirm={async (reason) => {
          if (!deleteTarget) return;
          try {
            await deleteReward.mutateAsync({ id: deleteTarget._id || deleteTarget.id, userId, reason });
            setDeleteTarget(null);
          } catch {}
        }}
      />

      <Dialog open={!!detailRecord} onOpenChange={(o) => !o && setDetailRecord(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reward {detailRecord?.code}</DialogTitle>
          </DialogHeader>
          {detailRecord && (
            <div className="space-y-3">
              <DeletedBanner info={getDeletedInfo(detailRecord)} />
              <div className="opacity-70 text-sm space-y-1.5">
                <div className="flex justify-between gap-3"><span className="text-muted-foreground">Code</span><span className="font-mono text-xs">{detailRecord.code}</span></div>
                <div className="flex justify-between gap-3"><span className="text-muted-foreground">Type</span><span>{TYPE_LABELS[detailRecord.type as RewardType] || detailRecord.type}</span></div>
                <div className="flex justify-between gap-3"><span className="text-muted-foreground">Description</span><span>{detailRecord.description || "—"}</span></div>
                <div className="flex justify-between gap-3"><span className="text-muted-foreground">Issued</span><span>{fmtDateSG(detailRecord.createdAt || detailRecord.created_at)}</span></div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>


      <Dialog open={open} onOpenChange={(o) => { if (!o) { setOpen(false); reset(); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Issue Reward</DialogTitle>
            <DialogDescription>Generate a reward code for this customer.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as RewardType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="free_session">Free Session (1 hr)</SelectItem>
                  <SelectItem value="wallet_credit">Wallet Credit</SelectItem>
                  <SelectItem value="free_item">Free Item</SelectItem>
                  <SelectItem value="booking_discount">Booking Discount</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {valueLabel && (
              <div className="space-y-2">
                <Label>{valueLabel}</Label>
                <Input type="number" step="0.01" min="0" value={value} onChange={(e) => setValue(e.target.value)} />
              </div>
            )}
            <div className="space-y-2">
              <Label>Description (shown to customer)</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder='e.g. "1 hour free pool session — Birthday gift!"'
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label>Reason</Label>
              <Select value={reason} onValueChange={(v) => setReason(v as RewardReason)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(REASON_LABELS) as RewardReason[]).map(k => (
                    <SelectItem key={k} value={k}>{REASON_LABELS[k]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {reason === "other" && (
                <Input
                  value={otherReason}
                  onChange={(e) => setOtherReason(e.target.value)}
                  placeholder="Specify reason"
                />
              )}
            </div>
            <div className="space-y-2">
              <Label>Expires At (optional)</Label>
              <Input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
            </div>
            {type !== "wallet_credit" && (
              <>
                <div className="space-y-2">
                  <Label>Issue Mode</Label>
                  <Select value={issueMode} onValueChange={(v) => setIssueMode(v as any)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="single">Single use (1 code, used once)</SelectItem>
                      <SelectItem value="multi">Multiple uses (1 code, used N times)</SelectItem>
                      <SelectItem value="unlimited">Unlimited (1 code, used forever)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {issueMode === "multi" && (
                  <div className="space-y-2">
                    <Label>Quantity</Label>
                    <Input
                      type="number" min="1" max="100" step="1"
                      value={qty}
                      onChange={(e) => setQty(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">Number of times this code can be redeemed</p>
                  </div>
                )}
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setOpen(false); reset(); }} disabled={issueReward.isPending}>Cancel</Button>
            <Button onClick={submit} disabled={issueReward.isPending}>
              {issueReward.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
              Issue Reward
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!issuedCodes} onOpenChange={(o) => { if (!o) setIssuedCodes(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reward Issued 🎁</DialogTitle>
            <DialogDescription>
              {issuedCodes && issuedCodes.length > 1
                ? `${issuedCodes.length} codes generated — share with the customer.`
                : "Share this code with the customer."}
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border-2 border-dashed border-accent/40 bg-accent/5 p-6 text-center space-y-2 max-h-72 overflow-y-auto">
            <p className="text-xs text-muted-foreground mb-2">
              {issuedCodes && issuedCodes.length > 1 ? "Reward Codes" : "Reward Code"}
            </p>
            {issuedCodes?.map((c) => (
              <div key={c} className="flex items-center justify-center gap-2">
                <p className="text-2xl font-mono font-bold tracking-wider gold-gradient">{c}</p>
                <Button
                  size="sm" variant="ghost" className="h-7 w-7 p-0"
                  onClick={() => { navigator.clipboard.writeText(c); toast({ title: "Code copied" }); }}
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
          <DialogFooter>
            {issuedCodes && issuedCodes.length > 0 && (
              <Button
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(issuedCodes.join("\n"));
                  toast({ title: "All codes copied" });
                }}
              >
                <Copy className="mr-2 h-4 w-4" /> Copy {issuedCodes.length > 1 ? "All" : "Code"}
              </Button>
            )}
            <Button onClick={() => setIssuedCodes(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
