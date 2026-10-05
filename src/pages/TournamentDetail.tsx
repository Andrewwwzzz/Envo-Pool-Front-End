import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { CalendarDays, Clock, Trophy, Users, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import TopUpWalletDialog from "@/components/dashboard/TopUpWalletDialog";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { useToast } from "@/hooks/use-toast";
import {
  useTournament, useRegisterTournament, useJoinWaitlist, useLeaveWaitlist,
  TournamentError, feeLabel, formatLabel, type Tournament, type MyEntry,
} from "@/hooks/useTournaments";
import { fmtDateTimeSG } from "@/lib/sgTime";
import { TournamentPageShell, TournamentStatusBadge } from "./Tournaments";

/** Sign-up form: teammates, the admin's custom questions, and the fee. */
function SignupDialog({
  t, mode, open, onOpenChange,
}: { t: Tournament; mode: "register" | "waitlist"; open: boolean; onOpenChange: (v: boolean) => void }) {
  const { toast } = useToast();
  const { data: profile } = useProfile();
  const register = useRegisterTournament(t._id);
  const waitlist = useJoinWaitlist(t._id);
  const [teammates, setTeammates] = useState<string[]>(() => Array(t.teamSize - 1).fill(""));
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [agreed, setAgreed] = useState(false);
  const [topUpOpen, setTopUpOpen] = useState(false);

  const balance = Number(profile?.wallet_balance ?? 0);
  const short = mode === "register" && t.entryFee > 0 && balance < t.entryFee;
  const missing =
    teammates.some((n) => !n.trim()) ||
    t.fields.some((f) => f.required && !(answers[f.key] || "").trim());
  const pending = register.isPending || waitlist.isPending;

  const submit = () => {
    const payload = { teammates: teammates.map((n) => n.trim()), answers };
    const done = (title: string, description?: string) => {
      toast({ title, description });
      onOpenChange(false);
    };
    const fail = (err: Error) => {
      const data = err instanceof TournamentError ? err.data : {};
      toast({ title: data.full ? "Tournament just filled up" : "Couldn't sign up", description: err.message, variant: "destructive" });
      if (data.full) onOpenChange(false);
    };
    if (mode === "register") {
      register.mutate(payload, {
        onSuccess: () => done("You're registered!", t.entryFee > 0 ? `${feeLabel(t.entryFee)} paid from your wallet.` : undefined),
        onError: fail,
      });
    } else {
      waitlist.mutate(payload, {
        onSuccess: () => done("You're on the waitlist", "We'll notify you if a slot opens."),
        onError: fail,
      });
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="dark max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{mode === "register" ? `Register — ${t.name}` : `Join waitlist — ${t.name}`}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {teammates.map((name, i) => (
              <div key={i} className="space-y-1.5">
                <Label htmlFor={`teammate-${i}`} className="text-xs">{t.teamSize === 2 ? "Partner's name" : `Teammate ${i + 1} name`}</Label>
                <Input
                  id={`teammate-${i}`}
                  value={name}
                  maxLength={80}
                  onChange={(e) => setTeammates((prev) => prev.map((n, j) => (j === i ? e.target.value : n)))}
                />
              </div>
            ))}

            {t.fields.map((f) => (
              <div key={f.key} className="space-y-1.5">
                <Label htmlFor={`field-${f.key}`} className="text-xs">{f.label}{f.required ? " *" : " (optional)"}</Label>
                {f.type === "select" ? (
                  <Select value={answers[f.key] || ""} onValueChange={(v) => setAnswers((a) => ({ ...a, [f.key]: v }))}>
                    <SelectTrigger id={`field-${f.key}`}><SelectValue placeholder="Choose…" /></SelectTrigger>
                    <SelectContent className="dark">
                      {f.options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input id={`field-${f.key}`} value={answers[f.key] || ""} maxLength={300} onChange={(e) => setAnswers((a) => ({ ...a, [f.key]: e.target.value }))} />
                )}
              </div>
            ))}

            {mode === "register" ? (
              <div className="rounded-lg border border-border/50 bg-muted/30 p-3 space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Entry fee</span><span className="font-semibold">{feeLabel(t.entryFee)}</span></div>
                {t.entryFee > 0 && (
                  <div className="flex justify-between"><span className="text-muted-foreground">Wallet balance</span><span className={short ? "text-destructive" : ""}>${balance.toFixed(2)}</span></div>
                )}
                {short && (
                  <div className="pt-2 flex items-center justify-between gap-2">
                    <span className="text-destructive text-xs">Top up ${(t.entryFee - balance).toFixed(2)} more to register.</span>
                    <Button size="sm" variant="outline" onClick={() => setTopUpOpen(true)}><Wallet className="h-4 w-4 mr-1" /> Top up</Button>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Nothing is charged now. If a slot opens we'll notify everyone on the waitlist — the first to confirm and pay {feeLabel(t.entryFee)} gets it.
              </p>
            )}

            {mode === "register" && t.entryFee > 0 && (
              <label className="flex items-start gap-2 text-sm cursor-pointer">
                <Checkbox checked={agreed} onCheckedChange={(v) => setAgreed(v === true)} className="mt-0.5" />
                <span>I understand the entry fee is <strong>non-refundable</strong> once my slot is confirmed.</span>
              </label>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button
              className="bg-accent text-accent-foreground hover:bg-accent/90"
              disabled={pending || missing || short || (mode === "register" && t.entryFee > 0 && !agreed)}
              onClick={submit}
            >
              {pending ? "Please wait…" : mode === "register" ? (t.entryFee > 0 ? `Pay ${feeLabel(t.entryFee)} & register` : "Register") : "Join waitlist"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <TopUpWalletDialog open={topUpOpen} onOpenChange={setTopUpOpen} />
    </>
  );
}

/** What the signed-in player sees about their own entry. */
function MyEntryCard({ t, entry }: { t: Tournament; entry: MyEntry }) {
  const { toast } = useToast();
  const { data: profile } = useProfile();
  const claim = useRegisterTournament(t._id);
  const leave = useLeaveWaitlist(t._id);
  const [agreed, setAgreed] = useState(false);
  const [topUpOpen, setTopUpOpen] = useState(false);
  const balance = Number(profile?.wallet_balance ?? 0);

  const details = (
    <>
      {entry.teammates.length > 0 && <p className="text-sm"><span className="text-muted-foreground">Team:</span> {entry.teammates.join(", ")}</p>}
      {entry.answers.map((a) => <p key={a.key} className="text-sm"><span className="text-muted-foreground">{a.label}:</span> {a.value}</p>)}
    </>
  );

  if (entry.status === "confirmed") {
    return (
      <Card className="border-green-500/40 bg-green-500/5">
        <CardContent className="p-4 space-y-1">
          <p className="font-semibold text-green-400">You're registered ✓</p>
          {entry.amountPaid > 0 && <p className="text-sm text-muted-foreground">Paid ${entry.amountPaid.toFixed(2)} from your wallet.</p>}
          {details}
        </CardContent>
      </Card>
    );
  }

  if (entry.status === "waitlisted") {
    const canClaim = t.registrationOpen && (t.spotsLeft == null || t.spotsLeft > 0);
    const short = t.entryFee > 0 && balance < t.entryFee;
    return (
      <Card className="border-amber-500/40 bg-amber-500/5">
        <CardContent className="p-4 space-y-3">
          <div className="space-y-1">
            <p className="font-semibold text-amber-400">
              {canClaim ? "A slot is open — claim it now!" : `You're on the waitlist${entry.waitlistPosition ? ` (#${entry.waitlistPosition})` : ""}`}
            </p>
            {!canClaim && <p className="text-sm text-muted-foreground">We'll notify you if a slot opens. Nothing has been charged.</p>}
            {details}
          </div>
          {canClaim && (
            <div className="space-y-2">
              {short && (
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="text-destructive">Wallet: ${balance.toFixed(2)} — top up ${(t.entryFee - balance).toFixed(2)} more.</span>
                  <Button size="sm" variant="outline" onClick={() => setTopUpOpen(true)}><Wallet className="h-4 w-4 mr-1" /> Top up</Button>
                </div>
              )}
              {t.entryFee > 0 && (
                <label className="flex items-start gap-2 text-sm cursor-pointer">
                  <Checkbox checked={agreed} onCheckedChange={(v) => setAgreed(v === true)} className="mt-0.5" />
                  <span>I understand the entry fee is <strong>non-refundable</strong> once my slot is confirmed.</span>
                </label>
              )}
              <Button
                className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
                disabled={claim.isPending || short || (t.entryFee > 0 && !agreed)}
                onClick={() => claim.mutate(null, {
                  onSuccess: () => toast({ title: "Slot confirmed!", description: t.entryFee > 0 ? `${feeLabel(t.entryFee)} paid from your wallet.` : undefined }),
                  onError: (err) => toast({ title: "Couldn't claim the slot", description: err.message, variant: "destructive" }),
                })}
              >
                {claim.isPending ? "Please wait…" : t.entryFee > 0 ? `Pay ${feeLabel(t.entryFee)} & claim slot` : "Claim slot"}
              </Button>
            </div>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="text-muted-foreground"
            disabled={leave.isPending}
            onClick={() => leave.mutate(undefined, {
              onSuccess: () => toast({ title: "You've left the waitlist" }),
              onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
            })}
          >
            Leave waitlist
          </Button>
          <TopUpWalletDialog open={topUpOpen} onOpenChange={setTopUpOpen} />
        </CardContent>
      </Card>
    );
  }

  // revoked / cancelled
  return (
    <Card className="border-destructive/40 bg-destructive/5">
      <CardContent className="p-4 space-y-1">
        <p className="font-semibold text-destructive">{entry.status === "cancelled" ? "This tournament was cancelled" : "Your entry was removed"}</p>
        {entry.refundAmount > 0 && <p className="text-sm text-muted-foreground">${entry.refundAmount.toFixed(2)} was refunded to your wallet.</p>}
        {entry.revokeReason && <p className="text-sm text-muted-foreground">Reason: {entry.revokeReason}</p>}
      </CardContent>
    </Card>
  );
}

export default function TournamentDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data, isLoading, isError } = useTournament(id);
  const [dialog, setDialog] = useState<"register" | "waitlist" | null>(null);

  if (isLoading) {
    return <TournamentPageShell title="Tournament" back="/tournaments"><p className="text-center text-muted-foreground py-10">Loading…</p></TournamentPageShell>;
  }
  if (isError || !data) {
    return (
      <TournamentPageShell title="Tournament" back="/tournaments">
        <p className="text-center text-muted-foreground py-10">This tournament doesn't exist or isn't available. <Link to="/tournaments" className="text-accent">See all tournaments</Link></p>
      </TournamentPageShell>
    );
  }

  const { tournament: t, players, myEntry } = data;
  const full = t.spotsLeft === 0;

  const start = (mode: "register" | "waitlist") => {
    if (!user) {
      navigate(`/auth?next=${encodeURIComponent(`/tournaments/${t._id}`)}`);
      return;
    }
    setDialog(mode);
  };

  return (
    <TournamentPageShell title={t.name} back="/tournaments">
      <Card className="border-border/50">
        <CardContent className="p-4 sm:p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-lg font-semibold">{t.name}</h2>
            <TournamentStatusBadge t={t} />
          </div>

          <div className="grid gap-2 sm:grid-cols-2 text-sm">
            <span className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-accent" />{fmtDateTimeSG(t.startsAt)}</span>
            <span className="flex items-center gap-2"><Clock className="h-4 w-4 text-accent" />Registration closes {fmtDateTimeSG(t.registrationClosesAt)}</span>
            <span className="flex items-center gap-2"><Trophy className="h-4 w-4 text-accent" />{formatLabel(t.teamSize)} · Entry {feeLabel(t.entryFee)}</span>
            <span className="flex items-center gap-2">
              <Users className="h-4 w-4 text-accent" />
              {t.maxEntries == null ? `${t.confirmedCount} registered` : `${t.confirmedCount}/${t.maxEntries} slots filled`}
              {!!t.waitlistCount && ` · ${t.waitlistCount} waiting`}
            </span>
          </div>

          {t.description && <p className="text-sm text-muted-foreground whitespace-pre-line">{t.description}</p>}

          {t.status === "cancelled" && (
            <p className="text-sm text-destructive">This tournament has been cancelled.{t.cancelReason ? ` ${t.cancelReason}` : ""}</p>
          )}

          {!myEntry && t.registrationOpen && (
            <div className="space-y-2">
              <Button className="w-full bg-accent text-accent-foreground hover:bg-accent/90" onClick={() => start(full ? "waitlist" : "register")}>
                {full ? "Tournament full — join waitlist" : t.entryFee > 0 ? `Register · ${feeLabel(t.entryFee)}` : "Register"}
              </Button>
              {t.entryFee > 0 && !full && (
                <p className="text-xs text-muted-foreground text-center">Paid from your Envo wallet. Non-refundable once confirmed.</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {myEntry && <MyEntryCard t={t} entry={myEntry} />}

      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Registered players ({players.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {players.length === 0 ? (
            <p className="text-sm text-muted-foreground">No one yet — be the first!</p>
          ) : (
            <ol className="space-y-1.5 text-sm">
              {players.map((p, i) => (
                <li key={i} className="flex gap-3">
                  <span className="w-6 text-right text-muted-foreground">{i + 1}.</span>
                  <span>{[p.name, ...p.teammates].join(" & ")}</span>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>

      {dialog && <SignupDialog t={t} mode={dialog} open onOpenChange={(v) => !v && setDialog(null)} />}
    </TournamentPageShell>
  );
}
