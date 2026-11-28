import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { MAJOR_CATEGORIES, subsOf, getMajor, getSub, resolveHome } from "@shared/topicTaxonomy";

export interface MoveTopic {
  id: string;
  title: string;
  description?: string | null;
  categories?: string[] | null;
  homeMajor?: string | null;
  homeSub?: string | null;
}

interface GroupsResponse {
  majors: { id: string; name: string; count: number; subs: { id: string; name: string; count: number }[] }[];
  splitCandidates: { majorId: string; subId: string; majorName: string; subName: string; count: number }[];
}

export const homeLabel = (majorId: string, subId: string) =>
  `${getMajor(majorId)?.name ?? majorId} › ${getSub(majorId, subId)?.name ?? "General"}`;

/** Admin: move a topic to another official home group. Official groups only. */
export function MoveTopicDialog({ topic, onClose }: { topic: MoveTopic | null; onClose: () => void }) {
  const { toast } = useToast();
  const [value, setValue] = useState("");
  const { data: groups } = useQuery<GroupsResponse>({ queryKey: ["/api/topics/groups"], enabled: !!topic });

  useEffect(() => {
    if (!topic) return;
    const h = resolveHome({ id: topic.id, title: topic.title, description: topic.description, categories: topic.categories ?? [], homeMajor: topic.homeMajor, homeSub: topic.homeSub });
    setValue(`${h.majorId}/${h.subId}`);
  }, [topic]);

  const move = useMutation({
    mutationFn: async () => {
      const [homeMajor, homeSub] = value.split("/");
      return await apiRequest("PUT", `/api/admin/topics/${topic!.id}/home`, { homeMajor, homeSub });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/topics"] });
      queryClient.invalidateQueries({ queryKey: ["/api/topics/map"] });
      queryClient.invalidateQueries({ queryKey: ["/api/topics/groups"] });
      queryClient.invalidateQueries({ queryKey: ["/api/topics"] });
      toast({ title: "Topic moved", description: `Now in ${homeLabel(value.split("/")[0], value.split("/")[1])}.` });
      onClose();
    },
    onError: (e: any) => toast({ title: "Move failed", description: e?.message || "Could not move the topic", variant: "destructive" }),
  });

  const counts = new Map<string, number>();
  groups?.majors.forEach((m) => m.subs.forEach((s) => counts.set(`${m.id}/${s.id}`, s.count)));
  const crowded = new Set((groups?.splitCandidates ?? []).map((c) => `${c.majorId}/${c.subId}`));

  return (
    <Dialog open={!!topic} onOpenChange={(o) => !o && onClose()}>
      <DialogContent data-testid="dialog-move-topic">
        <DialogHeader>
          <DialogTitle>Move topic</DialogTitle>
          <DialogDescription className="line-clamp-2">{topic?.title}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="move-home">Home group (official groups only)</label>
          <Select value={value || undefined} onValueChange={setValue}>
            <SelectTrigger id="move-home" data-testid="select-move-home">
              <SelectValue placeholder="Choose a group">{value ? homeLabel(value.split("/")[0], value.split("/")[1]) : undefined}</SelectValue>
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {MAJOR_CATEGORIES.map((m) => (
                <SelectGroup key={m.id}>
                  <SelectLabel>{m.name}</SelectLabel>
                  {subsOf(m.id).map((s) => (
                    <SelectItem key={`${m.id}/${s.id}`} value={`${m.id}/${s.id}`} data-testid={`option-move-${m.id}-${s.id}`}>
                      {s.name === "General" ? `${m.name} (general)` : s.name}
                      <span className="text-muted-foreground"> · {counts.get(`${m.id}/${s.id}`) ?? 0}</span>
                      {crowded.has(`${m.id}/${s.id}`) ? " · large" : ""}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
          {(groups?.splitCandidates?.length ?? 0) > 0 && (
            <p className="text-xs text-muted-foreground" data-testid="text-split-hint">
              Large groups to consider splitting:{" "}
              {groups!.splitCandidates.map((c) => (
                <Badge key={`${c.majorId}/${c.subId}`} variant="secondary" className="mr-1">{c.majorName} › {c.subName} ({c.count})</Badge>
              ))}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} data-testid="button-cancel-move-topic">Cancel</Button>
          <Button onClick={() => move.mutate()} disabled={!value || move.isPending} data-testid="button-confirm-move-topic">
            {move.isPending ? "Moving…" : "Move"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
