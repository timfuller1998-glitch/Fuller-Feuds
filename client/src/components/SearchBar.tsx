import { useState, useEffect, useRef } from "react";
import { Search, History, Plus, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation } from "@tanstack/react-query";
import { type Topic } from "@shared/schema";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useLocation } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";

interface SearchBarProps {
  onSearch?: (query: string) => void;
  placeholder?: string;
  className?: string;
  value?: string;
}

export default function SearchBar({ 
  onSearch, 
  placeholder = "Search debate topics...", 
  className = "",
  value: externalValue,
}: SearchBarProps) {
  const [query, setQuery] = useState(externalValue || "");
  const [debouncedQuery, setDebouncedQuery] = useState(query);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [topicTitle, setTopicTitle] = useState("");
  const [initialOpinion, setInitialOpinion] = useState("");
  const [topicCategories, setTopicCategories] = useState<string[]>([]);
  const [categoryInput, setCategoryInput] = useState("");
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
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch topic suggestions when debounced query changes
  const { data: topics } = useQuery<Topic[]>({
    queryKey: ["/api/topics", { search: debouncedQuery }],
    queryFn: async () => {
      if (!debouncedQuery || debouncedQuery.length < 2) return [];
      const params = new URLSearchParams();
      params.append("search", debouncedQuery);
      const response = await fetch(`/api/topics?${params}`);
      if (!response.ok) return [];
      return response.json();
    },
    enabled: debouncedQuery.length >= 2,
  });

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
      setTopicCategories(data.categories);
    },
    onError: (error) => {
      console.error("Failed to generate categories:", error);
      // Fallback to default categories
      setTopicCategories(["Politics", "Society", "General"]);
    },
  });

  // Create topic mutation
  const createTopicMutation = useMutation({
    mutationFn: async (data: { title: string; initialOpinion: string; categories: string[] }) => {
      const response = await apiRequest("POST", "/api/topics", data);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/topics"] });
      setShowSuggestions(false);
      setShowCreateForm(false);
      setTopicTitle("");
      setInitialOpinion("");
      setTopicCategories([]);
      setCategoryInput("");
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
    if (!topicTitle.trim() || !initialOpinion.trim() || topicCategories.length === 0) return;
    createTopicMutation.mutate({
      title: topicTitle,
      initialOpinion: initialOpinion.trim(),
      categories: topicCategories,
    });
  };

  const handleSearch = (value: string) => {
    setQuery(value);
    onSearch?.(value);
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
      handleSubmit(query);
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
    }
  };

  const searchHistory = getSearchHistory();
  const categories = Array.from(new Set(topics?.flatMap(t => t.categories) || []));
  
  // Show suggestions if we have query OR history, and field is focused
  const hasResults = topics && topics.length > 0;
  const hasNoResults = query.length >= 2 && topics !== undefined && topics.length === 0;
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
      {showSuggestions && hasSuggestions && (
        <Card className="absolute top-full left-0 right-0 mt-2 p-2 max-h-96 overflow-y-auto z-50 shadow-lg">
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

          {/* No Results - Create New Topic */}
          {hasNoResults && !showCreateForm && (
            <div className="p-4 text-center space-y-3">
              <div className="text-sm text-muted-foreground">
                No debates found for "{query}"
              </div>
              <Button
                onClick={() => {
                  setShowCreateForm(true);
                  setTopicTitle(query);
                  // Auto-generate 3 related categories
                  generateCategoriesMutation.mutate(query);
                }}
                disabled={generateCategoriesMutation.isPending}
                className="w-full"
                data-testid="button-create-topic-from-search"
              >
                <Plus className="w-4 h-4 mr-2" />
                {generateCategoriesMutation.isPending ? "Loading..." : "Create New Topic"}
              </Button>
            </div>
          )}

          {/* Inline Topic Creation Form */}
          {hasNoResults && showCreateForm && (
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold">Create New Topic</h3>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setShowCreateForm(false);
                    setTopicTitle("");
                    setInitialOpinion("");
                    setTopicCategories([]);
                    setCategoryInput("");
                  }}
                  data-testid="button-close-create-form"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    Title
                  </label>
                  <Input
                    value={topicTitle}
                    onChange={(e) => setTopicTitle(e.target.value)}
                    placeholder="Enter topic title..."
                    className="h-9 text-sm"
                    data-testid="input-topic-title"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    Your Initial Opinion
                  </label>
                  <Textarea
                    value={initialOpinion}
                    onChange={(e) => setInitialOpinion(e.target.value)}
                    placeholder="Share your thoughts on this topic... (required)"
                    className="min-h-[80px] text-sm resize-none"
                    data-testid="input-initial-opinion"
                    required
                  />
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

                <Button
                  onClick={handleCreateTopic}
                  disabled={!topicTitle.trim() || !initialOpinion.trim() || topicCategories.length === 0 || createTopicMutation.isPending}
                  className="w-full"
                  data-testid="button-submit-create-topic"
                >
                  {createTopicMutation.isPending ? "Creating..." : "Create Topic"}
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
