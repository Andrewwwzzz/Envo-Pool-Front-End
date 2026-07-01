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
import { AlertTriangle, Loader2, Plus, Trash2 } from "lucide-react";
import { useChargeWallet, type ChargeWalletCategory } from "@/hooks/useAdmin";
import { useAdminMenu } from "@/hooks/useFnb";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api";

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

interface FnbItem {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
}

const CATEGORY_LABELS: Partial<Record<ChargeWalletCategory, string>> = {
  fnb: "F&B",
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
  const { toast } = useToast();
  const { data: fnbProducts = [] } = useAdminMenu();

  const [amount, setAmount] = useState<string>("");
  const [category, setCategory] = useState<ChargeWalletCategory>(defaultCategory);
  const [description, setDescription] = useState("");
  const [allowNegative, setAllowNegative] = useState(false);
  const [fnbItems, setFnbItems] = useState<FnbItem[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [selectedQuantity, setSelectedQuantity] = useState<string>("1");

  useEffect(() => {
    if (open) {
      setAmount(defaultAmount != null ? String(defaultAmount) : "");
      setCategory(defaultCategory);
      setDescription(defaultDescription ?? "");
      setAllowNegative(false);
      setFnbItems([]);
    }
  }, [open, defaultAmount, defaultCategory, defaultDescription]);

  const amt = Number.parseFloat(amount || "0");
  const validAmount = Number.isFinite(amt) && amt > 0;
  const newBalance = useMemo(() => currentBalance - (validAmount ? amt : 0), [currentBalance, amt, validAmount]);
  const willGoNegative = validAmount && newBalance < 0;
  const isFnbCategory = category === "fnb";

  const canSubmit = isFnbCategory
    ? fnbItems.length > 0 && !charge.isPending
    : validAmount &&
      description.trim().length > 0 &&
      (!willGoNegative || allowNegative) &&
      !charge.isPending;

  const addFnbItem = () => {
    if (!selectedProductId || !selectedQuantity) return;

    const product = fnbProducts.find((p) => p._id === selectedProductId);
    if (!product) return;

    const qty = Math.max(1, parseInt(selectedQuantity) || 1);
    const unitPrice = Number(product.sellingPrice ?? product.price ?? 0);
    const newItem: FnbItem = {
      productId: product._id,
      productName: product.name,
      quantity: qty,
      price: unitPrice,
    };

    const updatedItems = [...fnbItems, newItem];
    setFnbItems(updatedItems);
    const totalFnbAmount = updatedItems.reduce((sum, item) => sum + item.quantity * item.price, 0);
    setAmount(String(totalFnbAmount.toFixed(2)));

    setSelectedProductId("");
    setSelectedQuantity("1");
  };

  const removeFnbItem = (index: number) => {
    const updated = fnbItems.filter((_, i) => i !== index);
    setFnbItems(updated);
    const totalFnbAmount = updated.reduce((sum, item) => sum + item.quantity * item.price, 0);
    setAmount(totalFnbAmount > 0 ? String(totalFnbAmount.toFixed(2)) : "");
  };

  const submit = async () => {
    if (!canSubmit) return;
    try {
      if (isFnbCategory && fnbItems.length > 0) {
        // Call /api/fnb/orders/staff once per unit so each item becomes a real FnbOrder
        // (pending → staff marks served in FnB tab; stock decremented; correct transaction description)
        for (const item of fnbItems) {
          for (let i = 0; i < item.quantity; i++) {
            const res = await apiFetch("/api/fnb/orders/staff", {
              method: "POST",
              body: JSON.stringify({ userId, productId: item.productId }),
            });
            if (!res.ok) {
              const err = await res.json().catch(() => ({}));
              toast({ title: "Order failed", description: err.error || `Failed to order ${item.productName}`, variant: "destructive" });
              return;
            }
          }
        }
        onCharged?.();
        onOpenChange(false);
      } else {
        await charge.mutateAsync({
          userId,
          amount: amt,
          category,
          description: description.trim(),
          allowNegative,
        });
        onCharged?.();
        onOpenChange(false);
      }
    } catch {
      /* errors surface via toast in hook or handled above */
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
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
            <Label>Category</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as ChargeWalletCategory)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(CATEGORY_LABELS).map(([k, label]) => (
                  <SelectItem key={k} value={k}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* FNB Items Section */}
          {isFnbCategory && (
            <div className="rounded-lg border border-border/50 bg-muted/20 p-3 space-y-3">
              <p className="text-sm font-medium">F&B Items</p>

              {fnbItems.length > 0 && (
                <div className="space-y-2 max-h-[200px] overflow-y-auto">
                  {fnbItems.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between rounded bg-background p-2 border border-border/30"
                    >
                      <div className="flex-1">
                        <p className="text-sm font-medium">{item.productName}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.quantity}x @ ${Number(item.price ?? 0).toFixed(2)} = ${(item.quantity * Number(item.price ?? 0)).toFixed(2)}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removeFnbItem(idx)}
                        className="h-8 w-8 p-0"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {fnbItems.length > 0 && (
                <div className="flex items-center justify-between rounded-md bg-muted px-3 py-2 text-sm font-semibold">
                  <span>Total</span>
                  <span>${Number(amount || 0).toFixed(2)}</span>
                </div>
              )}

              <div className="space-y-2 border-t border-border/30 pt-3">
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                      <SelectTrigger className="text-sm">
                        <SelectValue placeholder="Select item" />
                      </SelectTrigger>
                      <SelectContent>
                        {fnbProducts.map((product) => (
                          <SelectItem key={product._id} value={product._id}>
                            {product.name} (${Number(product.sellingPrice ?? product.price ?? 0).toFixed(2)})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Input
                    type="number"
                    min="1"
                    step="1"
                    value={selectedQuantity}
                    onChange={(e) => setSelectedQuantity(e.target.value)}
                    placeholder="Qty"
                    className="text-sm"
                  />
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={addFnbItem}
                  disabled={!selectedProductId}
                  className="w-full"
                >
                  <Plus className="mr-1 h-3 w-3" /> Add Item
                </Button>
              </div>
            </div>
          )}

          <div className="space-y-1.5" style={{ display: isFnbCategory ? "none" : undefined }}>
            <Label htmlFor="charge-amount">Amount ($)</Label>
            <Input
              id="charge-amount"
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              autoFocus={!isFnbCategory}
            />
          </div>

          {!isFnbCategory && (
            <div className="space-y-1.5">
              <Label htmlFor="charge-desc">
                Description / reason <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="charge-desc"
                rows={3}
                placeholder="e.g. Manual timer session"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Shown to the customer in their transaction history.</p>
            </div>
          )}

          {validAmount && (
            <div className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
              <span className="text-muted-foreground">Balance after charge</span>
              <span className={`font-semibold ${newBalance < 0 ? "text-destructive" : ""}`}>
                ${newBalance.toFixed(2)}
              </span>
            </div>
          )}

          {willGoNegative && !isFnbCategory && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm">
              <AlertTriangle className="h-4 w-4 mt-0.5 text-destructive shrink-0" />
              <div className="space-y-2">
                <p className="text-destructive">Charge exceeds the customer's wallet balance.</p>
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
