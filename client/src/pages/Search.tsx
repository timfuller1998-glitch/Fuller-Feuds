import { useQuery } from "@tanstack/react-query";
import { useSearch, useLocation } from "wouter";
import SwipeableCardStack from "@/components/SwipeableCardStack";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search as SearchIcon, History, Filter, Users, MessageSquare } from "lucide-react";
import { type Topic } from "@shared/schema";
import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { useUserSearch, PersonRow } from "@/components/PeopleResults";

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

  // People matching the same query (name or @handle).
  const { data: people = [], isLoading: peopleLoading } = useUserSearch(searchQuery, 20);
  const [kind, setKind] = useState<"topics" | "people">("topics");
  useEffect(() => {
    setKind("topics");
  }, [searchQuery]);
  // Land on People when the query only matches people.
  useEffect(() => {
    if (!isLoading && !peopleLoading && (topics?.length ?? 0) === 0 && people.length > 0) setKind("people");
  }, [isLoading, peopleLoading, topics, people.length]);

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
              Search for topics, debates, and people
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
              Use the search bar above to find topics, debates, and people
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
              {isLoading || peopleLoading
                ? "Searching..."
                : `${topics?.length || 0} topics and ${people.length} ${people.length === 1 ? "person" : "people"} for "${searchQuery}"`}
            </p>
          </div>
        </div>
      </div>

      {/* Topics / People switch */}
      <div className="inline-flex rounded-lg border p-0.5" role="tablist" data-testid="search-kind-switch">
        {([
          { id: "topics", label: "Topics", icon: MessageSquare, count: topics?.length ?? 0 },
          { id: "people", label: "People", icon: Users, count: people.length },
        ] as const).map((k) => (
          <button
            key={k.id}
            type="button"
            role="tab"
            aria-selected={kind === k.id}
            onClick={() => setKind(k.id)}
            className={`font-ui inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] ${kind === k.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover-elevate"}`}
            data-testid={`tab-search-${k.id}`}
          >
            <k.icon className="h-3.5 w-3.5" />
            {k.label} ({k.count})
          </button>
        ))}
      </div>

      {/* People results */}
      {kind === "people" && (
        <div className="space-y-2" data-testid="list-people-results">
          {peopleLoading ? (
            <p className="text-sm text-muted-foreground">Searching people...</p>
          ) : people.length > 0 ? (
            <div className="grid gap-2 md:grid-cols-2">
              {people.map((p) => (
                <PersonRow key={p.id} p={p} />
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-10 text-center">
                <Users className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
                <p className="text-muted-foreground">No people match "{searchQuery}".</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Results Tabs */}
      {kind === "topics" && !isLoading && topics && topics.length > 0 && (
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
            <div className="py-2" data-testid="list-search-results">
              {filteredTopics && filteredTopics.length > 0 && (
                <SwipeableCardStack key={activeTab} topics={filteredTopics} testId="deck-search" />
              )}
            </div>
          </TabsContent>
        </Tabs>
      )}

      {/* Loading State */}
      {kind === "topics" && isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Searching topics...</p>
          </div>
        </div>
      )}

      {/* No Results */}
      {kind === "topics" && !isLoading && topics && topics.length === 0 && (
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
