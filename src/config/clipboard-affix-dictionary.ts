import generatedEnglishAffixDictionary from "../generated/affix-dictionary/affix_dictionary_en.generated.json";
import type { ClipboardLocale } from "../types/clipboard.types";
import type {
  ClipboardAffixKind,
  EnglishAffixDictionaryEntry,
} from "../types/affix-dictionary.types";

export type ClipboardAffixMatch = {
  entries: ClipboardAffixDictionaryEntry[];
  matchedPattern: string;
  matchingMethod: "normalized_exact";
  isAmbiguous: boolean;
};

export type ClipboardAffixDictionaryEntry = EnglishAffixDictionaryEntry;

export const CLIPBOARD_AFFIX_DICTIONARY =
  generatedEnglishAffixDictionary as ClipboardAffixDictionaryEntry[];

const ENGLISH_AFFIX_DICTIONARY_INDEX = CLIPBOARD_AFFIX_DICTIONARY.reduce<
  Map<string, ClipboardAffixDictionaryEntry[]>
>((index, entry) => {
  for (const pattern of entry.normalizedTextTemplatesEn) {
    const existingEntries = index.get(pattern) ?? [];
    existingEntries.push(entry);
    index.set(pattern, existingEntries);
  }

  return index;
}, new Map());

export function normalizeClipboardModLine(line: string): string {
  return line
    .replace(/\{[^}]*\}/g, " ")
    .replace(/\(\s*[+-]?\d+(?:\.\d+)?\s*-\s*[+-]?\d+(?:\.\d+)?\s*\)/g, "#")
    .replace(/\(\s*[+-]?\d+(?:\.\d+)?\s*\)/g, "#")
    .replace(/\((implicit|enchant|crafted|fractured)\)/gi, " ")
    .replace(/\([^)]*\)/g, " ")
    .replace(/[+-]?\d+(?:\.\d+)?(?:\s*-\s*[+-]?\d+(?:\.\d+)?)?/g, "#")
    .replace(/\{[0-9]+\}/g, "#")
    .replace(/\(\s*#(?:\s*-\s*#)?\s*\)/g, "#")
    .replace(/\+\s*#/g, "#")
    .replace(/\s*\/\s*/g, "/")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function matchEnglishDictionary(line: string): ClipboardAffixMatch | null {
  const normalizedLine = normalizeClipboardModLine(line);
  const entries = ENGLISH_AFFIX_DICTIONARY_INDEX.get(normalizedLine);

  if (!entries || entries.length === 0) {
    return null;
  }

  return {
    entries,
    matchedPattern: normalizedLine,
    matchingMethod: "normalized_exact",
    isAmbiguous: entries.length > 1,
  };
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
