import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Copy, Check, UserPlus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface AdoptOpinionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentOpinion: {
    content: string;
    stance: "for" | "against" | "neutral";
  } | null;
  opinionToAdopt: {
    content: string;
    stance: "for" | "against" | "neutral";
    authorName: string;
  } | null;
  onAdopt: (content: string, stance: "for" | "against" | "neutral") => void;
  isPending?: boolean;
}

const stanceBadgeVariant = {
  for: "default",
  against: "destructive",
  neutral: "secondary"
} as const;

const stanceText = {
  for: "Supporting",
  against: "Opposing",
  neutral: "Neutral"
} as const;

export function AdoptOpinionDialog({
  open,
  onOpenChange,
  currentOpinion,
  opinionToAdopt,
  onAdopt,
  isPending = false
}: AdoptOpinionDialogProps) {
  const { toast } = useToast();
  const [editedContent, setEditedContent] = useState("");
  const [editedStance, setEditedStance] = useState<"for" | "against" | "neutral">("neutral");
  const [copied, setCopied] = useState(false);

  // Initialize form with current opinion or opinion to adopt
  useEffect(() => {
    if (open && opinionToAdopt) {
      if (currentOpinion) {
        setEditedContent(currentOpinion.content);
        setEditedStance(currentOpinion.stance);
      } else {
        setEditedContent("");
        setEditedStance(opinionToAdopt.stance);
      }
      setCopied(false);
    }
  }, [open, currentOpinion, opinionToAdopt]);

  const handleFullyAdopt = () => {
    if (opinionToAdopt) {
      setEditedContent(opinionToAdopt.content);
      setEditedStance(opinionToAdopt.stance);
      setCopied(true);
      toast({
        title: "Opinion copied",
        description: "The full opinion has been copied. You can edit it before adopting.",
      });
      
      // Reset copied state after a delay
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSubmit = () => {
    if (!editedContent.trim()) {
      toast({
        title: "Error",
        description: "Opinion content cannot be empty",
        variant: "destructive",
      });
      return;
    }
    onAdopt(editedContent, editedStance);
  };

  if (!opinionToAdopt) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Adopt Opinion
          </DialogTitle>
          <DialogDescription>
            {currentOpinion 
              ? "Review and modify your opinion based on the one you're adopting"
              : "Create your opinion based on the one you're adopting"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Opinion to Adopt */}
          <Card className="border-2 border-primary/20">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  Opinion by {opinionToAdopt.authorName}
                </CardTitle>
                <Badge variant={stanceBadgeVariant[opinionToAdopt.stance]}>
                  {stanceText[opinionToAdopt.stance]}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed" data-testid="text-opinion-to-adopt">
                {opinionToAdopt.content}
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={handleFullyAdopt}
                className="mt-3"
                data-testid="button-fully-adopt"
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 mr-2" />
                    Fully Adopt This Opinion
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Current/Edited Opinion */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                {currentOpinion ? "Your Current Opinion (Edit Below)" : "Your New Opinion"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {currentOpinion && (
                <div className="bg-muted/30 p-3 rounded-md">
                  <p className="text-sm text-muted-foreground mb-2">Original content:</p>
                  <p className="text-sm" data-testid="text-current-opinion">
                    {currentOpinion.content}
                  </p>
                </div>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="opinion-content">
                  Opinion Content
                  <span className="text-muted-foreground text-sm ml-2">(You can manually copy text or use "Fully Adopt" button)</span>
                </Label>
                <Textarea
                  id="opinion-content"
                  value={editedContent}
                  onChange={(e) => setEditedContent(e.target.value)}
                  placeholder="Write or edit your opinion here..."
                  className="min-h-[300px]"
                  data-testid="textarea-opinion-content"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="opinion-stance">Stance</Label>
                <div className="flex gap-2">
                  <Button
                    variant={editedStance === "for" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setEditedStance("for")}
                    data-testid="button-stance-for"
                  >
                    Supporting
                  </Button>
                  <Button
                    variant={editedStance === "against" ? "destructive" : "outline"}
                    size="sm"
                    onClick={() => setEditedStance("against")}
                    data-testid="button-stance-against"
                  >
                    Opposing
                  </Button>
                  <Button
                    variant={editedStance === "neutral" ? "secondary" : "outline"}
                    size="sm"
                    onClick={() => setEditedStance("neutral")}
                    data-testid="button-stance-neutral"
                  >
                    Neutral
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <DialogFooter>
          <Button 
            variant="ghost" 
            onClick={() => onOpenChange(false)}
            disabled={isPending}
            data-testid="button-cancel-adopt"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isPending || !editedContent.trim()}
            data-testid="button-submit-adopt"
          >
            {isPending ? "Adopting..." : currentOpinion ? "Update Opinion" : "Create Opinion"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
