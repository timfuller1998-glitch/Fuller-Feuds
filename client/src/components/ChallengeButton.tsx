import { useState, type SyntheticEvent } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Swords } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LoginPromptDialog } from "@/components/LoginPromptDialog";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { getOpinionStance, stanceLabel, type Stance } from "@/lib/stance";

type ChallengeOp = { id: string; userId: string; topicId: string; stance?: string | null; author?: { firstName?: string | null; handle?: string | null } | null };

const STANCES: Stance[] = ["for", "against", "neutral"];
const stop = (e: SyntheticEvent) => e.stopPropagation();

/**
 * "Challenge" on an opinion card (Nov 20 2026). An explicit button (touch rule: only buttons navigate).
 * You don't need your own opinion on the topic: if you have one, your stance comes from it; if not, you pick a side.
 * An optional opening argument goes first; otherwise the author opens. Invites never expire.
 */
export function ChallengeButton({ op, className }: { op: ChallengeOp; className?: string }) {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [open, setOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [opening, setOpening] = useState("");
  const authorStance = getOpinionStance(op);
  const [stance, setStance] = useState<Stance | null>(null);
  const [sending, setSending] = useState(false);

  // Same cache key the topic page uses, so it's usually already loaded.
  const { data: topicOpinions } = useQuery<any[]>({ queryKey: ["/api/topics", op.topicId, "opinions"], enabled: open && !!op.topicId });
  const mine = Array.isArray(topicOpinions) ? topicOpinions.find((o) => o.userId === user?.id) : undefined;
  const myStance = mine ? getOpinionStance(mine) : null;
  const defaultPick: Stance = authorStance === "for" ? "against" : authorStance === "against" ? "for" : "against";
  const pick = myStance ?? stance ?? defaultPick;
  const authorName = op.author?.firstName || (op.author?.handle ? "@" + op.author.handle : "them");

  if (user?.id === op.userId) return null;

  const start = async () => {
    setSending(true);
    try {
      const res = await apiRequest("POST", `/api/opinions/${op.id}/start-debate`, { stance: myStance ? undefined : pick, opening: opening.trim() || undefined });
      const room = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/debates/grouped"] });
      setOpen(false);
      setOpening("");
      toast({
        title: room.reused ? "You already have this debate going" : "Challenge sent",
        description: room.reused ? "Taking you to it." : `${authorName} gets an invite. It stays open until they answer.`,
      });
      navigate(`/debate-room/${room.id}`);
    } catch (e: any) {
      const msg = String(e?.message || "").replace(/^\d+:\s*/, "");
      let text = msg;
      try { text = JSON.parse(msg).message || msg; } catch {}
      toast({ title: "Couldn't start the debate", description: text || "Please try again.", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <div onClick={stop} onPointerDown={stop} onPointerMove={stop} onPointerUp={stop} onTouchStart={stop} onTouchMove={stop} onTouchEnd={stop} className={className}>
      <Button
        size="sm"
        variant="outline"
        className="w-full border-primary text-primary hover:bg-primary hover:text-primary-foreground"
        onClick={() => (isAuthenticated ? setOpen(true) : setLoginOpen(true))}
        data-testid={`button-challenge-${op.id}`}
      >
        <Swords className="w-4 h-4 mr-1.5" /> Challenge to a debate
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md" data-testid="dialog-challenge">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl">Challenge {authorName}</DialogTitle>
            <DialogDescription>
              One-on-one, three turns each, then you rate each other. Anyone can watch it live.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <div className="font-ui text-xs uppercase tracking-[0.12em] text-muted-foreground mb-2">Your side</div>
              {myStance ? (
                <p className="text-sm" data-testid="text-challenge-my-stance">From your opinion: <span className="font-semibold">{stanceLabel[myStance]}</span></p>
              ) : (
                <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Your side">
                  {STANCES.map((s) => (
                    <Button
                      key={s}
                      type="button"
                      size="sm"
                      variant={pick === s ? "default" : "outline"}
                      onClick={() => setStance(s)}
                      role="radio"
                      aria-checked={pick === s}
                      data-testid={`button-challenge-stance-${s}`}
                    >
                      {stanceLabel[s]}
                    </Button>
                  ))}
                </div>
              )}
              {!myStance && <p className="mt-1.5 text-xs text-muted-foreground">You don't need your own opinion on this topic to debate it.</p>}
            </div>
            <div>
              <div className="font-ui text-xs uppercase tracking-[0.12em] text-muted-foreground mb-2">Opening argument (optional)</div>
              <Textarea
                value={opening}
                onChange={(e) => setOpening(e.target.value)}
                maxLength={4000}
                rows={4}
                placeholder={`Say why ${authorName} is wrong. Leave it blank to let them open.`}
                data-testid="input-challenge-opening"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} data-testid="button-challenge-cancel">Cancel</Button>
            <Button onClick={start} disabled={sending} data-testid="button-challenge-send">
              <Swords className="w-4 h-4 mr-1.5" /> {sending ? "Sending…" : "Send challenge"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <LoginPromptDialog open={loginOpen} onOpenChange={setLoginOpen} action="debate" />
    </div>
  );
}
