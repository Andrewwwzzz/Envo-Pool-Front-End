/**
 * Envo Pool Service Worker
 * ─────────────────────────────────────────────────────────────────
 * Handles PWA caching and update detection. When a new version is
 * deployed, this SW detects it, takes control immediately, and
 * notifies the app to show the update popup.
 *
 * Strategy: Network-first for HTML/version.json (always get latest),
 * Cache-first for static assets (JS/CSS/images — these have hashed
 * filenames in Vite builds so they're safe to cache indefinitely).
 */

const CACHE_NAME = "envo-pool-v4";

// Assets to pre-cache on install (app shell)
const PRECACHE_URLS = ["/", "/manifest.json", "/version.json"];

// ── Install ───────────────────────────────────────────────────────
self.addEventListener("install", (event) => {
  // Skip waiting so the new SW activates immediately instead of
  // waiting for all tabs to close — combined with clients.claim()
  // below, this means updates take effect on the very next page load.
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
});

// ── Activate ──────────────────────────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      // Take control of all open tabs immediately
      self.clients.claim(),
      // Delete old caches from previous SW versions
      caches.keys().then((names) =>
        Promise.all(
          names
            .filter((name) => name !== CACHE_NAME)
            .map((name) => caches.delete(name))
        )
      ),
    ])
  );

  // Notify all open app windows that the SW has updated — this
  // triggers the update popup in the React app.
  self.clients.matchAll({ type: "window" }).then((clients) => {
    clients.forEach((client) => client.postMessage({ type: "SW_UPDATED" }));
  });
});

// ── Message handler ──────────────────────────────────────────────
// Lets the app tell the SW to stop waiting and activate immediately.
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// ── Push notifications ───────────────────────────────────────────
// Shows the notification on the phone even when the app is closed, and
// sets the unread count as the badge on the home-screen app icon.
self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { title: "Envo Pool", body: event.data?.text() || "" }; }
  const title = data.title || "Envo Pool";
  const options = {
    body: data.body || "",
    icon: "/icons/icon-192x192.png",
    badge: "/icons/icon-192x192.png",
    tag: data.tag,
    data: { url: data.url || "/dashboard/inbox", notificationId: data.notificationId || null },
  };
  // Big picture — shown by Android/Chrome/desktop; iOS ignores it (the
  // image still shows in the Inbox).
  if (data.image) options.image = data.image;
  const tasks = [self.registration.showNotification(title, options)];
  if (typeof data.unread === "number" && self.navigator && "setAppBadge" in self.navigator) {
    tasks.push(data.unread > 0 ? self.navigator.setAppBadge(data.unread) : self.navigator.clearAppBadge());
  }
  event.waitUntil(Promise.all(tasks).catch(() => {}));
});

// Tapping a notification opens (or focuses) the app on the right page.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/dashboard/inbox", self.location.origin);
  // ?n= lets the app record this as "opened from the phone notification"
  // (the service worker has no login token to report it itself).
  if (event.notification.data?.notificationId) url.searchParams.set("n", event.notification.data.notificationId);
  const target = url.href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.startsWith(self.location.origin) && "focus" in client) {
          client.navigate(target).catch(() => {});
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    })
  );
});

// ── Fetch ─────────────────────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Only handle same-origin requests — let API calls go through normally
  if (url.origin !== self.location.origin) return;

  // Skip Vite dev-server module URLs — caching these breaks HMR and
  // pins stale React chunks (null dispatcher → useState errors).
  if (
    url.pathname.startsWith("/node_modules/") ||
    url.pathname.startsWith("/@") ||
    url.pathname.startsWith("/src/") ||
    url.search.includes("import") ||
    url.search.includes("v=")
  ) {
    return;
  }

  // Network-first for navigation requests (HTML) and version.json
  // so users always get the freshest app shell and version check.
  const isNavigation = event.request.mode === "navigate";
  const isVersionCheck = url.pathname === "/version.json";

  if (isNavigation || isVersionCheck) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Cache the fresh response for offline fallback
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() =>
          // Offline fallback — serve from cache
          caches.match(event.request).then((cached) => cached || caches.match("/"))
        )
    );
    return;
  }

  // Cache-first for static assets (JS/CSS/images with hashed names)
  event.respondWith(
    caches.match(event.request).then(
      (cached) =>
        cached ||
        fetch(event.request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
    )
  );
});
