import type { ClipboardLocale } from "../types/clipboard.types";

export type ClipboardAffixKind = "prefix" | "suffix";

export type ClipboardAffixDictionaryEntry = {
  id: string;
  affixKind: ClipboardAffixKind;
  englishPatterns: string[];
  koreanPatterns: string[];
  notes?: string;
};

export type ClipboardAffixMatch = {
  entry: ClipboardAffixDictionaryEntry;
  matchedPattern: string;
};

// This starts intentionally small. The first implementation goal is to
// stabilize the schema and matching flow so real rules can be filled from
// clipboard samples and later from external game data.
export const CLIPBOARD_AFFIX_DICTIONARY: ClipboardAffixDictionaryEntry[] = [];

function normalizeClipboardModLine(line: string): string {
  return line
    .toLowerCase()
    .replace(/\([^)]*\)/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function matchClipboardAffixDictionary(
  line: string,
  locale: Exclude<ClipboardLocale, "unknown">,
): ClipboardAffixMatch | null {
  const normalizedLine = normalizeClipboardModLine(line);

  for (const entry of CLIPBOARD_AFFIX_DICTIONARY) {
    const patterns = locale === "en" ? entry.englishPatterns : entry.koreanPatterns;
    for (const pattern of patterns) {
      if (normalizedLine.includes(normalizeClipboardModLine(pattern))) {
        return {
          entry,
          matchedPattern: pattern,
        };
      }
    }
  }

  return null;
}
