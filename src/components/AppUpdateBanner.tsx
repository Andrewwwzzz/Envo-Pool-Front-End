import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useAppVersion } from "@/hooks/useAppVersion";

/**
 * AppUpdateBanner
 *
 * Shows a small, dismissible toast when a new app version is detected —
 * not a blocking modal. Staff can keep working uninterrupted; the update
 * applies automatically in the background (the service worker already
 * takes over via skipWaiting + clients.claim()) the next time a tab is
 * refreshed or reopened. Tapping "Refresh" in the toast applies it right
 * away instead of waiting for that natural reload.
 *
 * Only ever fires once per mount, guarded by shownRef — the previous
 * full-screen version of this re-triggered on every single deploy
 * (this session pushes many per day), which made it feel like it never
 * stopped popping up.
 *
 * Every deploy is a new version: the build writes its own id into
 * version.json (vite.config.ts), so open sessions see the toast within
 * 5 minutes. To change the wording, edit "message" in public/version.json.
 */
export default function AppUpdateBanner() {
  const { updateAvailable, updateMessage, applyUpdate } = useAppVersion();
  const shownRef = useRef(false);

  useEffect(() => {
    if (!updateAvailable || shownRef.current) return;
    shownRef.current = true;
    toast("Update available", {
      description: updateMessage || "A new version of Envo Pool is ready.",
      action: { label: "Refresh", onClick: applyUpdate },
      duration: 15000,
    });
  }, [updateAvailable, updateMessage, applyUpdate]);

  return null;
}
