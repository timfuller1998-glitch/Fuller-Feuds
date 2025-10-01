import { useQuery } from "@tanstack/react-query";
import { useSearch } from "wouter/use-browser-location";
import TopicCard from "@/components/TopicCard";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search as SearchIcon, History, Filter } from "lucide-react";
import { type Topic } from "@shared/schema";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";

type TopicWithCounts = Topic & {
  opinionsCount?: number;
  participantCount?: number;
};

export default function Search() {
  const searchParams = new URLSearchParams(useSearch());
  const searchQuery = searchParams.get("q") || "";
  const [activeTab, setActiveTab] = useState("all");

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
  const categories = Array.from(new Set(topics?.map(t => t.category) || []));
  const filteredTopics = activeTab === "all" 
    ? topics 
    : topics?.filter(t => t.category === activeTab);

  // Get recent searches from localStorage
  const getRecentSearches = () => {
    try {
      const history = localStorage.getItem("searchHistory");
      return history ? JSON.parse(history) : [];
    } catch {
      return [];
    }
  };

  const recentSearches = getRecentSearches();

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
                      window.location.href = `/search?q=${encodeURIComponent(search)}`;
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
              {categories.map((category) => (
                <TabsTrigger 
                  key={category} 
                  value={category}
                  data-testid={`tab-${category.toLowerCase()}`}
                >
                  {category} ({topics.filter(t => t.category === category).length})
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
                  category={topic.category}
                  opinionsCount={topic.opinionsCount || 0}
                  participantCount={topic.participantCount || 0}
                  isActive={topic.isActive ?? true}
                  imageUrl={topic.imageUrl || "https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=800"}
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
          <CardContent className="py-12 text-center">
            <SearchIcon className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-lg font-medium mb-2">No results found</p>
            <p className="text-muted-foreground">
              Try different keywords or browse trending topics
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
