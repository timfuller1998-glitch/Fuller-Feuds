import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import type { TopicWithCounts } from "@shared/schema";

interface UseCardQueueOptions {
  sectionKey: string;
  sectionTopicIds: string[];
  limit?: number;
}

export function useCardQueue({ sectionKey, sectionTopicIds, limit = 20 }: UseCardQueueOptions) {
  const [localQueue, setLocalQueue] = useState<TopicWithCounts[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Fetch prioritized queue from API
  const { data: prioritizedTopics, isLoading, refetch } = useQuery<TopicWithCounts[]>({
    queryKey: ["/api/users/me/topic-queue", sectionKey, sectionTopicIds.join(",")],
    queryFn: async () => {
      const response = await fetch(
        `/api/users/me/topic-queue?sectionTopicIds=${encodeURIComponent(JSON.stringify(sectionTopicIds))}&limit=${limit}`
      );
      if (!response.ok) {
        throw new Error("Failed to fetch topic queue");
      }
      return response.json();
    },
    enabled: sectionTopicIds.length > 0,
  });

  // Update local queue when prioritized topics are fetched
  useEffect(() => {
    if (prioritizedTopics) {
      setLocalQueue(prioritizedTopics);
      setCurrentIndex(0);
    }
  }, [prioritizedTopics]);

  // Advance to next card
  const advance = useCallback(() => {
    setCurrentIndex(prev => prev + 1);
  }, []);

  // Refresh queue
  const refresh = useCallback(() => {
    refetch();
  }, [refetch]);

  // Get current visible topics (3-5 cards for stack)
  const visibleTopics = localQueue.slice(currentIndex, currentIndex + 5);

  return {
    topics: visibleTopics,
    advance,
    refresh,
    isLoading,
    hasMore: currentIndex < localQueue.length - 1,
  };
}
