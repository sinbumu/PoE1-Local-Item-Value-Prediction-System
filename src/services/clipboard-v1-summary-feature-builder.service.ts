import featurePolicy from "../config/clipboard-safe-feature-policy.json";
import type { ClipboardParsedItem, ClipboardSectionKind } from "../types/clipboard.types";

type FeaturePolicy = {
  activeFeatureColumns: string[];
  derivedFeatureColumns: string[];
  categoricalColumns: string[];
};

type V1ClipboardFeatureResult = {
  modelSegment: string | null;
  featureColumns: string[];
  categoricalColumns: string[];
  features: Record<string, string | number | boolean | null>;
};

const policy = featurePolicy as FeaturePolicy;
const FEATURE_COLUMNS = [...policy.activeFeatureColumns, ...policy.derivedFeatureColumns];
const CATEGORICAL_COLUMNS = policy.categoricalColumns.filter((column) =>
  FEATURE_COLUMNS.includes(column),
);

const DAMAGE_KEYWORDS = ["damage", "attack", "spell", "projectile", "minion", "critical", "crit"];
const DEFENCE_KEYWORDS = ["armour", "evasion", "energy shield", "block", "suppression", "resistance"];
const UTILITY_KEYWORDS = ["speed", "reservation", "cooldown", "area", "duration", "mana"];

function sectionLines(parsedItem: ClipboardParsedItem, kind: ClipboardSectionKind): string[] {
  return parsedItem.sections.filter((section) => section.kind === kind).flatMap((section) => section.lines);
}

function allLines(parsedItem: ClipboardParsedItem): string[] {
  return parsedItem.sections.flatMap((section) => section.lines);
}

function parseFirstNumber(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }
  const match = value.match(/[+-]?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function findNumber(lines: string[], label: string): number | null {
  const loweredLabel = label.toLowerCase();
  const line = lines.find((value) => value.toLowerCase().startsWith(loweredLabel));
  return parseFirstNumber(line);
}

function parseItemLevel(parsedItem: ClipboardParsedItem): number | null {
  return findNumber(sectionLines(parsedItem, "item_level"), "Item Level:");
}

function parseSockets(parsedItem: ClipboardParsedItem): { socketCount: number | null; linkCount: number | null; whiteSocketCount: number | null } {
  const socketLine = sectionLines(parsedItem, "sockets").find((line) => line.startsWith("Sockets:"));
  if (!socketLine) {
    return { socketCount: null, linkCount: null, whiteSocketCount: null };
  }
  const socketText = socketLine.slice("Sockets:".length).trim();
  const groups = socketText.split(/\s+/).filter(Boolean);
  const sockets = groups.flatMap((group) => group.split("-")).filter(Boolean);
  const linkCount = groups.reduce((max, group) => Math.max(max, group.split("-").filter(Boolean).length), 0);
  return {
    socketCount: sockets.length,
    linkCount: linkCount || null,
    whiteSocketCount: sockets.filter((socket) => socket.toUpperCase() === "W").length,
  };
}

function countLines(parsedItem: ClipboardParsedItem, kind: ClipboardSectionKind): number {
  return sectionLines(parsedItem, kind).length;
}

function countMatching(lines: string[], keywords: string[]): number {
  return lines.filter((line) => {
    const lowered = line.toLowerCase();
    return keywords.some((keyword) => lowered.includes(keyword));
  }).length;
}

function inferModelSegment(parsedItem: ClipboardParsedItem): string | null {
  const itemClass = (parsedItem.itemClass ?? "").toLowerCase();
  const rarity = (parsedItem.rarity ?? "").toLowerCase();
  if (itemClass.includes("jewel")) {
    return "jewel";
  }
  if (rarity === "gem" || itemClass.includes("gem")) {
    return "skill_gem";
  }
  if (rarity === "unique") {
    return "unique_equipment";
  }
  if (rarity === "rare") {
    return "rare_equipment";
  }
  return null;
}

function inferJewelType(parsedItem: ClipboardParsedItem): string | null {
  const combined = `${parsedItem.itemClass ?? ""} ${parsedItem.baseType ?? ""}`.toLowerCase();
  if (!combined.includes("jewel")) {
    return null;
  }
  if (combined.includes("abyss")) {
    return "abyss";
  }
  if (combined.includes("cluster")) {
    return "cluster";
  }
  return "normal";
}

function inferClusterSize(parsedItem: ClipboardParsedItem): string | null {
  const combined = `${parsedItem.itemClass ?? ""} ${parsedItem.baseType ?? ""}`.toLowerCase();
  if (!combined.includes("cluster")) {
    return null;
  }
  if (combined.includes("large")) {
    return "large";
  }
  if (combined.includes("medium")) {
    return "medium";
  }
  if (combined.includes("small")) {
    return "small";
  }
  return null;
}

function parseClusterPassiveCount(lines: string[]): number | null {
  const line = lines.find((value) => /Adds \d+ Passive Skills/i.test(value));
  return parseFirstNumber(line);
}

function parseGemLevel(parsedItem: ClipboardParsedItem): number | null {
  return findNumber(sectionLines(parsedItem, "properties"), "Level:");
}

function parseGemQuality(parsedItem: ClipboardParsedItem): number | null {
  return findNumber(sectionLines(parsedItem, "properties"), "Quality:");
}

function createEmptyFeatures(): Record<string, string | number | boolean | null> {
  const features: Record<string, string | number | boolean | null> = {};
  for (const column of FEATURE_COLUMNS) {
    features[column] = null;
  }
  return features;
}

export function buildV1SummaryFeaturesFromClipboard(parsedItem: ClipboardParsedItem): V1ClipboardFeatureResult {
  const features = createEmptyFeatures();
  const lines = allLines(parsedItem);
  const explicitLines = parsedItem.explicitAffixLines.map((line) => line.line);
  const properties = sectionLines(parsedItem, "properties");
  const sockets = parseSockets(parsedItem);
  const modelSegment = inferModelSegment(parsedItem);
  const now = new Date();

  features.item_class = parsedItem.itemClass;
  features.base_type = parsedItem.baseType;
  features.rarity = parsedItem.rarity;
  features.ilvl = parseItemLevel(parsedItem);
  features.identified = lines.some((line) => line === "Unidentified") ? 0 : 1;
  features.corrupted = lines.some((line) => line === "Corrupted") ? 1 : 0;
  features.fractured = lines.some((line) => /Fractured/i.test(line)) ? 1 : 0;
  features.synthesised = lines.some((line) => /Synthesised/i.test(line)) ? 1 : 0;
  features.influence_shaper = parsedItem.influences.shaper ? 1 : 0;
  features.influence_elder = parsedItem.influences.elder ? 1 : 0;
  features.influence_crusader = parsedItem.influences.crusader ? 1 : 0;
  features.influence_redeemer = parsedItem.influences.redeemer ? 1 : 0;
  features.influence_hunter = parsedItem.influences.hunter ? 1 : 0;
  features.influence_warlord = parsedItem.influences.warlord ? 1 : 0;
  features.influence_searing = parsedItem.influences.searing ? 1 : 0;
  features.influence_tangled = parsedItem.influences.tangled ? 1 : 0;
  features.socket_count = sockets.socketCount;
  features.link_count = sockets.linkCount;
  features.white_socket_count = sockets.whiteSocketCount;
  features.explicit_mod_count = explicitLines.length;
  features.implicit_mod_count = countLines(parsedItem, "implicit_mods");
  features.crafted_mod_count = countLines(parsedItem, "crafted_mods");
  features.fractured_mod_count = countLines(parsedItem, "fractured_mods");
  features.enchant_mod_count = countLines(parsedItem, "enchant_mods");
  features.quality = findNumber(properties, "Quality:");
  features.armour = findNumber(properties, "Armour:");
  features.evasion = findNumber(properties, "Evasion Rating:");
  features.energy_shield = findNumber(properties, "Energy Shield:");
  features.ward = findNumber(properties, "Ward:");
  features.physical_dps = null;
  features.elemental_dps = null;
  features.attack_speed = findNumber(properties, "Attacks per Second:");
  features.crit_chance = findNumber(properties, "Critical Strike Chance:");
  features.move_speed = findNumber(explicitLines, "% increased Movement Speed");
  features.life_roll_sum = explicitLines
    .filter((line) => /maximum Life|\blife\b/i.test(line))
    .reduce((sum, line) => sum + Math.abs(parseFirstNumber(line) ?? 0), 0);
  features.resistance_roll_sum = explicitLines
    .filter((line) => /Resistance|Resistances/i.test(line))
    .reduce((sum, line) => sum + Math.abs(parseFirstNumber(line) ?? 0), 0);
  features.attribute_roll_sum = explicitLines
    .filter((line) => /Strength|Dexterity|Intelligence|Attributes/i.test(line))
    .reduce((sum, line) => sum + Math.abs(parseFirstNumber(line) ?? 0), 0);
  features.jewel_type = inferJewelType(parsedItem);
  features.cluster_size = inferClusterSize(parsedItem);
  features.cluster_passive_count = parseClusterPassiveCount(lines);
  features.notable_count = lines.filter((line) => /Added Small Passive Skills also grant:/i.test(line)).length || null;
  features.damage_mod_count = modelSegment === "jewel" ? countMatching(explicitLines, DAMAGE_KEYWORDS) : null;
  features.defence_mod_count = modelSegment === "jewel" ? countMatching(explicitLines, DEFENCE_KEYWORDS) : null;
  features.utility_mod_count = modelSegment === "jewel" ? countMatching(explicitLines, UTILITY_KEYWORDS) : null;
  features.gem_level = modelSegment === "skill_gem" ? parseGemLevel(parsedItem) : null;
  features.gem_quality = modelSegment === "skill_gem" ? parseGemQuality(parsedItem) : null;
  features.is_awakened = modelSegment === "skill_gem" ? (parsedItem.baseType?.startsWith("Awakened ") ? 1 : 0) : null;
  features.is_vaal = modelSegment === "skill_gem" ? (parsedItem.baseType?.includes("Vaal ") ? 1 : 0) : null;
  features.model_segment = modelSegment;
  features.observed_hour_utc = now.getUTCHours();
  features.observed_weekday_utc = (now.getUTCDay() + 6) % 7;

  return {
    modelSegment,
    featureColumns: FEATURE_COLUMNS,
    categoricalColumns: CATEGORICAL_COLUMNS,
    features,
  };
}
