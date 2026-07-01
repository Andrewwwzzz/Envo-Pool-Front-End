import { useEffect, useState, useCallback } from "react";

const VERSION_KEY = "envo_app_version";
const CHECK_INTERVAL_MS = 5 * 60 * 1000; // poll every 5 minutes as fallback

export function useAppVersion() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [latestVersion, setLatestVersion] = useState<string | null>(null);
  const [updateMessage, setUpdateMessage] = useState<string>("");

  const checkVersion = useCallback(async () => {
    try {
      const res = await fetch(`/version.json?t=${Date.now()}`);
      if (!res.ok) return;
      const data = await res.json();
      const remote = data.version as string;
      const stored = localStorage.getItem(VERSION_KEY);

      setLatestVersion(remote);
      if (data.message) setUpdateMessage(data.message);

      if (!stored) {
        localStorage.setItem(VERSION_KEY, remote);
        return;
      }

      if (stored !== remote) {
        setUpdateAvailable(true);
      }
    } catch {
      // Network error — silently ignore
    }
  }, []);

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

    return () => {
      clearInterval(interval);
      window.removeEventListener("sw-updated", handleSwUpdated);
    };
  }, [checkVersion]);

  const applyUpdate = () => {
    if (latestVersion) localStorage.setItem(VERSION_KEY, latestVersion);
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
  };

  return { updateAvailable, updateMessage, applyUpdate };
}
