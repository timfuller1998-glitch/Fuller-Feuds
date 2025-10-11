import { db } from "../db";
import { bannedPhrases } from "@shared/schema";

export interface ContentFilterResult {
  isAllowed: boolean;
  shouldFlag: boolean;
  matchedPhrase?: string;
  severity?: string;
}

export async function validateContent(text: string): Promise<ContentFilterResult> {
  if (!text || text.trim().length === 0) {
    return { isAllowed: true, shouldFlag: false };
  }

  const allBannedPhrases = await db.select().from(bannedPhrases);
  
  const textLower = text.toLowerCase();
  
  for (const bannedPhrase of allBannedPhrases) {
    const phraseLower = bannedPhrase.phrase.toLowerCase();
    let isMatch = false;
    
    if (bannedPhrase.matchType === 'whole_word') {
      const regex = new RegExp(`\\b${escapeRegex(phraseLower)}\\b`, 'i');
      isMatch = regex.test(textLower);
    } else {
      isMatch = textLower.includes(phraseLower);
    }
    
    if (isMatch) {
      if (bannedPhrase.severity === 'block') {
        return {
          isAllowed: false,
          shouldFlag: false,
          matchedPhrase: bannedPhrase.phrase,
          severity: bannedPhrase.severity
        };
      } else if (bannedPhrase.severity === 'flag') {
        return {
          isAllowed: true,
          shouldFlag: true,
          matchedPhrase: bannedPhrase.phrase,
          severity: bannedPhrase.severity
        };
      }
    }
  }
  
  return { isAllowed: true, shouldFlag: false };
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
