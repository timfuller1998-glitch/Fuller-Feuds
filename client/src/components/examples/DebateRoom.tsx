import DebateRoom from '../DebateRoom'

export default function DebateRoomExample() {
  const mockMessages = [
    {
      id: "msg-1",
      userId: "user-1",
      userName: "Sarah Chen",
      content: "I think we need to start with individual responsibility. If everyone waits for policy changes, nothing will happen.",
      timestamp: "2 minutes ago",
      stance: "for" as const
    },
    {
      id: "msg-2", 
      userId: "user-2",
      userName: "Marcus Rodriguez",
      content: "But that's exactly the problem! While we're focusing on individual actions, corporations continue to pollute at massive scales. We're missing the forest for the trees.",
      timestamp: "1 minute ago",
      stance: "against" as const
    },
    {
      id: "msg-3",
      userId: "user-1", 
      userName: "Sarah Chen",
      content: "I agree corporations have a huge role, but individual actions create market demand. When consumers change behavior, companies follow. Look at the growth in renewable energy driven by consumer demand.",
      timestamp: "30 seconds ago",
      stance: "for" as const
    }
  ];

  return (
    <div className="p-8 max-w-4xl">
      <DebateRoom
        topicTitle="Climate Change: Individual vs. Systemic Action"
        participant1={{
          id: "user-1",
          name: "Sarah Chen",
          stance: "for",
          isOnline: true
        }}
        participant2={{
          id: "user-2", 
          name: "Marcus Rodriguez",
          stance: "against",
          isOnline: true
        }}
        currentUserId="user-1"
        duration="12:34"
        messages={mockMessages}
        onSendMessage={(content) => console.log('Send message:', content)}
        onEndDebate={() => console.log('End debate clicked')}
      />
    </div>
  )
}