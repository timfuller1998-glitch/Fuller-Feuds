import { useQuery } from "@tanstack/react-query";
import { useSearch, useLocation } from "wouter";
import TopicCard from "@/components/TopicCard";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search as SearchIcon, History, Filter } from "lucide-react";
import { type Topic } from "@shared/schema";
import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";

type TopicWithCounts = Topic & {
  opinionsCount?: number;
  participantCount?: number;
  previewContent?: string;
  previewAuthor?: string;
  previewIsAI?: boolean;
};

export default function Search() {
  const searchParams = new URLSearchParams(useSearch());
  const searchQuery = searchParams.get("q") || "";
  const [activeTab, setActiveTab] = useState("all");
  const [, setLocation] = useLocation();
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  // Get recent searches from localStorage
  const getRecentSearches = () => {
    try {
      const history = localStorage.getItem("searchHistory");
      return history ? JSON.parse(history) : [];
    } catch {
      return [];
    }
  };

  // Initialize recent searches and listen for updates
  useEffect(() => {
    setRecentSearches(getRecentSearches());
    
    const handleHistoryUpdate = () => {
      setRecentSearches(getRecentSearches());
    };
    
    window.addEventListener('searchHistoryUpdate', handleHistoryUpdate);
    return () => window.removeEventListener('searchHistoryUpdate', handleHistoryUpdate);
  }, []);

  // Fetch search results
  const { data: topics, isLoading } = useQuery<TopicWithCounts[]>({
    queryKey: ["/api/topics", { search: searchQuery }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchQuery) params.append("search", searchQuery);
      const response = await fetch(`/api/topics?${params}`);
      if (!response.ok) throw new Error("Failed to fetch topics");
      return response.json();
    },
    enabled: !!searchQuery,
  });

  // Filter by category for tabs
  const allCategories = Array.from(new Set(topics?.flatMap(t => t.categories) || []));
  const filteredTopics = activeTab === "all" 
    ? topics 
    : topics?.filter(t => t.categories.includes(activeTab));

  if (!searchQuery) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2 sm:p-3 rounded-lg bg-primary/10">
            <SearchIcon className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold" data-testid="heading-search">
              Search
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              Search for topics, debates, and discussions
            </p>
          </div>
        </div>

        {recentSearches.length > 0 && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-4">
                <History className="w-4 h-4 text-muted-foreground" />
                <h3 className="font-semibold">Recent Searches</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {recentSearches.slice(0, 10).map((search: string, index: number) => (
                  <Badge 
                    key={index} 
                    variant="secondary" 
                    className="cursor-pointer hover-elevate"
                    onClick={() => {
                      setLocation(`/search?q=${encodeURIComponent(search)}`);
                    }}
                    data-testid={`badge-recent-search-${index}`}
                  >
                    {search}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="py-12 text-center">
            <SearchIcon className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-lg font-medium mb-2">Start searching</p>
            <p className="text-muted-foreground">
              Use the search bar above to find topics and debates
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 sm:p-3 rounded-lg bg-primary/10">
            <SearchIcon className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold" data-testid="heading-search">
              Search Results
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              {isLoading ? "Searching..." : `${topics?.length || 0} results for "${searchQuery}"`}
            </p>
          </div>
        </div>
      </div>

      {/* Results Tabs */}
      {!isLoading && topics && topics.length > 0 && (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            <Filter className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <TabsList className="inline-flex">
              <TabsTrigger value="all" data-testid="tab-all">
                All ({topics.length})
              </TabsTrigger>
              {allCategories.map((category) => (
                <TabsTrigger 
                  key={category} 
                  value={category}
                  data-testid={`tab-${category.toLowerCase()}`}
                >
                  {category} ({topics.filter(t => t.categories.includes(category)).length})
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <TabsContent value={activeTab} className="mt-6">
            <div className="grid grid-cols-1 gap-4" data-testid="list-search-results">
              {filteredTopics?.map((topic) => (
                <TopicCard
                  key={topic.id}
                  id={topic.id}
                  title={topic.title}
                  description={topic.description}
                  categories={topic.categories}
                  opinionsCount={topic.opinionsCount || 0}
                  participantCount={topic.participantCount || 0}
                  isActive={topic.isActive ?? true}
                  imageUrl={topic.imageUrl || "https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=800"}
                  previewContent={topic.previewContent}
                  previewAuthor={topic.previewAuthor}
                  previewIsAI={topic.previewIsAI}
                  diversityScore={topic.diversityScore}
                />
              ))}
            </div>
          </TabsContent>
        </Tabs>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Searching topics...</p>
          </div>
        </div>
      )}

      {/* No Results */}
      {!isLoading && topics && topics.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center space-y-4">
            <SearchIcon className="w-12 h-12 text-muted-foreground mx-auto" />
            <div>
              <p className="text-lg font-medium mb-2">No results found</p>
              <p className="text-muted-foreground">
                No debates found for "{searchQuery}". Try creating a new topic using the search bar above.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
