import { SentimentIntensityAnalyzer } from 'vader-sentiment';

/**
 * Lexicon-based analysis service for instant opinion scoring
 * Uses VADER for taste (sentiment) and rule-based patterns for passion
 */
export class LexiconAnalysisService {
  
  // Hedges - indicate academic/measured tone
  private hedges = new Set([
    'perhaps', 'possibly', 'might', 'maybe', 'arguably', 'suggests', 
    'indicates', 'seems', 'appears', 'likely', 'probably', 'presumably',
    'supposedly', 'allegedly', 'reportedly', 'apparently'
  ]);
  
  // Boosters - indicate strong conviction
  private boosters = new Set([
    'absolutely', 'definitely', 'certainly', 'clearly', 'obviously', 
    'completely', 'totally', 'utterly', 'entirely', 'undoubtedly',
    'unquestionably', 'indisputably', 'undeniably', 'absolutely'
  ]);
  
  // Aggressive patterns - profanity and insults
  private aggressivePatterns = [
    /\b(fuck|shit|damn|hell|ass|bitch|bastard|crap)\w*/gi,
    /\b(idiot|moron|stupid|dumb|fool|jerk|loser)\w*/gi,
  ];
  
  /**
   * Analyze opinion text for taste (sentiment) and passion (intensity)
   * Returns scores from -100 to +100 for both dimensions
   */
  analyzeOpinionLocally(text: string): {
    taste: { score: number; label: string };
    passion: { score: number; label: string };
    confidence: 'high' | 'medium' | 'low';
  } {
    // 1. Taste analysis using VADER sentiment
    const tasteScore = this.analyzeTaste(text);
    
    // 2. Passion analysis using rule-based patterns
    const passionScore = this.analyzePassion(text);
    
    // 3. Determine confidence based on text characteristics
    const confidence = this.determineConfidence(text, tasteScore, passionScore);
    
    return {
      taste: {
        score: tasteScore,
        label: this.getTasteLabel(tasteScore)
      },
      passion: {
        score: passionScore,
        label: this.getPassionLabel(passionScore)
      },
      confidence
    };
  }
  
  /**
   * Analyze taste using VADER sentiment analysis
   * Maps sentiment compound score (-1 to +1) to taste score (-100 to +100)
   */
  private analyzeTaste(text: string): number {
    const result = SentimentIntensityAnalyzer.polarity_scores(text);
    const compound = result.compound || 0;
    
    // Map VADER compound score (-1 to +1) to taste score (-100 to +100)
    // Negative sentiment = revulsion, positive = delight
    const tasteScore = Math.round(compound * 100);
    
    // Clamp to -100 to +100
    return Math.max(-100, Math.min(100, tasteScore));
  }
  
  /**
   * Analyze passion using rule-based patterns
   * Combines multiple signals: hedges, boosters, caps, exclamations, aggressive language
   */
  private analyzePassion(text: string): number {
    const words = text.toLowerCase().split(/\s+/);
    let passionScore = 0;
    
    // Count hedges (reduce passion - more academic)
    const hedgeCount = words.filter(w => this.hedges.has(w)).length;
    passionScore -= hedgeCount * 15; // Each hedge reduces passion
    
    // Count boosters (increase passion - more conviction)
    const boosterCount = words.filter(w => this.boosters.has(w)).length;
    passionScore += boosterCount * 20; // Each booster increases passion
    
    // Check for ALL CAPS (high passion indicator)
    const capsWords = text.match(/\b[A-Z]{3,}\b/g) || [];
    passionScore += capsWords.length * 25;
    
    // Count exclamation marks (passion indicator)
    const exclamationCount = (text.match(/!/g) || []).length;
    passionScore += Math.min(exclamationCount * 10, 30); // Cap at 30 for exclamations
    
    // Check for aggressive language (high passion, negative)
    let aggressiveCount = 0;
    for (const pattern of this.aggressivePatterns) {
      const matches = text.match(pattern);
      if (matches) aggressiveCount += matches.length;
    }
    passionScore += aggressiveCount * 30; // Aggressive language = high passion
    
    // Check for question marks (reduces passion - more exploratory)
    const questionCount = (text.match(/\?/g) || []).length;
    passionScore -= Math.min(questionCount * 5, 15);
    
    // Normalize to -100 to +100 range
    // Academic/measured = negative, passionate/aggressive = positive
    passionScore = Math.max(-100, Math.min(100, passionScore));
    
    return Math.round(passionScore);
  }
  
  /**
   * Determine confidence level based on text characteristics
   */
  private determineConfidence(
    text: string, 
    tasteScore: number, 
    passionScore: number
  ): 'high' | 'medium' | 'low' {
    const wordCount = text.split(/\s+/).length;
    
    // High confidence: longer text with clear signals
    if (wordCount > 50 && (Math.abs(tasteScore) > 30 || Math.abs(passionScore) > 30)) {
      return 'high';
    }
    
    // Low confidence: very short text or neutral scores
    if (wordCount < 10 || (Math.abs(tasteScore) < 10 && Math.abs(passionScore) < 10)) {
      return 'low';
    }
    
    return 'medium';
  }
  
  /**
   * Get taste label from score
   */
  private getTasteLabel(score: number): string {
    if (score < -50) return 'revulsion';
    if (score < -20) return 'aversion';
    if (score <= 20) return 'neutral';
    if (score <= 50) return 'preference';
    return 'delight';
  }
  
  /**
   * Get passion label from score
   */
  private getPassionLabel(score: number): string {
    if (score < -50) return 'academic';
    if (score < -20) return 'measured';
    if (score <= 20) return 'moderate';
    if (score <= 50) return 'passionate';
    return 'aggressive';
  }
}

// Export singleton instance
export const lexiconAnalysisService = new LexiconAnalysisService();

