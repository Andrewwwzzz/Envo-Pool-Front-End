import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, CheckCircle2, ChevronRight, Coffee, Wallet, Calculator, Timer, PackageX } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useAdminTables } from "@/hooks/useAdmin";
import { useAdminMenu } from "@/hooks/useFnb";

const HOUR = 3600e3;
const LONG_SESSION_HOURS = 5;

const sgtNow = () => new Date(Date.now() + 8 * HOUR);
const sgtDateStr = (d: Date) => d.toISOString().slice(0, 10);

type Slot = { shiftType: "morning" | "night"; phase: "opening" | "closing"; filled: boolean };

function useChecklist(date: string, enabled: boolean) {
  return useQuery({
    queryKey: ["cashcount-checklist", date],
    queryFn: async () => {
      const r = await apiFetch(`/api/cashcount/checklist?date=${date}`);
      if (!r.ok) return { date, slots: [] as Slot[] };
      return r.json() as Promise<{ date: string; slots: Slot[] }>;
    },
    enabled,
    refetchInterval: 60_000,
  });
}

interface Item {
  key: string;
  icon: LucideIcon;
  text: string;
  detail?: string;
  goTo: string;
  urgent?: boolean;
}

/**
 * "Needs attention" list for the top of the Today screen — everything staff
 * should act on right now, each linking straight to where it's handled.
 */
export function TodayPanel({ can, fnbPending, topupPending, onGo }: {
  can: (key: string) => boolean;
  fnbPending: number;
  topupPending: number;
  onGo: (page: string) => void;
}) {
  const now = sgtNow();
  const today = sgtDateStr(now);
  const yesterday = sgtDateStr(new Date(now.getTime() - 24 * HOUR));
  const minsNow = now.getUTCHours() * 60 + now.getUTCMinutes();

  const { data: todayCounts } = useChecklist(today, can("cashcount"));
  const { data: yCounts } = useChecklist(yesterday, can("cashcount"));
  const { data: tables = [] } = useAdminTables();
  const { data: products = [] } = useAdminMenu();

  const items: Item[] = [];

  if (can("fnb") && fnbPending > 0) {
    items.push({ key: "fnb", icon: Coffee, text: `${fnbPending} F&B order${fnbPending > 1 ? "s" : ""} waiting to be served`, goTo: "fnb", urgent: true });
  }
  if (can("topups") && topupPending > 0) {
    items.push({ key: "topups", icon: Wallet, text: `${topupPending} top-up request${topupPending > 1 ? "s" : ""} waiting for approval`, goTo: "topups", urgent: true });
  }

  if (can("cashcount")) {
    // Counts that should have been done by now (SGT): morning opening from
    // 10:30, handover (morning closing + night opening) from 18:30, and
    // last night's closing once it's past 3am.
    const missing: string[] = [];
    const filled = (slots: Slot[] | undefined, shift: string, phase: string) => !!slots?.find((s) => s.shiftType === shift && s.phase === phase)?.filled;
    if (todayCounts && minsNow >= 10 * 60 + 30 && !filled(todayCounts.slots, "morning", "opening")) missing.push("morning opening");
    if (todayCounts && minsNow >= 18 * 60 + 30) {
      if (!filled(todayCounts.slots, "morning", "closing")) missing.push("morning closing");
      if (!filled(todayCounts.slots, "night", "opening")) missing.push("night opening");
    }
    if (yCounts && minsNow >= 3 * 60 && !filled(yCounts.slots, "night", "closing")) missing.push("last night's closing");
    if (missing.length) {
      items.push({ key: "cash", icon: Calculator, text: `Cash count not done: ${missing.join(", ")}`, goTo: "cashcount" });
    }
  }

  if (can("tables")) {
    const long = (tables as any[]).filter((t) => t.timer_started_at && Date.now() - new Date(t.timer_started_at).getTime() > LONG_SESSION_HOURS * HOUR);
    for (const t of long) {
      const hrs = Math.floor((Date.now() - new Date(t.timer_started_at).getTime()) / HOUR);
      items.push({ key: `table-${t.id}`, icon: Timer, text: `Table ${t.table_number} has been open for ${hrs}h`, detail: "Check it wasn't left running", goTo: "tables" });
    }
  }

  if (can("fnb")) {
    const low = products.filter((p) => p.isActive && p.lowStockThreshold > 0 && p.stock <= p.lowStockThreshold);
    if (low.length) {
      items.push({
        key: "stock", icon: PackageX,
        text: `${low.length} F&B item${low.length > 1 ? "s" : ""} low on stock`,
        detail: low.slice(0, 4).map((p) => `${p.name} (${p.stock})`).join(", ") + (low.length > 4 ? ` +${low.length - 4} more` : ""),
        goTo: "fnb",
      });
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          {items.length ? <AlertTriangle className="h-4 w-4 text-amber-500" /> : <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
          {items.length ? "Needs attention" : "All clear"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {!items.length && <p className="text-sm text-muted-foreground">Nothing needs doing right now.</p>}
        {items.map((it) => (
          <button
            key={it.key}
            type="button"
            onClick={() => onGo(it.goTo)}
            className={`w-full flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors hover:bg-muted/50 ${it.urgent ? "border-amber-500/40 bg-amber-500/5" : "border-border"}`}
          >
            <it.icon className={`h-5 w-5 shrink-0 ${it.urgent ? "text-amber-500" : "text-muted-foreground"}`} />
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-medium">{it.text}</span>
              {it.detail && <span className="block text-xs text-muted-foreground truncate">{it.detail}</span>}
            </span>
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          </button>
        ))}
      </CardContent>
    </Card>
  );
}
