import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import UserAvatar from "./UserAvatar";
import { 
  Clock, 
  Eye,
  Radio
} from "lucide-react";
import { useLocation } from "wouter";

interface StreamingTopicCardProps {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  category: string;
  scheduledTime?: string;
  participants: {
    id: string;
    name: string;
    avatar?: string;
    stance: "for" | "against";
  }[];
  moderator: {
    name: string;
    avatar?: string;
  };
  viewerCount?: number;
  status: "live" | "scheduled" | "ended";
  duration?: string;
}

const statusConfig = {
  live: {
    badge: { text: "🔴 LIVE", className: "bg-red-500 text-white animate-pulse" }
  },
  scheduled: {
    badge: { text: "📅 Scheduled", className: "bg-blue-500 text-white" }
  },
  ended: {
    badge: { text: "🎬 Ended", className: "bg-gray-500 text-white" }
  }
};

export default function StreamingTopicCard({
  id,
  title,
  description,
  imageUrl,
  category,
  scheduledTime,
  participants,
  moderator,
  viewerCount,
  status,
  duration,
}: StreamingTopicCardProps) {
  const [, setLocation] = useLocation();
  const config = statusConfig[status];

  return (
    <Card 
      className="hover-elevate active-elevate-2 overflow-hidden group cursor-pointer" 
      onClick={() => setLocation(`/topic/${id}`)}
      data-testid={`card-streaming-topic-${id}`}
    >
      <div className="aspect-video relative overflow-hidden">
        <img 
          src={imageUrl} 
          alt={title}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
        
        {/* Status and Category Badges */}
        <div className="absolute top-2 left-2 flex gap-2">
          <Badge variant="secondary" className="bg-background/80 backdrop-blur-sm">
            {category}
          </Badge>
          <Badge className={`${config.badge.className} flex items-center gap-1`}>
            <Radio className="w-3 h-3" />
            {config.badge.text}
          </Badge>
        </div>
        
        {/* Live Viewer Count */}
        {status === "live" && viewerCount && (
          <div className="absolute top-2 right-2">
            <Badge className="bg-black/70 text-white backdrop-blur-sm">
              <Eye className="w-3 h-3 mr-1" />
              {viewerCount}
            </Badge>
          </div>
        )}
        
        {/* Schedule Time */}
        {status === "scheduled" && scheduledTime && (
          <div className="absolute bottom-2 left-2">
            <Badge className="bg-black/70 text-white backdrop-blur-sm">
              <Clock className="w-3 h-3 mr-1" />
              {scheduledTime}
            </Badge>
          </div>
        )}
        
        {/* Duration for ended streams */}
        {status === "ended" && duration && (
          <div className="absolute bottom-2 right-2">
            <Badge className="bg-black/70 text-white backdrop-blur-sm">
              {duration}
            </Badge>
          </div>
        )}
      </div>
      
      <CardHeader className="pb-3">
        <h3 className="font-semibold text-lg leading-tight" data-testid={`text-streaming-title-${id}`}>
          {title}
        </h3>
        <p className="text-sm text-muted-foreground line-clamp-2">
          {description}
        </p>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Participants */}
        <div className="space-y-3">
          <h4 className="font-medium text-sm">Debate Participants</h4>
          <div className="flex items-center justify-between">
            {participants.map((participant) => (
              <div key={participant.id} className="flex items-center gap-2">
                <UserAvatar 
                  name={participant.name} 
                  imageUrl={participant.avatar} 
                  size="sm" 
                />
                <div>
                  <p className="font-medium text-xs">{participant.name}</p>
                  <Badge 
                    variant={participant.stance === "for" ? "default" : "destructive"} 
                    className="text-xs"
                  >
                    {participant.stance === "for" ? "Supporting" : "Opposing"}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {/* Moderator */}
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Moderated by:</span>
          <UserAvatar name={moderator.name} imageUrl={moderator.avatar} size="sm" />
          <span className="font-medium">{moderator.name}</span>
        </div>
      </CardContent>
    </Card>
  );
}