import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import TopicCard from "@/components/TopicCard";
import { Link } from "wouter";
import { useState } from "react";
import { 
  Gavel, 
  Cpu, 
  Globe, 
  Briefcase, 
  GraduationCap, 
  Heart,
  ChevronRight,
  MessageCircle,
  TrendingUp,
  Radio,
  Flame,
  Grid,
  ArrowUpDown
} from "lucide-react";
import type { Topic } from "@shared/schema";

// Icon mapping for common categories
const getCategoryIcon = (categoryName: string) => {
  const iconMap: Record<string, any> = {
    'Politics': Gavel,
    'Technology': Cpu,
    'Environment': Globe,
    'Business': Briefcase,
    'Education': GraduationCap,
    'Health': Heart,
    'Science': Cpu,
    'Sports': TrendingUp,
    'Entertainment': Radio,
    'Law': Gavel,
    'Economics': Briefcase,
    'Energy': Flame,
    'Climate': Globe,
    'Society': MessageCircle,
    'General': Grid,
  };
  return iconMap[categoryName] || MessageCircle;
};

type SortOption = 'popular' | 'alphabetical' | 'recent' | 'oldest';

interface CategoryData {
  name: string;
  icon: any;
  topics: Topic[];
  totalCount: number;
  mostRecentDate?: Date;
}

export default function AllCategoriesPage() {
  const [sortBy, setSortBy] = useState<SortOption>('popular');

  // Fetch all topics
  const { data: apiTopics, isLoading, error } = useQuery<Topic[]>({
    queryKey: ["/api/topics"],
  });

  // Group topics by category (topics can appear in multiple categories)
  const categoriesData: CategoryData[] = apiTopics
    ? (() => {
        const categoryMap = new Map<string, CategoryData>();
        
        apiTopics.forEach(topic => {
          topic.categories.forEach(categoryName => {
            if (!categoryMap.has(categoryName)) {
              categoryMap.set(categoryName, {
                name: categoryName,
                icon: getCategoryIcon(categoryName),
                topics: [],
                totalCount: 0,
                mostRecentDate: undefined
              });
            }
            
            const category = categoryMap.get(categoryName)!;
            category.topics.push(topic);
            category.totalCount++;
            
            // Track most recent topic date for "recent" sorting
            const topicDate = new Date(topic.createdAt || 0);
            if (!category.mostRecentDate || topicDate > category.mostRecentDate) {
              category.mostRecentDate = topicDate;
            }
          });
        });

        // Convert to array
        let categoriesArray = Array.from(categoryMap.values());

        // Apply sorting
        switch (sortBy) {
          case 'popular':
            categoriesArray.sort((a, b) => b.totalCount - a.totalCount);
            break;
          case 'alphabetical':
            categoriesArray.sort((a, b) => a.name.localeCompare(b.name));
            break;
          case 'recent':
            categoriesArray.sort((a, b) => {
              const dateA = a.mostRecentDate?.getTime() || 0;
              const dateB = b.mostRecentDate?.getTime() || 0;
              return dateB - dateA;
            });
            break;
          case 'oldest':
            categoriesArray.sort((a, b) => {
              const dateA = a.mostRecentDate?.getTime() || 0;
              const dateB = b.mostRecentDate?.getTime() || 0;
              return dateA - dateB;
            });
            break;
        }

        return categoriesArray;
      })()
    : [];

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
    <div className="space-y-4 sm:space-y-8 max-w-full overflow-hidden">
      {/* Page Header */}
      <div className="flex items-start justify-between gap-2 sm:gap-4 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold mb-1" data-testid="text-page-title">
            Browse All Categories
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground hidden sm:block">
            Explore debates across different topics and join the conversation
          </p>
        </div>
        
        {/* Sort Controls */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <ArrowUpDown className="w-4 h-4 text-muted-foreground hidden sm:block" />
          <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortOption)}>
            <SelectTrigger className="w-[140px] sm:w-[180px]" data-testid="select-sort-categories">
              <SelectValue placeholder="Sort by..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="popular" data-testid="option-sort-popular">Most Popular</SelectItem>
              <SelectItem value="alphabetical" data-testid="option-sort-alphabetical">Alphabetical</SelectItem>
              <SelectItem value="recent" data-testid="option-sort-recent">Most Recent</SelectItem>
              <SelectItem value="oldest" data-testid="option-sort-oldest">Oldest First</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Categories List */}
      {categoriesData.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Grid className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-lg font-medium mb-2">No categories yet</p>
            <p className="text-muted-foreground">
              Create a new topic to get started
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3 sm:space-y-8">
          {categoriesData.map((category) => {
            const topics = category.topics.slice(0, 5);
            const CategoryIcon = category.icon;

            return (
              <div key={category.name} className="space-y-2 sm:space-y-4 overflow-hidden" data-testid={`section-category-${category.name.toLowerCase()}`}>
                {/* Category Header */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                    <div className="p-1.5 sm:p-2 rounded-lg bg-primary/10 flex-shrink-0">
                      <CategoryIcon className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-base sm:text-xl font-semibold truncate" data-testid={`text-category-${category.name.toLowerCase()}`}>
                        {category.name}
                      </h2>
                      <p className="text-xs sm:text-sm text-muted-foreground">
                        {category.totalCount} {category.totalCount === 1 ? 'debate' : 'debates'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Horizontal Scrolling Topics */}
                {topics.length > 0 && (
                  <div className="relative overflow-hidden w-full min-w-0">
                    <div 
                      className="flex gap-3 sm:gap-4 overflow-x-auto overflow-y-hidden pb-2 sm:pb-4 scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent w-full min-w-0"
                      style={{ 
                        scrollbarWidth: 'thin',
                        scrollSnapType: 'x mandatory'
                      }}
                      data-testid={`scroll-topics-${category.name.toLowerCase()}`}
                    >
                      {topics.map((topic) => (
                        <div 
                          key={topic.id} 
                          className="flex-none sm:w-[300px]"
                          style={{ 
                            width: 'clamp(260px, calc(100vw - 6rem), 300px)',
                            scrollSnapAlign: 'start'
                          }}
                        >
                          <TopicCard
                            id={topic.id}
                            title={topic.title}
                            description={topic.description}
                            categories={topic.categories}
                            opinionsCount={0}
                            participantCount={0}
                            isActive={topic.isActive ?? true}
                            imageUrl={topic.imageUrl || "https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=800"}
                          />
                        </div>
                      ))}
                      {category.totalCount > 5 && (
                        <div 
                          className="flex-none sm:w-[300px]"
                          style={{ 
                            width: 'clamp(260px, calc(100vw - 6rem), 300px)',
                            scrollSnapAlign: 'start'
                          }}
                        >
                          <Card className="h-full hover-elevate active-elevate-2 transition-all">
                            <CardContent className="flex flex-col items-center justify-center h-full min-h-[160px] sm:min-h-[200px] p-4 sm:p-6">
                              <CategoryIcon className="w-8 h-8 sm:w-12 sm:h-12 text-muted-foreground mb-2 sm:mb-4" />
                              <p className="text-center text-sm sm:text-base font-medium mb-2">
                                {category.totalCount - 5} more {category.totalCount - 5 === 1 ? 'debate' : 'debates'}
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
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
