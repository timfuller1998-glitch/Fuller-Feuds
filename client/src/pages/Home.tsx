import { useState } from "react";
import SearchBar from "@/components/SearchBar";
import TopicCard from "@/components/TopicCard";
import OpinionCard from "@/components/OpinionCard";
import CumulativeOpinion from "@/components/CumulativeOpinion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, MessageCircle, Users, Plus } from "lucide-react";
import climateImage from '@assets/generated_images/Climate_change_debate_thumbnail_3b0bbda7.png';
import aiImage from '@assets/generated_images/AI_ethics_debate_thumbnail_98fa03cc.png';
import educationImage from '@assets/generated_images/Education_reform_debate_thumbnail_a88506ee.png';
import healthcareImage from '@assets/generated_images/Healthcare_policy_debate_thumbnail_269685b7.png';

export default function Home() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);

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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="text-center p-6 rounded-lg bg-card border">
          <div className="text-3xl font-bold text-primary mb-2">1,247</div>
          <div className="text-sm text-muted-foreground flex items-center justify-center gap-1">
            <MessageCircle className="w-4 h-4" />
            Active Debates
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