import { useState } from "react";
import { useAdminRewards, useIssueReward, useDeleteReward, RewardType, RewardReason } from "@/hooks/useRewards";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Gift, Copy, Loader2, Check, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { fmtDateSG } from "@/lib/sgTime";

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
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [open, setOpen] = useState(false);
  const [type, setType] = useState<RewardType>("free_session");
  const [value, setValue] = useState("1");
  const [description, setDescription] = useState("");
  const [reason, setReason] = useState<RewardReason>("reviews");
  const [otherReason, setOtherReason] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [qty, setQty] = useState("1");
  const [multiUse, setMultiUse] = useState(false);
  const [issuedCodes, setIssuedCodes] = useState<string[] | null>(null);

  const valueLabel =
    type === "free_session" ? "Sessions (1 hr each)" :
    type === "wallet_credit" ? "Amount ($)" :
    type === "booking_discount" ? "Percent off (%)" : null;

  const reset = () => {
    setType("free_session"); setValue("1"); setDescription(""); setReason("reviews"); setOtherReason(""); setExpiresAt("");
    setQty("1"); setMultiUse(false);
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
    const qtyNum = Math.max(1, Math.min(20, parseInt(qty) || 1));
    const payload: any = {
      userId,
      type,
      description: description.trim(),
      reason: reason === "other" ? otherReason.trim() : reason,
      expiresAt: expiresAt || null,
      qty: qtyNum,
      multiUse: qtyNum > 1 ? multiUse : false,
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
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Gift className="h-4 w-4 text-accent" /> Rewards
          </CardTitle>
          <Button size="sm" onClick={() => setOpen(true)}>
            <Gift className="mr-1 h-3 w-3" /> Issue Reward
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-muted-foreground text-sm">Loading rewards…</p>
        ) : !rewards?.length ? (
          <p className="text-muted-foreground text-sm">No rewards issued yet.</p>
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
                {rewards.map((r: any) => (
                  <tr key={r._id || r.id || r.code} className="border-b border-border last:border-0">
                    <td className="py-2 pr-4">
                      <div className="flex items-center gap-1">
                        <span className="font-mono text-xs">{r.code}</span>
                        <Button
                          size="sm" variant="ghost" className="h-6 w-6 p-0"
                          onClick={() => { navigator.clipboard.writeText(r.code); toast({ title: "Code copied" }); }}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </td>
                    <td className="py-2 pr-4">
                      <Badge variant="outline" className="capitalize">{TYPE_LABELS[r.type as RewardType] || r.type}</Badge>
                    </td>
                    <td className="py-2 pr-4">{r.description}</td>
                    <td className="py-2 pr-4">{fmtDateSG(r.createdAt || r.created_at)}</td>
                    <td className="py-2">
                      {r.redeemed ? (
                        <Badge variant="outline" className="bg-muted">Redeemed</Badge>
                      ) : (
                        <Badge>Active</Badge>
                      )}
                    </td>
                    <td className="py-2 text-right">
                      {!r.redeemed && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                          onClick={() => setDeleteId(r._id || r.id)}
                          disabled={deleteReward.isPending}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => { if (!o) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete reward?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this reward? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteReward.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async (e) => {
                e.preventDefault();
                if (!deleteId) return;
                try {
                  await deleteReward.mutateAsync({ id: deleteId, userId });
                  setDeleteId(null);
                } catch {}
              }}
              disabled={deleteReward.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteReward.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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

      <Dialog open={!!issuedCode} onOpenChange={(o) => { if (!o) setIssuedCode(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reward Issued 🎁</DialogTitle>
            <DialogDescription>Share this code with the customer.</DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border-2 border-dashed border-accent/40 bg-accent/5 p-6 text-center">
            <p className="text-xs text-muted-foreground mb-2">Reward Code</p>
            <p className="text-2xl font-mono font-bold tracking-wider gold-gradient">{issuedCode}</p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { if (issuedCode) { navigator.clipboard.writeText(issuedCode); toast({ title: "Copied" }); } }}
            >
              <Copy className="mr-2 h-4 w-4" /> Copy Code
            </Button>
            <Button onClick={() => setIssuedCode(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
