import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { MessageSquare, Clock, Scale, CheckCircle2 } from "lucide-react";

interface DebateOnboardingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (openingMessage: string) => void;
  isPending: boolean;
  opponentName?: string;
}

export function DebateOnboardingModal({
  open,
  onOpenChange,
  onSubmit,
  isPending,
  opponentName,
}: DebateOnboardingModalProps) {
  const [openingMessage, setOpeningMessage] = useState("");

  // Reset opening message when modal opens
  useEffect(() => {
    if (open) {
      setOpeningMessage("");
    }
  }, [open]);

  const handleSubmit = () => {
    if (openingMessage.trim()) {
      onSubmit(openingMessage.trim());
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="modal-debate-onboarding">
        <DialogHeader>
          <DialogTitle className="text-2xl">Start a Debate{opponentName ? ` with ${opponentName}` : ''}</DialogTitle>
          <DialogDescription>
            Kirk Debates uses a structured format to ensure productive discussions
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Guidelines Section */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              How it works
            </h3>
            
            <div className="space-y-3">
              <Alert>
                <Clock className="h-4 w-4" />
                <AlertDescription className="ml-6">
                  <strong>Turn-Based Discussion:</strong> You and your opponent take turns sharing arguments. Each person gets exactly 3 turns to present their best points.
                </AlertDescription>
              </Alert>

              <Alert>
                <Scale className="h-4 w-4" />
                <AlertDescription className="ml-6">
                  <strong>Peer Rating:</strong> After the structured phase, both participants rate each other on logical reasoning, politeness, and openness to change (1-5 scale).
                </AlertDescription>
              </Alert>

              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription className="ml-6">
                  <strong>Optional Free-Form:</strong> If both participants vote to continue, the debate transitions to an open discussion format with no turn limits.
                </AlertDescription>
              </Alert>
            </div>
          </div>

          {/* Expectations */}
          <div className="space-y-2 p-4 bg-muted rounded-md">
            <h4 className="font-semibold">Guidelines for Productive Debate</h4>
            <ul className="space-y-1 text-sm text-muted-foreground ml-4 list-disc">
              <li>Be respectful and courteous, even when you strongly disagree</li>
              <li>Support your arguments with facts, logic, and credible sources</li>
              <li>Listen to understand, not just to respond</li>
              <li>Stay open to changing your mind if presented with compelling evidence</li>
              <li>Focus on ideas, not personal attacks</li>
            </ul>
          </div>

          {/* Opening Message Input */}
          <div className="space-y-3">
            <Label htmlFor="opening-message" className="text-base font-semibold">
              Your Opening Statement
            </Label>
            <p className="text-sm text-muted-foreground">
              Start the debate with your strongest argument. Why should your opponent reconsider their position?
            </p>
            <Textarea
              id="opening-message"
              data-testid="input-opening-message"
              placeholder="You should change your mind because..."
              value={openingMessage}
              onChange={(e) => setOpeningMessage(e.target.value)}
              className="min-h-[120px] resize-none text-base"
              disabled={isPending}
            />
            <p className="text-xs text-muted-foreground">
              This will be your first message in the debate (1 of 3 turns)
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
            data-testid="button-cancel-debate"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!openingMessage.trim() || isPending}
            data-testid="button-start-debate"
          >
            {isPending ? "Starting Debate..." : "Start Debate"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
