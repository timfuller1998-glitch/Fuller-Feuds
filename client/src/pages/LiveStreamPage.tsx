import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Radio, ArrowLeft } from "lucide-react";
import LiveStreamDebate from "@/components/LiveStreamDebate";
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

  // Try to fetch from API first
  const { data: apiStream, isLoading } = useQuery({
    queryKey: ["/api/live-streams", streamId],
    queryFn: async () => {
      const response = await fetch(`/api/live-streams/${streamId}`);
      if (!response.ok) {
        // Return null if not found in API, we'll fall back to mock data
        if (response.status === 404) return null;
        throw new Error("Failed to fetch live stream");
      }
      return response.json();
    },
    enabled: !!streamId,
  });

  // Use API data if available, otherwise fall back to mock data
  const stream = apiStream || mockStreams[streamId || ""];

  if (isLoading) {
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button 
          variant="outline" 
          onClick={() => setLocation("/")}
          data-testid="button-back-home"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Home
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
            Ended - Recording Available
          </Badge>
        )}
      </div>
      
      <LiveStreamDebate
        topicId={stream.id}
        title={stream.title}
        viewerCount={stream.viewerCount || 0}
        duration={stream.duration || "0:00"}
        participants={stream.participants}
        moderator={stream.moderator}
        currentUserId="current-user"
        isLive={isLive}
      />
    </div>
  );
}
