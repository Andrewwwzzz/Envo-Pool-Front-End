import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// ── Service Worker Registration ────────────────────────────────────
// Registers sw.js for PWA caching and update detection.
// When a new SW is installed (new deploy detected), it sends a
// SW_UPDATED message to the app, which triggers the update popup.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        console.log("[SW] Registered:", registration.scope);

        // Listen for a new SW waiting to activate — this means a new
        // version was downloaded in the background while the app was open.
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (!newWorker) return;

          newWorker.addEventListener("statechange", () => {
            if (
              newWorker.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              // New SW installed and waiting — tell it to skip waiting
              // so it activates immediately and notifies the app.
              newWorker.postMessage({ type: "SKIP_WAITING" });
            }
          });
        });
      })
      .catch((err) => {
        console.warn("[SW] Registration failed:", err);
      });

    // Listen for messages from the SW (e.g. SW_UPDATED after activation)
    navigator.serviceWorker.addEventListener("message", (event) => {
      if (event.data?.type === "SW_UPDATED") {
        // Dispatch a custom DOM event that the React app listens to
        window.dispatchEvent(new CustomEvent("sw-updated"));
      }
    });
  });
}

createRoot(document.getElementById("root")!).render(<App />);
