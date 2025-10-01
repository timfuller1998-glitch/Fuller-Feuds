import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Radio } from "lucide-react";

export default function LiveStreamPage() {
  const params = useParams<{ id: string }>();
  const streamId = params.id;

  // Fetch live stream data
  const { data: stream, isLoading } = useQuery({
    queryKey: ["/api/live-streams", streamId],
    queryFn: async () => {
      const response = await fetch(`/api/live-streams/${streamId}`);
      if (!response.ok) throw new Error("Failed to fetch live stream");
      return response.json();
    },
    enabled: !!streamId,
  });

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
      <Card>
        <CardContent className="py-12 text-center">
          <Radio className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-lg font-medium mb-2">Live stream not found</p>
          <p className="text-muted-foreground">
            This stream may have ended or doesn't exist
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-3 rounded-lg bg-red-500/10">
          <Radio className="w-6 h-6 text-red-500" />
        </div>
        <div>
          <h1 className="text-3xl font-bold">{stream.title}</h1>
          <p className="text-muted-foreground">{stream.description}</p>
        </div>
      </div>
      
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">
            Live stream viewer component will be implemented here
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
