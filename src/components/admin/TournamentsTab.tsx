import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Ban, Download, ExternalLink, Pencil, Plus, Trash2, Trophy, UserX, X } from "lucide-react";
import { Link } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import ReasonDialog from "@/components/admin/ReasonDialog";
import { fmtDateTimeSG } from "@/lib/sgTime";
import {
  useAdminTournaments, useAdminTournamentEntries, useSaveTournament, useRevokeEntry,
  useCancelTournament, useDeleteTournament, feeLabel, formatLabel,
  type Tournament, type TournamentField, type AdminTournamentEntry,
} from "@/hooks/useTournaments";
import { TournamentStatusBadge } from "@/pages/Tournaments";

// <input type="datetime-local"> works in the browser's timezone; the shop
// runs on Singapore time, so convert explicitly either way.
const toSGInput = (iso?: string) =>
  iso ? new Date(iso).toLocaleString("sv-SE", { timeZone: "Asia/Singapore" }).slice(0, 16).replace(" ", "T") : "";
const fromSGInput = (v: string) => (v ? new Date(`${v}:00+08:00`).toISOString() : "");

interface FieldDraft { key?: string; label: string; type: "text" | "select"; options: string; required: boolean }

interface FormState {
  name: string;
  description: string;
  startsAt: string;
  registrationClosesAt: string;
  entryFee: string;
  maxEntries: string;
  teamSize: string;
  status: "draft" | "open" | "closed";
  fields: FieldDraft[];
}

const EMPTY_FORM: FormState = {
  name: "", description: "", startsAt: "", registrationClosesAt: "",
  entryFee: "", maxEntries: "", teamSize: "1", status: "draft", fields: [],
};

const toDraft = (f: TournamentField): FieldDraft => ({ key: f.key, label: f.label, type: f.type, options: f.options.join(", "), required: f.required });

// ── Create / edit ─────────────────────────────────────────────

function TournamentFormDialog({ editing, open, onOpenChange }: { editing: Tournament | null; open: boolean; onOpenChange: (v: boolean) => void }) {
  const { toast } = useToast();
  const save = useSaveTournament();
  const hasEntries = !!editing && (editing.confirmedCount > 0 || (editing.waitlistCount ?? 0) > 0);
  const [form, setForm] = useState<FormState>(() =>
    editing
      ? {
          name: editing.name,
          description: editing.description || "",
          startsAt: toSGInput(editing.startsAt),
          registrationClosesAt: toSGInput(editing.registrationClosesAt),
          entryFee: String(editing.entryFee),
          maxEntries: editing.maxEntries == null ? "" : String(editing.maxEntries),
          teamSize: String(editing.teamSize),
          status: editing.status === "cancelled" ? "closed" : editing.status,
          fields: editing.fields.map(toDraft),
        }
      : EMPTY_FORM
  );
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));
  const setField = (i: number, patch: Partial<FieldDraft>) =>
    setForm((f) => ({ ...f, fields: f.fields.map((x, j) => (j === i ? { ...x, ...patch } : x)) }));

  const submit = () => {
    const data = {
      name: form.name,
      description: form.description,
      startsAt: fromSGInput(form.startsAt),
      registrationClosesAt: fromSGInput(form.registrationClosesAt),
      entryFee: Number(form.entryFee || 0),
      maxEntries: form.maxEntries.trim() === "" ? null : Number(form.maxEntries),
      teamSize: Number(form.teamSize || 1),
      status: form.status,
      fields: form.fields.map((f) => ({
        key: f.key,
        label: f.label,
        type: f.type,
        required: f.required,
        options: f.type === "select" ? f.options.split(",").map((o) => o.trim()).filter(Boolean) : [],
      })),
    };
    save.mutate(
      { id: editing?._id, data },
      {
        onSuccess: () => {
          toast({ title: editing ? "Tournament updated" : "Tournament created" });
          onOpenChange(false);
        },
        onError: (err) => toast({ title: "Couldn't save", description: err.message, variant: "destructive" }),
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit tournament" : "New tournament"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Name</Label>
            <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Envo 9-Ball Open — November" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Description (format, prizes, rules)</Label>
            <Textarea rows={4} value={form.description} onChange={(e) => set("description", e.target.value)} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Tournament starts (SGT)</Label>
              <Input type="datetime-local" value={form.startsAt} onChange={(e) => set("startsAt", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Registration closes (SGT)</Label>
              <Input type="datetime-local" value={form.registrationClosesAt} onChange={(e) => set("registrationClosesAt", e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Entry fee ($)</Label>
              <Input type="number" min="0" step="0.5" value={form.entryFee} disabled={hasEntries} onChange={(e) => set("entryFee", e.target.value)} placeholder="0" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Max entries</Label>
              <Input type="number" min="1" value={form.maxEntries} onChange={(e) => set("maxEntries", e.target.value)} placeholder="No limit" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Players per entry</Label>
              <Input type="number" min="1" max="10" value={form.teamSize} disabled={hasEntries} onChange={(e) => set("teamSize", e.target.value)} />
            </div>
          </div>
          {hasEntries && <p className="text-xs text-muted-foreground">Entry fee and players per entry are locked because players have already signed up.</p>}

          <div className="space-y-1.5">
            <Label className="text-xs">Status</Label>
            <Select value={form.status} onValueChange={(v) => set("status", v as FormState["status"])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft — hidden from players</SelectItem>
                <SelectItem value="open">Open — taking sign-ups</SelectItem>
                <SelectItem value="closed">Closed — visible, no sign-ups</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Extra questions on the sign-up form</Label>
              <Button
                type="button" size="sm" variant="outline"
                onClick={() => set("fields", [...form.fields, { label: "", type: "text", options: "", required: false }])}
              >
                <Plus className="h-4 w-4 mr-1" /> Add question
              </Button>
            </div>
            {form.fields.length === 0 && <p className="text-xs text-muted-foreground">None — players just confirm and pay.</p>}
            {form.fields.map((f, i) => (
              <div key={i} className="rounded-md border border-border p-3 space-y-2">
                <div className="flex gap-2">
                  <Input value={f.label} onChange={(e) => setField(i, { label: e.target.value })} placeholder="Question, e.g. Skill level" />
                  <Select value={f.type} onValueChange={(v) => setField(i, { type: v as FieldDraft["type"] })}>
                    <SelectTrigger className="w-32 shrink-0"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="text">Text</SelectItem>
                      <SelectItem value="select">Dropdown</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button type="button" size="icon" variant="ghost" className="shrink-0" onClick={() => set("fields", form.fields.filter((_, j) => j !== i))} aria-label="Remove question">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                {f.type === "select" && (
                  <Input value={f.options} onChange={(e) => setField(i, { options: e.target.value })} placeholder="Options, comma separated — e.g. Beginner, Intermediate, Advanced" />
                )}
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <Checkbox checked={f.required} onCheckedChange={(v) => setField(i, { required: v === true })} /> Required
                </label>
              </div>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button className="bg-accent text-accent-foreground hover:bg-accent/90" disabled={save.isPending} onClick={submit}>
            {save.isPending ? "Saving…" : editing ? "Save" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Entries ───────────────────────────────────────────────────

function RevokeDialog({ entry, onClose }: { entry: AdminTournamentEntry; onClose: () => void }) {
  const { toast } = useToast();
  const revoke = useRevokeEntry();
  const [reason, setReason] = useState("");
  const [refund, setRefund] = useState(true);
  const paid = entry.status === "confirmed" && entry.amountPaid > 0;

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remove {entry.playerName}?</DialogTitle>
          <DialogDescription>
            {entry.status === "waitlisted" ? "They'll be taken off the waitlist." : "Their slot will be freed and everyone on the waitlist notified."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Reason (shown to the player)</Label>
            <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Requested withdrawal due to injury" />
          </div>
          {paid && (
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox checked={refund} onCheckedChange={(v) => setRefund(v === true)} />
              Refund ${entry.amountPaid.toFixed(2)} to their wallet
            </label>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            variant="destructive"
            disabled={revoke.isPending}
            onClick={() => revoke.mutate(
              { entryId: entry._id, refund: paid && refund, reason },
              {
                onSuccess: (r: { refunded?: number; refundedCount?: number; refundedTotal?: number }) => {
                  toast({ title: "Entry removed", description: r.refunded > 0 ? `$${Number(r.refunded).toFixed(2)} refunded to wallet` : undefined });
                  onClose();
                },
                onError: (err) => toast({ title: "Couldn't remove entry", description: err.message, variant: "destructive" }),
              }
            )}
          >
            {revoke.isPending ? "Removing…" : "Remove"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const ENTRY_BADGE: Record<AdminTournamentEntry["status"], string> = {
  confirmed: "bg-green-500/20 text-green-400 border-green-500/30",
  waitlisted: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  revoked: "bg-destructive/20 text-destructive border-destructive/30",
  cancelled: "bg-destructive/20 text-destructive border-destructive/30",
};

function csvCell(v: unknown) {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function downloadCsv(t: Tournament, entries: AdminTournamentEntry[]) {
  const header = ["#", "Status", "Player", ...Array.from({ length: t.teamSize - 1 }, (_, i) => `Teammate ${i + 1}`), ...t.fields.map((f) => f.label), "Email", "Phone", "Paid", "Refunded", "Confirmed at"];
  let n = 0;
  const rows = entries.map((e) => [
    e.status === "confirmed" ? ++n : "",
    e.status,
    e.playerName,
    ...Array.from({ length: t.teamSize - 1 }, (_, i) => e.teammates[i] || ""),
    ...t.fields.map((f) => e.answers.find((a) => a.key === f.key)?.value || ""),
    e.userId?.email || "",
    e.userId?.phone || "",
    e.amountPaid ? e.amountPaid.toFixed(2) : "",
    e.refundAmount ? e.refundAmount.toFixed(2) : "",
    e.confirmedAt ? fmtDateTimeSG(e.confirmedAt) : "",
  ]);
  const csv = [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${t.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-entries.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function EntriesView({ t, onBack }: { t: Tournament; onBack: () => void }) {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const { data: entries = [], isLoading } = useAdminTournamentEntries(t._id);
  const [revoking, setRevoking] = useState<AdminTournamentEntry | null>(null);
  const confirmed = entries.filter((e) => e.status === "confirmed");
  const waitlisted = entries.filter((e) => e.status === "waitlisted");
  const removed = entries.filter((e) => e.status === "revoked" || e.status === "cancelled");
  const collected = confirmed.reduce((s, e) => s + (e.amountPaid || 0), 0);

  const renderRow = (e: AdminTournamentEntry, i: number | null) => (
    <Card key={e._id} className="border-border/50">
      <CardContent className="p-3 flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-0.5">
          <div className="flex items-center gap-2 flex-wrap">
            {i != null && <span className="text-xs text-muted-foreground w-5">{i}.</span>}
            <p className="font-medium">{[e.playerName, ...e.teammates].join(" & ")}</p>
            <Badge className={`text-xs ${ENTRY_BADGE[e.status]}`}>{e.status}</Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            {[e.userId?.email, e.userId?.phone].filter(Boolean).join(" · ")}
            {e.amountPaid > 0 && ` · paid $${e.amountPaid.toFixed(2)}`}
            {e.refundAmount > 0 && ` · refunded $${e.refundAmount.toFixed(2)}`}
          </p>
          {e.answers.length > 0 && (
            <p className="text-xs">{e.answers.map((a) => `${a.label}: ${a.value}`).join(" · ")}</p>
          )}
          {e.revokeReason && <p className="text-xs text-destructive/80">Reason: {e.revokeReason}{e.revokedBy?.name ? ` — ${e.revokedBy.name}` : ""}</p>}
        </div>
        {isAdmin && (e.status === "confirmed" || e.status === "waitlisted") && t.status !== "cancelled" && (
          <Button size="sm" variant="outline" className="shrink-0 border-destructive/50 text-destructive hover:bg-destructive/10" onClick={() => setRevoking(e)}>
            <UserX className="h-4 w-4 mr-1" /> Remove
          </Button>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <Button size="sm" variant="ghost" onClick={onBack}><ArrowLeft className="h-4 w-4 mr-1" /> All tournaments</Button>
        <Button size="sm" variant="outline" disabled={entries.length === 0} onClick={() => downloadCsv(t, entries)}>
          <Download className="h-4 w-4 mr-1" /> Export CSV
        </Button>
      </div>
      <div>
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="text-lg font-semibold">{t.name}</h2>
          <TournamentStatusBadge t={t} />
        </div>
        <p className="text-sm text-muted-foreground">
          {fmtDateTimeSG(t.startsAt)} · {confirmed.length}{t.maxEntries != null ? `/${t.maxEntries}` : ""} confirmed · {waitlisted.length} waitlisted · ${collected.toFixed(2)} collected
        </p>
      </div>

      {isLoading && <p className="text-center text-muted-foreground py-6">Loading entries…</p>}
      {!isLoading && entries.length === 0 && <p className="text-center text-muted-foreground py-6">No sign-ups yet.</p>}

      {confirmed.length > 0 && <div className="space-y-2">{confirmed.map((e, i) => renderRow(e, i + 1))}</div>}
      {waitlisted.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">Waitlist</h3>
          {waitlisted.map((e, i) => renderRow(e, i + 1))}
        </div>
      )}
      {removed.length > 0 && (
        <div className="space-y-2 opacity-70">
          <h3 className="text-sm font-medium text-muted-foreground">Removed</h3>
          {removed.map((e) => renderRow(e, null))}
        </div>
      )}

      {revoking && <RevokeDialog entry={revoking} onClose={() => setRevoking(null)} />}
    </div>
  );
}

// ── Tab ───────────────────────────────────────────────────────

export default function TournamentsTab() {
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const { data: tournaments = [], isLoading } = useAdminTournaments();
  const cancel = useCancelTournament();
  const remove = useDeleteTournament();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Tournament | null>(null);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<Tournament | null>(null);
  const [deleting, setDeleting] = useState<Tournament | null>(null);

  const viewing = tournaments.find((t) => t._id === viewingId);
  if (viewing) return <EntriesView t={viewing} onBack={() => setViewingId(null)} />;

  const openForm = (t: Tournament | null) => {
    setEditing(t);
    setFormOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <p className="text-sm text-muted-foreground">
          {tournaments.length} tournament{tournaments.length !== 1 ? "s" : ""} ·{" "}
          <Link to="/tournaments" target="_blank" className="text-accent inline-flex items-center gap-1">public page <ExternalLink className="h-3 w-3" /></Link>
        </p>
        <Button size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90" onClick={() => openForm(null)}>
          <Plus className="h-4 w-4 mr-1" /> New tournament
        </Button>
      </div>

      <div className="space-y-2">
        {tournaments.map((t) => {
          const noEntries = t.confirmedCount === 0 && !t.waitlistCount;
          return (
            <Card key={t._id} className={`border-border/50 ${t.status === "cancelled" ? "opacity-60" : ""}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <button type="button" className="flex-1 min-w-0 text-left" onClick={() => setViewingId(t._id)}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Trophy className="h-4 w-4 text-accent" />
                      <p className="font-semibold">{t.name}</p>
                      <TournamentStatusBadge t={t} />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {fmtDateTimeSG(t.startsAt)} · {formatLabel(t.teamSize)} · {feeLabel(t.entryFee)}
                    </p>
                    <p className="text-xs mt-1">
                      <span className="font-medium">{t.confirmedCount}{t.maxEntries != null ? `/${t.maxEntries}` : ""}</span> confirmed
                      {!!t.waitlistCount && <span className="text-amber-400"> · {t.waitlistCount} waitlisted</span>}
                      <span className="text-muted-foreground"> · closes {fmtDateTimeSG(t.registrationClosesAt)}</span>
                    </p>
                  </button>
                  <div className="flex gap-1.5 shrink-0">
                    <Button size="sm" variant="outline" onClick={() => setViewingId(t._id)}>Entries</Button>
                    {t.status !== "cancelled" && (
                      <Button size="sm" variant="outline" onClick={() => openForm(t)} aria-label="Edit"><Pencil className="h-4 w-4" /></Button>
                    )}
                    {isAdmin && t.status !== "cancelled" && !noEntries && (
                      <Button size="sm" variant="outline" className="border-destructive/50 text-destructive hover:bg-destructive/10" onClick={() => setCancelling(t)} aria-label="Cancel tournament">
                        <Ban className="h-4 w-4" />
                      </Button>
                    )}
                    {isAdmin && noEntries && (
                      <Button size="sm" variant="destructive" onClick={() => setDeleting(t)} aria-label="Delete"><Trash2 className="h-4 w-4" /></Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {tournaments.length === 0 && (
          <p className="text-center text-muted-foreground text-sm py-10">{isLoading ? "Loading tournaments…" : "No tournaments yet. Create one to start taking sign-ups."}</p>
        )}
      </div>

      {formOpen && <TournamentFormDialog key={editing?._id ?? "new"} editing={editing} open onOpenChange={(v) => !v && setFormOpen(false)} />}

      <ReasonDialog
        open={!!cancelling}
        onOpenChange={(v) => !v && setCancelling(null)}
        title={`Cancel ${cancelling?.name ?? "tournament"}?`}
        description={`Every confirmed player (${cancelling?.confirmedCount ?? 0}) gets their entry fee refunded to their wallet and is notified. This can't be undone.`}
        label="Reason (shown to players)"
        confirmLabel="Cancel tournament & refund"
        destructive
        loading={cancel.isPending}
        onConfirm={(reason) => {
          if (!cancelling) return;
          cancel.mutate({ id: cancelling._id, reason }, {
            onSuccess: (r: { refunded?: number; refundedCount?: number; refundedTotal?: number }) => {
              toast({ title: "Tournament cancelled", description: `${r.refundedCount} refund(s), $${Number(r.refundedTotal).toFixed(2)} total` });
              setCancelling(null);
            },
            onError: (err) => toast({ title: "Couldn't cancel", description: err.message, variant: "destructive" }),
          });
        }}
      />

      <Dialog open={!!deleting} onOpenChange={(v) => !v && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {deleting?.name}?</DialogTitle>
            <DialogDescription>No one has signed up, so it will simply be removed.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>Keep</Button>
            <Button
              variant="destructive"
              disabled={remove.isPending}
              onClick={() => deleting && remove.mutate(deleting._id, {
                onSuccess: () => { toast({ title: "Tournament deleted" }); setDeleting(null); },
                onError: (err) => toast({ title: "Couldn't delete", description: err.message, variant: "destructive" }),
              })}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
