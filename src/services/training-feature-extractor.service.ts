import type { PublicItem } from "../types/poe.types";
import type {
  NormalizedPricedItemSourceRow,
  TrainingFeatureRaw,
} from "../types/training-features.types";

type ItemTextValue = [string, number?];
type ItemDisplayEntry = {
  name?: unknown;
  values?: unknown;
};

const LIFE_KEYWORDS = ["maximum life", "max life"];
const RESISTANCE_KEYWORDS = ["resistance", "all elemental resistances"];
const ATTRIBUTE_KEYWORDS = [
  "strength",
  "dexterity",
  "intelligence",
  "all attributes",
];
const DAMAGE_KEYWORDS = [
  "damage",
  "attack speed",
  "critical strike",
  "crit chance",
  "spell",
  "projectile",
  "melee",
  "minion",
  "bow",
  "wand",
];
const DEFENCE_KEYWORDS = [
  "armour",
  "evasion",
  "energy shield",
  "ward",
  "block",
  "suppression",
  "life",
  "resistance",
];

function asObject(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asBoolean(value: unknown): boolean {
  return value === true;
}

function normalizeNumericText(text: string): string {
  return text.replace(/,/g, "").replace(/[^0-9.+-]/g, "");
}

function parseFirstNumber(text: string): number | null {
  const match = text.match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function parseAllNumbers(text: string): number[] {
  return (text.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
}

function parsePropertyValue(entry: ItemDisplayEntry): string | null {
  const values = asArray<ItemTextValue>(entry.values);
  return typeof values[0]?.[0] === "string" ? values[0][0] : null;
}

function getDisplayEntries(item: PublicItem, key: string): ItemDisplayEntry[] {
  return asArray<ItemDisplayEntry>(item[key]);
}

function getDisplayEntryValue(item: PublicItem, name: string): string | null {
  const entry = getDisplayEntries(item, "properties").find(
    (property) => property.name === name,
  );

  return entry ? parsePropertyValue(entry) : null;
}

function parseRangeAverage(text: string): number | null {
  const values = parseAllNumbers(text);
  if (values.length >= 2) {
    return (values[0] + values[1]) / 2;
  }

  return values[0] ?? null;
}

function computeLinkCount(item: PublicItem): number {
  const sockets = asArray<Record<string, unknown>>(item.sockets);
  if (sockets.length === 0) {
    return 0;
  }

  const groupCounts = new Map<number, number>();
  for (const socket of sockets) {
    const group = Number(socket.group ?? 0);
    groupCounts.set(group, (groupCounts.get(group) ?? 0) + 1);
  }

  return Math.max(...groupCounts.values());
}

function countWhiteSockets(item: PublicItem): number {
  return asArray<Record<string, unknown>>(item.sockets).filter(
    (socket) => socket.sColour === "W",
  ).length;
}

function readPrefixes(item: PublicItem): number | null {
  const extended = asObject(item.extended);
  const value = extended.prefixes;
  return typeof value === "number" ? value : null;
}

function readSuffixes(item: PublicItem): number | null {
  const extended = asObject(item.extended);
  const value = extended.suffixes;
  return typeof value === "number" ? value : null;
}

function collectModLines(item: PublicItem): string[] {
  return [
    ...asArray<string>(item.explicitMods),
    ...asArray<string>(item.implicitMods),
    ...asArray<string>(item.craftedMods),
    ...asArray<string>(item.fracturedMods),
    ...asArray<string>(item.enchantMods),
  ].filter((value): value is string => typeof value === "string");
}

function sumLinesByKeywords(lines: string[], keywords: string[]): number | null {
  const total = lines.reduce((sum, line) => {
    const lowered = line.toLowerCase();
    if (!keywords.some((keyword) => lowered.includes(keyword))) {
      return sum;
    }

    return sum + parseAllNumbers(line).reduce((innerSum, value) => innerSum + value, 0);
  }, 0);

  return total === 0 ? null : total;
}

function extractMoveSpeed(lines: string[]): number | null {
  const matchingLines = lines.filter((line) =>
    line.toLowerCase().includes("movement speed"),
  );

  const values = matchingLines.flatMap((line) => parseAllNumbers(line));
  if (values.length === 0) {
    return null;
  }

  return Math.max(...values);
}

function classifyItemClass(item: PublicItem, row: NormalizedPricedItemSourceRow): string {
  const baseType = (row.base_type ?? item.baseType ?? item.typeLine ?? "").toLowerCase();
  const typeLine = (item.typeLine ?? "").toLowerCase();
  const descrText = (asString(item.descrText) ?? "").toLowerCase();

  if (
    row.frame_type === 4 ||
    typeof item.support === "boolean" ||
    descrText.includes("skill gem") ||
    descrText.includes("support gem")
  ) {
    return "skill_gem";
  }

  if (baseType.includes("jewel") || typeLine.includes("jewel")) {
    return "jewel";
  }

  if (baseType.includes("map") || typeLine.includes("map")) {
    return "map";
  }

  return "equipment";
}

function detectInfluence(item: PublicItem, key: string): boolean {
  const influences = asObject(item.influences);
  return influences[key] === true;
}

function extractItemTags(item: PublicItem): string[] {
  const firstProperty = getDisplayEntries(item, "properties")[0];
  const name = asString(firstProperty?.name);

  if (!name || name.includes(" ")) {
    return [];
  }

  return name
    .split(",")
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean);
}

function classifyJewelType(item: PublicItem, row: NormalizedPricedItemSourceRow): string | null {
  const baseType = (row.base_type ?? item.baseType ?? item.typeLine ?? "").toLowerCase();

  if (!baseType.includes("jewel")) {
    return null;
  }

  if (baseType.includes("cluster jewel")) {
    return "cluster";
  }

  if (baseType.includes("timeless jewel")) {
    return "timeless";
  }

  if (baseType.includes("eye jewel") || baseType.includes("abyss")) {
    return "abyss";
  }

  return "normal";
}

function classifyClusterSize(item: PublicItem, row: NormalizedPricedItemSourceRow): string | null {
  const baseType = row.base_type ?? item.baseType ?? item.typeLine ?? "";
  if (!baseType.includes("Cluster Jewel")) {
    return null;
  }

  if (baseType.startsWith("Large")) {
    return "Large";
  }

  if (baseType.startsWith("Medium")) {
    return "Medium";
  }

  if (baseType.startsWith("Small")) {
    return "Small";
  }

  return null;
}

function countMatchingMods(lines: string[], keywords: string[]): number {
  return lines.filter((line) => {
    const lowered = line.toLowerCase();
    return keywords.some((keyword) => lowered.includes(keyword));
  }).length;
}

function countUtilityMods(lines: string[]): number {
  return lines.filter((line) => {
    const lowered = line.toLowerCase();

    if (DAMAGE_KEYWORDS.some((keyword) => lowered.includes(keyword))) {
      return false;
    }

    if (DEFENCE_KEYWORDS.some((keyword) => lowered.includes(keyword))) {
      return false;
    }

    return true;
  }).length;
}

function readGemLevel(item: PublicItem): number | null {
  const value = getDisplayEntryValue(item, "Level");
  return value ? parseFirstNumber(value) : null;
}

function readGemQuality(item: PublicItem): number | null {
  const value = getDisplayEntryValue(item, "Quality");
  return value ? parseFirstNumber(value) : null;
}

function readNumericProperty(item: PublicItem, name: string): number | null {
  const value = getDisplayEntryValue(item, name);
  return value ? parseFirstNumber(normalizeNumericText(value)) : null;
}

function computePhysicalDps(item: PublicItem): number | null {
  const damage = getDisplayEntryValue(item, "Physical Damage");
  const attacksPerSecond = getDisplayEntryValue(item, "Attacks per Second");
  if (!damage || !attacksPerSecond) {
    return null;
  }

  const averageDamage = parseRangeAverage(damage);
  const aps = parseFirstNumber(attacksPerSecond);
  if (averageDamage === null || aps === null) {
    return null;
  }

  return Number((averageDamage * aps).toFixed(2));
}

function computeElementalDps(item: PublicItem): number | null {
  const damage = getDisplayEntryValue(item, "Elemental Damage");
  const attacksPerSecond = getDisplayEntryValue(item, "Attacks per Second");
  if (!damage || !attacksPerSecond) {
    return null;
  }

  const rangeSegments = damage.split(/,\s*/);
  const averageDamage = rangeSegments.reduce((sum, segment) => {
    const value = parseRangeAverage(segment);
    return sum + (value ?? 0);
  }, 0);
  const aps = parseFirstNumber(attacksPerSecond);

  if (averageDamage === 0 || aps === null) {
    return null;
  }

  return Number((averageDamage * aps).toFixed(2));
}

function readClusterPassiveCount(item: PublicItem): number | null {
  const enchantMod = asArray<string>(item.enchantMods).find((line) =>
    line.includes("Passive Skills"),
  );

  return enchantMod ? parseFirstNumber(enchantMod) : null;
}

function readNotableCount(item: PublicItem): number | null {
  const count = asArray<string>(item.explicitMods).filter((line) =>
    line.includes("Added Passive Skill is "),
  ).length;

  return count === 0 ? null : count;
}

export class TrainingFeatureExtractorService {
  extract(row: NormalizedPricedItemSourceRow): TrainingFeatureRaw {
    const item = row.item_json;
    const itemClass = classifyItemClass(item, row);
    const modLines = collectModLines(item);

    return {
      listingKey: row.listing_key,
      sourceItemId: row.item_id,
      sourceInsertedAt: row.inserted_at,
      sourceUpdatedAt: row.updated_at,
      league: row.league,
      itemClass,
      baseType: row.base_type,
      rarity: row.rarity,
      frameType: row.frame_type,
      ilvl: typeof item.ilvl === "number" ? item.ilvl : null,
      identified: asBoolean(item.identified),
      corrupted: asBoolean(item.corrupted),
      fractured: asBoolean(item.fractured),
      synthesised: asBoolean(item.synthesised),
      duplicated: asBoolean(item.duplicated),
      influenceShaper: detectInfluence(item, "shaper"),
      influenceElder: detectInfluence(item, "elder"),
      influenceCrusader: detectInfluence(item, "crusader"),
      influenceRedeemer: detectInfluence(item, "redeemer"),
      influenceHunter: detectInfluence(item, "hunter"),
      influenceWarlord: detectInfluence(item, "warlord"),
      influenceSearing: detectInfluence(item, "searing"),
      influenceTangled: detectInfluence(item, "tangled"),
      socketCount: asArray(item.sockets).length,
      linkCount: computeLinkCount(item),
      whiteSocketCount: countWhiteSockets(item),
      prefixCount: readPrefixes(item),
      suffixCount: readSuffixes(item),
      explicitModCount: asArray(item.explicitMods).length,
      implicitModCount: asArray(item.implicitMods).length,
      craftedModCount: asArray(item.craftedMods).length,
      fracturedModCount: asArray(item.fracturedMods).length,
      enchantModCount: asArray(item.enchantMods).length,
      priceAmount: row.price_amount,
      priceCurrency: row.price_currency,
      listingMode: row.listing_mode,
      quality: readNumericProperty(item, "Quality"),
      armour: readNumericProperty(item, "Armour"),
      evasion: readNumericProperty(item, "Evasion Rating"),
      energyShield: readNumericProperty(item, "Energy Shield"),
      ward: readNumericProperty(item, "Ward"),
      physicalDps: computePhysicalDps(item),
      elementalDps: computeElementalDps(item),
      attackSpeed: readNumericProperty(item, "Attacks per Second"),
      critChance: readNumericProperty(item, "Critical Strike Chance"),
      moveSpeed: extractMoveSpeed(modLines),
      lifeRollSum: sumLinesByKeywords(modLines, LIFE_KEYWORDS),
      resistanceRollSum: sumLinesByKeywords(modLines, RESISTANCE_KEYWORDS),
      attributeRollSum: sumLinesByKeywords(modLines, ATTRIBUTE_KEYWORDS),
      jewelType: classifyJewelType(item, row),
      clusterSize: classifyClusterSize(item, row),
      clusterPassiveCount: readClusterPassiveCount(item),
      notableCount: readNotableCount(item),
      damageModCount:
        itemClass === "jewel" ? countMatchingMods(modLines, DAMAGE_KEYWORDS) : null,
      defenceModCount:
        itemClass === "jewel" ? countMatchingMods(modLines, DEFENCE_KEYWORDS) : null,
      utilityModCount: itemClass === "jewel" ? countUtilityMods(modLines) : null,
      gemLevel: itemClass === "skill_gem" ? readGemLevel(item) : null,
      gemQuality: itemClass === "skill_gem" ? readGemQuality(item) : null,
      isAwakened:
        itemClass === "skill_gem"
          ? (row.base_type ?? item.baseType ?? item.typeLine ?? "").startsWith(
              "Awakened ",
            )
          : null,
      isVaal:
        itemClass === "skill_gem"
          ? (row.base_type ?? item.baseType ?? item.typeLine ?? "").includes("Vaal ")
          : null,
      isSupportGem:
        itemClass === "skill_gem" ? typeof item.support === "boolean" && item.support : null,
      gemTags: itemClass === "skill_gem" ? extractItemTags(item) : [],
    };
  }
}
