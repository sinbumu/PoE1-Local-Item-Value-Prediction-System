import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type {
  AffixValueBounds,
  CanonicalModRecord,
  CountingPolicyArtifact,
  EnglishAffixDictionaryEntry,
  RePoeVendorManifest,
} from "../types/affix-dictionary.types";

type StatTranslationEntry = {
  ids?: unknown;
  English?: unknown;
};

type TranslationStringRecord = {
  string?: unknown;
};

type ModStatRecord = {
  id?: unknown;
  min?: unknown;
  max?: unknown;
};

type SpawnWeightRecord = {
  tag?: unknown;
  weight?: unknown;
};

type ModRecord = {
  adds_tags?: unknown;
  domain?: unknown;
  generation_type?: unknown;
  groups?: unknown;
  spawn_weights?: unknown;
  stats?: unknown;
  text?: unknown;
  type?: unknown;
};

const ROOT_DIR = process.cwd();
const VENDOR_ROOT = path.join(ROOT_DIR, "vendor", "poe-static");
const OUTPUT_DIR = path.join(ROOT_DIR, "src", "generated", "affix-dictionary");
const ID_SEPARATOR = "\u0000";
const SUPPORTED_AFFIX_DOMAINS = new Set(["item", "jewel", "abyss_jewel", "misc", "crafted"]);

function readStringFlag(flagName: string): string | null {
  const prefix = `${flagName}=`;
  const argument = process.argv.slice(2).find((value) => value.startsWith(prefix));
  if (!argument) {
    return null;
  }

  return argument.slice(prefix.length).trim() || null;
}

async function resolveVendorDirectory(): Promise<string> {
  const explicitDir = readStringFlag("--vendor-dir");
  if (explicitDir) {
    return path.isAbsolute(explicitDir) ? explicitDir : path.join(ROOT_DIR, explicitDir);
  }

  const entries = await readdir(VENDOR_ROOT, { withFileTypes: true });
  const directories = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
  const latest = directories.at(-1);

  if (!latest) {
    throw new Error("no vendored RePoE snapshot found under vendor/poe-static");
  }

  return path.join(VENDOR_ROOT, latest);
}

async function readJsonFile<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, "utf8")) as T;
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter((value) => value.length > 0))];
}

function explodeTemplates(values: string[]): string[] {
  return uniqueStrings(
    values.flatMap((value) =>
      value
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0),
    ),
  );
}

function normalizeAffixTextTemplate(text: string): string {
  return text
    .replace(/\{[0-9]+\}/g, "#")
    .replace(/\(\s*[+-]?\d+(?:\.\d+)?\s*-\s*[+-]?\d+(?:\.\d+)?\s*\)/g, "#")
    .replace(/\(\s*[+-]?\d+(?:\.\d+)?\s*\)/g, "#")
    .replace(/[+-]?\d+(?:\.\d+)?(?:\s*-\s*[+-]?\d+(?:\.\d+)?)?/g, "#")
    .replace(/\(\s*#(?:\s*-\s*#)?\s*\)/g, "#")
    .replace(/\+\s*#/g, "#")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function buildMatchTokens(normalizedTemplate: string): string[] {
  return uniqueStrings(
    normalizedTemplate
      .split(/[^a-z]+/g)
      .map((token) => token.trim())
      .filter((token) => token.length >= 3 && token !== "and"),
  );
}

function buildTranslationMap(entries: StatTranslationEntry[]): Map<string, string[]> {
  const translationMap = new Map<string, string[]>();

  for (const entry of entries) {
    if (!Array.isArray(entry.ids)) {
      continue;
    }

    const ids = entry.ids.filter((value): value is string => typeof value === "string");
    if (ids.length === 0) {
      continue;
    }

    const englishRecords = Array.isArray(entry.English) ? entry.English : [];
    const templates = uniqueStrings(
      englishRecords
        .filter((value): value is TranslationStringRecord => typeof value === "object" && value !== null)
        .map((value) => (typeof value.string === "string" ? value.string : null))
        .filter((value): value is string => value !== null),
    );

    if (templates.length === 0) {
      continue;
    }

    translationMap.set(ids.join(ID_SEPARATOR), templates);
  }

  return translationMap;
}

function buildCanonicalModRecord(
  sourceVersion: string,
  sourceModId: string,
  mod: ModRecord,
  translationMap: Map<string, string[]>,
): CanonicalModRecord | null {
  const domain = typeof mod.domain === "string" ? mod.domain : null;
  const modType = typeof mod.type === "string" ? mod.type : null;
  const generationType = typeof mod.generation_type === "string" ? mod.generation_type : null;
  const addsTags = Array.isArray(mod.adds_tags)
    ? mod.adds_tags.filter((value): value is string => typeof value === "string")
    : [];
  const groups = Array.isArray(mod.groups)
    ? mod.groups.filter((value): value is string => typeof value === "string")
    : [];
  const spawnWeights = Array.isArray(mod.spawn_weights)
    ? mod.spawn_weights.filter((value): value is SpawnWeightRecord => typeof value === "object" && value !== null)
    : [];
  const stats = Array.isArray(mod.stats)
    ? mod.stats.filter((value): value is ModStatRecord => typeof value === "object" && value !== null)
    : [];

  const statIds = stats
    .map((value) => (typeof value.id === "string" ? value.id : null))
    .filter((value): value is string => value !== null);
  const statValueBounds: AffixValueBounds[] = stats.map((value) => ({
    min: typeof value.min === "number" ? value.min : null,
    max: typeof value.max === "number" ? value.max : null,
  }));

  const translatedTemplates =
    statIds.length > 0 ? translationMap.get(statIds.join(ID_SEPARATOR)) ?? [] : [];
  const inlineText = typeof mod.text === "string" ? [mod.text] : [];
  const englishTemplates = explodeTemplates([...inlineText, ...translatedTemplates]);

  if (!domain || !generationType || englishTemplates.length === 0) {
    return null;
  }

  return {
    canonicalModId: sourceModId,
    sourceModId,
    domain,
    modType,
    generationType,
    groups,
    statIds,
    sourceVersion,
    isHybrid: statIds.length > 1,
    addsTags,
    allowedTags: uniqueStrings(
      spawnWeights
        .filter((value) => typeof value.weight === "number" && value.weight > 0)
        .map((value) => (typeof value.tag === "string" ? value.tag : null))
        .filter((value): value is string => value !== null),
    ),
    statValueBounds,
    englishTemplates,
  };
}

function buildEnglishDictionaryEntry(
  record: CanonicalModRecord,
): EnglishAffixDictionaryEntry | null {
  if (!SUPPORTED_AFFIX_DOMAINS.has(record.domain)) {
    return null;
  }

  if (record.generationType !== "prefix" && record.generationType !== "suffix") {
    return null;
  }

  const normalizedTextTemplatesEn = uniqueStrings(
    record.englishTemplates.map((value) => normalizeAffixTextTemplate(value)),
  );

  if (normalizedTextTemplatesEn.length === 0) {
    return null;
  }

  return {
    canonicalModId: record.canonicalModId,
    sourceModId: record.sourceModId,
    domain: record.domain,
    modType: record.modType,
    affixKind: record.generationType,
    groups: record.groups,
    addsTags: record.addsTags,
    allowedTags: record.allowedTags,
    statValueBounds: record.statValueBounds,
    textTemplatesEn: record.englishTemplates,
    normalizedTextTemplatesEn,
    matchTokensEn: uniqueStrings(
      normalizedTextTemplatesEn.flatMap((value) => buildMatchTokens(value)),
    ),
    matchingConfidence: record.statIds.length > 0 ? "high" : "medium",
  };
}

async function main(): Promise<void> {
  const vendorDir = await resolveVendorDirectory();
  const manifest = await readJsonFile<RePoeVendorManifest>(path.join(vendorDir, "manifest.json"));
  const mods = await readJsonFile<Record<string, ModRecord>>(path.join(vendorDir, "mods.json"));
  const statTranslations = await readJsonFile<StatTranslationEntry[]>(
    path.join(vendorDir, "stat_translations.json"),
  );

  const translationMap = buildTranslationMap(statTranslations);
  const canonicalMods = Object.entries(mods)
    .map(([sourceModId, mod]) =>
      buildCanonicalModRecord(manifest.snapshotLabel, sourceModId, mod, translationMap),
    )
    .filter((value): value is CanonicalModRecord => value !== null)
    .sort((left, right) => left.canonicalModId.localeCompare(right.canonicalModId));

  const englishDictionary = canonicalMods
    .map((record) => buildEnglishDictionaryEntry(record))
    .filter((value): value is EnglishAffixDictionaryEntry => value !== null)
    .sort((left, right) => left.canonicalModId.localeCompare(right.canonicalModId));

  const countingPolicy: CountingPolicyArtifact = {
    countHybridAsSingleAffix: true,
    includeCraftedInPrefixSuffixCount: false,
    includeFracturedInPrefixSuffixCount: false,
    excludeSections: ["implicit_mods", "enchant_mods", "fractured_mods", "crafted_mods"],
    nullOnUnmatchedExplicit: true,
    scope: "en_v1",
    sourceVersion: manifest.snapshotLabel,
  };

  await mkdir(OUTPUT_DIR, { recursive: true });

  await writeFile(
    path.join(OUTPUT_DIR, "canonical_mods.generated.json"),
    `${JSON.stringify(canonicalMods, null, 2)}\n`,
    "utf8",
  );
  await writeFile(
    path.join(OUTPUT_DIR, "affix_dictionary_en.generated.json"),
    `${JSON.stringify(englishDictionary, null, 2)}\n`,
    "utf8",
  );
  await writeFile(
    path.join(OUTPUT_DIR, "counting_policy.generated.json"),
    `${JSON.stringify(countingPolicy, null, 2)}\n`,
    "utf8",
  );

  console.log(
    JSON.stringify(
      {
        vendorDir: path.relative(ROOT_DIR, vendorDir),
        outputDir: path.relative(ROOT_DIR, OUTPUT_DIR),
        sourceVersion: manifest.snapshotLabel,
        canonicalModCount: canonicalMods.length,
        englishAffixCount: englishDictionary.length,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
