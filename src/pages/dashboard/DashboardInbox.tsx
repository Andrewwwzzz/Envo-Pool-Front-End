import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Bell, BellOff, BellRing, Calendar, Wallet, Gift, Crown, Timer, ShieldCheck, Package, Info, Share, Loader2, CheckCheck, Megaphone, ArrowRight, ExternalLink } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { BASE_URL } from "@/lib/api";
import { useInbox, useMarkRead, useMarkAllRead, usePushNotifications, type InboxItem } from "@/hooks/useNotifications";

const TYPE_ICONS: Record<string, typeof Bell> = {
  booking: Calendar,
  wallet: Wallet,
  reward: Gift,
  membership: Crown,
  session: Timer,
  account: ShieldCheck,
  stock: Package,
  staff: Info,
  notice: Megaphone,
};

// Button text for the page a message links to.
const LINK_LABELS: Record<string, string> = {
  "/booking": "Book a Table",
  "/dashboard": "Go to Dashboard",
  "/dashboard/rewards": "View My Rewards",
  "/dashboard/membership": "View Membership",
  "/dashboard/fnb": "Order F&B",
  "/dashboard/bookings": "View My Bookings",
  "/dashboard/transactions": "View Transactions",
  "/admin": "Open Admin",
};

function fmtFull(iso: string) {
  return new Date(iso).toLocaleString("en-SG", { timeZone: "Asia/Singapore", weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

// Full view of one message: image (tap to see full size), title, full
// text, when it arrived, and a button to the related page.
function MessageDialog({ item, onClose }: { item: InboxItem | null; onClose: () => void }) {
  const navigate = useNavigate();
  const Icon = item ? TYPE_ICONS[item.type] ?? Bell : Bell;
  const isExternal = !!item?.url && /^https:\/\//i.test(item.url);
  const linkLabel = item?.url ? item.buttonLabel || LINK_LABELS[item.url.split("?")[0]] || "Open" : null;
  const go = () => {
    if (!item?.url) return;
    onClose();
    // Other websites open in a new tab so the customer doesn't lose the app.
    if (isExternal) window.open(item.url, "_blank", "noopener,noreferrer");
    else navigate(item.url);
  };

  return (
    <Dialog open={!!item} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg p-0 overflow-hidden gap-0 max-h-[90vh] overflow-y-auto">
        {item?.imageUrl && (
          <a href={`${BASE_URL}${item.imageUrl}`} target="_blank" rel="noopener noreferrer" title="Open full-size image">
            <img src={`${BASE_URL}${item.imageUrl}`} alt="" className="w-full max-h-[55vh] object-contain bg-black" />
          </a>
        )}
        <div className="p-5 space-y-4">
          <DialogHeader className="text-left space-y-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Icon className="h-3.5 w-3.5 text-accent" /> {item ? fmtFull(item.createdAt) : ""}
            </div>
            <DialogTitle className="text-lg leading-snug">{item?.title}</DialogTitle>
            {item?.body && (
              <DialogDescription className="text-sm text-foreground/80 whitespace-pre-line leading-relaxed">{item.body}</DialogDescription>
            )}
          </DialogHeader>
          {item?.url && (
            <Button className="w-full gap-2" onClick={go}>
              {linkLabel} {isExternal ? <ExternalLink className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString("en-SG", { timeZone: "Asia/Singapore", day: "numeric", month: "short" });
}

function PushCard() {
  const { toast } = useToast();
  const { state, busy, enable, disable } = usePushNotifications();

  if (state === "unsupported") return null;

  if (state === "on") {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
        <div className="flex items-center gap-2 text-sm text-emerald-300">
          <BellRing className="h-4 w-4 shrink-0" /> Notifications are on for this device.
        </div>
        <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={disable} disabled={busy}>Turn off</Button>
      </div>
    );
  }

  if (state === "needs-install") {
    return (
      <div className="rounded-lg border border-accent/30 bg-accent/10 px-4 py-3 space-y-1">
        <p className="text-sm font-medium flex items-center gap-2"><Bell className="h-4 w-4 text-accent" /> Get notifications on your iPhone</p>
        <p className="text-xs text-muted-foreground">
          Tap <Share className="inline h-3.5 w-3.5 -mt-0.5" /> <strong>Share</strong> → <strong>Add to Home Screen</strong>, then open Envo Pool from your home screen and come back here to turn notifications on.
        </p>
      </div>
    );
  }

  if (state === "denied") {
    return (
      <div className="rounded-lg border border-border px-4 py-3 space-y-1">
        <p className="text-sm font-medium flex items-center gap-2"><BellOff className="h-4 w-4 text-muted-foreground" /> Notifications are blocked</p>
        <p className="text-xs text-muted-foreground">Allow notifications for Envo Pool in your phone or browser settings to get alerts. Everything still appears in this inbox.</p>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-accent/30 bg-accent/10 px-4 py-3">
      <div className="text-sm">
        <p className="font-medium flex items-center gap-2"><Bell className="h-4 w-4 text-accent" /> Turn on notifications</p>
        <p className="text-xs text-muted-foreground mt-0.5">Top-ups, bookings, rewards and membership updates — straight to your phone.</p>
      </div>
      <Button
        size="sm"
        className="shrink-0"
        disabled={busy}
        onClick={async () => {
          try {
            const ok = await enable();
            toast(ok ? { title: "Notifications turned on" } : { title: "Notifications not allowed", variant: "destructive" });
          } catch (e: any) {
            toast({ title: "Couldn't turn on notifications", description: e?.message, variant: "destructive" });
          }
        }}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Turn on"}
      </Button>
    </div>
  );
}

export default function DashboardInbox() {
  const { toast } = useToast();
  const { data, isLoading } = useInbox();
  const markRead = useMarkRead();
  const markAll = useMarkAllRead();
  const items = data?.items ?? [];
  const unread = data?.unread ?? 0;

  const [selected, setSelected] = useState<InboxItem | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();

  // Tapping a message in the list opens it as a pop-up. The server keeps
  // only the first real open, so re-opening doesn't skew the analytics.
  const open = (n: InboxItem) => {
    markRead.mutate(n._id);
    setSelected(n);
  };

  // Arrived from a phone notification (?open=<id>) — show that message
  // straight away. The tap itself is recorded by NotificationTapTracker
  // as "from phone", so it isn't marked read here as an Inbox open.
  const openId = searchParams.get("open");
  useEffect(() => {
    if (!openId || !data) return;
    const found = data.items.find((i) => i._id === openId);
    if (found) setSelected(found);
    else toast({ title: "This message is no longer available", description: "It may have been withdrawn by Envo Pool." });
    setSearchParams((prev) => { prev.delete("open"); return prev; }, { replace: true });
  }, [openId, data]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-4">
      <PushCard />

      <Card className="card-premium">
        <CardContent className="p-0">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
            <p className="text-sm font-medium">{unread > 0 ? `${unread} unread` : "All caught up"}</p>
            {unread > 0 && (
              <Button size="sm" variant="ghost" className="h-8 gap-1.5 text-muted-foreground" onClick={() => markAll.mutate()} disabled={markAll.isPending}>
                <CheckCheck className="h-4 w-4" /> Mark all read
              </Button>
            )}
          </div>

          {isLoading ? (
            <div className="p-4 space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
          ) : items.length === 0 ? (
            <div className="px-4 py-12 text-center space-y-2">
              <Bell className="h-8 w-8 mx-auto text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">No messages yet. Updates about your bookings, top-ups and rewards will show up here.</p>
            </div>
          ) : (
            <ul className="divide-y divide-border/50">
              {items.map((n) => {
                const Icon = TYPE_ICONS[n.type] ?? Bell;
                return (
                  <li key={n._id}>
                    <button
                      type="button"
                      onClick={() => open(n)}
                      className={`w-full text-left flex gap-3 px-4 py-3 hover:bg-muted/30 transition-colors ${n.read ? "" : "bg-accent/5"}`}
                    >
                      <div className={`mt-0.5 h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${n.read ? "bg-muted/40 text-muted-foreground" : "bg-accent/15 text-accent"}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className={`text-sm ${n.read ? "text-foreground/80" : "font-semibold text-foreground"}`}>{n.title}</p>
                          <span className="text-[11px] text-muted-foreground shrink-0 mt-0.5">{timeAgo(n.createdAt)}</span>
                        </div>
                        {n.body && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>}
                        {n.imageUrl && (
                          <img
                            src={`${BASE_URL}${n.imageUrl}`}
                            alt=""
                            loading="lazy"
                            className="mt-2 w-full max-h-40 object-cover rounded-md border border-border/50"
                          />
                        )}
                      </div>
                      {!n.read && <span className="mt-2 h-2 w-2 rounded-full bg-accent shrink-0" aria-label="Unread" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <MessageDialog item={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
