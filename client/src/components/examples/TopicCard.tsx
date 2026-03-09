import TopicCard from '../TopicCard'
import climateImage from '@assets/generated_images/Climate_change_debate_thumbnail_3b0bbda7.png'
import aiImage from '@assets/generated_images/AI_ethics_debate_thumbnail_98fa03cc.png'

export default function TopicCardExample() {
  return (
    <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6">
      <TopicCard
        id="climate-change"
        title="Climate Change: Individual vs. Systemic Action"
        description="Should we focus on individual lifestyle changes or systemic policy reforms to address climate change effectively?"
        imageUrl={climateImage}
        categories={["Environment", "Policy", "Personal Action"]}
        participantCount={247}
        opinionsCount={1832}
        isActive={true}
      />
    </div>
  )
}