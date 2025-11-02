import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MessageCircle, Shield, Sparkles, CheckCircle, Mail } from "lucide-react";
import { SiGoogle, SiGithub } from "react-icons/si";

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
          <DialogTitle className="text-center text-2xl">Welcome to Fuller Feuds</DialogTitle>
          <DialogDescription className="text-center pt-2">
            Sign in to join the conversation and share your perspectives
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">Quick & Easy</p>
                <p className="text-sm text-muted-foreground">
                  Sign in with Google, GitHub, or email in seconds
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">Secure & Private</p>
                <p className="text-sm text-muted-foreground">
                  Your data is protected with industry-standard encryption
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">Instant Access</p>
                <p className="text-sm text-muted-foreground">
                  Start debating immediately - no lengthy forms required
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
            Sign In
          </Button>

          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <SiGoogle className="w-4 h-4" />
            <SiGithub className="w-4 h-4" />
            <Mail className="w-4 h-4" />
            <span>Multiple login options available</span>
          </div>

          <p className="text-xs text-center text-muted-foreground">
            By continuing, you agree to our Terms of Service and Privacy Policy
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
