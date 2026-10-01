import { useState } from "react";
import type { LucideIcon } from "lucide-react";
import { ChevronDown, LayoutGrid } from "lucide-react";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export interface AdminSection {
  value: string;
  label: string;
  icon: LucideIcon;
  group: string;
  /** Count shown as a red badge (e.g. pending orders). */
  badge?: number;
}

const GROUP_ORDER = ["Front desk", "Customers", "Sales & marketing", "Team"];

function CountBadge({ n, className }: { n?: number; className?: string }) {
  if (!n) return null;
  return (
    <span className={cn("min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center", className)}>
      {n > 99 ? "99+" : n}
    </span>
  );
}

/**
 * Desktop: the usual row of tabs.
 * Phones: one "section" button that stays at the top while scrolling and
 * opens every section as a grouped grid — instead of a long sideways strip.
 * Must be rendered inside the page's <Tabs>.
 */
export function AdminNav({ sections, tab, onChange }: { sections: AdminSection[]; tab: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const current = sections.find((s) => s.value === tab) ?? sections[0];
  const totalBadge = sections.reduce((s, x) => s + (x.badge || 0), 0);
  const groups = GROUP_ORDER.map((g) => ({ name: g, items: sections.filter((s) => s.group === g) })).filter((g) => g.items.length);

  const pick = (v: string) => {
    onChange(v);
    setOpen(false);
    window.scrollTo({ top: 0 });
  };

  return (
    <>
      {/* Desktop / tablet */}
      <div className="hidden md:block overflow-x-auto pb-1">
        <TabsList className="inline-flex w-max gap-0.5 min-w-full">
          {sections.map((s) => (
            <TabsTrigger key={s.value} value={s.value} className="relative">
              {s.label}
              <CountBadge n={s.badge} className="absolute -top-2 -right-2 shadow-md" />
            </TabsTrigger>
          ))}
        </TabsList>
      </div>

      {/* Phone */}
      <div className="md:hidden sticky top-0 z-30 -mx-3 px-3 py-2 bg-background/95 backdrop-blur border-b border-border">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5 text-left active:bg-muted"
        >
          {current && <current.icon className="h-5 w-5 text-primary shrink-0" />}
          <span className="flex-1 font-medium truncate">{current?.label}</span>
          {totalBadge > 0 && current?.badge !== totalBadge && <CountBadge n={totalBadge} />}
          <span className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
            <LayoutGrid className="h-4 w-4" /> All sections <ChevronDown className="h-4 w-4" />
          </span>
        </button>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-2xl px-4 pt-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
          <SheetHeader className="text-left">
            <SheetTitle>Go to</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-5">
            {groups.map((g) => (
              <div key={g.name}>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{g.name}</p>
                <div className="grid grid-cols-3 gap-2">
                  {g.items.map((s) => {
                    const active = s.value === tab;
                    return (
                      <button
                        key={s.value}
                        type="button"
                        onClick={() => pick(s.value)}
                        className={cn(
                          "relative flex flex-col items-center justify-center gap-1.5 rounded-xl border px-2 py-3 text-xs font-medium transition-colors",
                          active ? "border-primary bg-primary/10 text-primary" : "border-border bg-card active:bg-muted",
                        )}
                      >
                        <s.icon className="h-5 w-5" />
                        <span className="text-center leading-tight">{s.label}</span>
                        <CountBadge n={s.badge} className="absolute top-1.5 right-1.5" />
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
