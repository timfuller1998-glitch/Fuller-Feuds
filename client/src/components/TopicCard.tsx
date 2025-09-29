import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MessageCircle, Users, TrendingUp, Mic } from "lucide-react";

interface TopicCardProps {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  category: string;
  participantCount: number;
  opinionsCount: number;
  isActive: boolean;
  onJoinDebate?: (id: string) => void;
  onViewTopic?: (id: string) => void;
  onJoinLiveDebate?: (id: string) => void;
}

export default function TopicCard({
  id,
  title,
  description,
  imageUrl,
  category,
  participantCount,
  opinionsCount,
  isActive,
  onJoinDebate,
  onViewTopic,
  onJoinLiveDebate
}: TopicCardProps) {
  return (
    <Card className="hover-elevate overflow-hidden group cursor-pointer" data-testid={`card-topic-${id}`}>
      <div className="aspect-video relative overflow-hidden">
        <img 
          src={imageUrl} 
          alt={title}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
        <div className="absolute top-2 left-2">
          <Badge variant="secondary" className="bg-background/80 backdrop-blur-sm">
            {category}
          </Badge>
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
      
      <CardHeader className="pb-2">
        <h3 className="font-semibold text-lg leading-tight" data-testid={`text-topic-title-${id}`}>
          {title}
        </h3>
        <p className="text-sm text-muted-foreground line-clamp-2">
          {description}
        </p>
      </CardHeader>
      
      <CardContent className="pt-0">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <MessageCircle className="w-4 h-4" />
              <span data-testid={`text-opinions-count-${id}`}>{opinionsCount}</span>
            </div>
            <div className="flex items-center gap-1">
              <Users className="w-4 h-4" />
              <span data-testid={`text-participants-count-${id}`}>{participantCount}</span>
            </div>
          </div>
        </div>
        
        <div className="space-y-2">
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full"
            onClick={() => {
              onViewTopic?.(id);
              console.log('View topic clicked:', id);
            }}
            data-testid={`button-view-topic-${id}`}
          >
            View Topic
          </Button>
          <div className="flex gap-2">
            <Button 
              size="sm" 
              className="flex-1"
              onClick={() => {
                onJoinDebate?.(id);
                console.log('Join debate clicked:', id);
              }}
              data-testid={`button-join-debate-${id}`}
            >
              Join Debate
            </Button>
            <Button 
              variant="secondary"
              size="sm" 
              className="flex-1"
              onClick={() => {
                onJoinLiveDebate?.(id);
                console.log('Join live debate clicked:', id);
              }}
              data-testid={`button-join-live-debate-${id}`}
            >
              <Mic className="w-3 h-3 mr-1" />
              Live
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}