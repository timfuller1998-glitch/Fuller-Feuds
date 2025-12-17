import OpenAI from 'openai';
import { AIService } from '../aiService';

export type EmotionalIntensity = 'passionate' | 'measured' | 'analytical' | 'personal';

export interface TransformedOpinion {
  content: string;
  stance: 'for' | 'against' | 'nuanced';
  intensity: EmotionalIntensity;
  originalAuthor: string;
}

const intensityGuidance = {
  passionate: "Write with strong conviction and emotional appeal. Use emphatic language like 'absolutely', 'crucial', 'fundamental'. Show you care deeply.",
  measured: "Write in a balanced, thoughtful tone. Acknowledge complexity and opposing views while stating your position. Use hedging language where appropriate.",
  analytical: "Write in a logical, evidence-focused style. Structure arguments clearly, reference data or studies where relevant, minimize emotional language.",
  personal: "Write from personal experience. Include specific anecdotes, describe how this affects real people, make it relatable and human."
};

// Get OpenAI client (same pattern as AIService)
const openai = process.env.OPENAI_API_KEY ? new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
}) : null;

export class ContentTransformer {
  
  /**
   * Convert opinionated Reddit title to neutral debate topic
   * Example: "CMV: Universal healthcare is a human right" -> "Universal Healthcare"
   */
  static async extractNeutralTopic(redditTitle: string): Promise<string> {
    if (!openai) {
      console.log('OpenAI not configured - using fallback topic extraction');
      return redditTitle
        .replace(/^(CMV:|Change my view:|Unpopular opinion:|UO:|AITA|WIBTA|NTA|YTA)\s*/gi, '')
        .replace(/^\[.*?\]\s*/g, '')
        .trim();
    }

    const prompt = `Convert this opinionated statement into a neutral debate topic title.

Opinionated: "${redditTitle}"

Rules:
- Remove personal opinion ("I think", "is bad", "should be")
- Keep it concise (3-8 words)
- Frame as a noun phrase or neutral question
- No Reddit prefixes (CMV:, Unpopular opinion:, AITA, etc.)

Examples:
- "CMV: Universal healthcare is a human right" -> "Universal Healthcare"
- "I think the drinking age should be lowered" -> "The Legal Drinking Age"
- "AITA for not tipping?" -> "Tipping Culture"
- "Unpopular opinion: Remote work is killing company culture" -> "Remote Work and Company Culture"

Return ONLY the neutral topic title, nothing else.`;

    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are a debate topic extraction expert. Extract neutral, debatable topics from opinionated statements. Always respond with only the topic title, nothing else."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 50
      });

      const responseContent = completion.choices[0]?.message?.content?.trim();
      if (!responseContent) {
        throw new Error("No response from OpenAI");
      }

      // Clean up any quotes or extra formatting
      return responseContent.replace(/^["']|["']$/g, '').trim();
    } catch (error) {
      console.error("Error extracting neutral topic:", error);
      // Fallback: basic cleaning
      return redditTitle
        .replace(/^(CMV:|Change my view:|Unpopular opinion:|UO:|AITA|WIBTA|NTA|YTA)\s*/gi, '')
        .replace(/^\[.*?\]\s*/g, '')
        .trim();
    }
  }

  /**
   * Transform Reddit comment into debate-style argument
   */
  static async transformToDebateArgument(
    comment: string,
    topicTitle: string,
    intensity: EmotionalIntensity
  ): Promise<{ content: string; stance: 'for' | 'against' | 'nuanced' }> {
    if (!openai) {
      console.log('OpenAI not configured - using fallback transformation');
      const cleaned = this.basicClean(comment);
      return {
        content: cleaned,
        stance: 'nuanced'
      };
    }

    const prompt = `Transform this Reddit comment into a well-structured debate argument.

Topic: "${topicTitle}"
Original: "${comment}"
Tone: ${intensityGuidance[intensity]}

Requirements:
1. Determine stance: FOR, AGAINST, or NUANCED
2. Rewrite as 2-4 paragraph argument
3. Remove Reddit language (NTA, EDIT, /u/, /r/, etc.)
4. Match the requested emotional tone
5. Write in first person as original thought
6. Keep the core reasoning and any good points

Return JSON only:
{
  "content": "The rewritten argument...",
  "stance": "for" | "against" | "nuanced"
}`;

    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are a debate argument transformation expert. Transform casual Reddit comments into well-structured debate arguments. Always respond with valid JSON only."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.7,
        max_tokens: 800
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
        content: aiAnalysis.content || comment,
        stance: aiAnalysis.stance || 'nuanced'
      };
    } catch (error) {
      console.error("Error transforming debate argument:", error);
      // Fallback: return cleaned original
      const cleaned = this.basicClean(comment);
      return {
        content: cleaned,
        stance: 'nuanced'
      };
    }
  }

  /**
   * Assign varied emotional intensities across a batch
   */
  static assignIntensities(count: number): EmotionalIntensity[] {
    const intensities: EmotionalIntensity[] = [];
    
    // Distribution: 20% passionate, 35% measured, 25% analytical, 20% personal
    for (let i = 0; i < count; i++) {
      const rand = Math.random();
      if (rand < 0.2) {
        intensities.push('passionate');
      } else if (rand < 0.55) {
        intensities.push('measured');
      } else if (rand < 0.8) {
        intensities.push('analytical');
      } else {
        intensities.push('personal');
      }
    }
    
    return intensities;
  }

  /**
   * Generate realistic name from Reddit username
   */
  static generateNameFromUsername(username: string): { firstName: string; lastName: string | null } {
    // Skip bot/deleted accounts
    if (username === '[deleted]' || username.includes('bot') || username.includes('Bot')) {
      return { firstName: this.randomFirstName(), lastName: null };
    }
    
    // Try to extract name-like patterns
    const nameParts = username
      .replace(/[_\-\d]+/g, ' ')  // Replace separators and numbers with spaces
      .replace(/([a-z])([A-Z])/g, '$1 $2')  // Split camelCase
      .trim()
      .split(' ')
      .filter(p => p.length > 1);
    
    if (nameParts.length >= 2) {
      return {
        firstName: this.capitalize(nameParts[0]),
        lastName: this.capitalize(nameParts[1])
      };
    } else if (nameParts.length === 1 && nameParts[0].length > 2) {
      return { firstName: this.capitalize(nameParts[0]), lastName: null };
    }
    
    // Fallback to random name
    return { firstName: this.randomFirstName(), lastName: null };
  }

  private static capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  }

  private static randomFirstName(): string {
    const names = ['Alex', 'Jordan', 'Taylor', 'Morgan', 'Casey', 'Riley', 
                   'Quinn', 'Avery', 'Cameron', 'Jamie', 'Drew', 'Skyler'];
    return names[Math.floor(Math.random() * names.length)];
  }

  /**
   * Generate diverse opinions for a topic from scratch
   * Returns array of unique opinions with varied stances and intensities
   */
  static async generateOpinions(
    topicTitle: string,
    count: number
  ): Promise<Array<{
    content: string;
    stance: 'for' | 'against' | 'nuanced';
    intensity: EmotionalIntensity;
    authorName: string;
  }>> {
    if (!openai) {
      console.log('OpenAI not configured - cannot generate opinions');
      throw new Error('OpenAI API key required for opinion generation');
    }

    // Calculate stance distribution: ~40% for, ~40% against, ~20% nuanced
    const forCount = Math.round(count * 0.4);
    const againstCount = Math.round(count * 0.4);
    const nuancedCount = count - forCount - againstCount;

    const prompt = `Generate exactly ${count} diverse, unique opinions on the topic: "${topicTitle}"

Requirements:
1. Stance distribution: ${forCount} FOR, ${againstCount} AGAINST, ${nuancedCount} NUANCED
2. Vary emotional tones across opinions: passionate, measured, analytical, personal
3. Each opinion should be 2-4 paragraphs, well-structured and thoughtful
4. Make each opinion unique with different arguments and perspectives
5. Include diverse viewpoints and reasoning styles
6. Generate realistic author names (first name only or first + last)

Return JSON array with exactly ${count} items:
{
  "opinions": [
    {
      "content": "Full opinion text (2-4 paragraphs)...",
      "stance": "for|against|nuanced",
      "intensity": "passionate|measured|analytical|personal",
      "authorName": "First Last" or "First"
    },
    ...
  ]
}`;

    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are an expert at generating diverse, well-reasoned debate opinions. Create unique perspectives with varied stances and emotional tones. Always respond with valid JSON only."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.8, // Higher temperature for more diversity
        max_tokens: Math.min(4000, count * 400), // ~400 tokens per opinion
      });

      const responseContent = completion.choices[0]?.message?.content;
      if (!responseContent) {
        throw new Error("No response from OpenAI");
      }

      let aiResponse;
      try {
        aiResponse = JSON.parse(responseContent);
      } catch (parseError) {
        console.error("Failed to parse AI response:", responseContent);
        throw new Error("Invalid AI response format");
      }

      const opinions = aiResponse.opinions || [];
      
      // Validate we got the right count
      if (opinions.length !== count) {
        console.warn(`Expected ${count} opinions, got ${opinions.length}`);
      }

      // Ensure each opinion has required fields
      return opinions.map((op: any) => ({
        content: op.content || 'No content generated',
        stance: (op.stance === 'for' || op.stance === 'against' || op.stance === 'nuanced') 
          ? op.stance 
          : 'nuanced',
        intensity: (['passionate', 'measured', 'analytical', 'personal'].includes(op.intensity))
          ? op.intensity
          : this.assignIntensities(1)[0],
        authorName: op.authorName || 'Alex',
      }));
    } catch (error) {
      console.error("Error generating opinions:", error);
      throw error;
    }
  }

  private static basicClean(text: string): string {
    return text
      .replace(/EDIT\s*\d*:.*?(?=\n\n|$)/gi, '')
      .replace(/Edit:.*?(?=\n\n|$)/gi, '')
      .replace(/!delta/gi, '')
      .replace(/\/u\/\w+/g, 'another user')
      .replace(/\/r\/\w+/g, 'another community')
      .replace(/TL;?DR:?.*?(?=\n\n|$)/gi, '')
      .replace(/Thanks for the (gold|silver|platinum|award).*?(?=\n\n|$)/gi, '')
      .replace(/\*\*/g, '')
      .replace(/\*/g, '')
      .replace(/~~.*?~~/g, '')
      .replace(/&gt;/g, '')
      .replace(/&#x200B;/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }
}

