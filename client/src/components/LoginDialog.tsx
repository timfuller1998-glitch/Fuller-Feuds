import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MessageCircle, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Checkbox } from "@/components/ui/checkbox";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import { getRef, getPendingInvite, clearPendingInvite } from "@/lib/ref";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { HandleField, type HandleStatus } from "@/components/HandleField";

interface LoginDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LoginDialog({ open, onOpenChange }: LoginDialogProps) {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [handle, setHandle] = useState("");
  const [handleStatus, setHandleStatus] = useState<HandleStatus>("idle");
  const [inviteCode, setInviteCode] = useState("");
  const [is18Plus, setIs18Plus] = useState(false);
  const { foundingMode } = useSiteConfig();
  const queryClient = useQueryClient();

  // An invite link (/?invite=FF-XXXX-XXXX) opens straight into Create Account with the code filled in.
  useEffect(() => {
    if (!open) return;
    const pending = getPendingInvite();
    if (pending) {
      setIsRegister(true);
      setInviteCode((c) => c || pending);
    }
  }, [open]);
  const { toast } = useToast();

  const loginMutation = useMutation({
    mutationFn: async (data: { email: string; password: string }) => {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Login failed");
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({
        title: "Welcome back!",
        description: "You've been successfully logged in.",
      });
      onOpenChange(false);
      // Reset form
      setEmail("");
      setPassword("");
    },
    onError: (error: Error) => {
      toast({
        title: "Login failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (data: { email: string; password: string; firstName: string; lastName: string; handle: string; inviteCode: string; is18Plus: boolean; ref: string | null }) => {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Registration failed");
      }

      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      clearPendingInvite();
      setInviteCode("");
      setIs18Plus(false);
      toast({
        title: data?.founderNumber ? `Welcome, Founding Member #${data.founderNumber}!` : "Account created!",
        description: data?.founderNumber
          ? "Your badge and invite codes are in Settings."
          : "Welcome to Fuller Feuds.",
      });
      onOpenChange(false);
      // Reset form
      setEmail("");
      setPassword("");
      setFirstName("");
      setLastName("");
      setHandle("");
    },
    onError: (error: Error) => {
      toast({
        title: "Registration failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (isRegister) {
      if (handleStatus !== "available") {
        toast({ title: "Pick a handle", description: "Choose an available @handle to continue.", variant: "destructive" });
        return;
      }
      if (foundingMode && !inviteCode.trim()) {
        toast({ title: "Invite code needed", description: "Fuller Feuds is invite-only for now. Apply for a founding spot at /apply.", variant: "destructive" });
        return;
      }
      if (!is18Plus) {
        toast({ title: "Please confirm your age", description: "You must be 18 or older to join.", variant: "destructive" });
        return;
      }
      registerMutation.mutate({ email, password, firstName, lastName, handle, inviteCode: inviteCode.trim(), is18Plus, ref: getRef() });
    } else {
      loginMutation.mutate({ email, password });
    }
  };

  const isLoading = loginMutation.isPending || registerMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="dialog-login">
        <DialogHeader>
          <div className="flex items-center justify-center mb-4">
            <div className="p-3 rounded-full bg-primary/10">
              <MessageCircle className="w-8 h-8 text-primary" />
            </div>
          </div>
          <DialogTitle className="text-center text-2xl">
            {isRegister ? "Create Account" : "Welcome Back"}
          </DialogTitle>
          <DialogDescription className="text-center pt-2">
            {isRegister
              ? "Sign up to join the conversation and share your perspectives"
              : "Sign in to continue to Fuller Feuds"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          {isRegister && foundingMode && (
            <div className="space-y-2 border border-[hsl(var(--gold))]/60 bg-[hsl(var(--gold))]/5 p-3" data-testid="section-invite-code">
              <Label htmlFor="inviteCode">Invite code</Label>
              <Input
                id="inviteCode"
                type="text"
                placeholder="FF-XXXX-XXXX"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                autoComplete="off"
                required
                disabled={isLoading}
                className="font-mono tracking-wider"
                data-testid="input-invite-code"
              />
              <p className="text-xs text-muted-foreground">
                We're invite-only while our founding members settle in.{" "}
                <Link href="/apply" onClick={() => onOpenChange(false)} className="underline underline-offset-2 text-foreground" data-testid="link-apply-from-signup">
                  No code? Apply to be a founding member
                </Link>
              </p>
            </div>
          )}
          {isRegister && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                  disabled={isLoading}
                />
              </div>
            </div>
          )}

          {isRegister && (
            <HandleField
              value={handle}
              onChange={setHandle}
              onStatusChange={setHandleStatus}
              suggestFrom={`${firstName}${lastName.slice(0, 1)}`}
              disabled={isLoading}
              id="register-handle"
            />
          )}

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isLoading}
              minLength={6}
            />
            {isRegister && (
              <p className="text-xs text-muted-foreground">
                At least 6 characters
              </p>
            )}
          </div>

          {isRegister && (
            <div className="flex items-start gap-2">
              <Checkbox id="is18Plus" checked={is18Plus} onCheckedChange={(v) => setIs18Plus(v === true)} disabled={isLoading} data-testid="checkbox-18-plus" />
              <Label htmlFor="is18Plus" className="text-sm font-normal leading-snug">I'm 18 or older</Label>
            </div>
          )}

          <Button
            type="submit"
            className="w-full"
            size="lg"
            disabled={isLoading || (isRegister && (handleStatus !== "available" || !is18Plus || (foundingMode && !inviteCode.trim())))}
            data-testid="button-login-dialog"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {isRegister ? "Creating account..." : "Signing in..."}
              </>
            ) : (
              <>{isRegister ? "Create Account" : "Sign In"}</>
            )}
          </Button>

          <div className="text-center">
            <Button
              type="button"
              variant="link"
              onClick={() => setIsRegister(!isRegister)}
              disabled={isLoading}
              className="text-sm"
            >
              {isRegister
                ? "Already have an account? Sign in"
                : "Don't have an account? Sign up"}
            </Button>
          </div>

          {!isRegister && foundingMode && (
            <p className="text-xs text-center text-muted-foreground" data-testid="text-apply-cta">
              New here? Fuller Feuds is invite-only for now.{" "}
              <Link href="/apply" onClick={() => onOpenChange(false)} className="underline underline-offset-2 text-foreground" data-testid="link-apply-from-signin">
                Apply to be a founding member
              </Link>
            </p>
          )}

          <p className="text-xs text-center text-muted-foreground">
            By continuing, you agree to our{" "}
            <Link href="/terms" onClick={() => onOpenChange(false)} className="underline underline-offset-2">Terms of Use</Link> and{" "}
            <Link href="/privacy" onClick={() => onOpenChange(false)} className="underline underline-offset-2">Privacy Policy</Link>
          </p>
        </form>
      </DialogContent>
    </Dialog>
  );
}
