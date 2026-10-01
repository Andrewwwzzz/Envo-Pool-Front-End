import { useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { ChevronDown, LayoutGrid } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

/** One screen (the value matches a <TabsContent> in Admin.tsx). */
export interface AdminPage {
  value: string;
  label: string;
  /** Count shown as a red badge (e.g. pending orders). */
  badge?: number;
}

/** A top-level section; sections with more than one page show sub-tabs. */
export interface AdminSection {
  key: string;
  label: string;
  icon: LucideIcon;
  pages: AdminPage[];
}

function CountBadge({ n, className }: { n?: number; className?: string }) {
  if (!n) return null;
  return (
    <span className={cn("min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center", className)}>
      {n > 99 ? "99+" : n}
    </span>
  );
}

const sectionBadge = (s: AdminSection) => s.pages.reduce((n, p) => n + (p.badge || 0), 0);

/**
 * Two-level navigation: sections (Payments, Members, …) and, where a
 * section has several pages, a row of sub-tabs. Desktop shows the
 * sections as a tab row; phones get one sticky button that opens them as
 * a grid. `tab` / `onChange` work with page values, so the existing
 * <TabsContent> blocks stay as they are.
 */
export function AdminNav({ sections, tab, onChange }: { sections: AdminSection[]; tab: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  // Last page used in each section, so going back to a section returns to it.
  const lastPage = useRef<Record<string, string>>({});
  const current = sections.find((s) => s.pages.some((p) => p.value === tab)) ?? sections[0];
  if (current) lastPage.current[current.key] = tab;
  const totalBadge = sections.reduce((n, s) => n + sectionBadge(s), 0);

  const goSection = (s: AdminSection) => {
    const remembered = lastPage.current[s.key];
    onChange(s.pages.some((p) => p.value === remembered) ? remembered : s.pages[0].value);
    setOpen(false);
    window.scrollTo({ top: 0 });
  };

  const subTabs = current && current.pages.length > 1 && (
    <div className="flex gap-1.5 overflow-x-auto">
      {current.pages.map((p) => (
        <button
          key={p.value}
          type="button"
          onClick={() => onChange(p.value)}
          className={cn(
            "relative shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
            p.value === tab ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground",
          )}
        >
          <span className="flex items-center gap-1.5">
            {p.label}
            <CountBadge n={p.badge} />
          </span>
        </button>
      ))}
    </div>
  );

  return (
    <>
      {/* Desktop / tablet */}
      <div className="hidden md:block space-y-3">
        <div className="overflow-x-auto pb-1">
          <div className="inline-flex w-max min-w-full gap-0.5 rounded-md bg-muted p-1">
            {sections.map((s) => {
              const active = s.key === current?.key;
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => goSection(s)}
                  className={cn(
                    "relative inline-flex items-center gap-1.5 whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium transition-all",
                    active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <s.icon className="h-4 w-4" />
                  {s.label}
                  <CountBadge n={sectionBadge(s)} className="absolute -top-2 -right-2 shadow-md" />
                </button>
              );
            })}
          </div>
        </div>
        {subTabs}
      </div>

      {/* Phone */}
      <div className="md:hidden sticky top-0 z-30 -mx-3 px-3 py-2 space-y-2 bg-background/95 backdrop-blur border-b border-border">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5 text-left active:bg-muted"
        >
          {current && <current.icon className="h-5 w-5 text-primary shrink-0" />}
          <span className="flex-1 truncate font-medium">{current?.label}</span>
          {totalBadge > 0 && <CountBadge n={totalBadge} />}
          <span className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
            <LayoutGrid className="h-4 w-4" /> All sections <ChevronDown className="h-4 w-4" />
          </span>
        </button>
        {subTabs}
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-2xl px-4 pt-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
          <SheetHeader className="text-left">
            <SheetTitle>Go to</SheetTitle>
          </SheetHeader>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {sections.map((s) => {
              const active = s.key === current?.key;
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => goSection(s)}
                  className={cn(
                    "relative flex flex-col items-center justify-center gap-1.5 rounded-xl border px-2 py-3.5 text-xs font-medium transition-colors",
                    active ? "border-primary bg-primary/10 text-primary" : "border-border bg-card active:bg-muted",
                  )}
                >
                  <s.icon className="h-5 w-5" />
                  <span className="text-center leading-tight">{s.label}</span>
                  {s.pages.length > 1 && (
                    <span className="text-[10px] font-normal text-muted-foreground text-center leading-tight">
                      {s.pages.map((p) => p.label).join(" · ")}
                    </span>
                  )}
                  <CountBadge n={sectionBadge(s)} className="absolute top-1.5 right-1.5" />
                </button>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
