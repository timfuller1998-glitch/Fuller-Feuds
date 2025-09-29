import StreamingTopicCard from '../StreamingTopicCard'
import climateImage from '@assets/generated_images/Climate_change_debate_thumbnail_3b0bbda7.png'
import aiImage from '@assets/generated_images/AI_ethics_debate_thumbnail_98fa03cc.png'
import educationImage from '@assets/generated_images/Education_reform_debate_thumbnail_a88506ee.png'

export default function StreamingTopicCardExample() {
  const participants = [
    {
      id: "p1",
      name: "Dr. Sarah Chen",
      stance: "for" as const
    },
    {
      id: "p2", 
      name: "Prof. Marcus Rodriguez",
      stance: "against" as const
    }
  ];

  const moderator = {
    name: "Alex Thompson"
  };

  return (
    <div className="p-8 grid grid-cols-1 md:grid-cols-3 gap-6">
      <StreamingTopicCard
        id="live-debate-1"
        title="Climate Change: Individual vs. Systemic Action"
        description="Live debate on whether individual actions or systemic changes are more effective in addressing climate change."
        imageUrl={climateImage}
        category="Environment"
        participants={participants}
        moderator={moderator}
        viewerCount={1247}
        status="live"
        onWatchLive={(id) => console.log('Watch live:', id)}
      />
      
      <StreamingTopicCard
        id="scheduled-debate-1"
        title="AI Ethics in Healthcare Decisions"
        description="Scheduled debate on the role of AI in making critical healthcare decisions and its ethical implications."
        imageUrl={aiImage}
        category="Technology"
        scheduledTime="Today 3:00 PM"
        participants={participants}
        moderator={moderator}
        status="scheduled"
        onSetReminder={(id) => console.log('Set reminder:', id)}
      />
      
      <StreamingTopicCard
        id="ended-debate-1"
        title="Traditional vs. Progressive Education"
        description="Recent debate on educational methodologies and their effectiveness in modern learning environments."
        imageUrl={educationImage}
        category="Education"
        participants={participants}
        moderator={moderator}
        status="ended"
        duration="1h 23m"
        onViewRecording={(id) => console.log('View recording:', id)}
      />
    </div>
  )
}