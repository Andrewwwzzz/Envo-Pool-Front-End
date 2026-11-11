import { useEffect, useState, useCallback, useRef } from "react";

const CHECK_INTERVAL_MS = 5 * 60 * 1000; // poll every 5 minutes as fallback
// A phone app left in the background this long reloads itself when reopened
// if a newer version is out (a copy once stayed open for days and kept
// sending free drinks to the counter after the vending machine went live).
// Shorter trips away — e.g. to the bank app to pay a PayNow top-up — only get
// the toast, so a half-filled form isn't lost.
export const RESUME_RELOAD_AFTER_MS = 30 * 60 * 1000;
// Remembers which version a resume-reload was for, so a CDN still serving
// the old page can't make it reload again and again.
const RELOADED_FOR_KEY = "envo_reloaded_for";

/** This copy of the app is older than the deployed one. Never true in dev. */
export function isOutdated(current: string, remote: string | null | undefined): boolean {
  return current !== "dev" && !!remote && remote !== current;
}

export function shouldReloadOnResume(opts: { current: string; remote: string | null; hiddenMs: number; reloadedFor: string | null }): boolean {
  return isOutdated(opts.current, opts.remote) && opts.hiddenMs >= RESUME_RELOAD_AFTER_MS && opts.reloadedFor !== opts.remote;
}

function readSession(key: string): string | null {
  try { return sessionStorage.getItem(key); } catch { return null; }
}

function clearCachesAndReload() {
  // Clear all caches so the new version loads cleanly
  if ("caches" in window) {
    caches.keys().then((names) => names.forEach((n) => caches.delete(n)));
  }
  // Tell the waiting SW to activate immediately if there is one
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.getRegistration().then((reg) => {
      if (reg?.waiting) {
        reg.waiting.postMessage({ type: "SKIP_WAITING" });
      }
    });
  }
  window.location.reload();
}

export function useAppVersion() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updateMessage, setUpdateMessage] = useState<string>("");
  const hiddenAt = useRef<number | null>(null);

  // The deployed version, or null when it can't be read (offline, etc.).
  const fetchRemote = useCallback(async (): Promise<string | null> => {
    try {
      const res = await fetch(`/version.json?t=${Date.now()}`);
      if (!res.ok) return null;
      const data = await res.json();
      if (data.message) setUpdateMessage(data.message);
      return (data.version as string) || null;
    } catch {
      return null; // Network error — silently ignore
    }
  }, []);

  const checkVersion = useCallback(async () => {
    if (isOutdated(__APP_BUILD__, await fetchRemote())) setUpdateAvailable(true);
  }, [fetchRemote]);

  useEffect(() => {
    // 1. Check immediately on mount
    checkVersion();

    // 2. Poll periodically as fallback (browser users / no SW)
    const interval = setInterval(checkVersion, CHECK_INTERVAL_MS);

    // 3. Listen for SW_UPDATED event — fired by the service worker
    //    when a new version activates. This is the fast path for PWA
    //    users: no need to wait for the next poll cycle.
    const handleSwUpdated = () => {
      console.log("[APP] Service worker updated — showing update banner");
      setUpdateAvailable(true);
    };
    window.addEventListener("sw-updated", handleSwUpdated);

    // 4. Coming back to the app: reload straight away after a long time
    //    away, otherwise just check (the toast offers the refresh).
    const handleVisibility = async () => {
      if (document.visibilityState === "hidden") {
        hiddenAt.current = Date.now();
        return;
      }
      const hiddenMs = hiddenAt.current ? Date.now() - hiddenAt.current : 0;
      hiddenAt.current = null;
      const remote = await fetchRemote();
      if (shouldReloadOnResume({ current: __APP_BUILD__, remote, hiddenMs, reloadedFor: readSession(RELOADED_FOR_KEY) })) {
        try { sessionStorage.setItem(RELOADED_FOR_KEY, remote as string); } catch { /* private mode — reload anyway */ }
        clearCachesAndReload();
        return;
      }
      if (isOutdated(__APP_BUILD__, remote)) setUpdateAvailable(true);
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      clearInterval(interval);
      window.removeEventListener("sw-updated", handleSwUpdated);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [checkVersion, fetchRemote]);

  return { updateAvailable, updateMessage, applyUpdate: clearCachesAndReload };
}
