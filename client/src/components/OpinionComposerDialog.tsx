import { useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { insertOpinionSchema, type Opinion } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { OpinionStructure, BareOpinionTip, useBareOpinionGuard } from "@/components/OpinionStructure";

export const opinionFormSchema = insertOpinionSchema.omit({
  topicId: true,
  userId: true,
}).extend({
  content: z.string().min(1, "Opinion is required").max(2000, "Opinion too long"),
  debateStatus: z.enum(["open", "closed", "private"], { required_error: "Please select debate availability" }),
  references: z.array(z.string().url("Must be a valid URL")).optional().default([]),
  stance: z.enum(["for", "against", "neutral"], { required_error: "Pick a stance", invalid_type_error: "Pick a stance" }),
});
export type OpinionFormValues = z.infer<typeof opinionFormSchema>;

interface OpinionComposerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  topicId: string;
  topicTitle?: string;
  /** The signed-in user's existing opinion on this topic; when set, the dialog edits it (PATCH). */
  existingOpinion?: Opinion | null;
  onSaved?: () => void;
}

/**
 * The one opinion composer: used by the topic page and by topic cards, so both open
 * the same dialog (stance, debate availability, opinion with the structure guide).
 */
export function OpinionComposerDialog({ open, onOpenChange, topicId, topicTitle, existingOpinion, onSaved }: OpinionComposerDialogProps) {
  const { toast } = useToast();
  const isUpdate = !!existingOpinion;

  const opinionForm = useForm<OpinionFormValues>({
    resolver: zodResolver(opinionFormSchema),
    defaultValues: { content: "", debateStatus: "open", references: [] },
  });

  // Update mode: prefill from the existing opinion each time the dialog opens.
  useEffect(() => {
    if (!open || !existingOpinion) return;
    opinionForm.reset({
      content: existingOpinion.content,
      debateStatus: (existingOpinion.debateStatus || "open") as OpinionFormValues["debateStatus"],
      references: existingOpinion.references || [],
      stance: (existingOpinion.stance ?? undefined) as OpinionFormValues["stance"],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, existingOpinion?.id]);

  const saveMutation = useMutation({
    mutationFn: async (data: OpinionFormValues) => {
      if (existingOpinion) return apiRequest("PATCH", `/api/opinions/${existingOpinion.id}`, data);
      return apiRequest("POST", `/api/topics/${topicId}/opinions`, data);
    },
    onSuccess: () => {
      // Cards and the topic page share ["/api/topics", id, "opinions"], so both refresh.
      queryClient.invalidateQueries({ queryKey: ["/api/topics", topicId, "opinions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/topics", topicId] });
      queryClient.invalidateQueries({ queryKey: ["/api/topics"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats/platform"] });
      opinionForm.reset();
      onOpenChange(false);
      toast({ title: isUpdate ? "Opinion updated" : "Opinion shared" });
      onSaved?.();

      // Poll for the AI summary refresh after saving (about 45 seconds max).
      let pollAttempts = 0;
      const pollForSummary = setInterval(() => {
        pollAttempts++;
        queryClient.invalidateQueries({ queryKey: ["/api/topics", topicId, "cumulative"] });
        if (pollAttempts >= 15) clearInterval(pollForSummary);
      }, 3000);
      setTimeout(() => clearInterval(pollForSummary), 3000 * 15);
    },
    onError: (error: any) => {
      console.error("Failed to save opinion:", error);
      toast({ title: "Error", description: error?.message || "Failed to save opinion", variant: "destructive" });
    },
  });

  const opinionContent = opinionForm.watch("content");
  const bareOpinion = useBareOpinionGuard(opinionContent ?? "");
  const onSubmit = (data: OpinionFormValues) => bareOpinion.guard(() => saveMutation.mutate(data));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dialog-opinion-composer">
        <DialogHeader>
          <DialogTitle>{isUpdate ? "Update Your Opinion" : "Share Your Opinion"}</DialogTitle>
          <DialogDescription>
            {isUpdate ? "Modify your existing opinion on this topic." : "Share your thoughts on this topic."}
          </DialogDescription>
        </DialogHeader>
        <Form {...opinionForm}>
          <form onSubmit={opinionForm.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={opinionForm.control}
              name="stance"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Your Stance</FormLabel>
                  <FormControl>
                    <ToggleGroup
                      type="single"
                      value={field.value ?? ""}
                      onValueChange={(v) => { if (v) field.onChange(v); }}
                      className="grid grid-cols-3 gap-2"
                      data-testid="picker-stance"
                    >
                      <ToggleGroupItem value="for" variant="outline" className="data-[state=on]:bg-stance-for data-[state=on]:text-primary-foreground" data-testid="option-stance-for">For</ToggleGroupItem>
                      <ToggleGroupItem value="against" variant="outline" className="data-[state=on]:bg-stance-against data-[state=on]:text-primary-foreground" data-testid="option-stance-against">Against</ToggleGroupItem>
                      <ToggleGroupItem value="neutral" variant="outline" className="data-[state=on]:bg-stance-neutral data-[state=on]:text-primary-foreground" data-testid="option-stance-neutral">Neutral</ToggleGroupItem>
                    </ToggleGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={opinionForm.control}
              name="debateStatus"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Debate Availability</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-debate-status">
                        <SelectValue placeholder="Select debate availability" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="open" data-testid="option-debate-open">
                        Open for Debate - Others can challenge this opinion
                      </SelectItem>
                      <SelectItem value="closed" data-testid="option-debate-closed">
                        Not Debatable - Opinion is public but read-only
                      </SelectItem>
                      <SelectItem value="private" data-testid="option-debate-private">
                        Private - Only visible to you
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={opinionForm.control}
              name="content"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Your Opinion</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Share your thoughts..."
                      className="min-h-[120px]"
                      data-testid="input-opinion-content"
                      {...field}
                    />
                  </FormControl>
                  <OpinionStructure text={field.value ?? ""} topicTitle={topicTitle} />
                  <FormMessage />
                </FormItem>
              )}
            />
            <BareOpinionTip
              open={bareOpinion.showTip}
              onKeepWriting={bareOpinion.keepWriting}
              onPostAnyway={bareOpinion.postAnyway}
            />
            <div className="flex gap-2 justify-end pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-opinion">
                Cancel
              </Button>
              <Button type="submit" disabled={saveMutation.isPending} data-testid="button-submit-opinion">
                {saveMutation.isPending ? "Saving..." : isUpdate ? "Update Opinion" : "Share Opinion"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
