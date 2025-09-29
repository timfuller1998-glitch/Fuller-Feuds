import OpinionCard from '../OpinionCard'

export default function OpinionCardExample() {
  return (
    <div className="p-8 space-y-6 max-w-2xl">
      <OpinionCard
        id="opinion-1"
        userName="Sarah Chen"
        content="I believe that individual actions, while important, are not sufficient to address the scale of the climate crisis. We need systemic changes in policy and corporate behavior. However, individual actions can create momentum for larger changes and shouldn't be dismissed entirely."
        stance="for"
        timestamp="2 hours ago"
        likesCount={24}
        dislikesCount={3}
        repliesCount={8}
        onLike={(id) => console.log('Liked:', id)}
        onDislike={(id) => console.log('Disliked:', id)}
        onReply={(id) => console.log('Reply to:', id)}
      />
      
      <OpinionCard
        id="opinion-2"
        userName="Marcus Rodriguez"
        content="The focus on individual responsibility is actually counterproductive. It shifts blame away from the major corporations and governments that have the real power to make a difference. We're being distracted from the real solutions by being told to change our light bulbs."
        stance="against"
        timestamp="4 hours ago"
        likesCount={18}
        dislikesCount={12}
        repliesCount={15}
        isLiked={true}
        onLike={(id) => console.log('Liked:', id)}
        onDislike={(id) => console.log('Disliked:', id)}
        onReply={(id) => console.log('Reply to:', id)}
      />
      
      <OpinionCard
        id="opinion-3"
        userName="Emma Thompson"
        content="I think both approaches have merit. We can't wait for perfect policy solutions while doing nothing ourselves, but we also can't pretend that personal choices alone will solve everything. The key is finding the right balance and not letting either approach become an excuse for inaction."
        stance="neutral"
        timestamp="6 hours ago"
        likesCount={42}
        dislikesCount={5}
        repliesCount={23}
        onLike={(id) => console.log('Liked:', id)}
        onDislike={(id) => console.log('Disliked:', id)}
        onReply={(id) => console.log('Reply to:', id)}
      />
    </div>
  )
}