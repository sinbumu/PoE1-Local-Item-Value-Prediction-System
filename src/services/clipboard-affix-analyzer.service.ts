import {
  matchClipboardAffixDictionary,
  normalizeClipboardModLine,
} from "../config/clipboard-affix-dictionary";
import type { ClipboardParsedItem, ClipboardSection, ClipboardSectionKind } from "../types/clipboard.types";
import type { ClipboardAffixAnalysisLine } from "../types/affix-dictionary.types";

const LINE_PREFIX_REJECTIONS = [
  "Item Class:",
  "Rarity:",
  "Requirements:",
  "Sockets:",
  "Item Level:",
  "Quality:",
  "Armour:",
  "Evasion Rating:",
  "Energy Shield:",
  "Ward:",
  "Level:",
  "Str:",
  "Dex:",
  "Int:",
  "Experience:",
  "Radius:",
  "Limited to:",
  "Cost & Reservation Multiplier:",
  "Mana Cost:",
  "Critical Strike Chance:",
  "Attacks per Second:",
  "Physical Damage:",
  "Elemental Damage:",
];

const LINE_EXACT_REJECTIONS = new Set(["Corrupted", "Fractured Item"]);

const SENTENCE_REJECTIONS = [
  "Right click",
  "Place into an allocated",
  "This is a Support Gem",
  "Supports any skill gem",
  "Added passives do not interact",
  "Place into an item socket",
];

function startsWithAny(line: string, prefixes: string[]): boolean {
  return prefixes.some((prefix) => line.startsWith(prefix));
}

function includesAny(line: string, needles: string[]): boolean {
  return needles.some((needle) => line.includes(needle));
}

function looksLikeModLine(line: string, sectionKind: ClipboardSectionKind): boolean {
  if (line.trim().length === 0) {
    return false;
  }

  if (LINE_EXACT_REJECTIONS.has(line)) {
    return false;
  }

  if (startsWithAny(line, LINE_PREFIX_REJECTIONS)) {
    return false;
  }

  if (includesAny(line, SENTENCE_REJECTIONS)) {
    return false;
  }

  if (line.endsWith(".")) {
    return false;
  }

  if (sectionKind === "crafted_mods" || sectionKind === "fractured_mods" || sectionKind === "enchant_mods") {
    return true;
  }

  return (
    /\d/.test(line) ||
    line.startsWith("+") ||
    /adds|gain|increased|reduced|chance|resistance|damage|shield|armour|evasion|life|mana|accuracy|speed|level|critical|projectile|curse|charge/i.test(
      line,
    )
  );
}

function eligibleSections(sections: ClipboardSection[]): ClipboardSection[] {
  return sections.filter((section) =>
    ["unknown", "crafted_mods", "fractured_mods", "enchant_mods"].includes(section.kind),
  );
}

export class ClipboardAffixAnalyzerService {
  extractExplicitCandidateLines(parsed: ClipboardParsedItem): ClipboardAffixAnalysisLine[] {
    if (parsed.locale !== "en") {
      return [];
    }

    return eligibleSections(parsed.sections).flatMap((section) =>
      section.lines
        .filter((line) => looksLikeModLine(line, section.kind))
        .map((line) => {
          const match = matchClipboardAffixDictionary(line, "en");
          return {
            line,
            normalizedLine: normalizeClipboardModLine(line),
            sectionKind: section.kind,
            matchedCanonicalModId: match?.entry.canonicalModId ?? null,
            matchedAffixKind: match?.entry.affixKind ?? null,
          };
        }),
    );
  }
}
