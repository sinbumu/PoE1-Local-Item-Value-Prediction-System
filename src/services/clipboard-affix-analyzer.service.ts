import {
  type ClipboardAffixDictionaryEntry,
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

const TRAILING_SCOPE_MARKERS = ["(implicit)", "(enchant)"];
const JEWEL_MARKERS = ["jewel"];
const ARMOUR_SLOT_CLASSES = new Set(["gloves", "boots", "helmets", "body armours", "shields"]);

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

  if (TRAILING_SCOPE_MARKERS.some((marker) => line.endsWith(marker))) {
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

function extractObservedValues(line: string): number[] {
  const sanitized = line.replace(/\((crafted|fractured|implicit|enchant)\)/gi, " ");
  const matches = sanitized.match(/[+-]?\d+(?:\.\d+)?/g) ?? [];
  return matches.map((value) => Number(value)).filter((value) => Number.isFinite(value));
}

function looksLikeJewelEntry(entry: ClipboardAffixDictionaryEntry): boolean {
  const searchable = [
    entry.domain,
    entry.modType ?? "",
    entry.sourceModId,
    ...entry.groups,
    ...entry.addsTags,
    ...entry.allowedTags,
  ]
    .join(" ")
    .toLowerCase();

  return JEWEL_MARKERS.some((marker) => searchable.includes(marker)) || entry.domain === "misc";
}

function isJewelContext(parsed: ClipboardParsedItem): boolean {
  const searchable = `${parsed.itemClass ?? ""} ${parsed.baseType ?? ""}`.toLowerCase();
  return searchable.includes("jewel");
}

function isAbyssJewelContext(parsed: ClipboardParsedItem): boolean {
  const searchable = `${parsed.itemClass ?? ""} ${parsed.baseType ?? ""}`.toLowerCase();
  return searchable.includes("abyss");
}

function inferContextTags(parsed: ClipboardParsedItem): string[] {
  const itemClass = (parsed.itemClass ?? "").toLowerCase();

  if (itemClass === "wands") {
    return ["wand", "one_hand_weapon"];
  }
  if (itemClass === "shields") {
    return ["shield", "shield_mod"];
  }
  if (itemClass === "gloves") {
    return ["gloves", "armour"];
  }
  if (itemClass === "boots") {
    return ["boots", "armour"];
  }
  if (itemClass === "helmets") {
    return ["helmet", "armour"];
  }
  if (itemClass === "body armours") {
    return ["body_armour", "armour"];
  }
  if (itemClass === "jewels") {
    return ["jewel"];
  }

  return [];
}

function isDefenceLine(line: string): boolean {
  return /armour|evasion|energy shield/i.test(line);
}

function isAccuracyLine(line: string): boolean {
  return /accuracy/i.test(line);
}

function looksLocal(entry: ClipboardAffixDictionaryEntry): boolean {
  const searchable = `${entry.sourceModId} ${entry.modType ?? ""}`.toLowerCase();
  return searchable.includes("local");
}

function overlapsContextTags(entry: ClipboardAffixDictionaryEntry, contextTags: string[]): boolean {
  if (contextTags.length === 0) {
    return false;
  }

  const entryTags = [...entry.addsTags, ...entry.allowedTags].map((tag) => tag.toLowerCase());
  return entryTags.some((tag) => contextTags.includes(tag));
}

function isWeaponItemClass(itemClass: string): boolean {
  return /wands|bows|swords|axes|maces|daggers|claws|staves|staff|warstaves/i.test(itemClass);
}

function entrySearchableText(entry: ClipboardAffixDictionaryEntry): string {
  return [
    entry.sourceModId,
    entry.modType ?? "",
    ...entry.groups,
    ...entry.addsTags,
    ...entry.allowedTags,
  ]
    .join(" ")
    .toLowerCase();
}

function inferForbiddenKeywords(parsed: ClipboardParsedItem): string[] {
  const itemClass = (parsed.itemClass ?? "").toLowerCase();

  if (itemClass === "gloves") {
    return ["chest", "body", "shield", "wand", "twohand", "bow", "staff", "boot", "helmet"];
  }
  if (itemClass === "boots") {
    return ["chest", "body", "shield", "wand", "twohand", "bow", "staff", "glove", "helmet"];
  }
  if (itemClass === "helmets") {
    return ["chest", "body", "shield", "wand", "twohand", "bow", "staff", "glove", "boot"];
  }
  if (itemClass === "body armours") {
    return ["shield", "wand", "twohand", "bow", "staff", "glove", "boot", "helmet"];
  }
  if (itemClass === "shields") {
    return ["wand", "twohand", "bow", "staff", "glove", "boot", "helmet", "chest", "body"];
  }
  if (itemClass === "wands") {
    return ["shield", "twohand", "bow", "staff", "glove", "boot", "helmet", "chest", "body"];
  }

  return [];
}

function filterCandidatesForContext(
  candidates: ClipboardAffixDictionaryEntry[],
  parsed: ClipboardParsedItem,
  line: string,
  sectionKind: ClipboardSectionKind,
): ClipboardAffixDictionaryEntry[] {
  let filtered = [...candidates];
  const craftedContext = sectionKind === "crafted_mods" || /\(crafted\)$/i.test(line);
  const itemClass = (parsed.itemClass ?? "").toLowerCase();
  const contextTags = inferContextTags(parsed);
  const forbiddenKeywords = inferForbiddenKeywords(parsed);

  if (craftedContext) {
    const craftedEntries = filtered.filter((entry) => entry.domain === "crafted");
    if (craftedEntries.length > 0) {
      filtered = craftedEntries;
    }
  } else {
    const nonCraftedEntries = filtered.filter((entry) => entry.domain !== "crafted");
    if (nonCraftedEntries.length > 0) {
      filtered = nonCraftedEntries;
    }
  }

  if (isJewelContext(parsed)) {
    const jewelEntries = filtered.filter((entry) => looksLikeJewelEntry(entry));
    if (jewelEntries.length > 0) {
      filtered = jewelEntries;
    }

    if (!isAbyssJewelContext(parsed)) {
      const nonAbyssEntries = filtered.filter((entry) => entry.domain !== "abyss_jewel");
      if (nonAbyssEntries.length > 0) {
        filtered = nonAbyssEntries;
      }
    }
  } else {
    const nonJewelEntries = filtered.filter((entry) => !looksLikeJewelEntry(entry));
    if (nonJewelEntries.length > 0) {
      filtered = nonJewelEntries;
    }
  }

  if (contextTags.length > 0) {
    const overlappingEntries = filtered.filter((entry) => overlapsContextTags(entry, contextTags));
    const untaggedEntries = filtered.filter(
      (entry) => entry.addsTags.length === 0 && entry.allowedTags.length === 0,
    );

    if (overlappingEntries.length > 0) {
      filtered = [...new Set([...overlappingEntries, ...untaggedEntries])];
    }
  }

  if (ARMOUR_SLOT_CLASSES.has(itemClass) && isDefenceLine(line)) {
    const localEntries = filtered.filter((entry) => looksLocal(entry));
    if (localEntries.length > 0) {
      filtered = localEntries;
    }
  }

  if (!isWeaponItemClass(itemClass) && isAccuracyLine(line)) {
    const nonLocalEntries = filtered.filter((entry) => !looksLocal(entry));
    if (nonLocalEntries.length > 0) {
      filtered = nonLocalEntries;
    }
  }

  if (forbiddenKeywords.length > 0) {
    const slotCompatibleEntries = filtered.filter((entry) => {
      const searchable = entrySearchableText(entry);
      return !forbiddenKeywords.some((keyword) => searchable.includes(keyword));
    });

    if (slotCompatibleEntries.length > 0) {
      filtered = slotCompatibleEntries;
    }
  }

  const observedValues = extractObservedValues(line);
  if (observedValues.length > 0) {
    const valueMatchedEntries = filtered.filter((entry) => {
      if (entry.statValueBounds.length !== observedValues.length) {
        return false;
      }

      return observedValues.every((value, index) => {
        const bounds = entry.statValueBounds[index];
        if (!bounds) {
          return false;
        }

        const min = bounds.min ?? Number.NEGATIVE_INFINITY;
        const max = bounds.max ?? Number.POSITIVE_INFINITY;
        return value >= min && value <= max;
      });
    });

    if (valueMatchedEntries.length > 0) {
      filtered = valueMatchedEntries;
    }
  }

  return filtered;
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
          const filteredCandidates = match
            ? filterCandidatesForContext(match.entries, parsed, line, section.kind)
            : [];
          const matchedEntry =
            filteredCandidates.length === 1 ? filteredCandidates[0] : null;
          return {
            line,
            normalizedLine: normalizeClipboardModLine(line),
            sectionKind: section.kind,
            candidateCanonicalModIds: filteredCandidates.map((entry) => entry.canonicalModId),
            candidateSourceModIds: filteredCandidates.map((entry) => entry.sourceModId),
            isAmbiguous: filteredCandidates.length > 1,
            matchedCanonicalModId: matchedEntry?.canonicalModId ?? null,
            matchedSourceModId: matchedEntry?.sourceModId ?? null,
            matchedAffixKind: matchedEntry?.affixKind ?? null,
            matchingConfidence: matchedEntry?.matchingConfidence ?? null,
            matchingMethod: match?.matchingMethod ?? null,
          };
        }),
    );
  }
}
