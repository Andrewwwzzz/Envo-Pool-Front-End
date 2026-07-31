import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldAlert } from "lucide-react";

interface PinDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  confirmLabel?: string;
  loading?: boolean;
  onConfirm: (pin: string) => void;
}

export function PinDialog({
  open,
  onOpenChange,
  title = "Enter Master PIN",
  description = "This action is permanent and cannot be undone. Enter your master PIN to confirm.",
  confirmLabel = "Confirm",
  loading = false,
  onConfirm,
}: PinDialogProps) {
  const [pin, setPin] = useState("");

  function handleConfirm() {
    if (!pin) return;
    onConfirm(pin);
  }

  function handleOpenChange(v: boolean) {
    if (!v) setPin("");
    onOpenChange(v);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <ShieldAlert className="h-5 w-5" /> {title}
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{description}</p>
        <div className="space-y-2">
          <Label htmlFor="pin-input">Master PIN</Label>
          <Input
            id="pin-input"
            type="password"
            inputMode="numeric"
            maxLength={6}
            placeholder="Enter PIN"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            onKeyDown={(e) => e.key === "Enter" && handleConfirm()}
            autoFocus
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={!pin || loading}>
            {loading ? "Processing…" : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface SetPinDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loading?: boolean;
  onConfirm: (pin: string) => void;
}

export function SetPinDialog({ open, onOpenChange, loading = false, onConfirm }: SetPinDialogProps) {
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const mismatch = pin.length >= 4 && confirm.length >= 4 && pin !== confirm;

  function handleConfirm() {
    if (pin.length < 4 || pin !== confirm) return;
    onConfirm(pin);
  }

  function handleOpenChange(v: boolean) {
    if (!v) { setPin(""); setConfirm(""); }
    onOpenChange(v);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5" /> Set Master PIN
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Set a 4–6 digit PIN that you will use to confirm permanent deletions.
        </p>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>New PIN</Label>
            <Input
              type="password"
              inputMode="numeric"
              maxLength={6}
              placeholder="4–6 digits"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            />
          </div>
          <div className="space-y-1">
            <Label>Confirm PIN</Label>
            <Input
              type="password"
              inputMode="numeric"
              maxLength={6}
              placeholder="Re-enter PIN"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value.replace(/\D/g, ""))}
              onKeyDown={(e) => e.key === "Enter" && handleConfirm()}
            />
            {mismatch && <p className="text-xs text-destructive">PINs do not match</p>}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={pin.length < 4 || pin !== confirm || loading}>
            {loading ? "Saving…" : "Set PIN"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
