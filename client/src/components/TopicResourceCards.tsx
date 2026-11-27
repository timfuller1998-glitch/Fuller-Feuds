import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ExternalLink, Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import CardDeck from "@/components/CardDeck";

export type TopicResource = {
  url: string;
  domain: string;
  faviconUrl: string;
  citationCount: number;
  likes: number;
  dislikes: number;
  likeRatio: number;
};

function ResourceFront({ item }: { item: TopicResource }) {
  return (
    <div className="h-full flex flex-col justify-between p-5">
      <div className="flex items-start gap-3 min-w-0">
        <img src={item.faviconUrl} alt="" width={32} height={32} className="w-8 h-8 rounded-sm bg-muted flex-shrink-0" />
        <div className="min-w-0">
          <p className="font-ui text-xs uppercase tracking-[0.14em] text-[hsl(var(--gold))]">Resource</p>
          <h3 className="mt-1 font-serif text-lg leading-snug break-words">{item.domain}</h3>
          <p className="mt-1 text-xs text-muted-foreground break-all line-clamp-3">{item.url}</p>
        </div>
      </div>
      <p className="text-sm text-muted-foreground">
        Cited in {item.citationCount} {item.citationCount === 1 ? "opinion" : "opinions"}
        {item.likes + item.dislikes > 0 ? ` · ${Math.round(item.likeRatio * 100)}% likes` : ""}
      </p>
    </div>
  );
}

function ResourceBack({ item, onReport }: { item: TopicResource; onReport: () => void }) {
  return (
    <div className="h-full flex flex-col justify-between p-5">
      <div>
        <p className="font-ui text-xs uppercase tracking-[0.14em] text-[hsl(var(--gold))]">Open or report</p>
        <p className="mt-3 text-sm break-all">{item.url}</p>
      </div>
      <div className="flex flex-col gap-2">
        <Button asChild className="w-full">
          <a href={item.url} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="w-4 h-4 mr-2" />
            Open link
          </a>
        </Button>
        <Button type="button" variant="outline" className="w-full" onClick={onReport}>
          <Flag className="w-4 h-4 mr-2" />
          Report link
        </Button>
      </div>
    </div>
  );
}

export function TopicResourceCards({ topicId }: { topicId?: string }) {
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [reporting, setReporting] = useState<TopicResource | null>(null);
  const [reason, setReason] = useState("");

  const { data, isLoading } = useQuery<{ items: TopicResource[] }>({
    queryKey: ["/api/topics", topicId, "resources"],
    queryFn: async () => {
      const res = await fetch(`/api/topics/${topicId}/resources`, { credentials: "include" });
      if (!res.ok) throw new Error("Could not load resources");
      return res.json();
    },
    enabled: !!topicId,
  });

  const report = useMutation({
    mutationFn: async () => {
      if (!reporting || !topicId) return;
      const res = await apiRequest("POST", `/api/topics/${topicId}/resources/report`, {
        url: reporting.url,
        reason,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Could not send the report");
      }
    },
    onSuccess: () => {
      toast({ title: "Link reported", description: "Thanks — we'll review it in Requests." });
      setReporting(null);
      setReason("");
    },
    onError: (error: Error) => toast({ title: "Couldn't report that link", description: error.message, variant: "destructive" }),
  });

  const items = data?.items || [];
  if (!topicId || isLoading) return null;
  if (!items.length) return null;

  return (
    <section className="mt-8" data-testid="topic-resource-cards">
      <h2 className="font-serif text-xl mb-1">Resources</h2>
      <p className="text-sm text-muted-foreground mb-4">
        Links cited in opinions, ranked by how often they appear and by like ratio. Tap a card to flip it.
      </p>
      <div className="flex justify-center py-2">
        <CardDeck<TopicResource>
          items={items}
          getKey={(item) => item.url}
          renderFront={(item) => <ResourceFront item={item} />}
          renderBack={(item) => (
            <ResourceBack
              item={item}
              onReport={() => {
                if (!isAuthenticated) {
                  toast({ title: "Sign in to report a link" });
                  return;
                }
                setReporting(item);
              }}
            />
          )}
          maxWidth={420}
          emptyLabel="No resource links yet"
          ariaLabel="Topic resource links"
          testId="resource-deck"
          ads={false}
        />
      </div>

      <Dialog open={!!reporting} onOpenChange={(open) => { if (!open) setReporting(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Report this link</DialogTitle>
          </DialogHeader>
          <p className="text-sm break-all text-muted-foreground">{reporting?.url}</p>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="What's wrong with this link? (optional)"
            maxLength={2000}
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setReporting(null)}>Cancel</Button>
            <Button type="button" onClick={() => report.mutate()} disabled={report.isPending}>
              {report.isPending ? "Sending…" : "Send report"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
