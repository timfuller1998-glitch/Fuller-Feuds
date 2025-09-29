import { useState } from "react";
import SearchBar from "@/components/SearchBar";
import TopicCard from "@/components/TopicCard";
import StreamingTopicCard from "@/components/StreamingTopicCard";
import LiveStreamDebate from "@/components/LiveStreamDebate";
import OpinionCard from "@/components/OpinionCard";
import CumulativeOpinion from "@/components/CumulativeOpinion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, MessageCircle, Users, Plus, Radio, Eye } from "lucide-react";
import climateImage from '@assets/generated_images/Climate_change_debate_thumbnail_3b0bbda7.png';
import aiImage from '@assets/generated_images/AI_ethics_debate_thumbnail_98fa03cc.png';
import educationImage from '@assets/generated_images/Education_reform_debate_thumbnail_a88506ee.png';
import healthcareImage from '@assets/generated_images/Healthcare_policy_debate_thumbnail_269685b7.png';

export default function Home() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [viewingLiveStream, setViewingLiveStream] = useState<string | null>(null);

  // todo: remove mock functionality
  const trendingTopics = [
    {
      id: "climate-change",
      title: "Climate Change: Individual vs. Systemic Action",
      description: "Should we focus on individual lifestyle changes or systemic policy reforms to address climate change effectively?",
      imageUrl: climateImage,
      category: "Environment",
      participantCount: 247,
      opinionsCount: 1832,
      isActive: true
    },
    {
      id: "ai-ethics",
      title: "AI in Decision Making: Progress or Problem?",
      description: "Are AI systems making our lives better or creating new forms of bias and discrimination in important decisions?",
      imageUrl: aiImage,
      category: "Technology",
      participantCount: 156,
      opinionsCount: 923,
      isActive: true
    },
    {
      id: "education-reform",
      title: "Traditional vs. Progressive Education Methods",
      description: "Which approach better prepares students for the modern world: structured traditional education or flexible progressive methods?",
      imageUrl: educationImage,
      category: "Education",
      participantCount: 189,
      opinionsCount: 1247,
      isActive: false
    },
    {
      id: "healthcare-policy",
      title: "Universal Healthcare: Right or Privilege?",
      description: "Should healthcare be guaranteed as a universal right or remain a service based on individual responsibility and choice?",
      imageUrl: healthcareImage,
      category: "Politics",
      participantCount: 298,
      opinionsCount: 2156,
      isActive: true
    }
  ];

  // todo: remove mock functionality
  const liveStreamingTopics = [
    {
      id: "live-climate",
      title: "Climate Change: Individual vs. Systemic Action",
      description: "Live debate featuring climate experts discussing the most effective approaches to environmental action.",
      imageUrl: climateImage,
      category: "Environment",
      participants: [
        { id: "p1", name: "Dr. Sarah Chen", stance: "for" as const },
        { id: "p2", name: "Prof. Marcus Rodriguez", stance: "against" as const }
      ],
      moderator: { name: "Alex Thompson" },
      viewerCount: 1247,
      status: "live" as const
    },
    {
      id: "scheduled-ai",
      title: "AI Ethics in Healthcare Decisions",
      description: "Scheduled debate on the role of AI in making critical healthcare decisions.",
      imageUrl: aiImage,
      category: "Technology",
      scheduledTime: "Today 3:00 PM",
      participants: [
        { id: "p3", name: "Dr. Emily Watson", stance: "for" as const },
        { id: "p4", name: "Prof. David Kim", stance: "against" as const }
      ],
      moderator: { name: "Jordan Martinez" },
      status: "scheduled" as const
    },
    {
      id: "ended-education",
      title: "Traditional vs. Progressive Education",
      description: "Recent debate on educational methodologies and their effectiveness.",
      imageUrl: educationImage,
      category: "Education",
      participants: [
        { id: "p5", name: "Prof. Lisa Anderson", stance: "for" as const },
        { id: "p6", name: "Dr. Michael Brown", stance: "against" as const }
      ],
      moderator: { name: "Sam Taylor" },
      status: "ended" as const,
      duration: "1h 23m"
    }
  ];

  const recentOpinions = [
    {
      id: "opinion-1",
      userName: "Sarah Chen",
      content: "I believe that individual actions, while important, are not sufficient to address the scale of the climate crisis. We need systemic changes in policy and corporate behavior.",
      stance: "for" as const,
      timestamp: "2 hours ago",
      likesCount: 24,
      dislikesCount: 3,
      repliesCount: 8
    },
    {
      id: "opinion-2",
      userName: "Marcus Rodriguez",
      content: "The focus on individual responsibility is actually counterproductive. It shifts blame away from the major corporations that have the real power to make a difference.",
      stance: "against" as const,
      timestamp: "4 hours ago",
      likesCount: 18,
      dislikesCount: 12,
      repliesCount: 15
    }
  ];

  const filteredTopics = trendingTopics.filter(topic =>
    topic.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    topic.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    topic.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // If viewing a live stream, show the full streaming interface
  if (viewingLiveStream) {
    const streamTopic = liveStreamingTopics.find(topic => topic.id === viewingLiveStream);
    if (streamTopic) {
      return (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <Button 
              variant="outline" 
              onClick={() => setViewingLiveStream(null)}
              data-testid="button-back-to-topics"
            >
              ← Back to Topics
            </Button>
            <Badge className="bg-red-500 text-white">
              🔴 LIVE
            </Badge>
          </div>
          
          <LiveStreamDebate
            topicId={streamTopic.id}
            title={streamTopic.title}
            viewerCount={streamTopic.viewerCount || 0}
            duration="24:15"
            participants={streamTopic.participants.map(p => ({
              ...p,
              isSpeaking: p.id === "p1",
              isMuted: false,
              isCameraOn: true
            }))}
            moderator={{ id: "mod-1", name: streamTopic.moderator.name }}
            currentUserId="current-user"
            isLive={streamTopic.status === "live"}
            onJoinAsViewer={() => console.log('Join as viewer')}
            onRequestToSpeak={() => console.log('Request to speak')}
            onModerateChat={(msgId, action) => console.log('Moderate:', msgId, action)}
          />
        </div>
      );
    }
  }

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="text-center space-y-6 py-8">
        <div className="space-y-4">
          <h1 className="text-4xl font-bold tracking-tight">
            Where Ideas Collide
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Join meaningful debates on topics that matter. Share your opinions, discover different perspectives, and engage in thoughtful discussions.
          </p>
        </div>
        
        <div className="max-w-2xl mx-auto">
          <SearchBar 
            onSearch={setSearchQuery}
            placeholder="Search for debate topics..."
          />
        </div>
        
        <div className="flex items-center justify-center gap-4">
          <Button data-testid="button-browse-topics">
            <TrendingUp className="w-4 h-4 mr-2" />
            Browse Trending
          </Button>
          <Button variant="outline" data-testid="button-create-topic">
            <Plus className="w-4 h-4 mr-2" />
            Start New Topic
          </Button>
        </div>
      </div>

      {/* Stats Section */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="text-center p-6 rounded-lg bg-card border">
          <div className="text-3xl font-bold text-primary mb-2">1,247</div>
          <div className="text-sm text-muted-foreground flex items-center justify-center gap-1">
            <MessageCircle className="w-4 h-4" />
            Active Debates
          </div>
        </div>
        <div className="text-center p-6 rounded-lg bg-card border">
          <div className="text-3xl font-bold text-red-500 mb-2">3</div>
          <div className="text-sm text-muted-foreground flex items-center justify-center gap-1">
            <Radio className="w-4 h-4" />
            Live Streams
          </div>
        </div>
        <div className="text-center p-6 rounded-lg bg-card border">
          <div className="text-3xl font-bold text-primary mb-2">8,923</div>
          <div className="text-sm text-muted-foreground flex items-center justify-center gap-1">
            <Users className="w-4 h-4" />
            Total Participants
          </div>
        </div>
        <div className="text-center p-6 rounded-lg bg-card border">
          <div className="text-3xl font-bold text-primary mb-2">24</div>
          <div className="text-sm text-muted-foreground">
            Categories
          </div>
        </div>
      </div>

      {/* Live Streaming Debates */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Live Streaming Debates</h2>
          <div className="flex items-center gap-2">
            <Badge className="bg-red-500 text-white animate-pulse">
              <Radio className="w-3 h-3 mr-1" />
              Live Now
            </Badge>
            <Badge variant="secondary">
              <Eye className="w-3 h-3 mr-1" />
              1,247 watching
            </Badge>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {liveStreamingTopics.map((topic) => (
            <StreamingTopicCard
              key={topic.id}
              {...topic}
              onWatchLive={(id) => {
                setViewingLiveStream(id);
                console.log('Watch live:', id);
              }}
              onSetReminder={(id) => {
                console.log('Set reminder:', id);
              }}
              onViewRecording={(id) => {
                console.log('View recording:', id);
              }}
            />
          ))}
        </div>
      </div>

      {/* Trending Topics */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Trending Topics</h2>
          <Badge variant="secondary" className="flex items-center gap-1">
            <TrendingUp className="w-3 h-3" />
            Live Updates
          </Badge>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTopics.map((topic) => (
            <TopicCard
              key={topic.id}
              {...topic}
              onViewTopic={(id) => {
                setSelectedTopic(id);
                console.log('View topic:', id);
              }}
              onJoinDebate={(id) => console.log('Join debate:', id)}
            />
          ))}
        </div>
        
        {filteredTopics.length === 0 && searchQuery && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">
              No topics found matching "{searchQuery}". Try a different search term.
            </p>
          </div>
        )}
      </div>

      {/* Featured Topic with AI Summary */}
      {selectedTopic === "climate-change" && (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold">Featured Discussion</h2>
          
          <CumulativeOpinion
            topicId="climate-change"
            summary="The discussion reveals a nuanced debate between individual responsibility and systemic change. While most participants acknowledge that both approaches are necessary, there's significant disagreement about where to focus efforts. Supporters of individual action emphasize personal accountability and the power of collective behavior change, while critics argue that this narrative deflects from the need for policy reform and corporate responsibility."
            keyPoints={[
              "Individual actions can create momentum for larger policy changes",
              "Corporate responsibility and government policy are seen as more impactful",
              "The 'both approaches' perspective is gaining traction among participants",
              "Concerns about action paralysis when focusing solely on systemic solutions"
            ]}
            supportingPercentage={45}
            opposingPercentage={32}
            neutralPercentage={23}
            totalOpinions={1832}
            confidence="high"
            lastUpdated="1 hour ago"
            onViewDetails={(id) => console.log('View details for:', id)}
          />
        </div>
      )}

      {/* Recent Opinions */}
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">Recent Opinions</h2>
        
        <div className="space-y-4">
          {recentOpinions.map((opinion) => (
            <OpinionCard
              key={opinion.id}
              {...opinion}
              onLike={(id) => console.log('Liked:', id)}
              onDislike={(id) => console.log('Disliked:', id)}
              onReply={(id) => console.log('Reply to:', id)}
            />
          ))}
        </div>
        
        <div className="text-center">
          <Button variant="outline" data-testid="button-view-more-opinions">
            View More Opinions
          </Button>
        </div>
      </div>
    </div>
  );
}