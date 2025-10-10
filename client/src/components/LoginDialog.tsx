import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MessageCircle, Shield, Sparkles, CheckCircle } from "lucide-react";

interface LoginDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LoginDialog({ open, onOpenChange }: LoginDialogProps) {
  const handleLogin = () => {
    window.location.href = "/api/login";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="dialog-login">
        <DialogHeader>
          <div className="flex items-center justify-center mb-4">
            <div className="p-3 rounded-full bg-primary/10">
              <MessageCircle className="w-8 h-8 text-primary" />
            </div>
          </div>
          <DialogTitle className="text-center text-2xl">Welcome to Kirk Debates</DialogTitle>
          <DialogDescription className="text-center pt-2">
            Sign in to join the conversation and share your perspectives
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">Instant Access</p>
                <p className="text-sm text-muted-foreground">
                  New users? No problem! Signing in automatically creates your account
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">Secure Authentication</p>
                <p className="text-sm text-muted-foreground">
                  Powered by Replit Auth for safe and seamless login
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">Personalized Experience</p>
                <p className="text-sm text-muted-foreground">
                  Set up your profile and customize your debate feed
                </p>
              </div>
            </div>
          </div>

          <Button 
            onClick={handleLogin} 
            className="w-full" 
            size="lg"
            data-testid="button-login-dialog"
          >
            Continue with Replit
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            By continuing, you agree to our Terms of Service and Privacy Policy
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
