import { Link } from "react-router-dom";
import { ArrowLeft, CalendarDays, Trophy, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useTournaments, feeLabel, formatLabel, type Tournament } from "@/hooks/useTournaments";
import { fmtDateTimeSG } from "@/lib/sgTime";

export function TournamentPageShell({ title, back, children }: { title: string; back: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background dark">
      <div className="fixed inset-0 opacity-[0.02]" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, hsl(var(--foreground)) 1px, transparent 0)", backgroundSize: "40px 40px" }} />
      <header
        className="relative z-10 border-b border-border/50 bg-card/80 backdrop-blur-md px-4 sm:px-6 py-3 sm:py-4 flex items-center gap-3"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 12px)" }}
      >
        <Link to={back}>
          <Button variant="ghost" size="sm"><ArrowLeft className="mr-2 h-4 w-4" /> Back</Button>
        </Link>
        <h1 className="text-xl font-bold tracking-tight gold-gradient truncate">{title}</h1>
      </header>
      <main className="relative z-10 mx-auto max-w-3xl px-4 sm:px-6 pt-4 sm:pt-6 space-y-4" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 1.5rem)" }}>
        {children}
      </main>
    </div>
  );
}

/** Open / Full / Closed / Cancelled badge for a tournament. */
export function TournamentStatusBadge({ t }: { t: Tournament }) {
  if (t.status === "cancelled") return <Badge variant="destructive">Cancelled</Badge>;
  if (t.status === "draft") return <Badge variant="outline">Draft</Badge>;
  if (new Date(t.startsAt) < new Date()) return <Badge variant="outline" className="text-muted-foreground">Finished</Badge>;
  if (!t.registrationOpen) return <Badge variant="outline" className="text-muted-foreground">Registration closed</Badge>;
  if (t.spotsLeft === 0) return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">Full · waitlist open</Badge>;
  return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Open</Badge>;
}


function TournamentCard({ t }: { t: Tournament }) {
  return (
    <Link to={`/tournaments/${t._id}`} className="block">
      <Card className="border-border/50 hover:border-accent/50 transition-colors">
        <CardContent className="p-4 space-y-2">
          <div className="flex items-start justify-between gap-3">
            <p className="font-semibold text-foreground">{t.name}</p>
            <TournamentStatusBadge t={t} />
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5"><CalendarDays className="h-4 w-4" />{fmtDateTimeSG(t.startsAt)}</span>
            <span className="flex items-center gap-1.5">
              <Users className="h-4 w-4" />
              {t.maxEntries == null ? `${t.confirmedCount} registered` : `${t.confirmedCount}/${t.maxEntries} slots`}
            </span>
            <span>{formatLabel(t.teamSize)}</span>
            <span className="text-accent font-medium">{feeLabel(t.entryFee)}</span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export default function Tournaments() {
  const { data, isLoading, isError } = useTournaments();
  const upcoming = data?.upcoming ?? [];
  const past = data?.past ?? [];

  return (
    <TournamentPageShell title="Tournaments" back="/">
      {isLoading && <p className="text-center text-muted-foreground py-10">Loading tournaments…</p>}
      {isError && <p className="text-center text-destructive py-10">Couldn't load tournaments. Please try again.</p>}

      {!isLoading && !isError && upcoming.length === 0 && (
        <div className="text-center py-12 space-y-2">
          <Trophy className="h-10 w-10 mx-auto text-muted-foreground/50" />
          <p className="text-muted-foreground">No upcoming tournaments right now. Check back soon.</p>
        </div>
      )}

      <div className="space-y-3">
        {upcoming.map((t) => <TournamentCard key={t._id} t={t} />)}
      </div>

      {past.length > 0 && (
        <div className="space-y-3 pt-4">
          <h2 className="text-sm font-medium text-muted-foreground">Past tournaments</h2>
          {past.map((t) => <TournamentCard key={t._id} t={t} />)}
        </div>
      )}
    </TournamentPageShell>
  );
}
