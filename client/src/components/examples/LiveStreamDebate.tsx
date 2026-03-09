import LiveStreamDebate from '../LiveStreamDebate'

export default function LiveStreamDebateExample() {
  const mockParticipants = [
    {
      id: "participant-1",
      name: "Dr. Sarah Chen",
      stance: "for" as const,
      isSpeaking: true,
      isMuted: false,
      isCameraOn: true
    },
    {
      id: "participant-2", 
      name: "Prof. Marcus Rodriguez",
      stance: "against" as const,
      isSpeaking: false,
      isMuted: false,
      isCameraOn: true
    }
  ];

  return (
    <div className="p-8">
      <LiveStreamDebate
        topicId="climate-live"
        title="Climate Change: Individual vs. Systemic Action - LIVE DEBATE"
        viewerCount={1247}
        duration="24:15"
        participants={mockParticipants}
        moderator={{
          id: "mod-1",
          name: "Alex Thompson"
        }}
        currentUserId="viewer-current"
        isLive={true}
        onJoinAsViewer={() => console.log('Join as viewer clicked')}
        onRequestToSpeak={() => console.log('Request to speak clicked')}
        onModerateChat={(messageId, action) => console.log('Moderate chat:', messageId, action)}
      />
    </div>
  )
}