import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, Users, TrendingUp } from "lucide-react";
import { useLocation } from "wouter";

interface TopicCardProps {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  categories: string[];
  participantCount: number;
  opinionsCount: number;
  isActive: boolean;
}

export default function TopicCard({
  id,
  title,
  description,
  imageUrl,
  categories = [],
  participantCount,
  opinionsCount,
  isActive,
}: TopicCardProps) {
  const [, setLocation] = useLocation();

  return (
    <Card 
      className="hover-elevate active-elevate-2 overflow-hidden group cursor-pointer" 
      onClick={() => setLocation(`/topic/${id}`)}
      data-testid={`card-topic-${id}`}
    >
      <div className="aspect-video relative overflow-hidden">
        <img 
          src={imageUrl} 
          alt={title}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
        <div className="absolute top-2 left-2 flex gap-1 flex-wrap">
          {categories?.slice(0, 2).map((category) => (
            <Badge key={category} variant="secondary" className="bg-background/80 backdrop-blur-sm">
              {category}
            </Badge>
          ))}
          {categories && categories.length > 2 && (
            <Badge variant="secondary" className="bg-background/80 backdrop-blur-sm">
              +{categories.length - 2}
            </Badge>
          )}
        </div>
        {isActive && (
          <div className="absolute top-2 right-2">
            <Badge className="bg-chart-1 text-white">
              <TrendingUp className="w-3 h-3 mr-1" />
              Active
            </Badge>
          </div>
        )}
      </div>
      
      <CardHeader className="pb-2 p-3 sm:p-6 sm:pb-2">
        <h3 className="font-semibold text-base sm:text-lg leading-tight" data-testid={`text-topic-title-${id}`}>
          {title}
        </h3>
        <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2">
          {description}
        </p>
      </CardHeader>
      
      <CardContent className="pt-0 p-3 sm:p-6 sm:pt-0">
        <div className="flex items-center gap-3 sm:gap-4 text-xs sm:text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <MessageCircle className="w-3 h-3 sm:w-4 sm:h-4" />
            <span data-testid={`text-opinions-count-${id}`}>{opinionsCount}</span>
          </div>
          <div className="flex items-center gap-1">
            <Users className="w-3 h-3 sm:w-4 sm:h-4" />
            <span data-testid={`text-participants-count-${id}`}>{participantCount}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}