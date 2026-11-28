import OpenAI from 'openai';
import type { Opinion, Topic, CumulativeOpinion, SummarySentence } from '../shared/schema.js';
import { chatParams, recordAIFailure, EMBEDDING_MODEL } from './lib/aiConfig.js';
import { MAJOR_CATEGORIES, subsOf, normalizeHome, classifyTopic } from '../shared/topicTaxonomy.js';

// Temporarily disable OpenAI for testing - remove this when you have API key
const openai = process.env.OPENAI_API_KEY ? new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
}) : null;

interface OpinionAnalysis {
  summary: string;
  keyPoints: string[];
  summarySentences: SummarySentence[];
  supportingPercentage: number;
  opposingPercentage: number;
  neutralPercentage: number;
  totalOpinions: number;
  confidence: 'high' | 'medium' | 'low';
  usedFallback?: boolean;
}

function pickRelatedOpinionIds(text: string, opinions: Array<{ id: string; content: string }>, limit = 3): string[] {
  const words = new Set(text.toLowerCase().split(/\W+/).filter((w) => w.length > 4));
  const scored = opinions
    .map((o) => {
      const owords = (o.content || "").toLowerCase().split(/\W+/);
      const score = owords.reduce((n, w) => n + (words.has(w) ? 1 : 0), 0);
      return { id: o.id, score };
    })
    .sort((a, b) => b.score - a.score);
  return scored.filter((s) => s.score > 0).slice(0, limit).map((s) => s.id);
}

export function sentencesFromSummary(summary: string, opinions: Array<{ id: string; content: string }>): SummarySentence[] {
  const paragraphs = summary.split(/\n{2,}/).map((s) => s.trim()).filter(Boolean);
  const blocks = paragraphs.length > 1
    ? paragraphs
    : summary.split(/(?<=[.!?])\s+/g).map((s) => s.trim()).filter(Boolean);
  return blocks.map((text) => ({
    text,
    referencedOpinionIds: pickRelatedOpinionIds(text, opinions),
  }));
}

function normalizeSummarySentences(
  raw: unknown,
  opinions: Array<{ id: string; content: string }>,
  fallbackSummary: string,
): SummarySentence[] {
  const allowed = new Set(opinions.map((o) => o.id));
  if (Array.isArray(raw)) {
    const parsed = raw
      .map((item) => {
        if (item == null) return null;
        if (typeof item === "string") {
          const t = item.trim();
          return t ? { text: t, referencedOpinionIds: pickRelatedOpinionIds(t, opinions) } : null;
        }
        if (typeof item === "object" && item !== null && "text" in item) {
          const text = String((item as { text?: unknown }).text ?? "").trim();
          if (!text) return null;
          const ids = (item as { referencedOpinionIds?: unknown }).referencedOpinionIds;
          const referencedOpinionIds = Array.isArray(ids)
            ? [...new Set(ids.filter((id): id is string => typeof id === "string" && allowed.has(id)))]
            : [];
          if (referencedOpinionIds.length === 0) {
            return { text, referencedOpinionIds: pickRelatedOpinionIds(text, opinions) };
          }
          return { text, referencedOpinionIds };
        }
        return null;
      })
      .filter(Boolean) as SummarySentence[];
    if (parsed.length) return parsed;
  }
  return sentencesFromSummary(fallbackSummary, opinions);
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
    // Return fallback categories if OpenAI is not configured
    if (!openai) {
      console.log('OpenAI not configured - returning fallback categories');
      return ["Politics", "Society", "General"];
    }

    try {
      const completion = await openai.chat.completions.create({
        ...chatParams({ maxTokens: 100, temperature: 0.5 }),
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
      console.error(`[AI] Category generation failed: ${recordAIFailure(error)}`);
      // Fallback to generic categories
      return ["Politics", "Society", "General"];
    }
  }

  /**
   * Pick the topic's official home (major + sub from shared/topicTaxonomy.ts) and up to 3 optional
   * free-form extra tags. The AI only chooses from the official list; an off-list or failed answer
   * falls back to the alias/keyword classifier, so the result is always a valid, non-"Other" home.
   */
  static async suggestTopicHome(
    title: string,
    description?: string | null,
    existingTags: string[] = [],
  ): Promise<{ majorId: string; subId: string; tags: string[]; source: 'ai' | 'keywords' }> {
    const keywordPick = classifyTopic({ title, description, categories: existingTags });
    const fallback = { majorId: keywordPick.majorId, subId: keywordPick.subId, tags: [] as string[], source: 'keywords' as const };
    if (!openai) return fallback;
    try {
      const menu = MAJOR_CATEGORIES.map((m) =>
        `- ${m.id}: ${m.name} | subs: ${subsOf(m.id).map((s) => `${s.id} (${s.name})`).join(', ')}`).join('\n');
      const completion = await openai.chat.completions.create({
        ...chatParams({ maxTokens: 120, temperature: 0.2, json: true }),
        messages: [
          {
            role: 'system',
            content: 'You file debate topics into an official group list for a general debate site (politics, religion, vehicles, recipes, movies, sports and more). Choose exactly one major and one sub from the list, using the ids exactly as written. If no specific sub fits, use "general" for that major. Never invent groups. Also give up to 3 short optional extra tags (1-2 words, not the major name). Reply with JSON only: {"major":"<id>","sub":"<id>","tags":["..."]}.',
          },
          {
            role: 'user',
            content: `Official groups:\n${menu}\n\nTopic title: "${title}"${description ? `\nDescription: "${description.slice(0, 400)}"` : ''}${existingTags.length ? `\nTags the author already chose: ${existingTags.join(', ')}` : ''}`,
          },
        ],
      });
      const raw = completion.choices[0]?.message?.content?.trim();
      if (!raw) throw new Error('No response from OpenAI');
      const parsed = JSON.parse(raw);
      const home = normalizeHome(String(parsed.major ?? ''), parsed.sub ? String(parsed.sub) : null);
      if (!home) throw new Error('AI picked a group that is not on the official list');
      const majorNames = new Set(MAJOR_CATEGORIES.flatMap((m) => [m.name.toLowerCase(), m.id]));
      const tags = (Array.isArray(parsed.tags) ? parsed.tags : [])
        .map((t: unknown) => String(t).trim())
        .filter((t: string) => t && t.length <= 30 && !majorNames.has(t.toLowerCase()))
        .slice(0, 3);
      return { majorId: home.majorId, subId: home.subId, tags, source: 'ai' };
    } catch (error) {
      console.error(`[AI] Topic home suggestion failed, using keywords: ${recordAIFailure(error)}`);
      return fallback;
    }
  }

  //static async generateTopicImage(topicTitle: string): Promise<string> {
  //  try {
  //    const response = await openai.images.generate({
  //      model: "dall-e-3",
  //      prompt: `Create a professional, abstract visual representation for a debate topic titled: "${topicTitle}". The image should be thought-provoking, balanced, and suitable for a serious discussion platform. Style: modern, clean, conceptual art with symbolic elements related to the topic.`,
  //      size: "1024x1024",
  //      quality: "standard",
  //      n: 1,
  //    });

  static async generateCumulativeOpinion(
    topic: Topic,
    opinions: Opinion[],
    distributions?: {
      averageEconomicScore?: number;
      averageAuthoritarianScore?: number;
      averageTasteScore?: number;
      averagePassionScore?: number;
      tasteDistribution?: any;
      passionDistribution?: any;
      politicalDistribution?: any;
      tasteDiversity?: number;
      passionDiversity?: number;
      diversityScore?: number;
    }
  ): Promise<OpinionAnalysis> {
    // Return mock data if OpenAI is not configured
    if (!openai) {
      console.log('OpenAI not configured - returning mock cumulative opinion');
      const totalOpinions = opinions.length;
      // Calculate percentages based on likes/dislikes since opinions don't have stance property
      const totalLikes = opinions.reduce((sum, o) => sum + (o.likesCount || 0), 0);
      const totalDislikes = opinions.reduce((sum, o) => sum + (o.dislikesCount || 0), 0);
      const totalVotes = totalLikes + totalDislikes;
      const supportingPercentage = totalVotes > 0 ? Math.round((totalLikes / totalVotes) * 100) : 0;
      const opposingPercentage = totalVotes > 0 ? Math.round((totalDislikes / totalVotes) * 100) : 0;
      const neutralPercentage = totalVotes === 0 ? 100 : 0;

      const summary = `Mock AI summary: ${totalOpinions} opinions on "${topic.title}" with ${supportingPercentage}% support, ${opposingPercentage}% opposition.`;
      return {
        summary,
        keyPoints: [
          'Mock key point: Community has mixed opinions',
          'Mock key point: Further discussion needed',
          'Mock key point: Data shows divided viewpoints'
        ],
        summarySentences: sentencesFromSummary(summary, opinions),
        supportingPercentage,
        opposingPercentage,
        neutralPercentage,
        totalOpinions,
        confidence: 'medium' as const,
        usedFallback: true
      };
    }

    if (opinions.length === 0) {
      return {
        summary: "No opinions available yet for this topic.",
        keyPoints: [],
        summarySentences: [],
        supportingPercentage: 0,
        opposingPercentage: 0,
        neutralPercentage: 0,
        totalOpinions: 0,
        confidence: 'low'
      };
    }

    // Calculate percentages based on likes/dislikes since opinions don't have stance property
    const totalLikes = opinions.reduce((sum, o) => sum + (o.likesCount || 0), 0);
    const totalDislikes = opinions.reduce((sum, o) => sum + (o.dislikesCount || 0), 0);
    const totalVotes = totalLikes + totalDislikes;
    const totalOpinions = opinions.length;
    const supportingPercentage = totalVotes > 0 ? Math.round((totalLikes / totalVotes) * 100) : 0;
    const opposingPercentage = totalVotes > 0 ? Math.round((totalDislikes / totalVotes) * 100) : 0;
    const neutralPercentage = totalVotes === 0 ? 100 : 0;

    // Determine confidence based on opinion count and diversity
    let confidence: 'high' | 'medium' | 'low' = 'low';
    if (totalOpinions >= 20) {
      confidence = 'high';
    } else if (totalOpinions >= 5) {
      confidence = 'medium';
    }

    // Prepare opinions for AI analysis
    const opinionTexts = opinions.map(opinion =>
      `Opinion ID ${opinion.id}:\n${opinion.content}`
    ).join('\n\n');

    // Build distribution context for AI
    let distributionContext = '';
    if (distributions) {
      distributionContext = `

OPINION STATISTICS:
- Political Distribution: 
  * Authoritarian Capitalist: ${distributions.politicalDistribution?.authoritarianCapitalist || 0}
  * Libertarian Capitalist: ${distributions.politicalDistribution?.libertarianCapitalist || 0}
  * Authoritarian Socialist: ${distributions.politicalDistribution?.authoritarianSocialist || 0}
  * Libertarian Socialist: ${distributions.politicalDistribution?.libertarianSocialist || 0}
- Average Political Position: Economic ${distributions.averageEconomicScore || 0} (Socialist -100 to Capitalist +100), Authoritarian ${distributions.averageAuthoritarianScore || 0} (Libertarian -100 to Authoritarian +100)
- Political Diversity Score: ${distributions.diversityScore || 0}/100

- Taste Distribution (Emotional Response):
  * Revulsion: ${distributions.tasteDistribution?.revulsion || 0}
  * Aversion: ${distributions.tasteDistribution?.aversion || 0}
  * Neutral: ${distributions.tasteDistribution?.neutral || 0}
  * Preference: ${distributions.tasteDistribution?.preference || 0}
  * Delight: ${distributions.tasteDistribution?.delight || 0}
- Average Taste Score: ${distributions.averageTasteScore || 0} (Revulsion -100 to Delight +100)
- Taste Diversity: ${distributions.tasteDiversity || 0}/100

- Passion Distribution (Intensity):
  * Academic: ${distributions.passionDistribution?.academic || 0}
  * Measured: ${distributions.passionDistribution?.measured || 0}
  * Moderate: ${distributions.passionDistribution?.moderate || 0}
  * Passionate: ${distributions.passionDistribution?.passionate || 0}
  * Aggressive: ${distributions.passionDistribution?.aggressive || 0}
- Average Passion Score: ${distributions.averagePassionScore || 0} (Academic -100 to Aggressive +100)
- Passion Diversity: ${distributions.passionDiversity || 0}/100`;
    }

    const prompt = `
You are analyzing a debate topic titled "${topic.title}".

Topic Description: ${topic.description}
${distributionContext}

Here are all the opinions expressed by users:

${opinionTexts}

Please provide a comprehensive analysis in the following JSON format:
{
  "summary": "A balanced 2-3 paragraph summary of the key themes and arguments",
  "keyPoints": ["array", "of", "3-5", "most", "important", "points", "from", "all", "sides"],
  "summarySentences": [
    {
      "text": "First paragraph of the summary",
      "referencedOpinionIds": ["id-of-an-opinion-this-paragraph-draws-from"]
    }
  ]
}

For summarySentences:
- Use 2-4 paragraphs that together match the summary.
- Each paragraph's referencedOpinionIds must be IDs from the opinions listed above, and only opinions that paragraph actually draws on (1-4 per paragraph).
- Do not invent IDs.

Focus on:
1. Identifying common themes and concerns
2. Highlighting the strongest arguments from each side
3. Noting areas of consensus or significant disagreement
4. Maintaining objectivity and balance
5. Being concise but comprehensive
6. Incorporating the distribution statistics to provide context about the political, emotional, and intensity dimensions of the debate

Return only valid JSON.`;

    try {
      const completion = await openai.chat.completions.create({
        ...chatParams({ maxTokens: 2000, temperature: 0.3, json: true }),
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

      const summary = aiAnalysis.summary || "Unable to generate summary at this time.";
      return {
        summary,
        keyPoints: Array.isArray(aiAnalysis.keyPoints) ? aiAnalysis.keyPoints : [],
        summarySentences: normalizeSummarySentences(aiAnalysis.summarySentences, opinions, summary),
        supportingPercentage,
        opposingPercentage,
        neutralPercentage,
        totalOpinions,
        confidence
      };

    } catch (error) {
      console.error(`[AI Summary] OpenAI call failed for "${topic.title}", using vote-count fallback: ${recordAIFailure(error)}`);
      
      // Fallback analysis without AI
      const majorityVote = totalLikes > totalDislikes ? 'supportive' : totalDislikes > totalLikes ? 'opposing' : 'neutral';

      const summary = `Based on ${totalOpinions} opinion(s), the discussion around "${topic.title}" shows ${supportingPercentage}% support, ${opposingPercentage}% opposition, and ${neutralPercentage}% neutral positions. The majority sentiment appears to be "${majorityVote}".`;
      return {
        summary,
        keyPoints: [
          `${totalOpinions} total opinions collected`,
          `${supportingPercentage}% expressing support`,
          `${opposingPercentage}% expressing opposition`,
          `${neutralPercentage}% taking neutral positions`
        ],
        summarySentences: sentencesFromSummary(summary, opinions),
        supportingPercentage,
        opposingPercentage,
        neutralPercentage,
        totalOpinions,
        confidence,
        usedFallback: true
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
      `Opinion ${index + 1}: ${opinion.content}`
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
- Populist: Anti-establishment, pro-common people regardless of liberal/conservative spectrum

Consider:
1. Economic views (taxation, regulation, welfare, free market)
2. Social issues (equality, diversity, traditional values, personal freedoms)
3. Government role (size, intervention, individual rights)
4. Environmental and climate positions
5. Law and order vs. criminal justice reform attitudes

Return only valid JSON.`;

    // Return mock data if OpenAI is not configured
    if (!openai) {
      console.log('OpenAI not configured - returning fallback political leaning analysis');
      return {
        leaning: 'moderate',
        score: 0,
        confidence: 'low',
        reasoning: 'OpenAI not configured - cannot perform analysis'
      };
    }

    try {
      const completion = await openai.chat.completions.create({
        ...chatParams({ maxTokens: 500, temperature: 0.2, json: true }),
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
      console.error(`[AI] Political leaning call failed: ${recordAIFailure(error)}`);
      
      // Fallback analysis without AI - simple heuristic based on likes/dislikes
      const totalLikes = opinions.reduce((sum, op) => sum + (op.likesCount || 0), 0);
      const totalDislikes = opinions.reduce((sum, op) => sum + (op.dislikesCount || 0), 0);
      
      // Simple heuristic: use average of economic scores if available, otherwise neutral
      const opinionsWithScores = opinions.filter(op => op.topicEconomicScore != null);
      let score = 0;
      if (opinionsWithScores.length > 0) {
        const avgEconomicScore = opinionsWithScores.reduce((sum, op) => sum + (op.topicEconomicScore || 0), 0) / opinionsWithScores.length;
        score = Math.max(-100, Math.min(100, avgEconomicScore));
      }
      
      let leaning = 'moderate';
      if (score < -20) leaning = 'progressive';
      else if (score > 20) leaning = 'conservative';

      return {
        leaning,
        score: Math.round(score),
        confidence,
        reasoning: `Fallback analysis based on ${opinions.length} opinions (${opinionsWithScores.length} with political scores)`
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
      `Opinion ${index + 1}: ${opinion.content}`
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

NOTE: -100 = economic Liberal (more government in the economy / socialist), +100 = economic Conservative (free markets / capitalist). On the standard Political Compass this is Liberal on the left side and Conservative on the right side. Any label you write for a person must use Liberal or Conservative, never Left or Right.

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

    // Return mock data if OpenAI is not configured
    if (!openai) {
      console.log('OpenAI not configured - returning fallback 2D political compass analysis');
      // Try to calculate from existing scores
      const opinionsWithScores = opinions.filter(op => op.topicEconomicScore != null && op.topicAuthoritarianScore != null);
      if (opinionsWithScores.length > 0) {
        const avgEconomic = opinionsWithScores.reduce((sum, op) => sum + (op.topicEconomicScore || 0), 0) / opinionsWithScores.length;
        const avgAuthoritarian = opinionsWithScores.reduce((sum, op) => sum + (op.topicAuthoritarianScore || 0), 0) / opinionsWithScores.length;
        return {
          economicScore: Math.round(Math.max(-100, Math.min(100, avgEconomic))),
          authoritarianScore: Math.round(Math.max(-100, Math.min(100, avgAuthoritarian))),
          confidence: 'low',
          reasoning: `Fallback analysis based on ${opinionsWithScores.length} opinions with political scores`,
          quadrant: 'centrist'
        };
      }
      return {
        economicScore: 0,
        authoritarianScore: 0,
        confidence: 'low',
        reasoning: 'OpenAI not configured and no political scores available',
        quadrant: 'centrist'
      };
    }

    try {
      console.log(`[AI Analysis] Starting 2D political compass analysis for ${recentOpinions.length} opinions`);
      
      const completion = await openai.chat.completions.create({
        ...chatParams({ maxTokens: 500, json: true }),
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
      });

      const responseContent = completion.choices[0]?.message?.content;
      
      if (!responseContent) {
        console.error("[AI Analysis] ERROR: No response from OpenAI");
        throw new Error("No response from OpenAI");
      }

      let aiAnalysis;
      try {
        aiAnalysis = JSON.parse(responseContent);
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
      console.error(`[AI Analysis] 2D compass call failed: ${recordAIFailure(error)}`);
      
      // Fallback analysis without AI - use existing scores if available
      const opinionsWithScores = opinions.filter(op => op.topicEconomicScore != null && op.topicAuthoritarianScore != null);
      if (opinionsWithScores.length > 0) {
        const avgEconomic = opinionsWithScores.reduce((sum, op) => sum + (op.topicEconomicScore || 0), 0) / opinionsWithScores.length;
        const avgAuthoritarian = opinionsWithScores.reduce((sum, op) => sum + (op.topicAuthoritarianScore || 0), 0) / opinionsWithScores.length;
        return {
          economicScore: Math.round(Math.max(-100, Math.min(100, avgEconomic))),
          authoritarianScore: Math.round(Math.max(-100, Math.min(100, avgAuthoritarian))),
          confidence,
          reasoning: `Fallback analysis based on ${opinionsWithScores.length} opinions with political scores`,
          quadrant: 'centrist'
        };
      }

      // No scores available - return neutral
      return {
        economicScore: 0,
        authoritarianScore: 0,
        confidence,
        reasoning: `Fallback analysis based on ${opinions.length} opinions (no political scores available)`,
        quadrant: 'centrist'
      };
    }
  }

  /**
   * Analyze the political stance of a single opinion
   * Returns economic and authoritarian scores from -100 to +100
   * @param opinionContent - The text content of the opinion
   * @param topicTitle - The title of the topic being discussed
   */
  static async analyzeOpinionPoliticalStance(
    opinionContent: string,
    topicTitle: string,
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

NOTE: -100 = economic Liberal (more government in the economy / socialist), +100 = economic Conservative (free markets / capitalist). On the standard Political Compass this is Liberal on the left side and Conservative on the right side. Any label you write for a person must use Liberal or Conservative, never Left or Right.

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

    // Never store made-up neutral scores: callers leave the opinion unscored so it is retried later.
    if (!openai) throw new Error('OpenAI not configured (OPENAI_API_KEY missing)');

    try {
      const completion = await openai.chat.completions.create({
        ...chatParams({ maxTokens: 200, temperature: 0.3, json: true }),
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
      });

      const responseContent = completion.choices[0]?.message?.content;
      
      if (!responseContent) {
        throw new Error("Empty response from OpenAI");
      }

      // Extract JSON from response (GPT-5 might wrap it in markdown code blocks)
      let jsonText = responseContent.trim();
      const jsonMatch = jsonText.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
      if (jsonMatch) {
        jsonText = jsonMatch[1];
      } else if (!jsonText.startsWith('{')) {
        // Try to find JSON object in the response
        const objectMatch = jsonText.match(/\{[\s\S]*?\}/);
        if (objectMatch) {
          jsonText = objectMatch[0];
        }
      }

      const aiAnalysis = JSON.parse(jsonText);
      const economicScore = Math.max(-100, Math.min(100, aiAnalysis.economicScore || 0));
      const authoritarianScore = Math.max(-100, Math.min(100, aiAnalysis.authoritarianScore || 0));

      return {
        economicScore: Math.round(economicScore),
        authoritarianScore: Math.round(authoritarianScore)
      };

    } catch (error) {
      const msg = recordAIFailure(error);
      console.error(`[Opinion Analysis] OpenAI call failed: ${msg}`);
      throw new Error(`AI scoring failed: ${msg}`);
    }
  }

  /**
   * Batch analyze multiple opinions for political stance
   * More efficient than analyzing individually - processes up to 50 opinions in a single API call
   * @param topic - The topic these opinions are about
   * @param opinions - Array of opinions with id and content
   * @returns Array of analysis results with opinionId, economicScore, and authoritarianScore
   */
  static async batchAnalyzeOpinions(
    topic: Topic,
    opinions: Array<{ id: string; content: string }>
  ): Promise<Array<{ opinionId: string; economicScore: number; authoritarianScore: number }>> {
    // Never store made-up neutral scores: on failure the opinions stay unscored and are retried next run.
    if (!openai) throw new Error('OpenAI not configured (OPENAI_API_KEY missing)');

    if (opinions.length === 0) {
      return [];
    }

    try {
      // Build prompt with all opinions
      const opinionsList = opinions.map((o, idx) => 
        `Opinion ${idx + 1} (ID: ${o.id}):\n"${o.content}"`
      ).join('\n\n');

      const prompt = `
Analyze the following opinions on the topic "${topic.title}" and determine each opinion's political position on a 2-dimensional political compass.

${opinionsList}

For each opinion, provide analysis in the following JSON format:
{
  "opinions": [
    {"opinionId": "uuid-1", "economicScore": -50, "authoritarianScore": 25},
    {"opinionId": "uuid-2", "economicScore": 30, "authoritarianScore": -20}
  ]
}

ECONOMIC AXIS (-100 to +100):
-100 to -51: Very Socialist (strong wealth redistribution, extensive government control of economy, anti-capitalist)
-50 to -21: Socialist (supports wealth redistribution, market regulation, public ownership of key industries)
-20 to +20: Mixed Economy (balanced approach, regulated capitalism, some social programs)
+21 to +50: Capitalist (free market preference, limited regulation, private enterprise focus)
+51 to +100: Very Capitalist (minimal government intervention, pure free market, strong private property rights)

NOTE: -100 = economic Liberal (more government in the economy / socialist), +100 = economic Conservative (free markets / capitalist). On the standard Political Compass this is Liberal on the left side and Conservative on the right side. Any label you write for a person must use Liberal or Conservative, never Left or Right.

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

Return only valid JSON with an "opinions" array containing all results.`;

      console.log(`[Batch Opinion Analysis] Analyzing ${opinions.length} opinions using batch API`);
      
      const completion = await openai.chat.completions.create({
        ...chatParams({ maxTokens: 2000, temperature: 0.3, json: true }),
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
      });

      const responseContent = completion.choices[0]?.message?.content;
      
      if (!responseContent) {
        throw new Error("Empty response from OpenAI");
      }

      // Parse JSON response
      let jsonText = responseContent.trim();
      const jsonMatch = jsonText.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
      if (jsonMatch) {
        jsonText = jsonMatch[1];
      }

      const aiAnalysis = JSON.parse(jsonText);
      const results = aiAnalysis.opinions || [];

      // Map results back to opinion IDs and clamp scores
      const analysisMap = new Map<string, { economicScore: number; authoritarianScore: number }>();
      
      for (const result of results) {
        const economicScore = Math.max(-100, Math.min(100, result.economicScore || 0));
        const authoritarianScore = Math.max(-100, Math.min(100, result.authoritarianScore || 0));
        
        analysisMap.set(result.opinionId, {
          economicScore: Math.round(economicScore),
          authoritarianScore: Math.round(authoritarianScore)
        });
      }

      // Only return opinions the model actually scored; any it skipped stay unscored for the next run.
      return opinions
        .filter(opinion => analysisMap.has(opinion.id))
        .map(opinion => ({ opinionId: opinion.id, ...analysisMap.get(opinion.id)! }));

    } catch (error) {
      const msg = recordAIFailure(error);
      console.error(`[Batch Opinion Analysis] OpenAI call failed: ${msg}`);
      throw new Error(`AI scoring failed: ${msg}`);
    }
  }

  /**
   * Generate embedding vector for text using OpenAI's text-embedding-3-small model
   * Returns a 1536-dimension vector for semantic similarity search
   */
  static async generateEmbedding(text: string): Promise<number[]> {
    if (!openai) {
      throw new Error("OpenAI API key not configured. Set OPENAI_API_KEY environment variable.");
    }

    try {
      const response = await openai.embeddings.create({
        model: EMBEDDING_MODEL,
        input: text.trim(),
        encoding_format: "float"
      });

      return response.data[0].embedding;
    } catch (error) {
      console.error("Error generating embedding:", error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to generate embedding: ${errorMessage}`);
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