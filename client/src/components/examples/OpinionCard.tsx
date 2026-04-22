import OpinionCard from '../OpinionCard'

export default function OpinionCardExample() {
  return (
    <div className="p-8 space-y-6 max-w-2xl">
      <OpinionCard
        id="opinion-1"
        topicId="topic-example"
        userName="Sarah Chen"
        userId="user-1"
        content="I believe that individual actions, while important, are not sufficient to address the scale of the climate crisis. We need systemic changes in policy and corporate behavior. However, individual actions can create momentum for larger changes and shouldn't be dismissed entirely."
        timestamp="2 hours ago"
        likesCount={24}
        dislikesCount={3}
      />
      
      <OpinionCard
        id="opinion-2"
        topicId="topic-example"
        userName="Marcus Rodriguez"
        userId="user-2"
        content="The focus on individual responsibility is actually counterproductive. It shifts blame away from the major corporations and governments that have the real power to make a difference. We're being distracted from the real solutions by being told to change our light bulbs."
        timestamp="4 hours ago"
        likesCount={18}
        dislikesCount={12}
        isLiked={true}
      />
      
      <OpinionCard
        id="opinion-3"
        topicId="topic-example"
        userName="Emma Thompson"
        userId="user-3"
        content="I think both approaches have merit. We can't wait for perfect policy solutions while doing nothing ourselves, but we also can't pretend that personal choices alone will solve everything. The key is finding the right balance and not letting either approach become an excuse for inaction."
        timestamp="6 hours ago"
        likesCount={42}
        dislikesCount={5}
      />
    </div>
  )
}
