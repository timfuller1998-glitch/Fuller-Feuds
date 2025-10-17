import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Plus, X, ArrowLeft } from "lucide-react";
import { useUser } from "@/hooks/use-user";
import LoginDialog from "@/components/LoginDialog";

export default function CreateTopicPage() {
  const [, params] = useRoute("/create-topic/:title");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useUser();
  const [showLoginDialog, setShowLoginDialog] = useState(false);

  const topicTitle = params?.title ? decodeURIComponent(params.title) : "";
  
  const [initialOpinion, setInitialOpinion] = useState("");
  const [stance, setStance] = useState<'for' | 'against' | 'neutral'>('neutral');
  const [topicCategories, setTopicCategories] = useState<string[]>([]);
  const [categoryInput, setCategoryInput] = useState("");
  const [categoriesGenerated, setCategoriesGenerated] = useState(false);

  // Auto-generate categories on mount
  const generateCategoriesMutation = useMutation({
    mutationFn: async (title: string) => {
      const response = await apiRequest(`/api/topics/generate-categories`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      return response.categories as string[];
    },
    onSuccess: (categories) => {
      setTopicCategories(categories);
      setCategoriesGenerated(true);
    },
    onError: () => {
      toast({
        title: "Category Generation Failed",
        description: "Could not generate categories. Please add them manually.",
        variant: "destructive",
      });
      setCategoriesGenerated(true); // Still show form
    },
  });

  // Generate categories when page loads
  useEffect(() => {
    if (topicTitle && !categoriesGenerated) {
      generateCategoriesMutation.mutate(topicTitle);
    }
  }, [topicTitle]);

  const createTopicMutation = useMutation({
    mutationFn: async (data: { title: string; initialOpinion: string; categories: string[]; stance: string }) => {
      const response = await apiRequest(`/api/topics`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return response;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/topics"] });
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
    if (!trimmed || topicCategories.includes(trimmed) || topicCategories.length >= 5) {
      return;
    }
    setTopicCategories([...topicCategories, trimmed]);
    setCategoryInput("");
  };

  const handleRemoveCategory = (categoryToRemove: string) => {
    setTopicCategories(topicCategories.filter(cat => cat !== categoryToRemove));
  };

  const handleCreateTopic = async () => {
    if (!user) {
      setShowLoginDialog(true);
      return;
    }

    if (!topicTitle.trim() || !initialOpinion.trim() || topicCategories.length === 0) {
      return;
    }

    createTopicMutation.mutate({
      title: topicTitle,
      initialOpinion,
      categories: topicCategories,
      stance,
    });
  };

  if (!topicTitle) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">Invalid topic creation request</p>
          <Button onClick={() => setLocation("/")} className="mt-4">
            Go Home
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-2xl mx-auto p-4 md:p-8">
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

      <Card className="p-6">
        <h1 className="text-2xl font-bold mb-2">Create New Topic</h1>
        <p className="text-muted-foreground mb-6">Share your perspective on: <span className="font-medium text-foreground">{topicTitle}</span></p>

        {!categoriesGenerated ? (
          <div className="py-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Preparing your topic...</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">
                Your Initial Opinion
              </label>
              <Textarea
                value={initialOpinion}
                onChange={(e) => setInitialOpinion(e.target.value)}
                placeholder="Share your thoughts on this topic... (required)"
                className="min-h-[120px] resize-none"
                data-testid="input-initial-opinion"
                required
              />
            </div>

            <div key={`stance-${categoriesGenerated}`}>
              <label className="text-sm font-medium mb-2 block">
                Your Stance
              </label>
              <Select 
                value={stance} 
                onValueChange={(value: 'for' | 'against' | 'neutral') => setStance(value)}
              >
                <SelectTrigger data-testid="select-stance">
                  <SelectValue placeholder="Select your stance" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="for">For - I support this topic</SelectItem>
                  <SelectItem value="against">Against - I oppose this topic</SelectItem>
                  <SelectItem value="neutral">Neutral - I'm undecided or balanced</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">
                Categories (1-5)
              </label>
              {topicCategories.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {topicCategories.map((cat) => (
                    <Badge
                      key={cat}
                      variant="secondary"
                      className="gap-1"
                      data-testid={`badge-category-${cat.toLowerCase()}`}
                    >
                      {cat}
                      <button
                        onClick={() => handleRemoveCategory(cat)}
                        className="hover:text-foreground"
                        data-testid={`button-remove-category-${cat.toLowerCase()}`}
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
                  placeholder="Add category..."
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
              <p className="text-xs text-muted-foreground mt-2">
                Press Enter or click + to add
              </p>
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
                disabled={!topicTitle.trim() || !initialOpinion.trim() || topicCategories.length === 0 || createTopicMutation.isPending}
                className="flex-1"
                data-testid="button-submit-create-topic"
              >
                {createTopicMutation.isPending ? "Creating..." : "Create Topic"}
              </Button>
            </div>
          </div>
        )}
      </Card>

      <LoginDialog 
        open={showLoginDialog} 
        onOpenChange={setShowLoginDialog}
      />
    </div>
  );
}
