import { useState, useRef, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import UserAvatar from "@/components/UserAvatar";
import { 
  Radio, 
  ArrowLeft, 
  Maximize2, 
  Minimize2,
  ChevronDown,
  ChevronUp,
  ThumbsUp,
  Heart,
  Zap,
  Send,
  Users,
  Eye,
  Shield,
  Mic,
  MicOff,
  Camera,
  CameraOff
} from "lucide-react";
import climateImage from '@assets/generated_images/Climate_change_debate_thumbnail_3b0bbda7.png';
import aiImage from '@assets/generated_images/AI_ethics_debate_thumbnail_98fa03cc.png';
import educationImage from '@assets/generated_images/Education_reform_debate_thumbnail_a88506ee.png';

// Mock data for demo streams (matches Home.tsx)
const mockStreams: Record<string, any> = {
  "live-climate": {
    id: "live-climate",
    title: "Climate Change: Individual vs. Systemic Action",
    description: "Live debate featuring climate experts discussing the most effective approaches to environmental action.",
    imageUrl: climateImage,
    category: "Environment",
    participants: [
      { id: "p1", name: "Dr. Sarah Chen", stance: "for" as const, isSpeaking: true, isMuted: false, isCameraOn: true },
      { id: "p2", name: "Prof. Marcus Rodriguez", stance: "against" as const, isSpeaking: false, isMuted: false, isCameraOn: true }
    ],
    moderator: { id: "mod-1", name: "Alex Thompson" },
    viewerCount: 1247,
    status: "live"
  },
  "scheduled-ai": {
    id: "scheduled-ai",
    title: "AI Ethics in Healthcare Decisions",
    description: "Scheduled debate on the role of AI in making critical healthcare decisions.",
    imageUrl: aiImage,
    category: "Technology",
    scheduledTime: "Today 3:00 PM",
    participants: [
      { id: "p3", name: "Dr. Emily Watson", stance: "for" as const, isSpeaking: false, isMuted: false, isCameraOn: true },
      { id: "p4", name: "Prof. David Kim", stance: "against" as const, isSpeaking: false, isMuted: false, isCameraOn: true }
    ],
    moderator: { id: "mod-2", name: "Jordan Martinez" },
    status: "scheduled"
  },
  "ended-education": {
    id: "ended-education",
    title: "Education Reform: Testing vs. Project-Based Learning",
    description: "Recorded debate exploring different approaches to modern education and student assessment.",
    imageUrl: educationImage,
    category: "Education",
    duration: "1h 23m",
    participants: [
      { id: "p5", name: "Dr. Rachel Adams", stance: "for" as const, isSpeaking: false, isMuted: false, isCameraOn: true },
      { id: "p6", name: "Prof. James Wilson", stance: "against" as const, isSpeaking: false, isMuted: false, isCameraOn: true }
    ],
    moderator: { id: "mod-3", name: "Sam Chen" },
    viewerCount: 3421,
    status: "ended"
  }
};

export default function LiveStreamPage() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const streamId = params.id;

  // Try to fetch from API first, but gracefully fall back to mock data on any error
  const { data: apiStream, isLoading } = useQuery({
    queryKey: ["/api/live-streams", streamId],
    queryFn: async () => {
      const response = await fetch(`/api/live-streams/${streamId}`);
      if (!response.ok) {
        // Return null on any error, we'll fall back to mock data
        return null;
      }
      return response.json();
    },
    enabled: !!streamId,
    retry: false, // Don't retry on error, just use mock data
  });

  // Use API data if available, otherwise fall back to mock data
  const stream = apiStream || mockStreams[streamId || ""];

  // Only show loading if we're actually loading AND we don't have mock data as fallback
  if (isLoading && !mockStreams[streamId || ""]) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading live stream...</p>
        </div>
      </div>
    );
  }

  if (!stream) {
    return (
      <div className="space-y-6">
        <Button 
          variant="outline" 
          onClick={() => setLocation("/")}
          data-testid="button-back-home"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Home
        </Button>
        <Card>
          <CardContent className="py-12 text-center">
            <Radio className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-lg font-medium mb-2">Live stream not found</p>
            <p className="text-muted-foreground">
              This stream may have ended or doesn't exist
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isLive = stream.status === "live";
  const isScheduled = stream.status === "scheduled";
  const isEnded = stream.status === "ended";

  const videoRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [chatMessage, setChatMessage] = useState("");
  
  type ChatMessageType = {
    id: string;
    userName: string;
    message: string;
    timestamp: string;
    type: "chat" | "reaction";
  };
  
  const [messages, setMessages] = useState<ChatMessageType[]>([
    { id: "1", userName: "Alice", message: "Great points on systemic action!", timestamp: "2:15 PM", type: "chat" },
    { id: "2", userName: "Bob", message: "I disagree, individual responsibility matters too", timestamp: "2:16 PM", type: "chat" },
    { id: "3", userName: "Charlie", message: "Both perspectives have merit", timestamp: "2:17 PM", type: "chat" },
  ]);

  // Sync fullscreen state with actual fullscreen status
  useEffect(() => {
    const handleFullscreenChange = () => {
      const fullscreenElement = document.fullscreenElement || 
                               (document as any).webkitFullscreenElement || 
                               (document as any).mozFullScreenElement;
      setIsFullscreen(fullscreenElement === videoRef.current);
    };

    // Listen to all fullscreen change events (for cross-browser support)
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
    };
  }, []);

  const toggleFullscreen = async () => {
    if (!videoRef.current) return;
    
    try {
      if (!isFullscreen) {
        // Try different fullscreen methods for cross-browser support
        const elem = videoRef.current as any;
        if (elem.requestFullscreen) {
          await elem.requestFullscreen();
        } else if (elem.webkitRequestFullscreen) {
          await elem.webkitRequestFullscreen();
        } else if (elem.mozRequestFullScreen) {
          await elem.mozRequestFullScreen();
        } else if (elem.msRequestFullscreen) {
          await elem.msRequestFullscreen();
        }
      } else {
        // Exit fullscreen
        const doc = document as any;
        if (doc.exitFullscreen) {
          await doc.exitFullscreen();
        } else if (doc.webkitExitFullscreen) {
          await doc.webkitExitFullscreen();
        } else if (doc.mozCancelFullScreen) {
          await doc.mozCancelFullScreen();
        } else if (doc.msExitFullscreen) {
          await doc.msExitFullscreen();
        }
      }
    } catch (error) {
      console.error('Fullscreen error:', error);
    }
  };

  const sendMessage = () => {
    if (!chatMessage.trim()) return;
    const newMessage = {
      id: Date.now().toString(),
      userName: "You",
      message: chatMessage,
      timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      type: "chat" as const
    };
    setMessages([...messages, newMessage]);
    setChatMessage("");
  };

  const sendReaction = (type: string) => {
    const reactions: Record<string, string> = {
      thumbsup: "liked this",
      heart: "loved this",
      zap: "found this insightful"
    };
    const newMessage = {
      id: Date.now().toString(),
      userName: "You",
      message: reactions[type],
      timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      type: "reaction" as const
    };
    setMessages([...messages, newMessage]);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <Button 
          variant="outline" 
          onClick={() => setLocation("/")}
          data-testid="button-back-home"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        {isLive && (
          <Badge className="bg-red-500 text-white animate-pulse" data-testid="badge-live">
            <Radio className="w-3 h-3 mr-1" />
            LIVE
          </Badge>
        )}
        {isScheduled && (
          <Badge className="bg-blue-500 text-white" data-testid="badge-scheduled">
            Scheduled: {stream.scheduledTime}
          </Badge>
        )}
        {isEnded && (
          <Badge className="bg-gray-500 text-white" data-testid="badge-ended">
            Ended
          </Badge>
        )}
      </div>

      {/* Title */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold" data-testid="text-stream-title">{stream.title}</h1>
        <p className="text-muted-foreground mt-1" data-testid="text-stream-description">{stream.description}</p>
      </div>

      {/* Video Player */}
      <div 
        ref={videoRef}
        className="relative bg-black rounded-lg overflow-hidden aspect-video group"
        data-testid="container-video"
      >
        {/* Video placeholder */}
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-900 to-gray-800">
          <div className="text-center">
            <Radio className="w-16 h-16 text-white/50 mx-auto mb-4" />
            <p className="text-white/70">Stream Video Player</p>
          </div>
        </div>

        {/* Video overlays */}
        <div className="absolute top-4 left-4 flex items-center gap-3">
          {isLive && (
            <Badge className="bg-red-500 text-white">
              <Radio className="w-3 h-3 mr-1" />
              LIVE
            </Badge>
          )}
          {typeof stream.viewerCount === 'number' && !isScheduled && (
            <Badge variant="secondary" className="flex items-center gap-1 bg-black/50 text-white border-0">
              <Eye className="w-3 h-3" />
              {stream.viewerCount.toLocaleString()}
            </Badge>
          )}
        </div>

        <Button
          size="icon"
          variant="ghost"
          className="absolute top-2 right-2 sm:top-4 sm:right-4 bg-black/50 text-white hover:bg-black/70 z-10"
          style={{
            top: isFullscreen ? 'calc(env(safe-area-inset-top) + 0.5rem)' : undefined,
            right: isFullscreen ? 'calc(env(safe-area-inset-right) + 0.5rem)' : undefined,
          }}
          onClick={toggleFullscreen}
          data-testid="button-fullscreen"
          aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
        >
          {isFullscreen ? <Minimize2 className="w-4 h-4 sm:w-5 sm:h-5" /> : <Maximize2 className="w-4 h-4 sm:w-5 sm:h-5" />}
        </Button>

        {/* Participant badges on video */}
        <div className="absolute bottom-4 left-4 flex gap-2">
          {stream.participants.map((p: any) => (
            <div 
              key={p.id}
              className="flex items-center gap-2 bg-black/70 px-3 py-2 rounded-lg"
            >
              <UserAvatar name={p.name} size="sm" />
              <div className="text-white">
                <p className="text-sm font-medium">{p.name}</p>
                <div className="flex items-center gap-1 text-xs text-white/70">
                  {p.isMuted ? <MicOff className="w-3 h-3" /> : <Mic className="w-3 h-3" />}
                  {p.isCameraOn ? <Camera className="w-3 h-3" /> : <CameraOff className="w-3 h-3" />}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Collapsible Details Section */}
      <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen}>
        <CollapsibleTrigger asChild>
          <Button 
            variant="outline" 
            className="w-full justify-between"
            data-testid="button-toggle-details"
          >
            <span className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Participant Details
            </span>
            {detailsOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-4 space-y-4">
          {/* Moderator */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Shield className="w-4 h-4 text-primary" />
              <h3 className="font-semibold">Moderator</h3>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <UserAvatar name={stream.moderator.name} />
              <div>
                <p className="font-medium" data-testid={`text-moderator-${stream.moderator.id}`}>{stream.moderator.name}</p>
                <p className="text-sm text-muted-foreground">Moderating the discussion</p>
              </div>
            </div>
          </div>

          {/* Participants */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-4 h-4 text-primary" />
              <h3 className="font-semibold">Debaters</h3>
            </div>
            <div className="space-y-2">
              {stream.participants.map((participant: any) => (
                <div 
                  key={participant.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                  data-testid={`participant-${participant.id}`}
                >
                  <div className="flex items-center gap-3">
                    <UserAvatar name={participant.name} />
                    <div>
                      <p className="font-medium">{participant.name}</p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Badge 
                          variant={participant.stance === "for" ? "default" : "secondary"}
                          className="text-xs"
                        >
                          {participant.stance === "for" ? "Supporting" : "Opposing"}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {participant.isMuted ? 
                      <MicOff className="w-4 h-4 text-muted-foreground" /> : 
                      <Mic className="w-4 h-4 text-green-500" />
                    }
                    {participant.isCameraOn ? 
                      <Camera className="w-4 h-4 text-green-500" /> : 
                      <CameraOff className="w-4 h-4 text-muted-foreground" />
                    }
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Live Chat - Only visible when details are closed */}
      {!detailsOpen && (
        <Card data-testid="container-chat">
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Live Chat</h3>
              <Badge variant="secondary">{messages.length} messages</Badge>
            </div>

            <Separator />

            {/* Chat messages */}
            <ScrollArea className="h-64 pr-4">
              <div className="space-y-3">
                {messages.map((msg) => (
                  <div key={msg.id} className="space-y-1">
                    <div className="flex items-baseline gap-2">
                      <span className="font-medium text-sm">{msg.userName}</span>
                      <span className="text-xs text-muted-foreground">{msg.timestamp}</span>
                    </div>
                    <p className={`text-sm ${msg.type === 'reaction' ? 'text-muted-foreground italic' : ''}`}>
                      {msg.message}
                    </p>
                  </div>
                ))}
              </div>
            </ScrollArea>

            <Separator />

            {/* Chat input with integrated interactions */}
            {isLive ? (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    placeholder="Type your message..."
                    value={chatMessage}
                    onChange={(e) => setChatMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                    disabled={isScheduled}
                    data-testid="input-chat-message"
                  />
                  <Button 
                    size="icon"
                    onClick={sendMessage}
                    disabled={!chatMessage.trim()}
                    data-testid="button-send-message"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>

                {/* Quick reactions integrated into chat */}
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Quick reactions:</span>
                  <div className="flex gap-1">
                    <Button 
                      size="icon" 
                      variant="ghost"
                      onClick={() => sendReaction('thumbsup')}
                      data-testid="button-reaction-thumbsup"
                    >
                      <ThumbsUp className="w-4 h-4" />
                    </Button>
                    <Button 
                      size="icon" 
                      variant="ghost"
                      onClick={() => sendReaction('heart')}
                      data-testid="button-reaction-heart"
                    >
                      <Heart className="w-4 h-4" />
                    </Button>
                    <Button 
                      size="icon" 
                      variant="ghost"
                      onClick={() => sendReaction('zap')}
                      data-testid="button-reaction-zap"
                    >
                      <Zap className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ) : isScheduled ? (
              <p className="text-sm text-muted-foreground text-center py-2">
                Chat will be available when the stream starts
              </p>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-2">
                This stream has ended. Chat is now closed.
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
