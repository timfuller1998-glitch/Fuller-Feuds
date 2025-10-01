import { useState, useEffect, useRef } from "react";
import { Search, History } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useQuery } from "@tanstack/react-query";
import { type Topic } from "@shared/schema";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useLocation } from "wouter";

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
  value: externalValue
}: SearchBarProps) {
  const [query, setQuery] = useState(externalValue || "");
  const [debouncedQuery, setDebouncedQuery] = useState(query);
  const [showSuggestions, setShowSuggestions] = useState(false);
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
  const categories = Array.from(new Set(topics?.map(t => t.category) || []));
  
  // Show suggestions if we have query OR history, and field is focused
  const hasSuggestions = (query.length >= 2 && topics && topics.length > 0) || 
                         (query.length === 0 && searchHistory.length > 0) ||
                         (query.length >= 2 && categories.length > 0);

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
                  <div className="text-xs text-muted-foreground flex items-center gap-2 mt-1">
                    <Badge variant="secondary" className="text-xs px-1 py-0">
                      {topic.category}
                    </Badge>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Category Suggestions */}
          {query.length >= 2 && categories.length > 0 && (
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
        </Card>
      )}
    </div>
  );
}
