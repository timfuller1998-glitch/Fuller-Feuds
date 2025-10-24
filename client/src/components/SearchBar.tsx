import { useState, useEffect, useRef } from "react";
import { Search, History, Plus, X, Link as LinkIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation } from "@tanstack/react-query";
import { type Topic } from "@shared/schema";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLocation } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { TopicSimilarityModal } from "./TopicSimilarityModal";

interface SearchBarProps {
  onSearch?: (query: string) => void;
  placeholder?: string;
  className?: string;
  value?: string;
}

export default function SearchBar({ 
  onSearch, 
  placeholder = "search or create topics to debate your opinions...", 
  className = "",
  value: externalValue,
}: SearchBarProps) {
  const [query, setQuery] = useState(externalValue || "");
  const [debouncedQuery, setDebouncedQuery] = useState(query);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showSimilarityModal, setShowSimilarityModal] = useState(false);
  const [topicTitle, setTopicTitle] = useState("");
  const [initialOpinion, setInitialOpinion] = useState("");
  const [stance, setStance] = useState<'for' | 'against' | 'neutral'>('neutral');
  const [topicCategories, setTopicCategories] = useState<string[]>([]);
  const [categoryInput, setCategoryInput] = useState("");
  const [references, setReferences] = useState<string[]>([]);
  const [pendingEnterKey, setPendingEnterKey] = useState<string | null>(null);
  const [dismissedQuery, setDismissedQuery] = useState<string | null>(null);
  const [pendingSimilarityCheck, setPendingSimilarityCheck] = useState<string | null>(null);
  const [pendingMutationQuery, setPendingMutationQuery] = useState<string | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [, setLocation] = useLocation();

  // Sync internal state with external value (for controlled usage)
  useEffect(() => {
    if (externalValue !== undefined) {
      setQuery(externalValue);
    }
  }, [externalValue]);

  // Debounce query for API calls (300ms delay)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  // Close suggestions when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Element;
      // Don't close if clicking on Select dropdown content (rendered in portal)
      if (target.closest('[role="listbox"]') || target.closest('[data-radix-popper-content-wrapper]')) {
        return;
      }
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch topic suggestions using semantic search when debounced query changes
  const { data: topics } = useQuery<Topic[]>({
    queryKey: ["/api/topics/search-similar", { query: debouncedQuery, dropdown: true }],
    queryFn: async () => {
      if (!debouncedQuery || debouncedQuery.length < 2) return [];
      const params = new URLSearchParams();
      params.append("query", debouncedQuery);
      params.append("threshold", "0.3"); // Very broad for dropdown suggestions
      const response = await fetch(`/api/topics/search-similar?${params}`);
      if (!response.ok) return [];
      return response.json();
    },
    enabled: debouncedQuery.length >= 2,
  });

  // Fetch similar topics using AI embeddings when checking for duplicates
  const { data: similarTopics } = useQuery<(Topic & { similarityScore: number })[]>({
    queryKey: ["/api/topics/search-similar", { query: pendingSimilarityCheck }],
    queryFn: async () => {
      if (!pendingSimilarityCheck || pendingSimilarityCheck.length < 3) return [];
      const params = new URLSearchParams();
      params.append("query", pendingSimilarityCheck);
      params.append("threshold", "0.5"); // Fairly broad for duplicate detection
      const response = await fetch(`/api/topics/search-similar?${params}`);
      if (!response.ok) return [];
      return response.json();
    },
    enabled: !!pendingSimilarityCheck && pendingSimilarityCheck.length >= 3,
  });

  // Calculate search state variables (must be before useEffect that uses them)
  const hasResults = topics && topics.length > 0;
  const hasNoResults = query.length >= 2 && topics !== undefined && topics.length === 0;

  // Handle Enter key flow - navigate to search or clear pending state
  useEffect(() => {
    if (pendingEnterKey && debouncedQuery === pendingEnterKey) {
      if (topics && topics.length > 0) {
        // Has results, navigate to search page
        saveToHistory(pendingEnterKey);
        onSearch?.(pendingEnterKey);
        setShowSuggestions(false);
        setLocation(`/search?q=${encodeURIComponent(pendingEnterKey)}`);
        window.dispatchEvent(new CustomEvent('searchHistoryUpdate'));
      }
      // Clear pending state regardless - the auto-trigger effect will handle topic creation
      setPendingEnterKey(null);
    }
  }, [pendingEnterKey, debouncedQuery, topics]);

  // Don't auto-trigger similarity check - let users manually click "Create Topic" in dropdown
  // (Removed auto-trigger since dropdown now uses semantic search and has manual create option)

  // Show similarity modal or create form based on similarity check results
  useEffect(() => {
    if (pendingSimilarityCheck && similarTopics !== undefined) {
      if (similarTopics.length > 0) {
        // Found similar topics, show modal
        setShowSimilarityModal(true);
      } else {
        // No similar topics, proceed with category generation and create form
        setPendingMutationQuery(pendingSimilarityCheck);
        generateCategoriesMutation.mutate(pendingSimilarityCheck);
      }
      setPendingSimilarityCheck(null);
    }
  }, [pendingSimilarityCheck, similarTopics]);

  // Get search history from localStorage
  const getSearchHistory = (): string[] => {
    try {
      const history = localStorage.getItem("searchHistory");
      return history ? JSON.parse(history) : [];
    } catch {
      return [];
    }
  };

  // Save search to history
  const saveToHistory = (searchTerm: string) => {
    if (!searchTerm.trim()) return;
    
    try {
      const history = getSearchHistory();
      const newHistory = [
        searchTerm,
        ...history.filter(item => item !== searchTerm)
      ].slice(0, 20); // Keep last 20 searches
      
      localStorage.setItem("searchHistory", JSON.stringify(newHistory));
    } catch (error) {
      console.error("Failed to save search history:", error);
    }
  };

  // Clear search history
  const clearHistory = () => {
    try {
      localStorage.removeItem("searchHistory");
      setShowSuggestions(false);
      // Notify other components that history was cleared
      window.dispatchEvent(new CustomEvent('searchHistoryUpdate'));
    } catch (error) {
      console.error("Failed to clear search history:", error);
    }
  };

  // Generate categories mutation
  const generateCategoriesMutation = useMutation({
    mutationFn: async (title: string) => {
      const response = await apiRequest("POST", "/api/topics/generate-categories", { title });
      return response.json();
    },
    onSuccess: (data: { categories: string[] }) => {
      // Only show form if the mutation query still matches the current debounced query
      if (pendingMutationQuery === debouncedQuery) {
        setTopicCategories(data.categories);
        setShowCreateForm(true);
      }
      setPendingMutationQuery(null);
    },
    onError: (error) => {
      console.error("Failed to generate categories:", error);
      // Only show form if the mutation query still matches the current debounced query
      if (pendingMutationQuery === debouncedQuery) {
        // Fallback to default categories
        setTopicCategories(["Politics", "Society", "General"]);
        setShowCreateForm(true);
      }
      setPendingMutationQuery(null);
    },
  });

  // Create topic mutation
  const createTopicMutation = useMutation({
    mutationFn: async (data: { title: string; initialOpinion: string; stance: string; categories: string[]; references?: string[] }) => {
      const response = await apiRequest("POST", "/api/topics", data);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/topics"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats/platform"] });
      setShowSuggestions(false);
      setShowCreateForm(false);
      setTopicTitle("");
      setInitialOpinion("");
      setStance('neutral');
      setTopicCategories([]);
      setCategoryInput("");
      setReferences([]);
      setLocation(`/topic/${data.id}`);
    },
    onError: (error) => {
      console.error("Failed to create topic:", error);
    },
  });

  // Handle category addition
  const handleAddCategory = (category: string) => {
    const trimmed = category.trim();
    if (trimmed && !topicCategories.includes(trimmed) && topicCategories.length < 5) {
      setTopicCategories([...topicCategories, trimmed]);
      setCategoryInput("");
    }
  };

  // Handle category removal
  const handleRemoveCategory = (category: string) => {
    setTopicCategories(topicCategories.filter(c => c !== category));
  };

  // Handle form submission
  const handleCreateTopic = () => {
    // Use current query from search bar as the title (not the debounced/stale topicTitle)
    const currentTitle = query.trim();
    if (!currentTitle || !initialOpinion.trim() || topicCategories.length === 0) return;
    
    // Filter out empty references
    const validReferences = references.filter(ref => ref.trim());
    
    createTopicMutation.mutate({
      title: currentTitle,
      initialOpinion: initialOpinion.trim(),
      stance: stance,
      categories: topicCategories,
      references: validReferences.length > 0 ? validReferences : undefined,
    });
  };

  // Handle proceeding with topic creation after similarity warning
  const handleProceedWithCreation = () => {
    setShowSimilarityModal(false);
    // Generate categories and show create form
    setPendingMutationQuery(debouncedQuery);
    generateCategoriesMutation.mutate(debouncedQuery);
  };

  const handleSearch = (value: string) => {
    setQuery(value);
    onSearch?.(value);
    // Clear dismissed state when query changes
    if (value !== dismissedQuery) {
      setDismissedQuery(null);
    }
  };

  const handleSubmit = (searchTerm: string) => {
    if (!searchTerm.trim()) return;
    
    saveToHistory(searchTerm);
    onSearch?.(searchTerm);
    setShowSuggestions(false);
    
    // Navigate to search page using wouter
    setLocation(`/search?q=${encodeURIComponent(searchTerm)}`);
    
    // Dispatch custom event to notify other components
    window.dispatchEvent(new CustomEvent('searchHistoryUpdate'));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      if (!query.trim()) return;
      
      // Immediately flush debounce and mark as pending
      setDebouncedQuery(query);
      setPendingEnterKey(query);
      setShowSuggestions(true); // Keep dropdown open to show create form
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
      setShowCreateForm(false);
      setPendingEnterKey(null);
    }
  };

  const searchHistory = getSearchHistory();
  const categories = Array.from(new Set(topics?.flatMap(t => t.categories) || []));
  
  // Show suggestions if we have query OR history, and field is focused
  const hasSuggestions = (query.length >= 2 && hasResults) || 
                         (query.length === 0 && searchHistory.length > 0) ||
                         (query.length >= 2 && categories.length > 0) ||
                         hasNoResults;

  return (
    <div ref={wrapperRef} className={`relative w-full ${className}`}>
      <Search className="absolute left-2 sm:left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none z-10" />
      <Input
        type="search"
        placeholder={placeholder}
        value={query}
        onChange={(e) => handleSearch(e.target.value)}
        onFocus={() => setShowSuggestions(true)}
        onKeyDown={handleKeyDown}
        className="pl-8 sm:pl-10 h-9 sm:h-10 text-sm sm:text-base"
        data-testid="input-search"
      />

      {/* Suggestions Dropdown */}
      {showSuggestions && (hasSuggestions || query.length >= 2) && (
        <Card className="absolute top-full left-0 right-0 mt-2 p-2 max-h-[85vh] overflow-y-auto z-[999999] shadow-lg">
          {/* Search History (when no query) */}
          {query.length === 0 && searchHistory.length > 0 && (
            <div className="mb-2">
              <div className="flex items-center justify-between px-2 py-1 mb-1">
                <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                  <History className="w-3 h-3" />
                  <span>Recent Searches</span>
                </div>
                <button
                  onClick={clearHistory}
                  className="text-xs text-muted-foreground hover:text-foreground"
                  data-testid="button-clear-history"
                >
                  Clear
                </button>
              </div>
              {searchHistory.slice(0, 5).map((item, index) => (
                <button
                  key={index}
                  onClick={() => {
                    setQuery(item);
                    handleSubmit(item);
                  }}
                  className="w-full text-left px-2 py-2 rounded hover-elevate text-sm flex items-center gap-2"
                  data-testid={`suggestion-history-${index}`}
                >
                  <History className="w-3 h-3 text-muted-foreground" />
                  <span>{item}</span>
                </button>
              ))}
            </div>
          )}

          {/* Topic Suggestions */}
          {query.length >= 2 && topics && topics.length > 0 && (
            <div className="mb-2">
              <div className="px-2 py-1 mb-1">
                <span className="text-xs font-semibold text-muted-foreground">Topics</span>
              </div>
              {topics.slice(0, 5).map((topic) => (
                <button
                  key={topic.id}
                  onClick={() => {
                    setShowSuggestions(false);
                    setLocation(`/topic/${topic.id}`);
                  }}
                  className="w-full text-left px-2 py-2 rounded hover-elevate text-sm"
                  data-testid={`suggestion-topic-${topic.id}`}
                >
                  <div className="font-medium line-clamp-1">{topic.title}</div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                    {topic.categories.slice(0, 2).map((cat) => (
                      <Badge key={cat} variant="secondary" className="text-xs px-1 py-0">
                        {cat}
                      </Badge>
                    ))}
                    {topic.categories.length > 2 && (
                      <Badge variant="secondary" className="text-xs px-1 py-0">
                        +{topic.categories.length - 2}
                      </Badge>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Category Suggestions */}
          {query.length >= 2 && categories.length > 0 && !hasNoResults && (
            <div>
              <div className="px-2 py-1 mb-1">
                <span className="text-xs font-semibold text-muted-foreground">Categories</span>
              </div>
              <div className="flex flex-wrap gap-1 px-2">
                {categories.map((category) => (
                  <Badge
                    key={category}
                    variant="outline"
                    className="cursor-pointer hover-elevate text-xs"
                    onClick={() => {
                      setShowSuggestions(false);
                      setLocation(`/?category=${encodeURIComponent(category)}`);
                    }}
                    data-testid={`suggestion-category-${category.toLowerCase()}`}
                  >
                    {category}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Create New Topic Button */}
          {query.length >= 2 && !showCreateForm && (
            <div className="mt-2 pt-2 border-t">
              <Button
                variant="outline"
                className="w-full justify-start gap-2"
                onClick={() => {
                  setTopicTitle(query);
                  setPendingSimilarityCheck(query);
                }}
                disabled={generateCategoriesMutation.isPending}
                data-testid="button-create-new-topic-dropdown"
              >
                <Plus className="w-4 h-4" />
                {generateCategoriesMutation.isPending ? "Checking for similar topics..." : `Create new topic: "${query}"`}
              </Button>
            </div>
          )}

          {/* Inline Topic Creation Form */}
          {showCreateForm && (
            <div className="p-4 space-y-3">
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    Your Initial Opinion
                  </label>
                  <Textarea
                    value={initialOpinion}
                    onChange={(e) => setInitialOpinion(e.target.value)}
                    placeholder="Share your thoughts on this topic... (required)"
                    className="min-h-[200px] text-sm resize-none"
                    data-testid="input-initial-opinion"
                    required
                  />
                </div>

                <div key={`stance-${showCreateForm}`}>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    Your Stance
                  </label>
                  <Select 
                    value={stance} 
                    onValueChange={(value: 'for' | 'against' | 'neutral') => setStance(value)}
                  >
                    <SelectTrigger className="h-9 text-sm" data-testid="select-stance">
                      <SelectValue placeholder="Select your stance" />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4} className="z-[999999]">
                      <SelectItem value="for">For - I support this topic</SelectItem>
                      <SelectItem value="against">Against - I oppose this topic</SelectItem>
                      <SelectItem value="neutral">Neutral - I'm undecided or balanced</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    Categories (1-5) {generateCategoriesMutation.isPending && <span className="text-xs text-muted-foreground">(Generating...)</span>}
                  </label>
                  {topicCategories.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {topicCategories.map((cat) => (
                        <Badge
                          key={cat}
                          variant="secondary"
                          className="text-xs gap-1"
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
                      className="h-9 text-sm flex-1"
                      disabled={topicCategories.length >= 5}
                      data-testid="input-topic-category"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleAddCategory(categoryInput)}
                      disabled={!categoryInput.trim() || topicCategories.length >= 5}
                      data-testid="button-add-category"
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Press Enter or click + to add
                  </p>
                </div>

                {/* Reference Links Section */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-2">
                    <LinkIcon className="w-4 h-4" />
                    Reference Links (Optional)
                  </label>
                  <div className="space-y-2">
                    {references.map((ref, index) => (
                      <div key={index} className="flex gap-2">
                        <Input
                          type="url"
                          placeholder="https://example.com/source"
                          className="h-9 text-sm flex-1"
                          value={ref}
                          onChange={(e) => {
                            const newRefs = [...references];
                            newRefs[index] = e.target.value;
                            setReferences(newRefs);
                          }}
                          data-testid={`input-reference-${index}`}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setReferences(references.filter((_, i) => i !== index));
                          }}
                          data-testid={`button-remove-reference-${index}`}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setReferences([...references, '']);
                      }}
                      data-testid="button-add-reference"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Reference Link
                    </Button>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      const queryToDismiss = topicTitle;
                      setShowCreateForm(false);
                      setTopicTitle("");
                      setInitialOpinion("");
                      setStance('neutral');
                      setTopicCategories([]);
                      setCategoryInput("");
                      setReferences([]);
                      setDismissedQuery(queryToDismiss);
                    }}
                    className="flex-1"
                    data-testid="button-cancel-create-topic"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCreateTopic}
                    disabled={!query.trim() || !initialOpinion.trim() || topicCategories.length === 0 || createTopicMutation.isPending}
                    className="flex-1"
                    data-testid="button-submit-create-topic"
                  >
                    {createTopicMutation.isPending ? "Creating..." : "Create Topic"}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Topic Similarity Modal */}
      <TopicSimilarityModal
        open={showSimilarityModal}
        onOpenChange={(open) => {
          setShowSimilarityModal(open);
          if (!open) {
            setDismissedQuery(debouncedQuery);
          }
        }}
        similarTopics={similarTopics || []}
        onCreateNew={handleProceedWithCreation}
      />
    </div>
  );
}
