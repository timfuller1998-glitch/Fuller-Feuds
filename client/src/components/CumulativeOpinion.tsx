import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Brain, Users, TrendingUp, Sparkles } from "lucide-react";

interface CumulativeOpinionProps {
  topicId: string;
  summary: string;
  keyPoints: string[];
  supportingPercentage: number;
  opposingPercentage: number;
  neutralPercentage: number;
  totalOpinions: number;
  confidence: "high" | "medium" | "low";
  lastUpdated: string;
  onViewDetails?: (topicId: string) => void;
}

const confidenceConfig = {
  high: { color: "bg-chart-1", text: "High Confidence" },
  medium: { color: "bg-chart-2", text: "Medium Confidence" },
  low: { color: "bg-chart-5", text: "Low Confidence" }
};

export default function CumulativeOpinion({
  topicId,
  summary,
  keyPoints,
  supportingPercentage,
  opposingPercentage,
  neutralPercentage,
  totalOpinions,
  confidence,
  lastUpdated,
  onViewDetails
}: CumulativeOpinionProps) {
  return (
    <Card className="border-accent bg-gradient-to-br from-accent/5 to-accent/10 hover-elevate" data-testid={`card-cumulative-${topicId}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <Brain className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-lg flex items-center gap-2">
                AI-Generated Summary
                <Sparkles className="w-4 h-4 text-primary" />
              </h3>
              <p className="text-sm text-muted-foreground">
                Based on {totalOpinions} opinions • Updated {lastUpdated}
              </p>
            </div>
          </div>
          <Badge className={`${confidenceConfig[confidence].color} text-white`}>
            {confidenceConfig[confidence].text}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="prose prose-sm max-w-none">
          <p className="text-foreground leading-relaxed" data-testid={`text-summary-${topicId}`}>
            {summary}
          </p>
        </div>
        
        {keyPoints.length > 0 && (
          <div>
            <h4 className="font-medium mb-2 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Key Discussion Points
            </h4>
            <ul className="space-y-1 text-sm">
              {keyPoints.map((point, index) => (
                <li key={index} className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                  {point}
                </li>
              ))}
            </ul>
          </div>
        )}
        
        <div className="space-y-3">
          <h4 className="font-medium flex items-center gap-2">
            <Users className="w-4 h-4" />
            Opinion Distribution
          </h4>
          
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Supporting ({supportingPercentage}%)</span>
              <span>Opposing ({opposingPercentage}%)</span>
              <span>Neutral ({neutralPercentage}%)</span>
            </div>
            
            <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
              <div className="h-full flex">
                <div 
                  className="bg-chart-1" 
                  style={{ width: `${supportingPercentage}%` }}
                />
                <div 
                  className="bg-chart-5" 
                  style={{ width: `${opposingPercentage}%` }}
                />
                <div 
                  className="bg-muted-foreground" 
                  style={{ width: `${neutralPercentage}%` }}
                />
              </div>
            </div>
          </div>
        </div>
        
        <Button 
          variant="outline" 
          size="sm" 
          className="w-full"
          onClick={() => {
            onViewDetails?.(topicId);
            console.log('View cumulative details clicked:', topicId);
          }}
          data-testid={`button-view-details-${topicId}`}
        >
          View Detailed Analysis
        </Button>
      </CardContent>
    </Card>
  );
}