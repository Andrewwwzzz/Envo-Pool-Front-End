import { Link } from "react-router-dom";
import { CalendarDays, Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useMyTournaments, type EntryStatus } from "@/hooks/useTournaments";
import { fmtDateTimeSG } from "@/lib/sgTime";

const STATUS: Record<EntryStatus, { label: string; className: string }> = {
  confirmed: { label: "Registered", className: "bg-green-500/20 text-green-400 border-green-500/30" },
  waitlisted: { label: "Waitlist", className: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
  revoked: { label: "Removed", className: "bg-destructive/20 text-destructive border-destructive/30" },
  cancelled: { label: "Cancelled", className: "bg-destructive/20 text-destructive border-destructive/30" },
};

export default function DashboardTournaments() {
  const { data: entries = [], isLoading } = useMyTournaments();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">Tournaments you've signed up for.</p>
        <Link to="/tournaments">
          <Button size="sm" variant="outline" className="border-accent text-accent hover:bg-accent hover:text-accent-foreground">
            <Trophy className="h-4 w-4 mr-1" /> Browse tournaments
          </Button>
        </Link>
      </div>

      {isLoading && <p className="text-center text-muted-foreground py-10">Loading…</p>}
      {!isLoading && entries.length === 0 && (
        <p className="text-center text-muted-foreground py-10">You haven't signed up for any tournaments yet.</p>
      )}

      <div className="space-y-2">
        {entries.map((e) => (
          <Link key={e._id} to={`/tournaments/${e.tournament._id}`} className="block">
            <Card className="border-border/50 hover:border-accent/50 transition-colors">
              <CardContent className="p-4 space-y-1.5">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-semibold">{e.tournament.name}</p>
                  <Badge className={STATUS[e.status].className}>{STATUS[e.status].label}</Badge>
                </div>
                <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                  <CalendarDays className="h-4 w-4" />{fmtDateTimeSG(e.tournament.startsAt)}
                </p>
                {e.teammates.length > 0 && <p className="text-sm"><span className="text-muted-foreground">Team:</span> {e.teammates.join(", ")}</p>}
                {e.status === "confirmed" && e.amountPaid > 0 && <p className="text-xs text-muted-foreground">Paid ${e.amountPaid.toFixed(2)}</p>}
                {e.refundAmount > 0 && <p className="text-xs text-muted-foreground">Refunded ${e.refundAmount.toFixed(2)} to wallet</p>}
                {e.status === "waitlisted" && e.tournament.registrationOpen && (e.tournament.spotsLeft ?? 1) > 0 && (
                  <p className="text-xs font-medium text-amber-400">A slot is open — tap to claim it</p>
                )}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
