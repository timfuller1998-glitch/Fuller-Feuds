import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Download, Share, SquarePlus, X } from "lucide-react";
import { setupInstallPrompt, showInstallPrompt, isPWA } from "@/utils/registerSW";

/** iPhone/iPad browsers never fire beforeinstallprompt; they install via Share → Add to Home Screen. */
function isIOS(): boolean {
  const ua = navigator.userAgent || "";
  const iPadOS = navigator.platform === "MacIntel" && (navigator.maxTouchPoints || 0) > 1;
  return /iPhone|iPad|iPod/i.test(ua) || iPadOS;
}

export function InstallPrompt() {
  const [installable, setInstallable] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [iosHelp, setIosHelp] = useState(false);
  const [location] = useLocation();
  // Never cover a form someone is filling in.
  const busyPage = location === "/onboarding" || location === "/apply";

  useEffect(() => {
    // Don't show if already running as PWA
    if (isPWA()) {
      return;
    }

    // Check if previously dismissed
    const wasDismissed = localStorage.getItem('pwa-install-dismissed');
    if (wasDismissed) {
      setDismissed(true);
      return;
    }

    // iOS: show Add to Home Screen instructions instead of an Install button.
    if (isIOS()) {
      const t = window.setTimeout(() => setIosHelp(true), 2500);
      return () => window.clearTimeout(t);
    }

    // Setup install prompt listener
    setupInstallPrompt();

    const handleInstallable = () => {
      setInstallable(true);
    };

    window.addEventListener('pwa-installable', handleInstallable);

    return () => {
      window.removeEventListener('pwa-installable', handleInstallable);
    };
  }, []);

  const handleInstall = async () => {
    const accepted = await showInstallPrompt();
    if (accepted) {
      setInstallable(false);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem('pwa-install-dismissed', 'true');
  };

  if (dismissed || busyPage || isPWA()) {
    return null;
  }

  if (iosHelp) {
    return (
      <Card className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] left-4 right-4 sm:left-auto sm:right-4 sm:w-96 z-50 shadow-lg" data-testid="card-install-ios">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-primary/10 flex-shrink-0">
              <Download className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm mb-1">Add Fuller Feuds to your Home Screen</h3>
              <ol className="text-xs text-muted-foreground space-y-1.5 mb-3">
                <li className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                  <span className="whitespace-nowrap">1. Tap</span>
                  <Share className="w-4 h-4 text-foreground" aria-label="Share" />
                  <span>Share (in Safari it may be under the ••• menu)</span>
                </li>
                <li className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                  <span className="whitespace-nowrap">2. Choose</span>
                  <SquarePlus className="w-4 h-4 text-foreground" aria-hidden />
                  <span className="font-semibold text-foreground">Add to Home Screen</span>
                </li>
              </ol>
              <Button size="sm" variant="ghost" onClick={handleDismiss} data-testid="button-dismiss-install-ios">
                Got it
              </Button>
            </div>
            <button
              onClick={handleDismiss}
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Close"
              data-testid="button-close-install-ios"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!installable) {
    return null;
  }

  return (
    <Card className="fixed bottom-20 left-4 right-4 sm:left-auto sm:right-4 sm:w-96 z-50 shadow-lg">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-primary/10 flex-shrink-0">
            <Download className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm mb-1">Install Fuller Feuds</h3>
            <p className="text-xs text-muted-foreground mb-3">
              Install the app for a faster, app-like experience
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleInstall}
                data-testid="button-install-pwa"
              >
                Install
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleDismiss}
                data-testid="button-dismiss-install"
              >
                Not now
              </Button>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Close"
            data-testid="button-close-install"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
