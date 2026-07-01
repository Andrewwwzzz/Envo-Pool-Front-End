import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertTriangle, Loader2 } from "lucide-react";
import { useChargeWallet, type ChargeWalletCategory } from "@/hooks/useAdmin";

interface ChargeWalletDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  userId: string;
  customerName?: string | null;
  currentBalance?: number;
  defaultCategory?: ChargeWalletCategory;
  defaultAmount?: number;
  defaultDescription?: string;
  onCharged?: () => void;
}

const CATEGORY_LABELS: Record<ChargeWalletCategory, string> = {
  manual_timer: "Manual Timer",
  fnb: "F&B",
  locker: "Locker",
  merchandise: "Merchandise",
  other: "Other",
};

export function ChargeWalletDialog({
  open,
  onOpenChange,
  userId,
  customerName,
  currentBalance = 0,
  defaultCategory = "fnb",
  defaultAmount,
  defaultDescription,
  onCharged,
}: ChargeWalletDialogProps) {
  const charge = useChargeWallet();
  const [amount, setAmount] = useState<string>("");
  const [category, setCategory] = useState<ChargeWalletCategory>(defaultCategory);
  const [description, setDescription] = useState("");
  const [allowNegative, setAllowNegative] = useState(false);

  useEffect(() => {
    if (open) {
      setAmount(defaultAmount != null ? String(defaultAmount) : "");
      setCategory(defaultCategory);
      setDescription(defaultDescription ?? "");
      setAllowNegative(false);
    }
  }, [open, defaultAmount, defaultCategory, defaultDescription]);

  const amt = Number.parseFloat(amount || "0");
  const validAmount = Number.isFinite(amt) && amt > 0;
  const newBalance = useMemo(() => currentBalance - (validAmount ? amt : 0), [currentBalance, amt, validAmount]);
  const willGoNegative = validAmount && newBalance < 0;
  const canSubmit =
    validAmount &&
    description.trim().length > 0 &&
    (!willGoNegative || allowNegative) &&
    !charge.isPending;

  const submit = async () => {
    if (!canSubmit) return;
    try {
      await charge.mutateAsync({
        userId,
        amount: amt,
        category,
        description: description.trim(),
        allowNegative,
      });
      onCharged?.();
      onOpenChange(false);
    } catch {
      /* toast handled in hook */
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Charge Wallet</DialogTitle>
          <DialogDescription>
            {customerName ? (
              <>
                Charging <strong>{customerName}</strong>'s wallet.
              </>
            ) : (
              <>Charge this customer's wallet.</>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
            <span className="text-muted-foreground">Current balance</span>
            <span className="font-semibold">${currentBalance.toFixed(2)}</span>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="charge-amount">Amount ($)</Label>
            <Input
              id="charge-amount"
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label>Category</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as ChargeWalletCategory)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(CATEGORY_LABELS).map(([k, label]) => (
                  <SelectItem key={k} value={k}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="charge-desc">Description / reason <span className="text-destructive">*</span></Label>
            <Textarea
              id="charge-desc"
              rows={3}
              placeholder="e.g. 2x Heineken + 1x fries"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Shown to the customer in their transaction history.</p>
          </div>

          {validAmount && (
            <div className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
              <span className="text-muted-foreground">Balance after charge</span>
              <span className={`font-semibold ${newBalance < 0 ? "text-destructive" : ""}`}>
                ${newBalance.toFixed(2)}
              </span>
            </div>
          )}

          {willGoNegative && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm">
              <AlertTriangle className="h-4 w-4 mt-0.5 text-destructive shrink-0" />
              <div className="space-y-2">
                <p className="text-destructive">
                  Charge exceeds the customer's wallet balance.
                </p>
                <label className="flex items-center gap-2 text-xs">
                  <Checkbox
                    checked={allowNegative}
                    onCheckedChange={(v) => setAllowNegative(v === true)}
                  />
                  Allow negative balance
                </label>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={charge.isPending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!canSubmit}>
            {charge.isPending ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
            Charge ${validAmount ? amt.toFixed(2) : "0.00"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
