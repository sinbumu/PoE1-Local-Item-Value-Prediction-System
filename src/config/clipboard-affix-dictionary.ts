import generatedEnglishAffixDictionary from "../generated/affix-dictionary/affix_dictionary_en.generated.json";
import type { ClipboardLocale } from "../types/clipboard.types";
import type {
  ClipboardAffixKind,
  EnglishAffixDictionaryEntry,
} from "../types/affix-dictionary.types";

export type ClipboardAffixMatch = {
  entry: ClipboardAffixDictionaryEntry;
  matchedPattern: string;
  matchingMethod: "normalized_exact";
};

export type ClipboardAffixDictionaryEntry = EnglishAffixDictionaryEntry;

export const CLIPBOARD_AFFIX_DICTIONARY =
  generatedEnglishAffixDictionary as ClipboardAffixDictionaryEntry[];

export function normalizeClipboardModLine(line: string): string {
  return line
    .replace(/\{[^}]*\}/g, " ")
    .replace(/\([^)]*\)/g, " ")
    .replace(/[+-]?\d+(?:\.\d+)?(?:\s*-\s*[+-]?\d+(?:\.\d+)?)?/g, "#")
    .replace(/\{[0-9]+\}/g, "#")
    .replace(/\([^)]*\)/g, "")
    .replace(/\s*\/\s*/g, "/")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function matchEnglishDictionary(line: string): ClipboardAffixMatch | null {
  const normalizedLine = normalizeClipboardModLine(line);

  for (const entry of CLIPBOARD_AFFIX_DICTIONARY) {
    for (const pattern of entry.normalizedTextTemplatesEn) {
      if (normalizedLine === pattern) {
        return {
          entry,
          matchedPattern: pattern,
          matchingMethod: "normalized_exact",
        };
      }
    }
  }

  return null;
}

export function isEnglishAffixDictionaryAvailable(): boolean {
  return CLIPBOARD_AFFIX_DICTIONARY.length > 0;
}

export function getClipboardAffixKinds(): ClipboardAffixKind[] {
  return ["prefix", "suffix"];
}

export function matchClipboardAffixDictionary(
  line: string,
  locale: Exclude<ClipboardLocale, "unknown">,
): ClipboardAffixMatch | null {
  if (locale !== "en") {
    return null;
  }

  return matchEnglishDictionary(line);
}
