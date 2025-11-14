import { GLOBAL_FORBIDDEN } from './constants.ts';

export interface FilterResult {
  cleanedText: string;
  replacements: Array<{
    original: string;
    replacement: string;
    position: number;
  }>;
  warnings: string[];
}

/**
 * Filter forbidden terms from user text and replace with alternatives
 */
export function filterForbiddenTerms(userText: string): FilterResult {
  let cleanedText = userText;
  const replacements: FilterResult['replacements'] = [];
  const warnings: string[] = [];

  // Process each forbidden term
  for (const forbiddenItem of GLOBAL_FORBIDDEN) {
    const regex = new RegExp(`\\b${forbiddenItem.keyword}\\b`, 'gi');
    const matches = Array.from(userText.matchAll(regex));

    for (const match of matches) {
      if (match.index !== undefined) {
        // Select random alternative
        const alternative = forbiddenItem.alternatives[
          Math.floor(Math.random() * forbiddenItem.alternatives.length)
        ];

        // Replace in cleaned text
        cleanedText = cleanedText.replace(
          new RegExp(`\\b${forbiddenItem.keyword}\\b`, 'i'),
          alternative
        );

        replacements.push({
          original: match[0],
          replacement: alternative,
          position: match.index,
        });

        warnings.push(
          `Replaced trademarked term "${match[0]}" with "${alternative}" to comply with IP regulations`
        );
      }
    }
  }

  return {
    cleanedText,
    replacements,
    warnings,
  };
}

/**
 * Check if text contains any forbidden terms without replacing
 */
export function containsForbiddenTerms(text: string): boolean {
  const lowerText = text.toLowerCase();
  return GLOBAL_FORBIDDEN.some(item => 
    lowerText.includes(item.keyword.toLowerCase())
  );
}

/**
 * Get list of forbidden terms found in text
 */
export function detectForbiddenTerms(text: string): string[] {
  const lowerText = text.toLowerCase();
  return GLOBAL_FORBIDDEN
    .filter(item => lowerText.includes(item.keyword.toLowerCase()))
    .map(item => item.keyword);
}
