import { useEffect, useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

export interface InboxItem {
  _id: string;
  type: string;
  title: string;
  body: string;
  url: string | null;
  buttonLabel?: string | null;
  imageUrl?: string | null;
  read: boolean;
  createdAt: string;
}

export function useInbox() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["notifications", "list"],
    queryFn: async () => {
      const r = await apiFetch("/api/notifications?limit=100");
      if (!r.ok) throw new Error("Failed to load inbox");
      return (await r.json()) as { items: InboxItem[]; unread: number };
    },
    enabled: !!user,
  });
}

export function useUnreadCount() {
  const { user } = useAuth();
  const q = useQuery({
    queryKey: ["notifications", "unread"],
    queryFn: async () => {
      const r = await apiFetch("/api/notifications/unread-count");
      if (!r.ok) return 0;
      return ((await r.json()).unread ?? 0) as number;
    },
    enabled: !!user,
    refetchInterval: 60_000,
  });
  const unread = q.data ?? 0;

  // Mirror the unread count onto the home-screen app icon, where supported.
  useEffect(() => {
    const nav = navigator as any;
    if (!nav.setAppBadge) return;
    (unread > 0 ? nav.setAppBadge(unread) : nav.clearAppBadge()).catch(() => {});
  }, [unread]);

  return unread;
}

export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiFetch(`/api/notifications/${id}/read`, { method: "POST", body: JSON.stringify({ via: "inbox" }) });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
}

export function useMarkAllRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await apiFetch("/api/notifications/read-all", { method: "POST" });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
}

// ── Admin: announcements ────────────────────────────────────────

export interface SentAnnouncement {
  _id: string;
  sentAt: string;
  sentBy: string;
  title: string;
  body: string;
  url: string | null;
  buttonLabel: string | null;
  imageUrl: string | null;
  audience: "all" | "selected";
  recipients: number;
  pushed: number;
  opened: number;
  openedInbox: number;
  openedPush: number;
  dismissed: number;
  recalledAt: string | null;
  recalledBy: string | null;
}

export function useRecallAnnouncement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const r = await apiFetch(`/api/notifications/admin/announcements/${id}/recall`, { method: "POST" });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || "Failed to recall announcement");
      return data as { message: string };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notices"] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

export interface AnnouncementRecipient {
  name: string;
  phone: string | null;
  email: string | null;
  status: "tapped_push" | "opened_inbox" | "dismissed" | "not_opened";
  openedAt: string | null;
  hasPush: boolean;
}

export function useAnnouncementRecipients(id: string | null) {
  return useQuery({
    queryKey: ["notices", "recipients", id],
    queryFn: async () => {
      const r = await apiFetch(`/api/notifications/admin/announcements/${id}/recipients`);
      if (!r.ok) throw new Error("Failed to load recipients");
      return (await r.json()) as AnnouncementRecipient[];
    },
    enabled: !!id,
  });
}

export function useNoticeAudience() {
  return useQuery({
    queryKey: ["notices", "audience"],
    queryFn: async () => {
      const r = await apiFetch("/api/notifications/admin/audience");
      if (!r.ok) throw new Error("Failed to load audience");
      return (await r.json()) as { allCustomers: number; withPush: number };
    },
  });
}

export function useSentNotices() {
  return useQuery({
    queryKey: ["notices", "sent"],
    queryFn: async () => {
      const r = await apiFetch("/api/notifications/admin/sent");
      if (!r.ok) throw new Error("Failed to load sent announcements");
      return (await r.json()) as SentAnnouncement[];
    },
  });
}

export function useSendNotice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { title: string; body: string; url: string | null; buttonLabel?: string | null; audience: "all" | "selected"; userIds?: string[]; image?: Blob | null }) => {
      const fd = new FormData();
      fd.append("title", payload.title);
      fd.append("body", payload.body);
      if (payload.url) fd.append("url", payload.url);
      if (payload.buttonLabel) fd.append("buttonLabel", payload.buttonLabel);
      fd.append("audience", payload.audience);
      if (payload.userIds) fd.append("userIds", JSON.stringify(payload.userIds));
      if (payload.image) fd.append("image", payload.image, "announcement.jpg");
      const r = await apiFetch("/api/notifications/admin/send", { method: "POST", body: fd });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || "Failed to send announcement");
      return data as { message: string; recipients: number; pushed: number };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notices"] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
export const isInstalledApp = () =>
  window.matchMedia?.("(display-mode: standalone)").matches || (navigator as any).standalone === true;

export type PushState = "unsupported" | "needs-install" | "denied" | "off" | "on";

// Whether this device can get / is getting push notifications, plus a
// function to turn them on. iPhones only support push once the site is
// added to the home screen, so that case gets its own state.
export function usePushNotifications() {
  const [state, setState] = useState<PushState>("off");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    if (!supported) {
      setState(isIOS() && !isInstalledApp() ? "needs-install" : "unsupported");
      return;
    }
    if (Notification.permission === "denied") { setState("denied"); return; }
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    setState(sub && Notification.permission === "granted" ? "on" : "off");
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const enable = useCallback(async () => {
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") { await refresh(); return false; }
      const keyRes = await apiFetch("/api/notifications/push/public-key");
      const { publicKey } = await keyRes.json();
      if (!publicKey) throw new Error("Notifications aren't set up on the server yet");
      const reg = await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription()) ||
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) }));
      const r = await apiFetch("/api/notifications/push/subscribe", { method: "POST", body: JSON.stringify(sub.toJSON()) });
      if (!r.ok) throw new Error("Couldn't save notification settings");
      await refresh();
      return true;
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  const disable = useCallback(async () => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await apiFetch("/api/notifications/push/unsubscribe", { method: "POST", body: JSON.stringify({ endpoint: sub.endpoint }) });
        await sub.unsubscribe();
      }
      await refresh();
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  return { state, busy, enable, disable };
}
