import { useEffect, useState, useCallback } from "react";

const VERSION_KEY = "envo_app_version";
const CHECK_INTERVAL_MS = 5 * 60 * 1000; // check every 5 minutes while app is open

export function useAppVersion() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [latestVersion, setLatestVersion] = useState<string | null>(null);
  const [updateMessage, setUpdateMessage] = useState<string>("");

  const checkVersion = useCallback(async () => {
    try {
      // Cache-bust so we always get the real latest version.json, not a cached copy
      const res = await fetch(`/version.json?t=${Date.now()}`);
      if (!res.ok) return;
      const data = await res.json();
      const remote = data.version as string;
      const stored = localStorage.getItem(VERSION_KEY);

      setLatestVersion(remote);
      if (data.message) setUpdateMessage(data.message);

      if (!stored) {
        // First visit — just store the version silently, don't show popup
        localStorage.setItem(VERSION_KEY, remote);
        return;
      }

      if (stored !== remote) {
        // Version mismatch — new deployment detected
        setUpdateAvailable(true);
      }
    } catch {
      // Network error or JSON parse failure — silently ignore
    }
  }, []);

  useEffect(() => {
    // Check immediately on mount
    checkVersion();

    // Then re-check periodically while the tab is open
    const interval = setInterval(checkVersion, CHECK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [checkVersion]);

  const applyUpdate = () => {
    if (latestVersion) localStorage.setItem(VERSION_KEY, latestVersion);
    // Clear all caches and do a hard reload
    if ("caches" in window) {
      caches.keys().then((names) => {
        names.forEach((name) => caches.delete(name));
      });
    }
    window.location.reload();
  };

  return { updateAvailable, updateMessage, applyUpdate };
}
