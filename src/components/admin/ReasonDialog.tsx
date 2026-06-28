import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";

export interface ReasonDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description?: string;
  label?: string;
  placeholder?: string;
  confirmLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: (reason: string) => void | Promise<void>;
}

/**
 * Reusable confirmation dialog with a MANDATORY reason field.
 * Confirm button is disabled until reason is non-empty.
 */
export default function ReasonDialog({
  open,
  onOpenChange,
  title,
  description,
  label = "Reason",
  placeholder = "Please provide a reason…",
  confirmLabel = "Confirm",
  destructive = false,
  loading = false,
  onConfirm,
}: ReasonDialogProps) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setReason("");
      setError(null);
    }
  }, [open]);

  const submit = async () => {
    const trimmed = reason.trim();
    if (!trimmed) {
      setError("Please provide a reason");
      return;
    }
    setError(null);
    await onConfirm(trimmed);
  };

  const disabled = loading || !reason.trim();

  return (
    <Dialog open={open} onOpenChange={(o) => !loading && onOpenChange(o)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="reason-dialog-input">{label} <span className="text-destructive">*</span></Label>
          <Textarea
            id="reason-dialog-input"
            value={reason}
            onChange={(e) => {
              setReason(e.target.value.slice(0, 500));
              if (error) setError(null);
            }}
            placeholder={placeholder}
            maxLength={500}
            rows={3}
            autoFocus
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
          <p className="text-xs text-muted-foreground">{reason.length}/500</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Go Back</Button>
          <Button
            variant={destructive ? "destructive" : "default"}
            onClick={submit}
            disabled={disabled}
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
