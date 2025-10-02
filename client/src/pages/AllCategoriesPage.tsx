import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import TopicCard from "@/components/TopicCard";
import { Link } from "wouter";
import { 
  Gavel, 
  Cpu, 
  Globe, 
  Briefcase, 
  GraduationCap, 
  Heart,
  ChevronRight
} from "lucide-react";
import type { Topic } from "@shared/schema";

const categoryConfig = [
  { name: "Politics", icon: Gavel },
  { name: "Technology", icon: Cpu },
  { name: "Environment", icon: Globe },
  { name: "Business", icon: Briefcase },
  { name: "Education", icon: GraduationCap },
  { name: "Health", icon: Heart },
];

export default function AllCategoriesPage() {
  // Fetch all topics
  const { data: apiTopics, isLoading, error } = useQuery<Topic[]>({
    queryKey: ["/api/topics"],
  });

  // Group topics by category (topics can appear in multiple categories)
  const topicsByCategory = apiTopics?.reduce((acc, topic) => {
    // A topic can have multiple categories, add it to each one
    topic.categories.forEach(category => {
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push({
        id: topic.id,
        title: topic.title,
        description: topic.description,
        imageUrl: topic.imageUrl || "",
        categories: topic.categories,
        participantCount: 0,
        opinionsCount: 0,
        isActive: topic.isActive ?? true
      });
    });
    return acc;
  }, {} as Record<string, any[]>);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading categories...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-lg font-medium mb-2">Failed to load debates</p>
          <p className="text-muted-foreground">
            There was an error loading debates. Please try again later.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold mb-2" data-testid="text-page-title">
          Browse All Categories
        </h1>
        <p className="text-muted-foreground">
          Explore debates across different topics and join the conversation
        </p>
      </div>

      {/* Categories List */}
      <div className="space-y-8">
        {categoryConfig.map((category) => {
          const topics = topicsByCategory?.[category.name]?.slice(0, 6) || [];
          const totalCount = topicsByCategory?.[category.name]?.length || 0;
          const CategoryIcon = category.icon;

          return (
            <div key={category.name} className="space-y-4" data-testid={`section-category-${category.name.toLowerCase()}`}>
              {/* Category Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <CategoryIcon className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold" data-testid={`text-category-${category.name.toLowerCase()}`}>
                      {category.name}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {totalCount} {totalCount === 1 ? 'debate' : 'debates'}
                    </p>
                  </div>
                </div>
                {totalCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    asChild
                    data-testid={`button-viewall-${category.name.toLowerCase()}`}
                  >
                    <Link href={`/category/${category.name}`}>
                      View All
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Link>
                  </Button>
                )}
              </div>

              {/* Horizontal Scrolling Topics */}
              {topics.length > 0 ? (
                <div className="relative">
                  <div 
                    className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent"
                    style={{ scrollbarWidth: 'thin' }}
                    data-testid={`scroll-topics-${category.name.toLowerCase()}`}
                  >
                    {topics.map((topic) => (
                      <div key={topic.id} className="flex-none w-[300px]">
                        <TopicCard {...topic} />
                      </div>
                    ))}
                    {totalCount > 6 && (
                      <div className="flex-none w-[300px]">
                        <Card className="h-full hover-elevate active-elevate-2 transition-all">
                          <CardContent className="flex flex-col items-center justify-center h-full min-h-[200px] p-6">
                            <CategoryIcon className="w-12 h-12 text-muted-foreground mb-4" />
                            <p className="text-center font-medium mb-2">
                              {totalCount - 6} more {totalCount - 6 === 1 ? 'debate' : 'debates'}
                            </p>
                            <Button
                              variant="outline"
                              size="sm"
                              asChild
                              data-testid={`button-viewall-card-${category.name.toLowerCase()}`}
                            >
                              <Link href={`/category/${category.name}`}>
                                View All
                                <ChevronRight className="w-4 h-4 ml-1" />
                              </Link>
                            </Button>
                          </CardContent>
                        </Card>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <Card>
                  <CardContent className="py-8 text-center">
                    <CategoryIcon className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground">
                      No debates in {category.name} yet
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
