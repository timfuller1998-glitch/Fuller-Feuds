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

interface PoliticalCompass2DAnalysis {
  economicScore: number; // -100 (socialist) to +100 (capitalist)
  authoritarianScore: number; // -100 (libertarian) to +100 (authoritarian)
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
  quadrant: 'authoritarian-capitalist' | 'libertarian-capitalist' | 'libertarian-socialist' | 'authoritarian-socialist' | 'centrist';
}

export class AIService {
  static async generateCategories(topicTitle: string): Promise<string[]> {
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are a debate categorization expert. Generate exactly 3 relevant category tags for debate topics. Return only a JSON array of strings, nothing else. Categories should be concise (1-2 words), relevant, and commonly understood."
          },
          {
            role: "user",
            content: `Generate exactly 3 relevant category tags for this debate topic: "${topicTitle}". Return ONLY a JSON array like ["Category1", "Category2", "Category3"]`
          }
        ],
        temperature: 0.5,
        max_tokens: 100
      });

      const responseContent = completion.choices[0]?.message?.content?.trim();
      if (!responseContent) {
        throw new Error("No response from OpenAI");
      }

      const categories = JSON.parse(responseContent);
      if (!Array.isArray(categories) || categories.length !== 3) {
        throw new Error("Invalid categories format from AI");
      }

      return categories.slice(0, 3);
    } catch (error) {
      console.error("Error generating categories:", error);
      // Fallback to generic categories
      return ["Politics", "Society", "General"];
    }
  }

  static async generateTopicImage(topicTitle: string): Promise<string> {
    try {
      const response = await openai.images.generate({
        model: "dall-e-3",
        prompt: `Create a professional, abstract visual representation for a debate topic titled: "${topicTitle}". The image should be thought-provoking, balanced, and suitable for a serious discussion platform. Style: modern, clean, conceptual art with symbolic elements related to the topic.`,
        size: "1024x1024",
        quality: "standard",
        n: 1,
      });

      const imageUrl = response.data?.[0]?.url;
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

  static async analyze2DPoliticalCompass(opinions: Opinion[]): Promise<PoliticalCompass2DAnalysis> {
    if (opinions.length === 0) {
      return {
        economicScore: 0,
        authoritarianScore: 0,
        confidence: 'low',
        reasoning: 'No opinions available for analysis',
        quadrant: 'centrist'
      };
    }

    // Determine confidence based on opinion count
    let confidence: 'high' | 'medium' | 'low' = 'low';
    if (opinions.length >= 30) {
      confidence = 'high';
    } else if (opinions.length >= 10) {
      confidence = 'medium';
    }

    // Prepare opinions for AI analysis (last 50 opinions)
    const recentOpinions = opinions.slice(-50);
    const opinionTexts = recentOpinions.map((opinion, index) => 
      `Opinion ${index + 1}: ${opinion.content} (Stance: ${opinion.stance})`
    ).join('\n\n');

    const prompt = `
Analyze the following user opinions to determine their political position on a 2-dimensional political compass.

User Opinions (${recentOpinions.length} most recent):
${opinionTexts}

Please provide an analysis in the following JSON format:
{
  "economicScore": -50,
  "authoritarianScore": 25,
  "reasoning": "Brief explanation of the analysis"
}

ECONOMIC AXIS (-100 to +100):
-100 to -51: Very Socialist (strong wealth redistribution, extensive government control of economy, anti-capitalist)
-50 to -21: Socialist (supports wealth redistribution, market regulation, public ownership of key industries)
-20 to +20: Mixed Economy (balanced approach, regulated capitalism, some social programs)
+21 to +50: Capitalist (free market preference, limited regulation, private enterprise focus)
+51 to +100: Very Capitalist (minimal government intervention, pure free market, strong private property rights)

NOTE: -100 = Socialist, +100 = Capitalist

AUTHORITARIAN AXIS (-100 to +100):
-100 to -51: Very Libertarian (maximum individual freedom, minimal state authority, strong civil liberties)
-50 to -21: Libertarian (personal freedom priority, limited government power, strong individual rights)
-20 to +20: Moderate (balanced authority and freedom, pragmatic governance)
+21 to +50: Authoritarian (strong government control, order over freedom, limited civil liberties)
+51 to +100: Very Authoritarian (total state control, strict social order, minimal individual freedoms)

Consider these aspects:
ECONOMIC indicators:
- Views on taxation, welfare, healthcare, education funding
- Stance on business regulation, labor rights, unions
- Opinions on wealth inequality and redistribution
- Free market vs. planned economy preferences

AUTHORITARIAN indicators:
- Views on government surveillance, law enforcement, military
- Stance on censorship, free speech, personal privacy
- Opinions on drug policy, gun rights, personal freedoms
- Traditional values vs. progressive social policies

Return only valid JSON.`;

    try {
      console.log(`[AI Analysis] Starting 2D political compass analysis for ${recentOpinions.length} opinions`);
      
      // the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
      const completion = await openai.chat.completions.create({
        model: "gpt-5",
        messages: [
          {
            role: "system",
            content: "You are a political science expert who analyzes ideological positions on a 2D political compass objectively and accurately. Always respond with valid JSON only."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
        max_completion_tokens: 500
      });

      const responseContent = completion.choices[0]?.message?.content;
      console.log(`[AI Analysis] Raw OpenAI response:`, responseContent);
      
      if (!responseContent) {
        console.error("[AI Analysis] ERROR: No response from OpenAI");
        throw new Error("No response from OpenAI");
      }

      let aiAnalysis;
      try {
        aiAnalysis = JSON.parse(responseContent);
        console.log(`[AI Analysis] Parsed AI analysis:`, JSON.stringify(aiAnalysis, null, 2));
      } catch (parseError) {
        console.error("[AI Analysis] ERROR: Failed to parse AI 2D political analysis:", responseContent);
        console.error("[AI Analysis] Parse error details:", parseError);
        throw new Error("Invalid AI response format");
      }

      const economicScore = Math.max(-100, Math.min(100, aiAnalysis.economicScore || 0));
      const authoritarianScore = Math.max(-100, Math.min(100, aiAnalysis.authoritarianScore || 0));
      
      console.log(`[AI Analysis] Final scores - Economic: ${economicScore}, Authoritarian: ${authoritarianScore}`);

      // Determine quadrant
      let quadrant: PoliticalCompass2DAnalysis['quadrant'] = 'centrist';
      if (Math.abs(economicScore) > 20 || Math.abs(authoritarianScore) > 20) {
        if (economicScore > 20 && authoritarianScore > 20) {
          quadrant = 'authoritarian-capitalist';
        } else if (economicScore > 20 && authoritarianScore < -20) {
          quadrant = 'libertarian-capitalist';
        } else if (economicScore < -20 && authoritarianScore < -20) {
          quadrant = 'libertarian-socialist';
        } else if (economicScore < -20 && authoritarianScore > 20) {
          quadrant = 'authoritarian-socialist';
        }
      }
      
      console.log(`[AI Analysis] Determined quadrant: ${quadrant}, confidence: ${confidence}`);

      return {
        economicScore,
        authoritarianScore,
        confidence,
        reasoning: aiAnalysis.reasoning || 'Analysis based on expressed opinions',
        quadrant
      };

    } catch (error) {
      console.error("Error analyzing 2D political compass:", error);
      
      // Fallback analysis without AI - simple heuristic
      const forCount = opinions.filter(op => op.stance === 'for').length;
      const againstCount = opinions.filter(op => op.stance === 'against').length;
      
      // Simple heuristic: estimate based on stance patterns
      const ratio = forCount - againstCount;
      const economicScore = Math.max(-100, Math.min(100, (ratio / opinions.length) * 30));
      const authoritarianScore = 0; // Default to center on authority axis without content analysis

      return {
        economicScore: Math.round(economicScore),
        authoritarianScore: Math.round(authoritarianScore),
        confidence,
        reasoning: `Fallback analysis based on ${opinions.length} opinions with stance distribution: ${forCount} supportive, ${againstCount} opposing`,
        quadrant: 'centrist'
      };
    }
  }

  /**
   * Analyze the political stance of a single opinion
   * Returns economic and authoritarian scores from -100 to +100
   * @param opinionContent - The text content of the opinion
   * @param topicTitle - The title of the topic being discussed
   * @param model - The OpenAI model to use (default: gpt-4o-mini for cost efficiency)
   */
  static async analyzeOpinionPoliticalStance(
    opinionContent: string,
    topicTitle: string,
    model: "gpt-4o-mini" | "gpt-5" = "gpt-4o-mini"
  ): Promise<{ economicScore: number; authoritarianScore: number }> {
    const prompt = `
Analyze this opinion on the topic "${topicTitle}" and determine its political position on a 2-dimensional political compass.

Opinion: "${opinionContent}"

Provide analysis in the following JSON format:
{
  "economicScore": -50,
  "authoritarianScore": 25
}

ECONOMIC AXIS (-100 to +100):
-100 to -51: Very Socialist (strong wealth redistribution, extensive government control of economy, anti-capitalist)
-50 to -21: Socialist (supports wealth redistribution, market regulation, public ownership of key industries)
-20 to +20: Mixed Economy (balanced approach, regulated capitalism, some social programs)
+21 to +50: Capitalist (free market preference, limited regulation, private enterprise focus)
+51 to +100: Very Capitalist (minimal government intervention, pure free market, strong private property rights)

NOTE: -100 = Socialist, +100 = Capitalist

AUTHORITARIAN AXIS (-100 to +100):
-100 to -51: Very Libertarian (maximum individual freedom, minimal state authority, strong civil liberties)
-50 to -21: Libertarian (personal freedom priority, limited government power, strong individual rights)
-20 to +20: Moderate (balanced authority and freedom, pragmatic governance)
+21 to +50: Authoritarian (strong government control, order over freedom, limited civil liberties)
+51 to +100: Very Authoritarian (total state control, strict social order, minimal individual freedoms)

ECONOMIC indicators:
- Views on taxation, welfare, healthcare, education funding
- Stance on business regulation, labor rights, unions
- Opinions on wealth inequality and redistribution
- Free market vs. planned economy preferences

AUTHORITARIAN indicators:
- Views on government surveillance, law enforcement, military
- Stance on censorship, free speech, personal privacy
- Opinions on drug policy, gun rights, personal freedoms
- Traditional values vs. progressive social policies

Return only valid JSON with economicScore and authoritarianScore fields.`;

    try {
      console.log(`[Opinion Analysis] Analyzing opinion using model: ${model}`);
      const completion = await openai.chat.completions.create({
        model,
        messages: [
          {
            role: "system",
            content: "You are a political science expert who analyzes ideological positions on a 2D political compass objectively and accurately. Always respond with valid JSON only."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
        max_completion_tokens: 200,
        temperature: 0.3
      });

      const responseContent = completion.choices[0]?.message?.content;
      
      if (!responseContent) {
        console.error("[Opinion Analysis] No response from OpenAI");
        return { economicScore: 0, authoritarianScore: 0 };
      }

      const aiAnalysis = JSON.parse(responseContent);
      const economicScore = Math.max(-100, Math.min(100, aiAnalysis.economicScore || 0));
      const authoritarianScore = Math.max(-100, Math.min(100, aiAnalysis.authoritarianScore || 0));

      return {
        economicScore: Math.round(economicScore),
        authoritarianScore: Math.round(authoritarianScore)
      };

    } catch (error) {
      console.error("[Opinion Analysis] Error analyzing opinion political stance:", error);
      // Return neutral scores on error
      return { economicScore: 0, authoritarianScore: 0 };
    }
  }

  /**
   * Generate embedding vector for text using OpenAI's text-embedding-3-small model
   * Returns a 1536-dimension vector for semantic similarity search
   */
  static async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: text.trim(),
        encoding_format: "float"
      });

      return response.data[0].embedding;
    } catch (error) {
      console.error("Error generating embedding:", error);
      throw new Error("Failed to generate embedding");
    }
  }

  /**
   * Calculate cosine similarity between two embedding vectors
   * Returns a value between -1 and 1, where 1 means identical, 0 means orthogonal, -1 means opposite
   */
  static cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) {
      throw new Error("Vectors must have the same length");
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (normA * normB);
  }
}