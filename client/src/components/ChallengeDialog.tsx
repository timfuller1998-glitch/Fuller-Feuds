import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useState } from "react";

interface ChallengeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (context: string) => void;
  isPending?: boolean;
}

export default function ChallengeDialog({
  open,
  onOpenChange,
  onSubmit,
  isPending = false
}: ChallengeDialogProps) {
  const [context, setContext] = useState("");

  const handleSubmit = () => {
    if (context.trim()) {
      onSubmit(context.trim());
      setContext("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="dialog-challenge">
        <DialogHeader>
          <DialogTitle>Challenge This Opinion</DialogTitle>
          <DialogDescription>
            Add context if you believe this opinion contains misinformation, cherry-picked data, or misrepresentation.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 mt-4">
          <div>
            <Label htmlFor="context">Your Context</Label>
            <Textarea
              id="context"
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="Explain what's misleading or provide missing context..."
              className="min-h-[120px] mt-2"
              data-testid="input-challenge-context"
            />
          </div>
          
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => {
                onOpenChange(false);
                setContext("");
              }}
              disabled={isPending}
              data-testid="button-cancel-challenge"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!context.trim() || isPending}
              data-testid="button-submit-challenge"
            >
              {isPending ? "Submitting..." : "Submit Challenge"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
