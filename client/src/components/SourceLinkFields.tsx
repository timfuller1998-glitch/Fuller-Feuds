import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link as LinkIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";

export type SourcePreview = {
  url: string;
  pageTitle: string;
  pageDescription: string;
  draftTitle: string;
  draftDescription: string;
  warning?: string;
};

export function SourceLinkFields({
  sourceUrl,
  onSourceUrlChange,
  description,
  onDescriptionChange,
  onDraft,
  compact,
}: {
  sourceUrl: string;
  onSourceUrlChange: (url: string) => void;
  description: string;
  onDescriptionChange: (description: string) => void;
  onDraft?: (preview: SourcePreview) => void;
  compact?: boolean;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const preview = useMutation({
    mutationFn: async (url: string) => {
      const res = await apiRequest("POST", "/api/topics/preview-source", { url });
      return res.json() as Promise<SourcePreview>;
    },
    onSuccess: (data) => {
      if (data.draftDescription) onDescriptionChange(data.draftDescription);
      onDraft?.(data);
      setMessage(data.warning || (data.draftTitle ? "Draft title and description filled in — edit them before you publish." : null));
    },
    onError: (error: Error) => {
      setMessage(error.message || "Couldn't load that link. You can still add it and write the title yourself.");
    },
  });

  const labelCls = compact ? "text-xs font-medium text-muted-foreground mb-1 flex items-center gap-2" : "text-sm font-medium mb-2 flex items-center gap-2";

  return (
    <div className="space-y-3">
      <div>
        <label className={labelCls} htmlFor="topic-source-url">
          <LinkIcon className={compact ? "w-4 h-4" : "w-4 h-4"} />
          Source link (optional)
        </label>
        <div className={`flex gap-2 ${compact ? "" : "mt-0"}`}>
          <Input
            id="topic-source-url"
            type="url"
            value={sourceUrl}
            onChange={(e) => {
              onSourceUrlChange(e.target.value);
              setMessage(null);
            }}
            placeholder="https://… YouTube, X, or article"
            className={compact ? "h-9 text-sm flex-1" : "flex-1"}
            data-testid="input-topic-source-url"
          />
          <Button
            type="button"
            variant="outline"
            size={compact ? "sm" : "default"}
            onClick={() => sourceUrl.trim() && preview.mutate(sourceUrl.trim())}
            disabled={!sourceUrl.trim() || preview.isPending}
            data-testid="button-draft-from-source"
          >
            {preview.isPending ? "Drafting…" : "Draft from link"}
          </Button>
        </div>
        {message ? (
          <p className="mt-1 text-xs text-muted-foreground" data-testid="text-source-preview-status">{message}</p>
        ) : (
          <p className="mt-1 text-xs text-muted-foreground">Paste a link and we will try to draft a neutral title and description for you to edit.</p>
        )}
      </div>
      <div>
        <label className={compact ? "text-xs font-medium text-muted-foreground mb-1 block" : "text-sm font-medium mb-2 block"} htmlFor="topic-description">
          Topic description (optional)
        </label>
        <Textarea
          id="topic-description"
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          placeholder="A short, neutral frame for the debate…"
          className={compact ? "min-h-[80px] text-sm resize-none" : "min-h-[90px] resize-none"}
          data-testid="input-topic-description"
        />
      </div>
    </div>
  );
}
