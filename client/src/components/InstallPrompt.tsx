import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Download, X } from "lucide-react";
import { setupInstallPrompt, showInstallPrompt, isPWA } from "@/utils/registerSW";

export function InstallPrompt() {
  const [installable, setInstallable] = useState(false);
  const [dismissed, setDismissed] = useState(false);

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

  if (!installable || dismissed || isPWA()) {
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
