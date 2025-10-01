import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { MessageSquare } from "lucide-react";

export default function DebateRoomPage() {
  const params = useParams<{ id: string }>();
  const roomId = params.id;

  // Fetch debate room data
  const { data: room, isLoading } = useQuery({
    queryKey: ["/api/debate-rooms", roomId],
    queryFn: async () => {
      const response = await fetch(`/api/debate-rooms/${roomId}`);
      if (!response.ok) throw new Error("Failed to fetch debate room");
      return response.json();
    },
    enabled: !!roomId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading debate room...</p>
        </div>
      </div>
    );
  }

  if (!room) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <MessageSquare className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-lg font-medium mb-2">Debate room not found</p>
          <p className="text-muted-foreground">
            This debate may have ended or doesn't exist
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-3 rounded-lg bg-blue-500/10">
          <MessageSquare className="w-6 h-6 text-blue-500" />
        </div>
        <div>
          <h1 className="text-3xl font-bold">{room.topicTitle}</h1>
          <p className="text-muted-foreground">{room.topicDescription}</p>
        </div>
      </div>
      
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">
            Debate room chat interface will be implemented here
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
