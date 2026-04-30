import { normalizeClipboardModLine } from "../config/clipboard-affix-dictionary";
import type { ClipboardParsedItem, ClipboardSectionKind } from "../types/clipboard.types";
import type { ClipboardAffixAnalysisLine } from "../types/affix-dictionary.types";
import type { PublicItem } from "../types/poe.types";
import { ClipboardAffixAnalyzerService } from "./clipboard-affix-analyzer.service";

type ItemJson = PublicItem & Record<string, unknown>;

type V2FeatureInput = {
  itemJson: ItemJson;
  itemClass: string | null;
  baseType: string | null;
  rarity: string | null;
  modelSegment: string | null;
  equipmentSlot?: string | null;
};

type ClipboardFeatureInput = {
  parsedItem: ClipboardParsedItem;
  equipmentSlot?: string | null;
};

type AffixLineWithNumbers = ClipboardAffixAnalysisLine & {
  observedValues: number[];
};

export type V2ModAwareFeatures = Record<string, string | number | null>;

export const V2_MOD_FAMILIES = [
  "life",
  "resistance",
  "attribute",
  "movement_speed",
  "damage",
  "critical",
  "defence",
  "charge",
] as const;

export const V2_BASE_FEATURE_COLUMNS = [
  "item_class",
  "base_type",
  "rarity",
  "model_segment",
  "equipment_slot",
  "unique_name",
  "unique_base_type",
  "matched_explicit_mod_count",
  "unmatched_explicit_mod_count",
  "ambiguous_explicit_mod_count",
  "affix_match_confidence",
  "high_roll_mod_count",
  "top_tier_like_mod_count",
  "prefix_count_candidate",
  "suffix_count_candidate",
  "crafted_matched_mod_count",
  "fractured_matched_mod_count",
  "unique_roll_line_count",
] as const;

export const V2_MOD_FAMILY_FEATURE_COLUMNS = V2_MOD_FAMILIES.flatMap((family) => [
  `mod_family_${family}_count`,
  `mod_family_${family}_roll_sum`,
  `mod_family_${family}_roll_max`,
]);

export const V2_MOD_AWARE_FEATURE_COLUMNS = [
  ...V2_BASE_FEATURE_COLUMNS,
  ...V2_MOD_FAMILY_FEATURE_COLUMNS,
] as const;

export const V2_CATEGORICAL_FEATURE_COLUMNS = [
  "item_class",
  "base_type",
  "rarity",
  "model_segment",
  "equipment_slot",
  "unique_name",
  "unique_base_type",
] as const;

const affixAnalyzer = new ClipboardAffixAnalyzerService();

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function parseObservedValues(line: string): number[] {
  return (line.match(/[+-]?\d+(?:\.\d+)?/g) ?? [])
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value));
}

function collectLines(item: ItemJson, key: string): string[] {
  return asArray<string>(item[key]).filter((value): value is string => typeof value === "string");
}

function buildSection(kind: ClipboardSectionKind, lines: string[]) {
  return {
    kind,
    title: null,
    lines,
  };
}

function normalizeItemClassForDictionary(input: V2FeatureInput): string | null {
  const slot = input.equipmentSlot?.toLowerCase();
  if (slot === "body_armour") {
    return "Body Armours";
  }
  if (slot === "helmet") {
    return "Helmets";
  }
  if (slot === "boot") {
    return "Boots";
  }
  if (slot === "glove") {
    return "Gloves";
  }
  if (slot === "shield") {
    return "Shields";
  }
  if (slot === "weapon") {
    return "Wands";
  }
  if (slot === "jewel") {
    return "Jewels";
  }

  return input.itemClass;
}

function buildParsedItemFromItemJson(input: V2FeatureInput): ClipboardParsedItem {
  const item = input.itemJson;
  const explicitLines = collectLines(item, "explicitMods");
  const craftedLines = collectLines(item, "craftedMods");
  const fracturedLines = collectLines(item, "fracturedMods");
  const enchantLines = collectLines(item, "enchantMods");

  return {
    rawText: "",
    locale: "en",
    itemClass: normalizeItemClassForDictionary(input),
    rarity: input.rarity,
    itemName: asString(item.name) ?? null,
    baseType: input.baseType ?? asString(item.baseType) ?? asString(item.typeLine),
    sections: [
      buildSection("header", []),
      // Public API explicit mods are already isolated; mark them as unknown so the
      // clipboard analyzer applies the same candidate-line heuristic used for paste input.
      buildSection("unknown", explicitLines),
      buildSection("crafted_mods", craftedLines),
      buildSection("fractured_mods", fracturedLines),
      buildSection("enchant_mods", enchantLines),
    ].filter((section) => section.kind === "header" || section.lines.length > 0),
    explicitAffixLines: [],
    influences: {
      shaper: false,
      elder: false,
      crusader: false,
      redeemer: false,
      hunter: false,
      warlord: false,
      searing: false,
      tangled: false,
    },
    warnings: [],
  };
}

function inferFamily(line: AffixLineWithNumbers): (typeof V2_MOD_FAMILIES)[number] | null {
  const searchable = [
    line.line,
    line.normalizedLine,
    line.matchedCanonicalModId ?? "",
    line.matchedSourceModId ?? "",
  ]
    .join(" ")
    .toLowerCase();

  if (/movement speed|movespeed|move speed/.test(searchable)) {
    return "movement_speed";
  }
  if (/resistance|resist|all elemental/.test(searchable)) {
    return "resistance";
  }
  if (/strength|dexterity|intelligence|attribute/.test(searchable)) {
    return "attribute";
  }
  if (/maximum life|\blife\b/.test(searchable)) {
    return "life";
  }
  if (/critical|crit/.test(searchable)) {
    return "critical";
  }
  if (/armour|evasion|energy shield|ward|block|suppression/.test(searchable)) {
    return "defence";
  }
  if (/charge|frenzy|power|endurance/.test(searchable)) {
    return "charge";
  }
  if (/damage|attack|spell|projectile|minion|elemental|physical|chaos|fire|cold|lightning/.test(searchable)) {
    return "damage";
  }

  return null;
}

function isHighRoll(line: AffixLineWithNumbers): boolean {
  if (line.observedValues.length === 0 || line.candidateCanonicalModIds.length !== 1) {
    return false;
  }

  // The exact tier is not preserved in item_json. For MVP, a conservative numeric
  // proxy lets the classifier learn from clearly large observed rolls without
  // pretending that we know the real in-game tier.
  return line.observedValues.some((value) => Math.abs(value) >= 30);
}

function confidenceValue(line: ClipboardAffixAnalysisLine): number {
  if (line.matchedCanonicalModId) {
    return line.matchingConfidence === "high" ? 1 : 0.75;
  }
  if (line.isAmbiguous) {
    return 0.35;
  }
  return 0;
}

function createEmptyFeatures(): V2ModAwareFeatures {
  const features: V2ModAwareFeatures = {};
  for (const column of V2_MOD_AWARE_FEATURE_COLUMNS) {
    features[column] = null;
  }
  for (const family of V2_MOD_FAMILIES) {
    features[`mod_family_${family}_count`] = 0;
    features[`mod_family_${family}_roll_sum`] = 0;
    features[`mod_family_${family}_roll_max`] = null;
  }
  return features;
}

function buildFeaturesFromAnalysis(
  analysisLines: ClipboardAffixAnalysisLine[],
  context: {
    itemClass: string | null;
    baseType: string | null;
    rarity: string | null;
    modelSegment: string | null;
    equipmentSlot: string | null;
    uniqueName: string | null;
    uniqueBaseType: string | null;
    uniqueRollLineCount: number;
  },
): V2ModAwareFeatures {
  const features = createEmptyFeatures();
  const linesWithNumbers: AffixLineWithNumbers[] = analysisLines.map((line) => ({
    ...line,
    observedValues: parseObservedValues(line.line),
  }));
  const matchedLines = linesWithNumbers.filter((line) => line.matchedCanonicalModId);
  const unmatchedLines = linesWithNumbers.filter(
    (line) => !line.matchedCanonicalModId && !line.isAmbiguous,
  );
  const ambiguousLines = linesWithNumbers.filter((line) => line.isAmbiguous);
  const confidenceSum = linesWithNumbers.reduce((sum, line) => sum + confidenceValue(line), 0);

  features.item_class = context.itemClass;
  features.base_type = context.baseType;
  features.rarity = context.rarity;
  features.model_segment = context.modelSegment;
  features.equipment_slot = context.equipmentSlot;
  features.unique_name = context.uniqueName;
  features.unique_base_type = context.uniqueBaseType;
  features.unique_roll_line_count = context.uniqueRollLineCount;
  features.matched_explicit_mod_count = matchedLines.length;
  features.unmatched_explicit_mod_count = unmatchedLines.length;
  features.ambiguous_explicit_mod_count = ambiguousLines.length;
  features.affix_match_confidence =
    linesWithNumbers.length === 0 ? null : Number((confidenceSum / linesWithNumbers.length).toFixed(6));
  features.high_roll_mod_count = linesWithNumbers.filter(isHighRoll).length;
  features.top_tier_like_mod_count = matchedLines.filter(isHighRoll).length;
  features.prefix_count_candidate = matchedLines.filter((line) => line.matchedAffixKind === "prefix").length;
  features.suffix_count_candidate = matchedLines.filter((line) => line.matchedAffixKind === "suffix").length;
  features.crafted_matched_mod_count = matchedLines.filter((line) => line.sectionKind === "crafted_mods").length;
  features.fractured_matched_mod_count = matchedLines.filter((line) => line.sectionKind === "fractured_mods").length;

  for (const line of linesWithNumbers) {
    const family = inferFamily(line);
    if (!family) {
      continue;
    }

    const countKey = `mod_family_${family}_count`;
    const sumKey = `mod_family_${family}_roll_sum`;
    const maxKey = `mod_family_${family}_roll_max`;
    const observedAbsValues = line.observedValues.map((value) => Math.abs(value));
    const lineSum = observedAbsValues.reduce((sum, value) => sum + value, 0);
    const lineMax = observedAbsValues.length > 0 ? Math.max(...observedAbsValues) : null;

    features[countKey] = Number(features[countKey] ?? 0) + 1;
    features[sumKey] = Number(features[sumKey] ?? 0) + lineSum;
    if (lineMax !== null) {
      const existingMax = features[maxKey];
      features[maxKey] =
        typeof existingMax === "number" ? Math.max(existingMax, lineMax) : lineMax;
    }
  }

  return features;
}

export function buildV2ModAwareFeatures(input: V2FeatureInput): V2ModAwareFeatures {
  const item = input.itemJson;
  const parsedItem = buildParsedItemFromItemJson(input);
  parsedItem.explicitAffixLines = affixAnalyzer.extractExplicitCandidateLines(parsedItem);
  const uniqueName = input.modelSegment === "unique_equipment" ? asString(item.name) : null;

  return buildFeaturesFromAnalysis(parsedItem.explicitAffixLines, {
    itemClass: normalizeItemClassForDictionary(input),
    baseType: input.baseType ?? asString(item.baseType) ?? asString(item.typeLine),
    rarity: input.rarity,
    modelSegment: input.modelSegment,
    equipmentSlot: input.equipmentSlot ?? null,
    uniqueName,
    uniqueBaseType: uniqueName ? input.baseType ?? asString(item.typeLine) : null,
    uniqueRollLineCount: input.modelSegment === "unique_equipment" ? collectLines(item, "explicitMods").length : 0,
  });
}

export function analyzeV2AffixesFromItemJson(input: V2FeatureInput): ClipboardAffixAnalysisLine[] {
  const parsedItem = buildParsedItemFromItemJson(input);
  return affixAnalyzer.extractExplicitCandidateLines(parsedItem);
}

export function buildV2ModAwareFeaturesFromClipboard(
  input: ClipboardFeatureInput,
): V2ModAwareFeatures {
  return buildFeaturesFromAnalysis(input.parsedItem.explicitAffixLines, {
    itemClass: input.parsedItem.itemClass,
    baseType: input.parsedItem.baseType,
    rarity: input.parsedItem.rarity,
    modelSegment:
      input.parsedItem.rarity === "Unique" ? "unique_equipment" : "rare_equipment",
    equipmentSlot: input.equipmentSlot ?? null,
    uniqueName: input.parsedItem.rarity === "Unique" ? input.parsedItem.itemName : null,
    uniqueBaseType: input.parsedItem.rarity === "Unique" ? input.parsedItem.baseType : null,
    uniqueRollLineCount:
      input.parsedItem.rarity === "Unique" ? input.parsedItem.explicitAffixLines.length : 0,
  });
}

export function summarizeAffixAnalysis(lines: ClipboardAffixAnalysisLine[]): {
  explicitLineCount: number;
  matchedLineCount: number;
  ambiguousLineCount: number;
  unmatchedLineCount: number;
  matchedRate: number;
  ambiguousOrUnmatchedRate: number;
} {
  const explicitLineCount = lines.length;
  const matchedLineCount = lines.filter((line) => line.matchedCanonicalModId).length;
  const ambiguousLineCount = lines.filter((line) => line.isAmbiguous).length;
  const unmatchedLineCount = lines.filter(
    (line) => !line.matchedCanonicalModId && !line.isAmbiguous,
  ).length;

  return {
    explicitLineCount,
    matchedLineCount,
    ambiguousLineCount,
    unmatchedLineCount,
    matchedRate: explicitLineCount === 0 ? 0 : matchedLineCount / explicitLineCount,
    ambiguousOrUnmatchedRate:
      explicitLineCount === 0 ? 0 : (ambiguousLineCount + unmatchedLineCount) / explicitLineCount,
  };
}

export function normalizeV2ModLine(line: string): string {
  return normalizeClipboardModLine(line);
}
