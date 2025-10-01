import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import TopicCard from "@/components/TopicCard";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Folder } from "lucide-react";
import { type Topic } from "@shared/schema";

// Map category names to their icons
import { Gavel, Cpu, Globe, Briefcase, GraduationCap, Heart } from "lucide-react";

const categoryIcons: Record<string, any> = {
  Politics: Gavel,
  Technology: Cpu,
  Environment: Globe,
  Business: Briefcase,
  Education: GraduationCap,
  Health: Heart,
};

export default function CategoryPage() {
  const params = useParams<{ category: string }>();
  const category = params.category;

  // Fetch topics for this category using default fetcher
  const { data: apiTopics, isLoading, error } = useQuery<Topic[]>({
    queryKey: ["/api/topics", { category }],
    enabled: !!category,
  });

  // Transform API topics to include required TopicCard props
  const topics = apiTopics?.map(topic => ({
    id: topic.id,
    title: topic.title,
    description: topic.description,
    imageUrl: topic.imageUrl || "",
    category: topic.category,
    participantCount: 0, // TODO: Calculate from debate rooms
    opinionsCount: 0, // TODO: Calculate from opinions count
    isActive: topic.isActive ?? true
  }));

  const CategoryIcon = categoryIcons[category || ""] || Folder;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading debates...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <CategoryIcon className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-lg font-medium mb-2">Failed to load debates</p>
          <p className="text-muted-foreground">
            There was an error loading debates for {category}. Please try again later.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Category Header */}
      <div className="flex items-center gap-4">
        <div className="p-3 rounded-lg bg-primary/10">
          <CategoryIcon className="w-8 h-8 text-primary" />
        </div>
        <div className="flex-1">
          <h1 className="text-3xl font-bold" data-testid="text-category-title">
            {category}
          </h1>
          <p className="text-muted-foreground mt-1">
            Explore debates and discussions about {category?.toLowerCase()}
          </p>
        </div>
        <Badge variant="secondary" className="text-lg px-4 py-2">
          {topics?.length || 0} debates
        </Badge>
      </div>

      {/* Topics Grid */}
      {topics && topics.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {topics.map((topic) => (
            <TopicCard key={topic.id} {...topic} />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <CategoryIcon className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-lg font-medium mb-2">No debates yet</p>
            <p className="text-muted-foreground">
              Be the first to start a debate in {category}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
