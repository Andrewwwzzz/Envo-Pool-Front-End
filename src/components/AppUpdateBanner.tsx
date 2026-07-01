import { useAppVersion } from "@/hooks/useAppVersion";
import { Button } from "@/components/ui/button";

/**
 * AppUpdateBanner
 *
 * Shows a fixed bottom-sheet popup when a new app version is detected.
 * Not dismissable — the user must update to continue. This ensures
 * everyone is always on the latest version after a deploy.
 *
 * TO TRIGGER AN UPDATE POPUP:
 * 1. Open public/version.json
 * 2. Bump the "version" field (e.g. "1.0.0" → "1.1.0")
 * 3. Optionally update "message" to describe what changed
 * 4. Commit and push — all open app sessions will see the popup within 5 minutes
 */
export default function AppUpdateBanner() {
  const { updateAvailable, updateMessage, applyUpdate } = useAppVersion();

  if (!updateAvailable) return null;

  return (
    <>
      {/* Dark overlay — non-dismissable */}
      <div className="fixed inset-0 z-[9998] bg-black/70 backdrop-blur-sm" />

      {/* Bottom sheet */}
      <div className="fixed bottom-0 left-0 right-0 z-[9999] px-4 pb-[calc(env(safe-area-inset-bottom,0px)+16px)]">
        <div className="mx-auto max-w-md rounded-2xl bg-card border border-border shadow-2xl overflow-hidden">

          {/* Header */}
          <div className="bg-gradient-to-r from-purple-600 to-fuchsia-600 px-5 py-4 flex items-center gap-3">
            <span className="text-3xl">🎱</span>
            <div>
              <p className="text-white font-bold text-base leading-tight">Update Available</p>
              <p className="text-purple-200 text-xs mt-0.5">Envo Pool has a new version</p>
            </div>
          </div>

          {/* Body */}
          <div className="px-5 py-4 space-y-4">
            <p className="text-sm text-muted-foreground leading-relaxed">
              {updateMessage || "A new version of Envo Pool is available with improvements and bug fixes."}
            </p>

            <div className="rounded-lg bg-muted/40 border border-border px-4 py-3 text-xs text-muted-foreground space-y-1">
              <p>📱 <span className="text-foreground font-medium">If you installed the app</span> — tap Update Now below, then remove the app from your home screen and reinstall it from your browser.</p>
              <p>🌐 <span className="text-foreground font-medium">If you're using the browser</span> — tap Update Now to reload with the latest version.</p>
            </div>

            <Button
              onClick={applyUpdate}
              className="w-full bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-700 hover:to-fuchsia-700 text-white font-semibold py-5 rounded-xl text-base"
            >
              Update Now ✨
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
