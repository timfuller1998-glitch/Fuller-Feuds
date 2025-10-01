import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearch } from "wouter/use-browser-location";
import { useAuth } from "@/hooks/useAuth";
import TopicCard from "@/components/TopicCard";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageCircle, FileText, Users } from "lucide-react";
import { type Topic, type Opinion } from "@shared/schema";

// Extended topic type with counts
type TopicWithCounts = Topic & {
  opinionsCount?: number;
  participantCount?: number;
};

export default function MyDebates() {
  const { user } = useAuth();
  const searchParams = new URLSearchParams(useSearch());
  const searchQuery = searchParams.get("q") || "";
  const [activeTab, setActiveTab] = useState("created");

  // Fetch all topics
  const { data: allTopics, isLoading: topicsLoading } = useQuery<TopicWithCounts[]>({
    queryKey: ["/api/topics", { search: searchQuery }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchQuery) params.append("search", searchQuery);
      const response = await fetch(`/api/topics?${params}`);
      if (!response.ok) throw new Error("Failed to fetch topics");
      return response.json();
    },
  });

  // Fetch all opinions for this user
  const { data: userOpinions, isLoading: opinionsLoading } = useQuery<Opinion[]>({
    queryKey: ["/api/opinions", "user", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const response = await fetch(`/api/opinions/user/${user.id}`);
      if (!response.ok) {
        if (response.status === 404) return [];
        throw new Error("Failed to fetch user opinions");
      }
      return response.json();
    },
    enabled: !!user?.id,
  });

  // Filter topics created by user
  const createdTopics = allTopics?.filter(topic => topic.createdById === user?.id) || [];

  // Get unique topic IDs where user has participated
  const participatedTopicIds = new Set(userOpinions?.map(opinion => opinion.topicId) || []);
  
  // Filter topics where user has participated (excluding ones they created)
  const participatedTopics = allTopics?.filter(topic => 
    participatedTopicIds.has(topic.id) && topic.createdById !== user?.id
  ) || [];

  const isLoading = topicsLoading || opinionsLoading;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 sm:p-3 rounded-lg bg-primary/10">
          <MessageCircle className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold" data-testid="heading-my-debates">
            My Debates
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Topics you've created and participated in
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <Card>
          <CardContent className="pt-4 sm:pt-6">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="p-2 sm:p-3 rounded-lg bg-blue-500/10">
                <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-xl sm:text-2xl font-bold" data-testid="stat-created-topics">
                  {createdTopics.length}
                </p>
                <p className="text-xs sm:text-sm text-muted-foreground">Topics Created</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 sm:pt-6">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="p-2 sm:p-3 rounded-lg bg-green-500/10">
                <Users className="w-4 h-4 sm:w-5 sm:h-5 text-green-500" />
              </div>
              <div>
                <p className="text-xl sm:text-2xl font-bold" data-testid="stat-participated-topics">
                  {participatedTopics.length}
                </p>
                <p className="text-xs sm:text-sm text-muted-foreground">Participated In</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 sm:pt-6">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="p-2 sm:p-3 rounded-lg bg-purple-500/10">
                <MessageCircle className="w-4 h-4 sm:w-5 sm:h-5 text-purple-500" />
              </div>
              <div>
                <p className="text-xl sm:text-2xl font-bold" data-testid="stat-total-opinions">
                  {userOpinions?.length || 0}
                </p>
                <p className="text-xs sm:text-sm text-muted-foreground">Total Opinions</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for Created vs Participated */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="created" data-testid="tab-created">
            Created ({createdTopics.length})
          </TabsTrigger>
          <TabsTrigger value="participated" data-testid="tab-participated">
            Participated ({participatedTopics.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="created" className="mt-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-muted-foreground">Loading your topics...</p>
              </div>
            </div>
          ) : createdTopics.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-lg font-medium mb-2">No topics created yet</p>
                <p className="text-muted-foreground">
                  {searchQuery ? "Try a different search term" : "Start a new debate to see it here"}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4" data-testid="list-created-topics">
              {createdTopics.map((topic) => (
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
          )}
        </TabsContent>

        <TabsContent value="participated" className="mt-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-muted-foreground">Loading your debates...</p>
              </div>
            </div>
          ) : participatedTopics.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-lg font-medium mb-2">No debates participated in yet</p>
                <p className="text-muted-foreground">
                  {searchQuery ? "Try a different search term" : "Share your opinion on a topic to see it here"}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4" data-testid="list-participated-topics">
              {participatedTopics.map((topic) => (
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
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
