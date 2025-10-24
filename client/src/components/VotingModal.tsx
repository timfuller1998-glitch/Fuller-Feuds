import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ThumbsUp, Brain, Heart, TrendingUp } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface VotingModalProps {
  isOpen: boolean;
  roomId: string;
  opponentName: string;
  opponentId: string;
  currentUserId: string;
  onClose: () => void;
}

interface VoteResults {
  participant1Votes?: {
    logicalReasoning: number;
    politeness: number;
    opennessToChange: number;
    wantsToContinue: boolean;
  };
  participant2Votes?: {
    logicalReasoning: number;
    politeness: number;
    opennessToChange: number;
    wantsToContinue: boolean;
  };
}

export function VotingModal({ isOpen, roomId, opponentName, opponentId, currentUserId, onClose }: VotingModalProps) {
  const [logicalReasoning, setLogicalReasoning] = useState([3]);
  const [politeness, setPoliteness] = useState([3]);
  const [opennessToChange, setOpennessToChange] = useState([3]);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [voteResults, setVoteResults] = useState<VoteResults | null>(null);
  const { toast } = useToast();

  const submitVoteMutation = useMutation({
    mutationFn: async (wantsToContinue: boolean) => {
      const response = await apiRequest('POST', `/api/debate-rooms/${roomId}/vote`, {
        votedForUserId: opponentId,
        logicalReasoning: logicalReasoning[0],
        politeness: politeness[0],
        opennessToChange: opennessToChange[0],
        wantsToContinue,
      });
      return response.json();
    },
    onSuccess: (data: { voteResults: VoteResults }) => {
      setHasSubmitted(true);
      setVoteResults(data.voteResults);
      queryClient.invalidateQueries({ queryKey: ["/api/debate-rooms", roomId] });
      toast({
        title: "Vote Submitted",
        description: "Waiting for opponent to submit their vote...",
      });
    },
    onError: (error) => {
      console.error("Failed to submit vote:", error);
      toast({
        title: "Failed to submit vote",
        description: "Please try again",
        variant: "destructive",
      });
    },
  });

  const handleSubmitVote = (wantsToContinue: boolean) => {
    submitVoteMutation.mutate(wantsToContinue);
  };

  const getRatingLabel = (value: number) => {
    const labels = ["Very Poor", "Poor", "Average", "Good", "Excellent"];
    return labels[value - 1];
  };

  const bothSubmitted = voteResults?.participant1Votes && voteResults?.participant2Votes;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dialog-voting-modal">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ThumbsUp className="w-5 h-5" />
            {bothSubmitted ? "Voting Results" : hasSubmitted ? "Vote Submitted" : "Rate Your Opponent"}
          </DialogTitle>
          <DialogDescription>
            {bothSubmitted
              ? "Both participants have submitted their votes"
              : hasSubmitted
              ? "Waiting for your opponent to submit their vote..."
              : `Rate ${opponentName}'s performance in this debate`}
          </DialogDescription>
        </DialogHeader>

        {!hasSubmitted && !bothSubmitted && (
          <div className="space-y-6 py-4">
            {/* Logical Reasoning */}
            <Card>
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-center gap-2">
                  <Brain className="w-5 h-5 text-primary" />
                  <h3 className="font-semibold">Logical Reasoning</h3>
                  <Badge variant="secondary" data-testid="badge-logical-reasoning-value">
                    {logicalReasoning[0]} - {getRatingLabel(logicalReasoning[0])}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  How well did they present logical arguments and evidence?
                </p>
                <Slider
                  value={logicalReasoning}
                  onValueChange={setLogicalReasoning}
                  min={1}
                  max={5}
                  step={1}
                  className="w-full"
                  data-testid="slider-logical-reasoning"
                />
              </CardContent>
            </Card>

            {/* Politeness */}
            <Card>
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-center gap-2">
                  <Heart className="w-5 h-5 text-primary" />
                  <h3 className="font-semibold">Politeness</h3>
                  <Badge variant="secondary" data-testid="badge-politeness-value">
                    {politeness[0]} - {getRatingLabel(politeness[0])}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  How respectful and courteous were they in their responses?
                </p>
                <Slider
                  value={politeness}
                  onValueChange={setPoliteness}
                  min={1}
                  max={5}
                  step={1}
                  className="w-full"
                  data-testid="slider-politeness"
                />
              </CardContent>
            </Card>

            {/* Openness to Change */}
            <Card>
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-primary" />
                  <h3 className="font-semibold">Openness to Change</h3>
                  <Badge variant="secondary" data-testid="badge-openness-value">
                    {opennessToChange[0]} - {getRatingLabel(opennessToChange[0])}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  How willing were they to consider alternative viewpoints?
                </p>
                <Slider
                  value={opennessToChange}
                  onValueChange={setOpennessToChange}
                  min={1}
                  max={5}
                  step={1}
                  className="w-full"
                  data-testid="slider-openness"
                />
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <Button
                onClick={() => handleSubmitVote(true)}
                disabled={submitVoteMutation.isPending}
                className="flex-1"
                data-testid="button-vote-continue"
              >
                Submit & Continue Debate
              </Button>
              <Button
                onClick={() => handleSubmitVote(false)}
                disabled={submitVoteMutation.isPending}
                variant="outline"
                className="flex-1"
                data-testid="button-vote-end"
              >
                Submit & End Debate
              </Button>
            </div>
          </div>
        )}

        {hasSubmitted && !bothSubmitted && (
          <div className="py-8 text-center space-y-4">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
              <ThumbsUp className="w-8 h-8 text-primary" />
            </div>
            <p className="text-muted-foreground">
              Your vote has been submitted. Waiting for {opponentName} to submit their vote...
            </p>
          </div>
        )}

        {bothSubmitted && voteResults && (
          <div className="space-y-6 py-4">
            <Card>
              <CardContent className="pt-6 space-y-4">
                <h3 className="font-semibold text-center mb-4">
                  {opponentName}'s Rating of You
                </h3>
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Brain className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm">Logical Reasoning</span>
                    </div>
                    <Badge data-testid="badge-result-logical">
                      {voteResults.participant1Votes?.logicalReasoning || voteResults.participant2Votes?.logicalReasoning} / 5
                    </Badge>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Heart className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm">Politeness</span>
                    </div>
                    <Badge data-testid="badge-result-politeness">
                      {voteResults.participant1Votes?.politeness || voteResults.participant2Votes?.politeness} / 5
                    </Badge>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm">Openness to Change</span>
                    </div>
                    <Badge data-testid="badge-result-openness">
                      {voteResults.participant1Votes?.opennessToChange || voteResults.participant2Votes?.opennessToChange} / 5
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-4">
                {voteResults.participant1Votes?.wantsToContinue && voteResults.participant2Votes?.wantsToContinue
                  ? "Both participants voted to continue - the debate will enter free-form discussion"
                  : "At least one participant voted to end - the debate is now concluded"}
              </p>
              <Button onClick={onClose} data-testid="button-close-results">
                Close
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
