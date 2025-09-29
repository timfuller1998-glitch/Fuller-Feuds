import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import UserAvatar from "./UserAvatar";
import { 
  MessageCircle, 
  Users, 
  Clock, 
  Play,
  Eye,
  Calendar,
  Radio
} from "lucide-react";

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
  onWatchLive?: (id: string) => void;
  onSetReminder?: (id: string) => void;
  onViewRecording?: (id: string) => void;
}

const statusConfig = {
  live: {
    badge: { text: "🔴 LIVE", className: "bg-red-500 text-white animate-pulse" },
    button: { text: "Watch Live", icon: Eye, variant: "default" as const }
  },
  scheduled: {
    badge: { text: "📅 Scheduled", className: "bg-blue-500 text-white" },
    button: { text: "Set Reminder", icon: Calendar, variant: "outline" as const }
  },
  ended: {
    badge: { text: "🎬 Ended", className: "bg-gray-500 text-white" },
    button: { text: "Watch Recording", icon: Play, variant: "secondary" as const }
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
  onWatchLive,
  onSetReminder,
  onViewRecording
}: StreamingTopicCardProps) {
  const config = statusConfig[status];

  const handleAction = () => {
    switch (status) {
      case "live":
        onWatchLive?.(id);
        console.log('Watch live clicked:', id);
        break;
      case "scheduled":
        onSetReminder?.(id);
        console.log('Set reminder clicked:', id);
        break;
      case "ended":
        onViewRecording?.(id);
        console.log('View recording clicked:', id);
        break;
    }
  };

  return (
    <Card className="hover-elevate overflow-hidden group" data-testid={`card-streaming-topic-${id}`}>
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
        
        {/* Action Button */}
        <Button 
          variant={config.button.variant}
          className="w-full"
          onClick={handleAction}
          data-testid={`button-${status}-${id}`}
        >
          <config.button.icon className="w-4 h-4 mr-2" />
          {config.button.text}
        </Button>
      </CardContent>
    </Card>
  );
}