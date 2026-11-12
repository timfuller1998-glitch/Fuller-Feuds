import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Bug, Lightbulb } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { OPEN_FEEDBACK_EVENT } from "@/lib/feedback";
import { cn } from "@/lib/utils";

/** App-wide "Send feedback" form. Opened via openFeedback(); the current page URL is attached automatically. */
export function FeedbackDialog() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<"bug" | "feature">("bug");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [pageUrl, setPageUrl] = useState("");

  useEffect(() => {
    const onOpen = (e: Event) => {
      const t = (e as CustomEvent).detail?.type;
      setType(t === "feature" ? "feature" : "bug");
      setPageUrl(window.location.href);
      setOpen(true);
    };
    window.addEventListener(OPEN_FEEDBACK_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_FEEDBACK_EVENT, onOpen);
  }, []);

  const submit = useMutation({
    mutationFn: () => apiRequest("POST", "/api/feedback", { type, title, description, pageUrl }),
    onSuccess: () => {
      toast({ title: type === "bug" ? "Bug report sent" : "Feature request sent", description: "Thanks! We read every one." });
      setOpen(false); setTitle(""); setDescription("");
    },
    onError: (e: any) => {
      const msg = String(e?.message || "").replace(/^\d+:\s*/, "");
      let text = msg;
      try { text = JSON.parse(msg).error || msg; } catch { /* plain text */ }
      toast({ title: "Couldn't send that", description: text || "Please try again.", variant: "destructive" });
    },
  });

  const valid = title.trim().length >= 3 && description.trim().length >= 5;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md" data-testid="dialog-feedback">
        <DialogHeader>
          <DialogTitle>Send feedback</DialogTitle>
          <DialogDescription>Report a bug or suggest a feature. We'll see which page you were on.</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (valid && !submit.isPending) submit.mutate(); }}>
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Type">
            {([["bug", "Bug", Bug], ["feature", "Feature idea", Lightbulb]] as const).map(([v, label, Icon]) => (
              <button key={v} type="button" role="radio" aria-checked={type === v} onClick={() => setType(v)}
                data-testid={`button-feedback-type-${v}`}
                className={cn("flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors",
                  type === v ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted")}>
                <Icon className="h-4 w-4" />{label}
              </button>
            ))}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="feedback-title">Title</Label>
            <Input id="feedback-title" value={title} maxLength={140} onChange={(e) => setTitle(e.target.value)}
              placeholder={type === "bug" ? "e.g. Search doesn't filter" : "e.g. Let me follow topics"} data-testid="input-feedback-title" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="feedback-description">{type === "bug" ? "What happened?" : "Describe your idea"}</Label>
            <Textarea id="feedback-description" value={description} maxLength={5000} rows={5} onChange={(e) => setDescription(e.target.value)}
              placeholder={type === "bug" ? "What did you do, what did you expect, and what happened instead?" : "What would it do, and why would it help?"}
              data-testid="input-feedback-description" />
          </div>
          <p className="text-xs text-muted-foreground break-all" data-testid="text-feedback-page">Page: {pageUrl.replace(/^https?:\/\/[^/]+/, "") || "/"}</p>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={!valid || submit.isPending} data-testid="button-feedback-submit">
              {submit.isPending ? "Sending…" : "Send"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
