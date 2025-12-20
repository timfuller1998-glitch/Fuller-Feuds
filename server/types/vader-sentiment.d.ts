declare module 'vader-sentiment' {
  export interface SentimentResult {
    neg: number;
    neu: number;
    pos: number;
    compound: number;
  }

  export class SentimentIntensityAnalyzer {
    static polarity_scores(text: string): SentimentResult;
  }
}
