import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Bot } from "lucide-react";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Row = {
  opinionId: string;
  topicId: string;
  topicTitle: string;
  excerpt: string;
  authorId: string;
  flagCount: number;
  lastFlaggedAt: string | null;
};

/** Admin/moderator list of opinions users have flagged as likely AI-written. */
export function AiOpinionFlags() {
  const { data, isLoading } = useQuery<{ items: Row[] }>({
    queryKey: ["/api/admin/ai-flags"],
    queryFn: async () => {
      const res = await fetch("/api/admin/ai-flags", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load AI flags");
      return res.json();
    },
  });

  const items = data?.items || [];

  return (
    <div className="space-y-4" data-testid="panel-ai-opinion-flags">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Bot className="h-5 w-5" />Likely AI-written flags</CardTitle>
          <CardDescription>
            Users can flag an opinion as likely AI-written. Counts only — no automatic detector yet. {items.length} opinion{items.length === 1 ? "" : "s"} flagged.
          </CardDescription>
        </CardHeader>
      </Card>

      {isLoading ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">Loading…</CardContent></Card>
      ) : items.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">No AI-written flags yet.</CardContent></Card>
      ) : (
        items.map((row) => (
          <Card key={row.opinionId} data-testid={`card-ai-flag-${row.opinionId}`}>
            <CardContent className="py-4 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link href={`/topic/${row.topicId}?opinion=${row.opinionId}`} className="font-serif font-semibold hover:text-primary">
                    {row.topicTitle}
                  </Link>
                  {row.excerpt ? (
                    <p className="mt-1 font-serif text-sm italic text-muted-foreground line-clamp-2">“{row.excerpt}”</p>
                  ) : null}
                </div>
                <Badge variant="secondary" className="shrink-0" data-testid={`badge-ai-flag-count-${row.opinionId}`}>
                  {row.flagCount} flag{row.flagCount === 1 ? "" : "s"}
                </Badge>
              </div>
              {row.lastFlaggedAt ? (
                <p className="text-xs text-muted-foreground">
                  Last flagged {formatDistanceToNow(new Date(row.lastFlaggedAt), { addSuffix: true })}
                </p>
              ) : null}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
