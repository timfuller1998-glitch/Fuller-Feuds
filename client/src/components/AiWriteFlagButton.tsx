import { useMutation, useQuery } from "@tanstack/react-query";
import { Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

const MINE_KEY = ["/api/opinions/ai-flags/mine"] as const;

/** Lets a signed-in user flag someone else's opinion as likely AI-written. One flag per user. */
export function AiWriteFlagButton({ opinionId, authorId, className }: { opinionId: string; authorId: string; className?: string }) {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const mine = useQuery<{ opinionIds: string[] }>({
    queryKey: MINE_KEY,
    queryFn: async () => {
      const res = await fetch("/api/opinions/ai-flags/mine", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load AI flags");
      return res.json();
    },
    enabled: isAuthenticated,
  });

  const flagged = !!mine.data?.opinionIds?.includes(opinionId);

  const toggle = useMutation({
    mutationFn: async () => {
      if (flagged) {
        await apiRequest("DELETE", `/api/opinions/${opinionId}/ai-flag`);
        return false;
      }
      await apiRequest("POST", `/api/opinions/${opinionId}/ai-flag`);
      return true;
    },
    onSuccess: (nowFlagged) => {
      queryClient.setQueryData<{ opinionIds: string[] }>(MINE_KEY, (prev) => {
        const ids = new Set(prev?.opinionIds || []);
        if (nowFlagged) ids.add(opinionId);
        else ids.delete(opinionId);
        return { opinionIds: [...ids] };
      });
      toast({
        title: nowFlagged ? "Flagged as likely AI-written" : "AI flag removed",
        description: nowFlagged ? "Thanks. Admins can see the flag count." : undefined,
      });
    },
    onError: (error: Error) => {
      toast({ title: "Couldn't update the AI flag", description: error.message, variant: "destructive" });
    },
  });

  if (!isAuthenticated || !user || user.id === authorId) return null;

  return (
    <Button
      size="sm"
      variant={flagged ? "default" : "outline"}
      className={className ?? "w-full"}
      onClick={() => toggle.mutate()}
      disabled={toggle.isPending}
      data-testid={`button-ai-flag-${opinionId}`}
      aria-pressed={flagged}
    >
      <Bot className="w-4 h-4 mr-1.5" />
      {flagged ? "Flagged as AI-written" : "Flag as AI-written"}
    </Button>
  );
}
