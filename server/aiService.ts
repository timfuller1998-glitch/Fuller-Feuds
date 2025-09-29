import OpenAI from 'openai';
import type { Opinion, Topic, CumulativeOpinion } from '@shared/schema';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface OpinionAnalysis {
  summary: string;
  keyPoints: string[];
  supportingPercentage: number;
  opposingPercentage: number;
  neutralPercentage: number;
  totalOpinions: number;
  confidence: 'high' | 'medium' | 'low';
}

export class AIService {
  static async generateCumulativeOpinion(
    topic: Topic,
    opinions: Opinion[]
  ): Promise<OpinionAnalysis> {
    if (opinions.length === 0) {
      return {
        summary: "No opinions available yet for this topic.",
        keyPoints: [],
        supportingPercentage: 0,
        opposingPercentage: 0,
        neutralPercentage: 0,
        totalOpinions: 0,
        confidence: 'low'
      };
    }

    // Calculate stance percentages
    const stanceCounts = opinions.reduce((acc, opinion) => {
      acc[opinion.stance] = (acc[opinion.stance] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const totalOpinions = opinions.length;
    const supportingPercentage = Math.round(((stanceCounts.for || 0) / totalOpinions) * 100);
    const opposingPercentage = Math.round(((stanceCounts.against || 0) / totalOpinions) * 100);
    const neutralPercentage = Math.round(((stanceCounts.neutral || 0) / totalOpinions) * 100);

    // Determine confidence based on opinion count and diversity
    let confidence: 'high' | 'medium' | 'low' = 'low';
    if (totalOpinions >= 20) {
      confidence = 'high';
    } else if (totalOpinions >= 5) {
      confidence = 'medium';
    }

    // Prepare opinions for AI analysis
    const opinionTexts = opinions.map(opinion => 
      `Stance: ${opinion.stance}, Content: ${opinion.content}`
    ).join('\n\n');

    const prompt = `
You are analyzing a debate topic titled "${topic.title}".

Topic Description: ${topic.description}

Here are all the opinions expressed by users:

${opinionTexts}

Please provide a comprehensive analysis in the following JSON format:
{
  "summary": "A balanced 2-3 paragraph summary of the key themes and arguments",
  "keyPoints": ["array", "of", "3-5", "most", "important", "points", "from", "all", "sides"]
}

Focus on:
1. Identifying common themes and concerns
2. Highlighting the strongest arguments from each side
3. Noting areas of consensus or significant disagreement
4. Maintaining objectivity and balance
5. Being concise but comprehensive

Return only valid JSON.`;

    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are an expert debate analyst who creates balanced, objective summaries of public discourse. Always respond with valid JSON only."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 1500
      });

      const responseContent = completion.choices[0]?.message?.content;
      if (!responseContent) {
        throw new Error("No response from OpenAI");
      }

      let aiAnalysis;
      try {
        aiAnalysis = JSON.parse(responseContent);
      } catch (parseError) {
        console.error("Failed to parse AI response:", responseContent);
        throw new Error("Invalid AI response format");
      }

      return {
        summary: aiAnalysis.summary || "Unable to generate summary at this time.",
        keyPoints: Array.isArray(aiAnalysis.keyPoints) ? aiAnalysis.keyPoints : [],
        supportingPercentage,
        opposingPercentage,
        neutralPercentage,
        totalOpinions,
        confidence
      };

    } catch (error) {
      console.error("Error generating AI analysis:", error);
      
      // Fallback analysis without AI
      const majorityStance = Object.entries(stanceCounts)
        .sort(([,a], [,b]) => b - a)[0]?.[0] || 'neutral';

      return {
        summary: `Based on ${totalOpinions} opinion(s), the discussion around "${topic.title}" shows ${supportingPercentage}% support, ${opposingPercentage}% opposition, and ${neutralPercentage}% neutral positions. The majority stance appears to be "${majorityStance}".`,
        keyPoints: [
          `${totalOpinions} total opinions collected`,
          `${supportingPercentage}% expressing support`,
          `${opposingPercentage}% expressing opposition`,
          `${neutralPercentage}% taking neutral positions`
        ],
        supportingPercentage,
        opposingPercentage,
        neutralPercentage,
        totalOpinions,
        confidence
      };
    }
  }
}