import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Bug, Lightbulb, MessageSquare, ExternalLink } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const STATUS_LABEL: Record<string, string> = { new: "New", in_progress: "In progress", done: "Done", wont_fix: "Won't fix" };

type Row = {
  request: { id: string; type: string; title: string; description: string; pageUrl: string | null; status: string; createdAt: string; userAgent: string | null };
  user: { id: string; handle: string | null; firstName: string | null; lastName: string | null; email: string | null } | null;
};

/** Admin "Requests" tab: bug reports + feature requests sent from the in-app Feedback form. */
export function FeedbackRequests() {
  const { toast } = useToast();
  const [type, setType] = useState("all");
  const [status, setStatus] = useState("open");

  const { data, isLoading } = useQuery<{ items: Row[]; counts: Record<string, number> }>({
    queryKey: ['/api/admin/feedback', { type, status }],
    queryFn: async () => {
      const qs = new URLSearchParams();
      if (type !== "all") qs.set("type", type);
      if (status !== "all" && status !== "open") qs.set("status", status);
      const res = await fetch(`/api/admin/feedback?${qs}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load requests");
      return res.json();
    },
  });

  const update = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => apiRequest("PATCH", `/api/admin/feedback/${id}`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/admin/feedback'] }),
    onError: () => toast({ title: "Couldn't update the request", variant: "destructive" }),
  });

  const items = (data?.items || []).filter((r) => status !== "open" || r.request.status === "new" || r.request.status === "in_progress");
  const counts = data?.counts || {};

  return (
    <div className="space-y-4" data-testid="panel-feedback-requests">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <CardTitle className="flex items-center gap-2"><MessageSquare className="h-5 w-5" />Bug reports &amp; feature requests</CardTitle>
              <CardDescription>
                Sent from the Feedback button in the app. {counts.new ?? 0} new · {counts.in_progress ?? 0} in progress · {counts.done ?? 0} done
              </CardDescription>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Select value={type} onValueChange={setType}>
                <SelectTrigger className="w-[140px]" data-testid="select-feedback-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  <SelectItem value="bug">Bugs</SelectItem>
                  <SelectItem value="feature">Features</SelectItem>
                </SelectContent>
              </Select>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="w-[150px]" data-testid="select-feedback-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="all">All statuses</SelectItem>
                  {Object.entries(STATUS_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
      </Card>

      {isLoading ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">Loading…</CardContent></Card>
      ) : items.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground" data-testid="text-no-requests">No requests here yet.</CardContent></Card>
      ) : items.map(({ request: r, user }) => (
        <Card key={r.id} data-testid={`card-request-${r.id}`}>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 min-w-0">
                <Badge variant={r.type === "bug" ? "destructive" : "secondary"} className="gap-1 shrink-0">
                  {r.type === "bug" ? <Bug className="h-3 w-3" /> : <Lightbulb className="h-3 w-3" />}
                  {r.type === "bug" ? "Bug" : "Feature"}
                </Badge>
                <span className="font-medium break-words" data-testid={`text-request-title-${r.id}`}>{r.title}</span>
              </div>
              <Select value={r.status} onValueChange={(v) => update.mutate({ id: r.id, status: v })}>
                <SelectTrigger className="w-[140px] h-8" data-testid={`select-request-status-${r.id}`}><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <p className="text-sm whitespace-pre-wrap">{r.description}</p>
            <div className="flex items-center gap-3 flex-wrap text-xs text-muted-foreground">
              <span>{user ? (user.handle ? `@${user.handle}` : [user.firstName, user.lastName].filter(Boolean).join(" ")) : "Signed-out visitor"}</span>
              <span>•</span>
              <span>{r.createdAt ? formatDistanceToNow(new Date(r.createdAt), { addSuffix: true }) : ""}</span>
              {r.pageUrl && (<>
                <span>•</span>
                <a href={r.pageUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline break-all">
                  {r.pageUrl.replace(/^https?:\/\/[^/]+/, "") || "/"}<ExternalLink className="h-3 w-3" />
                </a>
              </>)}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
