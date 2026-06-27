import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { X, Download } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PWAInstallPrompt() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
      return;
    }

    // Check iOS
    const ios = /iphone|ipad|ipod/.test(navigator.userAgent.toLowerCase());
    setIsIOS(ios);

    // Check if dismissed before
    const dismissed = localStorage.getItem("pwa-prompt-dismissed");
    if (dismissed) return;

    if (ios) {
      // Show iOS instructions after 3 seconds
      setTimeout(() => setShowPrompt(true), 3000);
    } else {
      // Listen for Android/Chrome install prompt
      window.addEventListener("beforeinstallprompt", (e) => {
        e.preventDefault();
        setInstallEvent(e as BeforeInstallPromptEvent);
        setTimeout(() => setShowPrompt(true), 3000);
      });
    }
  }, []);

  const handleInstall = async () => {
    if (installEvent) {
      await installEvent.prompt();
      const { outcome } = await installEvent.userChoice;
      if (outcome === "accepted") setShowPrompt(false);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem("pwa-prompt-dismissed", "true");
  };

  if (!showPrompt || isInstalled) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 bg-card border border-border rounded-xl shadow-2xl p-4 flex items-start gap-3 animate-in slide-in-from-bottom-4">
      <img src="/icons/icon-72x72.png" alt="Envo Pool" className="w-12 h-12 rounded-xl flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm">Install Envo Pool</p>
        {isIOS ? (
          <p className="text-xs text-muted-foreground mt-0.5">
            Tap <span className="font-medium">Share</span> then <span className="font-medium">Add to Home Screen</span> to install.
          </p>
        ) : (
          <p className="text-xs text-muted-foreground mt-0.5">
            Install for a faster, app-like experience.
          </p>
        )}
        {!isIOS && (
          <Button size="sm" className="mt-2 h-7 text-xs gap-1" onClick={handleInstall}>
            <Download className="h-3 w-3" />
            Install
          </Button>
        )}
      </div>
      <button onClick={handleDismiss} className="text-muted-foreground hover:text-foreground flex-shrink-0">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}