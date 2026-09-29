import { useRef, useState } from "react";
import { Megaphone, Users, UserCheck, X, Loader2, Send, BellRing, ImagePlus, Eye, Smartphone, Inbox as InboxIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAdminCustomers } from "@/hooks/useAdmin";
import { BASE_URL } from "@/lib/api";
import {
  useNoticeAudience, useSentNotices, useSendNotice, useAnnouncementRecipients,
  type SentAnnouncement, type AnnouncementRecipient,
} from "@/hooks/useNotifications";

// One-tap shortcuts for the button link — pages inside the app.
const QUICK_LINKS: { value: string; label: string }[] = [
  { value: "/booking", label: "Book a Table" },
  { value: "/dashboard/rewards", label: "My Rewards" },
  { value: "/dashboard/membership", label: "Membership" },
  { value: "/dashboard/fnb", label: "F&B" },
  { value: "/dashboard", label: "Top Up" },
];

const BUTTON_MAX = 30;

// A page on this site ("/booking") or a full https:// link — same rule the server enforces.
function isValidLink(url: string) {
  if (url.startsWith("/")) return !url.startsWith("//") && !url.includes("\\");
  try { return new URL(url).protocol === "https:"; } catch { return false; }
}

const TITLE_MAX = 80;
const BODY_MAX = 500;
const IMAGE_MAX_PX = 1200;

function fmtWhen(iso: string) {
  return new Date(iso).toLocaleString("en-SG", { timeZone: "Asia/Singapore", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0);

// Shrinks the photo before upload (max 1200px, JPEG) so it loads fast in
// inboxes and phone notifications, and stays well under the upload limit.
async function compressImage(file: File): Promise<Blob> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = reject;
    el.src = URL.createObjectURL(file);
  });
  const scale = Math.min(1, IMAGE_MAX_PX / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
  URL.revokeObjectURL(img.src);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't process image"))), "image/jpeg", 0.85)
  );
}

const STATUS_LABEL: Record<AnnouncementRecipient["status"], string> = {
  tapped_push: "Tapped phone notification",
  opened_inbox: "Opened in Inbox",
  dismissed: "Cleared without opening",
  not_opened: "Not opened",
};
const STATUS_CLASS: Record<AnnouncementRecipient["status"], string> = {
  tapped_push: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
  opened_inbox: "bg-blue-500/15 text-blue-600 border-blue-500/30",
  dismissed: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  not_opened: "text-muted-foreground",
};

function RecipientsDialog({ announcement, onClose }: { announcement: SentAnnouncement | null; onClose: () => void }) {
  const { data = [], isLoading } = useAnnouncementRecipients(announcement?._id ?? null);
  const [filter, setFilter] = useState<"all" | AnnouncementRecipient["status"]>("all");
  const rows = filter === "all" ? data : data.filter((r) => r.status === filter);

  return (
    <Dialog open={!!announcement} onOpenChange={(o) => { if (!o) { onClose(); setFilter("all"); } }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{announcement?.title}</DialogTitle>
          <DialogDescription>
            Sent {announcement ? fmtWhen(announcement.sentAt) : ""} to {announcement?.recipients} people · {announcement ? pct(announcement.opened, announcement.recipients) : 0}% opened
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-1.5 flex-wrap">
          {(["all", "tapped_push", "opened_inbox", "dismissed", "not_opened"] as const).map((f) => (
            <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} className="h-7 text-xs" onClick={() => setFilter(f)}>
              {f === "all" ? `All (${data.length})` : `${STATUS_LABEL[f]} (${data.filter((r) => r.status === f).length})`}
            </Button>
          ))}
        </div>
        <div className="max-h-[50vh] overflow-y-auto rounded-md border">
          {isLoading ? (
            <div className="p-4 text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
          ) : rows.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">No one here.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-background">
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="px-3 py-2">Customer</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">When</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="px-3 py-2">
                      <div className="font-medium flex items-center gap-1.5">
                        {r.name}
                        {r.hasPush && <span title="Has phone notifications on"><Smartphone className="h-3 w-3 text-muted-foreground" /></span>}
                      </div>
                      <div className="text-xs text-muted-foreground">{r.phone || r.email || "—"}</div>
                    </td>
                    <td className="px-3 py-2"><Badge variant="outline" className={STATUS_CLASS[r.status]}>{STATUS_LABEL[r.status]}</Badge></td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{r.openedAt ? fmtWhen(r.openedAt) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function AnnouncementsTab() {
  const { toast } = useToast();
  const { data: audienceInfo } = useNoticeAudience();
  const { data: sent = [] } = useSentNotices();
  const send = useSendNotice();
  const fileRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [buttonLabel, setButtonLabel] = useState("");
  const [buttonUrl, setButtonUrl] = useState("");
  const [image, setImage] = useState<Blob | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBusy, setImageBusy] = useState(false);
  const [audience, setAudience] = useState<"all" | "selected">("all");
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<{ id: string; name: string; email: string }[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [viewing, setViewing] = useState<SentAnnouncement | null>(null);
  const { data: customers = [] } = useAdminCustomers(search);

  const recipientCount = audience === "all" ? (audienceInfo?.allCustomers ?? 0) : picked.length;
  // Like Campaigns: the button needs both text and a link, or neither.
  const btnText = buttonLabel.trim();
  const btnUrl = buttonUrl.trim();
  const buttonProblem =
    btnText && !btnUrl ? "Add a link for the button" :
    !btnText && btnUrl ? "Add button text" :
    btnUrl && !isValidLink(btnUrl) ? "Link must start with https:// (or pick a page below)" :
    null;
  const hasButton = !!btnText && !!btnUrl && !buttonProblem;
  const canSend = title.trim().length > 0 && recipientCount > 0 && !imageBusy && !buttonProblem;

  const pickImage = async (file: File | undefined) => {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast({ title: "Use a JPG, PNG or WebP image", variant: "destructive" });
      return;
    }
    setImageBusy(true);
    try {
      const blob = await compressImage(file);
      setImage(blob);
      if (imagePreview) URL.revokeObjectURL(imagePreview);
      setImagePreview(URL.createObjectURL(blob));
    } catch (e: any) {
      toast({ title: "Couldn't use that image", description: e?.message, variant: "destructive" });
    } finally {
      setImageBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const removeImage = () => {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImage(null);
    setImagePreview(null);
  };

  const togglePick = (c: any) => {
    setPicked((prev) => prev.some((p) => p.id === c.id)
      ? prev.filter((p) => p.id !== c.id)
      : [...prev, { id: c.id, name: c.name || c.legal_name || c.email, email: c.email }]);
  };

  const doSend = async () => {
    try {
      const res = await send.mutateAsync({
        title: title.trim(),
        body: body.trim(),
        url: hasButton ? btnUrl : null,
        buttonLabel: hasButton ? btnText : null,
        audience,
        userIds: audience === "selected" ? picked.map((p) => p.id) : undefined,
        image,
      });
      toast({ title: res.message, description: res.pushed ? `${res.pushed} also got it as a phone notification.` : undefined });
      setConfirmOpen(false);
      setTitle(""); setBody(""); setButtonLabel(""); setButtonUrl(""); setPicked([]); setSearch(""); removeImage();
    } catch (e: any) {
      toast({ title: "Couldn't send announcement", description: e?.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Megaphone className="h-4 w-4" /> New Announcement</CardTitle>
          <p className="text-xs text-muted-foreground">
            Goes to each person's Inbox, and to their phone if they've turned notifications on.
            {audienceInfo && ` ${audienceInfo.withPush} of ${audienceInfo.allCustomers} customers currently have phone notifications on.`}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="space-y-1.5">
                <div className="flex justify-between"><Label>Title</Label><span className="text-xs text-muted-foreground">{title.length}/{TITLE_MAX}</span></div>
                <Input value={title} maxLength={TITLE_MAX} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. 9-Ball Tournament this Saturday!" />
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between"><Label>Message</Label><span className="text-xs text-muted-foreground">{body.length}/{BODY_MAX}</span></div>
                <Textarea value={body} maxLength={BODY_MAX} onChange={(e) => setBody(e.target.value)} rows={4} placeholder="Details — date, time, prizes, how to join…" />
              </div>

              <div className="space-y-1.5">
                <Label>Image (optional)</Label>
                <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => pickImage(e.target.files?.[0])} />
                {imagePreview ? (
                  <div className="relative">
                    <img src={imagePreview} alt="Announcement" className="w-full max-h-56 object-cover rounded-md border" />
                    <Button size="sm" variant="secondary" className="absolute top-2 right-2 h-7 gap-1" onClick={removeImage}>
                      <X className="h-3.5 w-3.5" /> Remove
                    </Button>
                  </div>
                ) : (
                  <Button type="button" variant="outline" className="w-full gap-2" onClick={() => fileRef.current?.click()} disabled={imageBusy}>
                    {imageBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />} Add image
                  </Button>
                )}
              </div>

              <div className="space-y-2 rounded-md border border-border p-3">
                <Label>Button (optional)</Label>
                <div className="space-y-1.5">
                  <div className="flex justify-between"><span className="text-xs text-muted-foreground">Button text</span><span className="text-xs text-muted-foreground">{buttonLabel.length}/{BUTTON_MAX}</span></div>
                  <Input value={buttonLabel} maxLength={BUTTON_MAX} onChange={(e) => setButtonLabel(e.target.value)} placeholder="e.g. Sign Up, Learn More" />
                </div>
                <div className="space-y-1.5">
                  <span className="text-xs text-muted-foreground">Button link</span>
                  <Input value={buttonUrl} onChange={(e) => setButtonUrl(e.target.value)} placeholder="https://… or pick a page below" />
                  <div className="flex flex-wrap gap-1.5">
                    {QUICK_LINKS.map((l) => (
                      <Button key={l.value} type="button" size="sm" variant={btnUrl === l.value ? "default" : "outline"} className="h-7 text-xs"
                        onClick={() => { setButtonUrl(l.value); if (!btnText) setButtonLabel(l.label); }}>
                        {l.label}
                      </Button>
                    ))}
                  </div>
                </div>
                {buttonProblem && <p className="text-xs text-destructive">{buttonProblem}</p>}
                {hasButton && (
                  <p className="text-xs text-muted-foreground">
                    {btnUrl.startsWith("/") ? "Opens inside the app." : "Opens the website in a new tab."}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Send to</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Button type="button" variant={audience === "all" ? "default" : "outline"} onClick={() => setAudience("all")} className="gap-2">
                    <Users className="h-4 w-4" /> All customers{audienceInfo ? ` (${audienceInfo.allCustomers})` : ""}
                  </Button>
                  <Button type="button" variant={audience === "selected" ? "default" : "outline"} onClick={() => setAudience("selected")} className="gap-2">
                    <UserCheck className="h-4 w-4" /> Specific people
                  </Button>
                </div>
              </div>

              {audience === "selected" && (
                <div className="space-y-2">
                  {picked.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {picked.map((p) => (
                        <Badge key={p.id} variant="secondary" className="gap-1 pr-1">
                          {p.name}
                          <button type="button" onClick={() => setPicked((prev) => prev.filter((x) => x.id !== p.id))} aria-label={`Remove ${p.name}`}>
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                  <Input placeholder="Search name, email or phone" value={search} onChange={(e) => setSearch(e.target.value)} />
                  {search.trim() && (
                    <div className="max-h-48 overflow-y-auto rounded-md border">
                      {customers.slice(0, 20).map((c: any) => {
                        const on = picked.some((p) => p.id === c.id);
                        return (
                          <button key={c.id} type="button" onClick={() => togglePick(c)}
                            className={`w-full text-left px-3 py-2 text-sm hover:bg-muted flex items-center justify-between ${on ? "bg-muted" : ""}`}>
                            <span>
                              <span className="font-medium">{c.name || c.legal_name || "—"}</span>
                              <span className="block text-xs text-muted-foreground">{c.email}{c.phone ? ` · ${c.phone}` : ""}</span>
                            </span>
                            {on && <UserCheck className="h-4 w-4 text-accent shrink-0" />}
                          </button>
                        );
                      })}
                      {customers.length === 0 && <div className="px-3 py-2 text-xs text-muted-foreground">No matches</div>}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Preview — roughly how it lands on a phone */}
            <div className="space-y-2">
              <Label>Preview</Label>
              <div className="rounded-2xl border border-border bg-muted/30 p-3 space-y-2">
                <div className="flex gap-3">
                  <img src="/icons/icon-96x96.png" alt="" className="h-9 w-9 rounded-lg shrink-0" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground"><span className="font-medium">ENVO POOL</span><span>now</span></div>
                    <p className="text-sm font-semibold break-words">{title || "Announcement title"}</p>
                    <p className="text-xs text-muted-foreground whitespace-pre-line break-words line-clamp-4">{body || "Your message will appear here."}</p>
                  </div>
                </div>
                {imagePreview && <img src={imagePreview} alt="" className="w-full max-h-48 object-cover rounded-lg" />}
              </div>
              {hasButton && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">When opened, the message shows this button:</p>
                  <div className="rounded-md bg-primary text-primary-foreground text-sm font-medium text-center py-2">{btnText}</div>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Phones may cut long messages short — the full text is always in the Inbox. Android shows the image in the notification; iPhones show it in the Inbox only.
              </p>
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={() => setConfirmOpen(true)} disabled={!canSend} className="gap-2">
              <Send className="h-4 w-4" /> Send to {recipientCount} {recipientCount === 1 ? "person" : "people"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Sent Announcements</CardTitle></CardHeader>
        <CardContent>
          {sent.length === 0 ? (
            <p className="text-sm text-muted-foreground">No announcements sent yet.</p>
          ) : (
            <div className="space-y-3">
              {sent.map((n) => (
                <div key={n._id} className="rounded-md border border-border px-3 py-2.5 flex gap-3">
                  {n.imageUrl && <img src={`${BASE_URL}${n.imageUrl}`} alt="" className="h-16 w-16 rounded object-cover shrink-0" loading="lazy" />}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <p className="font-medium text-sm">{n.title}</p>
                      <span className="text-xs text-muted-foreground">{fmtWhen(n.sentAt)} · by {n.sentBy}</span>
                    </div>
                    {n.body && <p className="text-xs text-muted-foreground mt-1 whitespace-pre-line line-clamp-2">{n.body}</p>}

                    <div className="mt-2 flex items-center gap-2 flex-wrap">
                      <Badge variant="outline">{n.audience === "all" ? "All customers" : "Specific people"} · {n.recipients}</Badge>
                      <Badge variant="outline" className="gap-1"><BellRing className="h-3 w-3" /> {n.pushed} phones</Badge>
                      <Badge variant="outline" className="gap-1 bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
                        {n.opened} opened · {pct(n.opened, n.recipients)}%
                      </Badge>
                      <span className="text-xs text-muted-foreground flex items-center gap-2">
                        <span className="flex items-center gap-1"><Smartphone className="h-3 w-3" /> {n.openedPush} from phone</span>
                        <span className="flex items-center gap-1"><InboxIcon className="h-3 w-3" /> {n.openedInbox} in Inbox</span>
                      </span>
                      <Button size="sm" variant="ghost" className="h-7 ml-auto gap-1" onClick={() => setViewing(n)}>
                        <Eye className="h-3.5 w-3.5" /> View
                      </Button>
                    </div>
                    <div className="mt-2 h-1.5 w-full rounded-full bg-muted overflow-hidden" title={`${pct(n.opened, n.recipients)}% opened`}>
                      <div className="h-full bg-emerald-500" style={{ width: `${pct(n.opened, n.recipients)}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <RecipientsDialog announcement={viewing} onClose={() => setViewing(null)} />

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send this announcement?</DialogTitle>
            <DialogDescription>
              "{title}"{image ? " (with image)" : ""} will go to <strong>{recipientCount} {recipientCount === 1 ? "person" : "people"}</strong>
              {audience === "all" ? " — every customer" : ""}. Sent announcements can't be recalled.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button onClick={doSend} disabled={send.isPending}>
              {send.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send now"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
