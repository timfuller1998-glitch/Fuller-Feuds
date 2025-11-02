import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MessageCircle, ThumbsUp, MessageSquarePlus } from "lucide-react";

interface LoginPromptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  action?: "like" | "opinion" | "debate" | "interact";
}

export function LoginPromptDialog({ open, onOpenChange, action = "interact" }: LoginPromptDialogProps) {
  const actionMessages = {
    like: {
      icon: ThumbsUp,
      title: "Sign in to react",
      description: "Join the conversation and let others know what you think about their opinions."
    },
    opinion: {
      icon: MessageSquarePlus,
      title: "Sign in to share your opinion",
      description: "Create an account to share your thoughts and join debates on topics you care about."
    },
    debate: {
      icon: MessageCircle,
      title: "Sign in to start debating",
      description: "Join Fuller Feuds to engage in meaningful debates with people who have different perspectives."
    },
    interact: {
      icon: MessageCircle,
      title: "Sign in to interact",
      description: "Create an account to fully participate in discussions and debates."
    }
  };

  const { icon: Icon, title, description } = actionMessages[action];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="dialog-login-prompt">
        <DialogHeader>
          <div className="flex items-center justify-center mb-4">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Icon className="h-6 w-6 text-primary" />
            </div>
          </div>
          <DialogTitle className="text-center">{title}</DialogTitle>
          <DialogDescription className="text-center">
            {description}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 mt-4">
          <a href="/api/login" className="w-full">
            <Button className="w-full" size="lg" data-testid="button-login-primary">
              Sign in with Replit
            </Button>
          </a>
          <p className="text-xs text-center text-muted-foreground">
            New to Fuller Feuds? Signing in will create your account.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
