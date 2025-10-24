import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, Users, TrendingUp } from "lucide-react";
import { Link } from "wouter";

interface SimilarTopic {
  id: string;
  title: string;
  description: string;
  categories: string[];
  opinionsCount?: number;
  participantCount?: number;
  similarityScore?: number;
}

interface TopicSimilarityModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  similarTopics: SimilarTopic[];
  onCreateNew: () => void;
}

export function TopicSimilarityModal({
  open,
  onOpenChange,
  similarTopics,
  onCreateNew,
}: TopicSimilarityModalProps) {
  if (similarTopics.length === 0) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto" data-testid="modal-topic-similarity">
        <DialogHeader>
          <DialogTitle className="text-2xl">Similar Topics Found</DialogTitle>
          <DialogDescription>
            We found {similarTopics.length} existing {similarTopics.length === 1 ? 'topic' : 'topics'} similar to yours. 
            Consider joining an existing discussion instead of creating a duplicate.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4">
          {similarTopics.map((topic) => (
            <Link key={topic.id} href={`/topic/${topic.id}`}>
              <Card className="hover-elevate active-elevate-2 cursor-pointer transition-smooth" data-testid={`card-similar-topic-${topic.id}`}>
                <CardContent className="p-4">
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold text-lg leading-tight flex-1">
                        {topic.title}
                      </h3>
                      {topic.similarityScore !== undefined && (
                        <Badge variant="outline" className="shrink-0">
                          {Math.round(topic.similarityScore * 100)}% match
                        </Badge>
                      )}
                    </div>

                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {topic.description}
                    </p>

                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      {topic.opinionsCount !== undefined && (
                        <div className="flex items-center gap-1" data-testid={`stat-opinions-${topic.id}`}>
                          <MessageCircle className="h-4 w-4" />
                          <span>{topic.opinionsCount} {topic.opinionsCount === 1 ? 'opinion' : 'opinions'}</span>
                        </div>
                      )}
                      {topic.participantCount !== undefined && (
                        <div className="flex items-center gap-1" data-testid={`stat-participants-${topic.id}`}>
                          <Users className="h-4 w-4" />
                          <span>{topic.participantCount} {topic.participantCount === 1 ? 'participant' : 'participants'}</span>
                        </div>
                      )}
                    </div>

                    {topic.categories && topic.categories.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {topic.categories.slice(0, 3).map((category) => (
                          <Badge 
                            key={category} 
                            variant="secondary" 
                            className="text-xs cursor-pointer hover-elevate"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              window.location.href = `/?category=${encodeURIComponent(category)}`;
                            }}
                            data-testid={`badge-category-${category.toLowerCase()}`}
                          >
                            {category}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={onCreateNew}
            data-testid="button-create-anyway"
            className="w-full sm:w-auto"
          >
            None of these match - Create New Topic
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
