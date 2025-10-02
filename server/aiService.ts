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

interface PoliticalLeaningAnalysis {
  leaning: string; // 'progressive', 'moderate', 'conservative', 'libertarian', etc.
  score: number; // -100 (very progressive) to +100 (very conservative)
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
}

export class AIService {
  static async generateTopicImage(topicTitle: string): Promise<string> {
    try {
      const response = await openai.images.generate({
        model: "dall-e-3",
        prompt: `Create a professional, abstract visual representation for a debate topic titled: "${topicTitle}". The image should be thought-provoking, balanced, and suitable for a serious discussion platform. Style: modern, clean, conceptual art with symbolic elements related to the topic.`,
        size: "1024x1024",
        quality: "standard",
        n: 1,
      });

      const imageUrl = response.data[0]?.url;
      if (!imageUrl) {
        throw new Error("No image URL returned from DALL-E");
      }

      return imageUrl;
    } catch (error) {
      console.error("Error generating topic image:", error);
      throw error;
    }
  }

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

  static async analyzePoliticalLeaning(opinions: Opinion[]): Promise<PoliticalLeaningAnalysis> {
    if (opinions.length === 0) {
      return {
        leaning: 'unknown',
        score: 0,
        confidence: 'low',
        reasoning: 'No opinions available for analysis'
      };
    }

    // Determine confidence based on opinion count
    let confidence: 'high' | 'medium' | 'low' = 'low';
    if (opinions.length >= 15) {
      confidence = 'high';
    } else if (opinions.length >= 5) {
      confidence = 'medium';
    }

    // Prepare opinions for AI analysis
    const opinionTexts = opinions.map((opinion, index) => 
      `Opinion ${index + 1}: ${opinion.content} (Stance: ${opinion.stance})`
    ).join('\n\n');

    const prompt = `
Analyze the following user opinions to determine their political leaning on a spectrum from progressive to conservative.

User Opinions:
${opinionTexts}

Please provide an analysis in the following JSON format:
{
  "leaning": "progressive|moderate-progressive|moderate|moderate-conservative|conservative|libertarian|populist",
  "score": -50,
  "reasoning": "Brief explanation of the analysis"
}

Scoring Guide:
- -100 to -51: Very Progressive (strong support for social change, government intervention in inequality, environmental regulation)
- -50 to -21: Progressive (supports social progress, some government intervention, climate action)
- -20 to +20: Moderate (balanced views, pragmatic approach to issues)
- +21 to +50: Conservative (traditional values, limited government, free market preferences)
- +51 to +100: Very Conservative (strong traditional values, minimal government, strict social order)

Special categories:
- Libertarian: Strong individual freedom + minimal government on both social and economic issues
- Populist: Anti-establishment, pro-common people regardless of left/right spectrum

Consider:
1. Economic views (taxation, regulation, welfare, free market)
2. Social issues (equality, diversity, traditional values, personal freedoms)
3. Government role (size, intervention, individual rights)
4. Environmental and climate positions
5. Law and order vs. criminal justice reform attitudes

Return only valid JSON.`;

    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are a political science expert who analyzes ideological leanings objectively. Always respond with valid JSON only."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.2,
        max_tokens: 500
      });

      const responseContent = completion.choices[0]?.message?.content;
      if (!responseContent) {
        throw new Error("No response from OpenAI");
      }

      let aiAnalysis;
      try {
        aiAnalysis = JSON.parse(responseContent);
      } catch (parseError) {
        console.error("Failed to parse AI political analysis:", responseContent);
        throw new Error("Invalid AI response format");
      }

      return {
        leaning: aiAnalysis.leaning || 'moderate',
        score: Math.max(-100, Math.min(100, aiAnalysis.score || 0)),
        confidence,
        reasoning: aiAnalysis.reasoning || 'Analysis based on expressed opinions'
      };

    } catch (error) {
      console.error("Error analyzing political leaning:", error);
      
      // Fallback analysis without AI - simple heuristic based on stance patterns
      const forCount = opinions.filter(op => op.stance === 'for').length;
      const againstCount = opinions.filter(op => op.stance === 'against').length;
      const neutralCount = opinions.filter(op => op.stance === 'neutral').length;
      
      // Simple heuristic: more "for" stances might indicate progressive leaning
      const ratio = forCount - againstCount;
      const score = Math.max(-100, Math.min(100, (ratio / opinions.length) * 50));
      
      let leaning = 'moderate';
      if (score < -20) leaning = 'progressive';
      else if (score > 20) leaning = 'conservative';

      return {
        leaning,
        score: Math.round(score),
        confidence,
        reasoning: `Analysis based on ${opinions.length} opinions with stance distribution: ${forCount} supportive, ${againstCount} opposing, ${neutralCount} neutral`
      };
    }
  }
}