import { useState, useEffect, useMemo } from "react";
import { useLocation, useSearch } from "wouter";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Plus, X, ArrowLeft } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { LoginDialog } from "@/components/LoginDialog";
import { SourceLinkFields } from "@/components/SourceLinkFields";
import { OpinionStructure, BareOpinionTip, useBareOpinionGuard } from "@/components/OpinionStructure";
import { MAJOR_CATEGORIES, subsOf, getMajor, getSub, normalizeHome } from "@shared/topicTaxonomy";

/**
 * Dedicated create-topic page.
 * Routes: /create-topic  and  /create-topic?title=...&category=...
 * Category CTAs navigate here; SearchBar also has an inline create flow.
 */
export default function CreateTopicPage() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const { toast } = useToast();
  const { user, isAuthenticated } = useAuth();
  const [showLoginDialog, setShowLoginDialog] = useState(false);

  const params = useMemo(() => new URLSearchParams(search.startsWith("?") ? search.slice(1) : search), [search]);
  const prefillTitle = params.get("title") || "";
  const prefillCategory = params.get("category") || "";

  const [title, setTitle] = useState(prefillTitle);
  const [initialOpinion, setInitialOpinion] = useState("");
  const [stance, setStance] = useState<"for" | "against" | "neutral">("neutral");
  // A category link (/create-topic?category=Food) that names an official group sets the home; any other value is just an extra tag.
  const prefillHome = prefillCategory ? normalizeHome(decodeURIComponent(prefillCategory)) : null;
  const [topicCategories, setTopicCategories] = useState<string[]>(
    prefillCategory && !prefillHome ? [decodeURIComponent(prefillCategory)] : [],
  );
  const [categoryInput, setCategoryInput] = useState("");
  const [categoriesReady, setCategoriesReady] = useState(!prefillTitle);
  // Official home group (major/sub ids). `homeTouched` = the author picked it, so a new AI suggestion never overrides it.
  const [home, setHome] = useState<string>(prefillHome ? `${prefillHome.majorId}/${prefillHome.subId}` : "");
  const [homeTouched, setHomeTouched] = useState(!!prefillHome);
  const [homeSource, setHomeSource] = useState<"ai" | "keywords" | "you" | "">(prefillHome ? "you" : "");
  const [sourceUrl, setSourceUrl] = useState("");
  const [topicDescription, setTopicDescription] = useState("");

  useEffect(() => {
    setTitle(prefillTitle);
  }, [prefillTitle]);

  useEffect(() => {
    if (prefillCategory && !normalizeHome(decodeURIComponent(prefillCategory))) {
      const decoded = decodeURIComponent(prefillCategory);
      setTopicCategories((prev) => (prev.includes(decoded) ? prev : [decoded, ...prev].slice(0, 5)));
    }
  }, [prefillCategory]);

  const generateCategoriesMutation = useMutation({
    mutationFn: async (topicTitle: string) => {
      const response = await apiRequest("POST", "/api/topics/generate-categories", {
        title: topicTitle,
        description: topicDescription.trim() || undefined,
        categories: topicCategories,
      });
      return response.json() as Promise<{ categories: string[]; home?: { homeMajor: string; homeSub: string; source: "ai" | "keywords" } }>;
    },
    onSuccess: (data) => {
      if (data.home && !homeTouched) {
        const h = normalizeHome(data.home.homeMajor, data.home.homeSub);
        if (h) {
          setHome(`${h.majorId}/${h.subId}`);
          setHomeSource(data.home.source);
        }
      }
      // Optional extra tags: only fill in when the author has none yet.
      const next = data.categories || [];
      setTopicCategories((prev) => {
        if (prev.length) return prev;
        return next.slice(0, 5);
      });
      setCategoriesReady(true);
    },
    onError: () => {
      toast({
        title: "Couldn't suggest a group",
        description: "Pick a home group from the list below.",
        variant: "destructive",
      });
      setCategoriesReady(true);
    },
  });

  useEffect(() => {
    if (prefillTitle.trim() && !categoriesReady && !generateCategoriesMutation.isPending) {
      generateCategoriesMutation.mutate(prefillTitle.trim());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillTitle]);

  const createTopicMutation = useMutation({
    mutationFn: async (data: {
      title: string;
      initialOpinion: string;
      categories: string[];
      homeMajor?: string;
      homeSub?: string;
      stance: string;
      description?: string;
      sourceUrl?: string;
    }) => {
      const response = await apiRequest("POST", "/api/topics", data);
      return response.json();
    },
    onSuccess: (data: { id: string }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/topics"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats/platform"] });
      queryClient.invalidateQueries({ queryKey: ["/api/topics", data.id, "opinions"] });
      toast({
        title: "Topic Created!",
        description: "Your debate topic has been created successfully.",
      });
      setLocation(`/topic/${data.id}`);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create topic",
        variant: "destructive",
      });
    },
  });

  const handleAddCategory = (category: string) => {
    const trimmed = category.trim();
    if (!trimmed || topicCategories.includes(trimmed) || topicCategories.length >= 5) return;
    setTopicCategories([...topicCategories, trimmed]);
    setCategoryInput("");
  };

  const handleRemoveCategory = (categoryToRemove: string) => {
    setTopicCategories(topicCategories.filter((cat) => cat !== categoryToRemove));
  };

  const handleSuggestCategories = () => {
    if (!title.trim()) return;
    setCategoriesReady(false);
    generateCategoriesMutation.mutate(title.trim());
  };

  const bareOpinion = useBareOpinionGuard(initialOpinion);

  const submitNewTopic = () => {
    if (!isAuthenticated || !user) {
      setShowLoginDialog(true);
      return;
    }
    createTopicMutation.mutate({
      title: title.trim(),
      initialOpinion: initialOpinion.trim(),
      categories: topicCategories,
      ...(home ? { homeMajor: home.split("/")[0], homeSub: home.split("/")[1] } : {}),
      stance,
      description: topicDescription.trim() || undefined,
      sourceUrl: sourceUrl.trim() || undefined,
    });
  };

  const handleCreateTopic = () => {
    if (!title.trim() || !initialOpinion.trim()) return;
    bareOpinion.guard(submitNewTopic);
  };

  return (
    <div className="container max-w-2xl mx-auto p-4 md:p-8" data-testid="page-create-topic">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setLocation("/")}
        className="mb-4"
        data-testid="button-back-home"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Topics
      </Button>

      <Card className="p-6 border-[1.5px] border-foreground">
        <h1 className="font-serif text-2xl font-bold mb-2">Create New Topic</h1>
        <p className="text-muted-foreground mb-6">
          Start a fair fight — share a title, your opening opinion, and a stance.
        </p>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block" htmlFor="topic-title">
              Topic Title
            </label>
            <Input
              id="topic-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => {
                if (!homeTouched && !home && title.trim().length >= 8 && !generateCategoriesMutation.isPending) handleSuggestCategories();
              }}
              placeholder="What should people debate?"
              data-testid="input-topic-title"
            />
            <div className="mt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSuggestCategories}
                disabled={!title.trim() || generateCategoriesMutation.isPending}
                data-testid="button-suggest-categories"
              >
                {generateCategoriesMutation.isPending ? "Finding a group…" : "Suggest home group"}
              </Button>
            </div>
          </div>

          <div data-testid="home-group-picker">
            <label className="text-sm font-medium mb-1 block" htmlFor="home-group">Home group</label>
            <p className="text-xs text-muted-foreground mb-2" data-testid="text-home-hint">
              {home
                ? homeSource === "you"
                  ? "Your pick. This is where the topic sits on the Explore map."
                  : "Suggested for you. Change it if another group fits better."
                : "Where this topic lives on the Explore map. We'll suggest one from your title."}
            </p>
            <Select
              value={home || undefined}
              onValueChange={(v) => {
                setHome(v);
                setHomeTouched(true);
                setHomeSource("you");
              }}
            >
              <SelectTrigger id="home-group" data-testid="select-home-group">
                <SelectValue placeholder="Choose a group (or tap Suggest home group)">
                  {home ? `${getMajor(home.split("/")[0])?.name} › ${getSub(home.split("/")[0], home.split("/")[1])?.name}` : undefined}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {MAJOR_CATEGORIES.map((m) => (
                  <SelectGroup key={m.id}>
                    <SelectLabel>{m.name}</SelectLabel>
                    {subsOf(m.id).map((sub) => (
                      <SelectItem key={`${m.id}/${sub.id}`} value={`${m.id}/${sub.id}`} data-testid={`option-home-${m.id}-${sub.id}`}>
                        {sub.name === "General" ? `${m.name} (general)` : sub.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </div>

          <SourceLinkFields
            sourceUrl={sourceUrl}
            onSourceUrlChange={setSourceUrl}
            description={topicDescription}
            onDescriptionChange={setTopicDescription}
            onDraft={(preview) => {
              if (preview.draftTitle && !title.trim()) setTitle(preview.draftTitle);
              else if (preview.draftTitle && title.trim()) setTitle(preview.draftTitle);
            }}
          />

          {!categoriesReady && generateCategoriesMutation.isPending ? (
            <div className="py-8 text-center">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">Finding the best group…</p>
            </div>
          ) : (
            <>
              <div>
                <label className="text-sm font-medium mb-2 block" htmlFor="initial-opinion">
                  Your Initial Opinion
                </label>
                <Textarea
                  id="initial-opinion"
                  value={initialOpinion}
                  onChange={(e) => setInitialOpinion(e.target.value)}
                  placeholder="Share your thoughts on this topic… (required)"
                  className="min-h-[120px] resize-none"
                  data-testid="input-initial-opinion"
                  required
                />
                <div className="mt-2 space-y-2">
                  <OpinionStructure text={initialOpinion} topicTitle={title} />
                  <BareOpinionTip
                    open={bareOpinion.showTip}
                    onKeepWriting={bareOpinion.keepWriting}
                    onPostAnyway={bareOpinion.postAnyway}
                    anywayLabel="Create anyway"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Your Stance</label>
                <Select
                  value={stance}
                  onValueChange={(value: "for" | "against" | "neutral") => setStance(value)}
                >
                  <SelectTrigger data-testid="select-stance">
                    <SelectValue placeholder="Select your stance" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="for">For — I support this</SelectItem>
                    <SelectItem value="against">Against — I oppose this</SelectItem>
                    <SelectItem value="neutral">Neutral — undecided or balanced</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Extra tags (optional, up to 5)</label>
                {topicCategories.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {topicCategories.map((cat) => (
                      <Badge
                        key={cat}
                        variant="secondary"
                        className="gap-1"
                        data-testid={`badge-category-${cat.toLowerCase().replace(/\s+/g, "-")}`}
                      >
                        {cat}
                        <button
                          type="button"
                          onClick={() => handleRemoveCategory(cat)}
                          className="hover:text-foreground"
                          data-testid={`button-remove-category-${cat.toLowerCase().replace(/\s+/g, "-")}`}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <Input
                    value={categoryInput}
                    onChange={(e) => setCategoryInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddCategory(categoryInput);
                      }
                    }}
                    placeholder="Add a tag, e.g. Mustang"
                    disabled={topicCategories.length >= 5}
                    data-testid="input-topic-category"
                  />
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => handleAddCategory(categoryInput)}
                    disabled={!categoryInput.trim() || topicCategories.length >= 5}
                    data-testid="button-add-category"
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Tags help search. A tag that names another group (like Food) also shows the topic there.</p>
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setLocation("/")}
                  className="flex-1"
                  data-testid="button-cancel-create-topic"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateTopic}
                  disabled={
                    !title.trim() ||
                    !initialOpinion.trim() ||
                    createTopicMutation.isPending
                  }
                  className="flex-1"
                  data-testid="button-submit-create-topic"
                >
                  {createTopicMutation.isPending ? "Creating…" : "Create Topic"}
                </Button>
              </div>
            </>
          )}
        </div>
      </Card>

      <LoginDialog open={showLoginDialog} onOpenChange={setShowLoginDialog} />
    </div>
  );
}
