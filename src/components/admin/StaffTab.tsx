import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, Pencil, Trash2, RotateCcw, ShieldAlert } from "lucide-react";
import {
  ALL_PERMISSIONS,
  useStaffList,
  usePromoteStaff,
  useUpdateStaffPermissions,
  useRemoveStaff,
  useRestoreRecord,
  useAdminCustomers,
  useSetMasterPin,
} from "@/hooks/useAdmin";
import { SetPinDialog } from "@/components/admin/PinDialog";

const RESTORE_TYPES = [
  { value: "user", label: "User (deleted account)" },
  { value: "booking", label: "Booking" },
  { value: "fnb-product", label: "F&B Product" },
  { value: "membership-plan", label: "Membership Plan" },
  { value: "locker-unit", label: "Locker Unit" },
  { value: "locker-rental", label: "Locker Rental" },
  { value: "timer-session", label: "Timer Session (Invoice)" },
];

function PermissionCheckboxes({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (v: string[]) => void;
}) {
  const toggle = (key: string) => {
    onChange(selected.includes(key) ? selected.filter((k) => k !== key) : [...selected, key]);
  };
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {ALL_PERMISSIONS.map(({ key, label }) => (
        <label key={key} className="flex items-center gap-2 cursor-pointer select-none text-sm">
          <Checkbox checked={selected.includes(key)} onCheckedChange={() => toggle(key)} />
          {label}
        </label>
      ))}
    </div>
  );
}

function PromoteStaffDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<any | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const { data: customers = [] } = useAdminCustomers(search);
  const promote = usePromoteStaff();

  const reset = () => { setSearch(""); setSelected(null); setPermissions([]); };

  const submit = async () => {
    if (!selected) return;
    try {
      await promote.mutateAsync({ userId: selected._id ?? selected.id, permissions });
      reset();
      onOpenChange(false);
    } catch {/* toast in hook */}
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Assign Staff Role</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Search User</Label>
            <Input
              placeholder="Name or email..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setSelected(null); }}
            />
            {search && !selected && (
              <div className="max-h-40 overflow-y-auto rounded-md border">
                {customers.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-muted-foreground">No users found</div>
                ) : customers.slice(0, 15).map((c: any) => (
                  <button
                    key={c._id ?? c.id} type="button"
                    onClick={() => { setSelected(c); setSearch(""); }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-muted"
                  >
                    <div className="font-medium">{c.name || "—"}</div>
                    <div className="text-xs text-muted-foreground">{c.email}</div>
                  </button>
                ))}
              </div>
            )}
            {selected && (
              <div className="flex items-center justify-between rounded-md border px-3 py-2 bg-muted/40">
                <div>
                  <div className="text-sm font-medium">{selected.name}</div>
                  <div className="text-xs text-muted-foreground">{selected.email}</div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>Change</Button>
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Label>Allowed Sections</Label>
            <PermissionCheckboxes selected={permissions} onChange={setPermissions} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={promote.isPending || !selected}>
            {promote.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Assign Role
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditPermissionsDialog({
  staff,
  open,
  onOpenChange,
}: {
  staff: any;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [permissions, setPermissions] = useState<string[]>(staff?.staffPermissions ?? []);
  const update = useUpdateStaffPermissions();

  const submit = async () => {
    try {
      await update.mutateAsync({ id: staff._id ?? staff.id, permissions });
      onOpenChange(false);
    } catch {/* toast in hook */}
  };

  // Reset when staff changes
  if (open && permissions.length === 0 && (staff?.staffPermissions ?? []).length > 0) {
    setPermissions(staff.staffPermissions);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Permissions — {staff?.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Label>Allowed Sections</Label>
          <PermissionCheckboxes selected={permissions} onChange={setPermissions} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={update.isPending}>
            {update.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RestoreRecordCard() {
  const [type, setType] = useState("user");
  const [id, setId] = useState("");
  const restore = useRestoreRecord();

  const submit = async () => {
    if (!id.trim()) return;
    try {
      await restore.mutateAsync({ type, id: id.trim() });
      setId("");
    } catch {/* toast in hook */}
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <RotateCcw className="h-4 w-4" /> Restore Soft-Deleted Record
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Paste the MongoDB ObjectId of the record you want to restore. Nothing is ever hard-deleted — only the soft-delete flag is cleared.
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="w-full sm:w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RESTORE_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            className="flex-1 font-mono text-sm"
            placeholder="MongoDB ObjectId (24 hex chars)"
            value={id}
            onChange={(e) => setId(e.target.value.trim())}
          />
          <Button
            onClick={submit}
            disabled={restore.isPending || !/^[a-f\d]{24}$/i.test(id)}
          >
            {restore.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Restore"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function StaffTab() {
  const { data: staffList = [], isLoading } = useStaffList();
  const removeStaff = useRemoveStaff();
  const setPin = useSetMasterPin();
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<any | null>(null);
  const [removeTarget, setRemoveTarget] = useState<any | null>(null);
  const [setPinOpen, setSetPinOpen] = useState(false);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-base">Staff Accounts</CardTitle>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Assign Staff
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : staffList.length === 0 ? (
            <p className="text-sm text-muted-foreground">No staff accounts yet.</p>
          ) : (
            <div className="space-y-3">
              {staffList.map((s: any) => (
                <div key={s._id ?? s.id} className="rounded-lg border p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div>
                      <div className="font-medium">{s.name}</div>
                      <div className="text-xs text-muted-foreground">{s.email}</div>
                    </div>
                    <div className="flex gap-1.5">
                      <Button variant="outline" size="sm" onClick={() => setEditTarget(s)}>
                        <Pencil className="h-3.5 w-3.5 mr-1" /> Permissions
                      </Button>
                      <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setRemoveTarget(s)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {(s.staffPermissions ?? []).length === 0 ? (
                      <span className="text-xs text-muted-foreground">No sections allowed</span>
                    ) : (
                      (s.staffPermissions as string[]).map((p) => (
                        <Badge key={p} variant="secondary" className="text-xs capitalize">{p}</Badge>
                      ))
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <RestoreRecordCard />

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldAlert className="h-4 w-4" /> Master Hard Delete PIN
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Set or change the PIN used to confirm permanent (hard) deletions. Keep it private.
          </p>
          <Button size="sm" variant="outline" onClick={() => setSetPinOpen(true)}>
            Set / Change PIN
          </Button>
        </CardContent>
      </Card>

      <SetPinDialog
        open={setPinOpen}
        onOpenChange={setSetPinOpen}
        loading={setPin.isPending}
        onConfirm={(pin) => setPin.mutate(pin, { onSuccess: () => setSetPinOpen(false) })}
      />

      <PromoteStaffDialog open={createOpen} onOpenChange={setCreateOpen} />

      {editTarget && (
        <EditPermissionsDialog
          staff={editTarget}
          open={!!editTarget}
          onOpenChange={(v) => { if (!v) setEditTarget(null); }}
        />
      )}

      <AlertDialog open={!!removeTarget} onOpenChange={(v) => { if (!v) setRemoveTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove staff role?</AlertDialogTitle>
            <AlertDialogDescription>
              {removeTarget?.name} ({removeTarget?.email}) will lose staff access and become a regular user. This does not delete their account.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (!removeTarget) return;
                await removeStaff.mutateAsync(removeTarget._id ?? removeTarget.id);
                setRemoveTarget(null);
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
