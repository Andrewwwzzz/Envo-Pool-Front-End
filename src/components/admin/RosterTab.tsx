import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ChevronLeft, ChevronRight, Plus, Loader2, Pencil, Trash2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useRosterShifts, useRosterTeam, useCreateShift, useUpdateShift, useCancelShift, RosterShift, ClockLog } from "@/hooks/useRoster";

// ── Singapore time helpers (the roster is always shown in SGT) ──
const SGT_MS = 8 * 3600e3;
const DAY_MS = 24 * 3600e3;
const pad = (n: number) => String(n).padStart(2, "0");
/** "YYYY-MM-DD" of an instant, in Singapore time. */
function sgDateStr(d: Date): string {
  const s = new Date(d.getTime() + SGT_MS);
  return `${s.getUTCFullYear()}-${pad(s.getUTCMonth() + 1)}-${pad(s.getUTCDate())}`;
}
/** "HH:MM" of an instant, in Singapore time. */
function sgTimeStr(d: Date): string {
  const s = new Date(d.getTime() + SGT_MS);
  return `${pad(s.getUTCHours())}:${pad(s.getUTCMinutes())}`;
}
/** "5pm", "5:30pm" */
function fmtTime(d: Date): string {
  const [h, m] = sgTimeStr(d).split(":").map(Number);
  return `${((h + 11) % 12) + 1}${m ? ":" + pad(m) : ""}${h < 12 ? "am" : "pm"}`;
}
/** Monday of the SGT week containing `d`, as "YYYY-MM-DD". */
function mondayOf(d: Date): string {
  const s = new Date(d.getTime() + SGT_MS);
  const back = (s.getUTCDay() + 6) % 7;
  return new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), s.getUTCDate() - back)).toISOString().slice(0, 10);
}
const addDays = (ymd: string, n: number) => new Date(new Date(`${ymd}T00:00:00Z`).getTime() + n * DAY_MS).toISOString().slice(0, 10);
/** The instant of an SGT date + "HH:MM". */
const sgInstant = (ymd: string, hm: string) => new Date(`${ymd}T${hm}:00+08:00`);
const dayLabel = (ymd: string) =>
  new Date(`${ymd}T12:00:00+08:00`).toLocaleDateString("en-SG", { weekday: "short", day: "numeric", month: "short", timeZone: "Asia/Singapore" });
const weekLabel = (monday: string) => `${dayLabel(monday)} – ${dayLabel(addDays(monday, 6))}`;

/** What the bot and the clock-in log say about a shift. */
function statusOf(s: RosterShift): { label: string; cls: string } {
  const c = s.check || {};
  if (s.clockedInAt && s.clockedOutAt) return { label: `Worked ${fmtTime(new Date(s.clockedInAt))}–${fmtTime(new Date(s.clockedOutAt))}`, cls: "bg-muted text-muted-foreground" };
  if (s.clockedInAt) return { label: `Clocked in ${fmtTime(new Date(s.clockedInAt))}`, cls: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" };
  if (c.noClockInAt) return { label: "No clock-in", cls: "bg-destructive/15 text-destructive" };
  if (c.response === "cant") return { label: "Can't make it", cls: "bg-destructive/15 text-destructive" };
  if (c.response === "coming") return { label: "Confirmed", cls: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" };
  if (c.escalatedAt) return { label: "No reply", cls: "bg-amber-500/15 text-amber-600 dark:text-amber-400" };
  if (c.promptedAt) return { label: "Asked", cls: "bg-sky-500/15 text-sky-600 dark:text-sky-400" };
  if (c.notLinkedAt) return { label: "Not on Telegram", cls: "bg-amber-500/15 text-amber-600 dark:text-amber-400" };
  return { label: "Scheduled", cls: "bg-muted text-muted-foreground" };
}

/** "on time", "12 min late", "15 min early", or "not rostered". */
function punctuality(l: ClockLog): { label: string; cls: string } {
  if (!l.shiftStartAt) return { label: "Not rostered", cls: "text-muted-foreground" };
  const diff = Math.round((new Date(l.clockInAt).getTime() - new Date(l.shiftStartAt).getTime()) / 60000);
  if (diff > 5) return { label: `${diff} min late`, cls: "text-destructive" };
  if (diff < -5) return { label: `${-diff} min early`, cls: "text-muted-foreground" };
  return { label: "On time", cls: "text-emerald-600 dark:text-emerald-400" };
}
const hoursBetween = (a: string, b: string) => ((new Date(b).getTime() - new Date(a).getTime()) / 3600e3).toFixed(1);

interface Draft { id: string | null; staffId: string; date: string; start: string; end: string; note: string }

export default function RosterTab() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const { toast } = useToast();
  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date()));
  const from = sgInstant(weekStart, "00:00").toISOString();
  const to = sgInstant(addDays(weekStart, 7), "00:00").toISOString();
  const { data, isLoading, error } = useRosterShifts(from, to);
  const { data: team = [] } = useRosterTeam();
  const create = useCreateShift();
  const update = useUpdateShift();
  const cancel = useCancelShift();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [removing, setRemoving] = useState<RosterShift | null>(null);

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const today = sgDateStr(new Date());
  const byDay = useMemo(() => {
    const m: Record<string, RosterShift[]> = {};
    for (const s of data?.shifts ?? []) (m[sgDateStr(new Date(s.startAt))] ||= []).push(s);
    return m;
  }, [data]);

  const openNew = (date: string) => setDraft({ id: null, staffId: "", date, start: "17:00", end: "01:00", note: "" });
  const openEdit = (s: RosterShift) =>
    setDraft({ id: s.id, staffId: s.staffId, date: sgDateStr(new Date(s.startAt)), start: sgTimeStr(new Date(s.startAt)), end: sgTimeStr(new Date(s.endAt)), note: s.note });

  const save = async () => {
    if (!draft) return;
    if (!draft.staffId) return toast({ title: "Pick who is on this shift", variant: "destructive" });
    if (!draft.date || !draft.start || !draft.end) return toast({ title: "Fill in the date, start and end", variant: "destructive" });
    const startAt = sgInstant(draft.date, draft.start);
    let endAt = sgInstant(draft.date, draft.end);
    if (endAt <= startAt) endAt = new Date(endAt.getTime() + DAY_MS); // ends after midnight
    const input = { staffId: draft.staffId, startAt: startAt.toISOString(), endAt: endAt.toISOString(), note: draft.note.trim() };
    try {
      if (draft.id) await update.mutateAsync({ id: draft.id, ...input });
      else await create.mutateAsync(input);
      setDraft(null);
    } catch (e) {
      toast({ title: (e as Error).message, variant: "destructive" });
    }
  };

  const remove = async () => {
    if (!removing) return;
    try {
      await cancel.mutateAsync(removing.id);
      setRemoving(null);
    } catch (e) {
      toast({ title: (e as Error).message, variant: "destructive" });
    }
  };

  const saving = create.isPending || update.isPending;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Roster</h2>
          <p className="text-sm text-muted-foreground">
            An hour before each shift the Telegram bot asks the person if they're coming. No reply in 15 minutes, "can't make it",
            or no clock-in 15 minutes after the start, and the admins are messaged to find a replacement.
          </p>
        </div>
        {isAdmin && (
          <Button size="sm" onClick={() => openNew(today >= weekStart && today < addDays(weekStart, 7) ? today : weekStart)}>
            <Plus className="h-4 w-4 mr-1" /> Add shift
          </Button>
        )}
      </div>

      <div className="flex items-center justify-between gap-2">
        <Button variant="outline" size="sm" onClick={() => setWeekStart(addDays(weekStart, -7))} aria-label="Previous week"><ChevronLeft className="h-4 w-4" /></Button>
        <div className="flex items-center gap-2 text-sm font-medium">
          <span>{weekLabel(weekStart)}</span>
          {weekStart !== mondayOf(new Date()) && <Button variant="ghost" size="sm" onClick={() => setWeekStart(mondayOf(new Date()))}>This week</Button>}
        </div>
        <Button variant="outline" size="sm" onClick={() => setWeekStart(addDays(weekStart, 7))} aria-label="Next week"><ChevronRight className="h-4 w-4" /></Button>
      </div>

      {error && <p className="text-sm text-destructive">{(error as Error).message}</p>}
      {isLoading && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>}

      <div className="grid grid-cols-1 md:grid-cols-7 gap-2">
        {days.map((d) => (
          <div key={d} className={cn("rounded-lg border bg-card p-2 min-h-[120px] flex flex-col gap-2", d === today && "border-primary")}>
            <div className="flex items-center justify-between">
              <span className={cn("text-xs font-semibold", d === today ? "text-primary" : "text-muted-foreground")}>{dayLabel(d)}</span>
              {isAdmin && (
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openNew(d)} aria-label={`Add shift on ${dayLabel(d)}`}>
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
            {(byDay[d] ?? []).length === 0 && <span className="text-xs text-muted-foreground/70">No one rostered</span>}
            {(byDay[d] ?? []).map((s) => {
              const st = statusOf(s);
              return (
                <div key={s.id} className="rounded-md border bg-background p-2 text-sm space-y-1">
                  <div className="flex items-start justify-between gap-1">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{s.staffName}</div>
                      <div className="text-xs text-muted-foreground">{fmtTime(new Date(s.startAt))} – {fmtTime(new Date(s.endAt))}</div>
                    </div>
                    {isAdmin && (
                      <div className="flex shrink-0">
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEdit(s)} aria-label="Edit shift"><Pencil className="h-3 w-3" /></Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => setRemoving(s)} aria-label="Remove shift"><Trash2 className="h-3 w-3" /></Button>
                      </div>
                    )}
                  </div>
                  {s.note && <div className="text-xs text-muted-foreground">{s.note}</div>}
                  <span className={cn("inline-block rounded px-1.5 py-0.5 text-[11px] font-medium", st.cls)}>{st.label}</span>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <h3 className="text-base font-semibold">Clock in / out this week</h3>
        {(data?.logs ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No clock-ins yet this week.</p>
        ) : (
          <div className="rounded-lg border overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th className="text-left font-medium p-2">Day</th>
                  <th className="text-left font-medium p-2">Name</th>
                  <th className="text-left font-medium p-2">Clocked in</th>
                  <th className="text-left font-medium p-2">Clocked out</th>
                  <th className="text-left font-medium p-2">Hours</th>
                  <th className="text-left font-medium p-2">Rostered</th>
                  <th className="text-left font-medium p-2">Punctuality</th>
                </tr>
              </thead>
              <tbody>
                {(data?.logs ?? []).map((l) => {
                  const p = punctuality(l);
                  return (
                    <tr key={l.id} className="border-t">
                      <td className="p-2 whitespace-nowrap">{dayLabel(sgDateStr(new Date(l.clockInAt)))}</td>
                      <td className="p-2 font-medium">{l.staffName}</td>
                      <td className="p-2 whitespace-nowrap">{fmtTime(new Date(l.clockInAt))}</td>
                      <td className="p-2 whitespace-nowrap">{l.clockOutAt ? fmtTime(new Date(l.clockOutAt)) : <span className="text-emerald-600 dark:text-emerald-400">Still on shift</span>}</td>
                      <td className="p-2">{l.clockOutAt ? hoursBetween(l.clockInAt, l.clockOutAt) : "—"}</td>
                      <td className="p-2 whitespace-nowrap text-muted-foreground">{l.shiftStartAt && l.shiftEndAt ? `${fmtTime(new Date(l.shiftStartAt))} – ${fmtTime(new Date(l.shiftEndAt))}` : "—"}</td>
                      <td className={cn("p-2 whitespace-nowrap", p.cls)}>{p.label}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={!!draft} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{draft?.id ? "Edit shift" : "Add shift"}</DialogTitle></DialogHeader>
          {draft && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Who</Label>
                <Select value={draft.staffId} onValueChange={(v) => setDraft({ ...draft, staffId: v })}>
                  <SelectTrigger><SelectValue placeholder="Pick a team member" /></SelectTrigger>
                  <SelectContent>
                    {team.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}{t.role === "admin" ? " (admin)" : ""}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="shift-date">Date</Label>
                <Input id="shift-date" type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="shift-start">Start</Label>
                  <Input id="shift-start" type="time" step={900} value={draft.start} onChange={(e) => setDraft({ ...draft, start: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="shift-end">End</Label>
                  <Input id="shift-end" type="time" step={900} value={draft.end} onChange={(e) => setDraft({ ...draft, end: e.target.value })} />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Times are Singapore time. An end time earlier than the start means the shift runs past midnight.</p>
              <div className="space-y-1.5">
                <Label htmlFor="shift-note">Note (optional)</Label>
                <Input id="shift-note" maxLength={200} value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} placeholder="e.g. tournament night" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDraft(null)} disabled={saving}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}{draft?.id ? "Save" : "Add"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!removing} onOpenChange={(o) => !o && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this shift?</AlertDialogTitle>
            <AlertDialogDescription>
              {removing && `${removing.staffName}, ${dayLabel(sgDateStr(new Date(removing.startAt)))} ${fmtTime(new Date(removing.startAt))} – ${fmtTime(new Date(removing.endAt))}. The bot will stop checking on it.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep</AlertDialogCancel>
            <AlertDialogAction onClick={remove} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Keeps the week in view when the tab is reopened after midnight.
export function useTodayRefresh(setWeekStart: (w: string) => void) {
  useEffect(() => {
    const id = setInterval(() => setWeekStart(mondayOf(new Date())), 6 * 3600e3);
    return () => clearInterval(id);
  }, [setWeekStart]);
}
