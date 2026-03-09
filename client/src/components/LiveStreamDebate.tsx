import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import UserAvatar from "./UserAvatar";
import { 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  MessageCircle, 
  ThumbsUp, 
  ThumbsDown, 
  Users, 
  Clock,
  Camera,
  Mic,
  MicOff,
  CameraOff,
  Shield,
  BarChart3,
  Send,
  Heart,
  Zap
} from "lucide-react";

interface ChatMessage {
  id: string;
  userId: string;
  userName: string;
  message: string;
  timestamp: string;
  type: "chat" | "reaction" | "system";
  isModerated?: boolean;
}

interface Participant {
  id: string;
  name: string;
  avatar?: string;
  stance: "for" | "against";
  isSpeaking: boolean;
  isMuted: boolean;
  isCameraOn: boolean;
}

interface LiveStreamDebateProps {
  topicId: string;
  title: string;
  viewerCount: number;
  duration: string;
  participants: Participant[];
  moderator: {
    id: string;
    name: string;
    avatar?: string;
  };
  currentUserId: string;
  isLive: boolean;
  onJoinAsViewer?: () => void;
  onRequestToSpeak?: () => void;
  onModerateChat?: (messageId: string, action: string) => void;
}

export default function LiveStreamDebate({
  topicId,
  title,
  viewerCount,
  duration,
  participants,
  moderator,
  currentUserId,
  isLive,
  onJoinAsViewer,
  onRequestToSpeak,
  onModerateChat
}: LiveStreamDebateProps) {
  const [chatMessage, setChatMessage] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [supportVotes, setSupportVotes] = useState(64);
  const [opposeVotes, setOpposeVotes] = useState(36);
  const [userVote, setUserVote] = useState<"support" | "oppose" | null>(null);

  // Mock chat messages for demonstration
  useEffect(() => {
    const mockMessages: ChatMessage[] = [
      {
        id: "1",
        userId: "viewer1",
        userName: "Alex M.",
        message: "Great point about renewable energy!",
        timestamp: "2m ago",
        type: "chat"
      },
      {
        id: "2", 
        userId: "viewer2",
        userName: "Sarah K.",
        message: "💯",
        timestamp: "1m ago",
        type: "reaction"
      },
      {
        id: "3",
        userId: "system",
        userName: "System",
        message: "Alice Johnson joined the debate",
        timestamp: "30s ago",
        type: "system"
      }
    ];
    setChatMessages(mockMessages);
  }, []);

  const handleSendMessage = () => {
    if (!chatMessage.trim()) return;

    const newMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      userId: currentUserId,
      userName: "You",
      message: chatMessage,
      timestamp: "now",
      type: "chat"
    };

    setChatMessages(prev => [...prev, newMessage]);
    setChatMessage("");
    console.log('Chat message sent:', chatMessage);
  };

  const handleVote = (vote: "support" | "oppose") => {
    if (userVote === vote) {
      // Remove vote
      setUserVote(null);
      if (vote === "support") {
        setSupportVotes(prev => prev - 1);
      } else {
        setOpposeVotes(prev => prev - 1);
      }
    } else {
      // Add/change vote
      if (userVote) {
        // Remove previous vote
        if (userVote === "support") {
          setSupportVotes(prev => prev - 1);
        } else {
          setOpposeVotes(prev => prev - 1);
        }
      }
      
      setUserVote(vote);
      if (vote === "support") {
        setSupportVotes(prev => prev + 1);
      } else {
        setOpposeVotes(prev => prev + 1);
      }
    }
    console.log('Vote cast:', vote);
  };

  const handleReaction = (type: string) => {
    const reactions = {
      "like": "👍",
      "love": "❤️",
      "wow": "⚡"
    };
    
    const reactionMessage: ChatMessage = {
      id: `reaction-${Date.now()}`,
      userId: currentUserId,
      userName: "You",
      message: reactions[type as keyof typeof reactions] || "👍",
      timestamp: "now",
      type: "reaction"
    };

    setChatMessages(prev => [...prev, reactionMessage]);
    console.log('Reaction sent:', type);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[600px]" data-testid={`livestream-${topicId}`}>
      {/* Main Stream Area */}
      <div className="lg:col-span-2 space-y-4">
        <Card className="flex-1">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {isLive && (
                  <Badge className="bg-red-500 text-white animate-pulse">
                    🔴 LIVE
                  </Badge>
                )}
                <h3 className="font-semibold text-lg" data-testid="stream-title">
                  {title}
                </h3>
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Users className="w-4 h-4" />
                  <span data-testid="viewer-count">{viewerCount}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  <span>{duration}</span>
                </div>
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="p-0">
            {/* Video Stream Placeholder */}
            <div className="aspect-video bg-black relative flex items-center justify-center">
              <div className="text-white text-center">
                <Camera className="w-12 h-12 mx-auto mb-2" />
                <p className="text-sm">Live Debate Stream</p>
              </div>
              
              {/* Participant Overlays */}
              <div className="absolute bottom-4 left-4 right-4 flex justify-between">
                {participants.map((participant) => (
                  <div key={participant.id} className="bg-black/50 rounded-lg p-2 text-white text-xs flex items-center gap-2">
                    <UserAvatar name={participant.name} size="sm" />
                    <div>
                      <p className="font-medium">{participant.name}</p>
                      <Badge variant={participant.stance === "for" ? "default" : "destructive"} className="text-xs">
                        {participant.stance === "for" ? "Supporting" : "Opposing"}
                      </Badge>
                    </div>
                    <div className="flex gap-1">
                      {participant.isMuted ? <MicOff className="w-3 h-3" /> : <Mic className="w-3 h-3" />}
                      {!participant.isCameraOn && <CameraOff className="w-3 h-3" />}
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Stream Controls */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                <Button size="sm" variant="secondary" className="bg-black/50 hover:bg-black/70">
                  <Volume2 className="w-4 h-4" />
                </Button>
                <Button size="sm" variant="secondary" className="bg-black/50 hover:bg-black/70">
                  <BarChart3 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Moderator Info & Controls */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <UserAvatar name={moderator.name} imageUrl={moderator.avatar} size="sm" />
                <div>
                  <p className="font-medium text-sm">Moderated by {moderator.name}</p>
                  <div className="flex items-center gap-2">
                    <Shield className="w-3 h-3 text-primary" />
                    <span className="text-xs text-muted-foreground">Live moderation active</span>
                  </div>
                </div>
              </div>
              
              <div className="flex gap-2">
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => {
                    onRequestToSpeak?.();
                    console.log('Request to speak clicked');
                  }}
                  data-testid="button-request-speak"
                >
                  <Mic className="w-4 h-4 mr-2" />
                  Request to Speak
                </Button>
                <Button 
                  size="sm"
                  onClick={() => {
                    onJoinAsViewer?.();
                    console.log('Join as viewer clicked');
                  }}
                  data-testid="button-join-viewer"
                >
                  Join as Viewer
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Interaction Panel */}
      <div className="space-y-4">
        {/* Live Voting */}
        <Card>
          <CardHeader className="pb-3">
            <h4 className="font-semibold flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Live Audience Poll
            </h4>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Supporting ({supportVotes}%)</span>
                <span>Opposing ({opposeVotes}%)</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                <div className="h-full flex">
                  <div 
                    className="bg-chart-1" 
                    style={{ width: `${supportVotes}%` }}
                  />
                  <div 
                    className="bg-chart-5" 
                    style={{ width: `${opposeVotes}%` }}
                  />
                </div>
              </div>
            </div>
            
            <div className="flex gap-2">
              <Button 
                size="sm" 
                variant={userVote === "support" ? "default" : "outline"}
                className="flex-1"
                onClick={() => handleVote("support")}
                data-testid="button-vote-support"
              >
                <ThumbsUp className="w-3 h-3 mr-1" />
                Support
              </Button>
              <Button 
                size="sm" 
                variant={userVote === "oppose" ? "destructive" : "outline"}
                className="flex-1"
                onClick={() => handleVote("oppose")}
                data-testid="button-vote-oppose"
              >
                <ThumbsDown className="w-3 h-3 mr-1" />
                Oppose
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Quick Reactions */}
        <Card>
          <CardHeader className="pb-3">
            <h4 className="font-semibold">Quick Reactions</h4>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => handleReaction("like")}
                data-testid="button-reaction-like"
              >
                <ThumbsUp className="w-4 h-4" />
              </Button>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => handleReaction("love")}
                data-testid="button-reaction-love"
              >
                <Heart className="w-4 h-4" />
              </Button>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => handleReaction("wow")}
                data-testid="button-reaction-wow"
              >
                <Zap className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Live Chat */}
        <Card className="flex-1">
          <CardHeader className="pb-3">
            <h4 className="font-semibold flex items-center gap-2">
              <MessageCircle className="w-4 h-4" />
              Live Chat
            </h4>
          </CardHeader>
          <CardContent className="p-0 flex flex-col h-80">
            <ScrollArea className="flex-1 p-4" data-testid="chat-messages">
              <div className="space-y-3">
                {chatMessages.map((message) => (
                  <div key={message.id} className={`text-sm ${
                    message.type === "system" ? "text-muted-foreground italic" : ""
                  }`}>
                    {message.type !== "system" && (
                      <div className="flex items-start gap-2">
                        <span className="font-medium text-xs">{message.userName}:</span>
                        <span className={message.type === "reaction" ? "text-lg" : ""}>
                          {message.message}
                        </span>
                        <span className="text-xs text-muted-foreground ml-auto">
                          {message.timestamp}
                        </span>
                      </div>
                    )}
                    {message.type === "system" && (
                      <p>{message.message}</p>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
            
            <Separator />
            
            <div className="p-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Type a message..."
                  value={chatMessage}
                  onChange={(e) => setChatMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  className="flex-1"
                  data-testid="input-chat-message"
                />
                <Button 
                  size="sm" 
                  onClick={handleSendMessage}
                  disabled={!chatMessage.trim()}
                  data-testid="button-send-chat"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}