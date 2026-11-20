import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Crown, Loader2, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { parseServerDate } from "@/lib/dates";
import { FOUNDERS_PLEDGE } from "@shared/founders";

// Founders' Room (Fuller Feuds Dev, Nov 20 2026): a small board only founding members and admins can see.
type Post = {
  id: string; body: string; createdAt: string;
  author: { id: string; handle: string | null; firstName: string | null; avatar: string | null; founderNumber: number | null; isAdmin: boolean };
};

export default function FoundersRoom() {
  const { user, isLoading } = useAuth();
  const { toast } = useToast();
  const [body, setBody] = useState("");
  const u = user as any;
  const allowed = !!u && (u.founderNumber != null || u.role === "admin");

  const posts = useQuery<Post[]>({
    queryKey: ["/api/founders/room"],
    queryFn: async () => {
      const res = await fetch("/api/founders/room", { credentials: "include" });
      if (!res.ok) throw new Error("room");
      return res.json();
    },
    enabled: allowed,
    refetchInterval: 30_000,
  });
  const post = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/founders/room", {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ body }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.message || "Couldn't post");
    },
    onSuccess: () => { setBody(""); queryClient.invalidateQueries({ queryKey: ["/api/founders/room"] }); },
    onError: (e: Error) => toast({ title: "Couldn't post", description: e.message, variant: "destructive" }),
  });
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/founders/room/${id}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("Couldn't delete");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/founders/room"] }),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground p-4">Loading…</p>;
  if (!allowed) {
    return (
      <div className="mx-auto max-w-xl text-center py-10 space-y-3" data-testid="page-founders-locked">
        <Crown className="w-10 h-10 mx-auto text-[hsl(var(--gold))]" />
        <h1 className="font-serif text-2xl font-bold">Founders' Room</h1>
        <p className="text-muted-foreground">This room is for Fuller Feuds founding members.</p>
        {!u ? <Button asChild variant="outline"><Link href="/apply">Apply to be a founding member</Link></Button> : null}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5" data-testid="page-founders-room">
      <header className="border-b-[3px] border-double border-foreground pb-4">
        <p className="font-ui text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-[hsl(var(--gold))] flex items-center gap-1.5">
          <Crown className="w-3.5 h-3.5" /> Founding members only
        </p>
        <h1 className="font-serif text-3xl font-bold mt-1">Founders' Room</h1>
        <p className="text-sm text-muted-foreground mt-2">
          Rules, ideas, first looks at new features, and who's up for the Saturday showcase. Only founders and admins can see this.
        </p>
        <p className="text-xs italic text-muted-foreground mt-2">{FOUNDERS_PLEDGE}</p>
      </header>

      <Card>
        <CardContent className="pt-5 space-y-3">
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={2000} rows={3} placeholder="Share something with the other founders…" data-testid="input-founders-post" />
          <div className="flex justify-end">
            <Button onClick={() => post.mutate()} disabled={body.trim().length < 2 || post.isPending} data-testid="button-founders-post">
              {post.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null} Post
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3" data-testid="list-founders-posts">
        {posts.isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : null}
        {posts.data?.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6" data-testid="empty-founders-room">Nothing here yet. Say hello.</p>
        ) : null}
        {posts.data?.map((p) => {
          const name = p.author.firstName || p.author.handle || "Founder";
          const mine = p.author.id === u.id;
          return (
            <Card key={p.id} className="border-foreground/15" data-testid={`post-${p.id}`}>
              <CardContent className="pt-4 pb-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Avatar className="h-8 w-8">
                    {p.author.avatar ? <AvatarImage src={p.author.avatar} alt={name} /> : null}
                    <AvatarFallback className="text-xs">{name.slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <Link href={`/profile/${p.author.id}`} className="font-serif font-semibold hover:underline">{name}</Link>
                    <span className="text-xs text-muted-foreground ml-2">
                      {p.author.founderNumber != null ? `Founder #${p.author.founderNumber}` : p.author.isAdmin ? "Admin" : ""}
                      {" · "}{formatDistanceToNow(parseServerDate(p.createdAt), { addSuffix: true })}
                    </span>
                  </div>
                  {mine || u.role === "admin" ? (
                    <Button size="icon" variant="ghost" onClick={() => remove.mutate(p.id)} aria-label="Delete post" data-testid={`button-delete-post-${p.id}`}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  ) : null}
                </div>
                <p className="whitespace-pre-wrap text-[0.95rem] leading-relaxed">{p.body}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
