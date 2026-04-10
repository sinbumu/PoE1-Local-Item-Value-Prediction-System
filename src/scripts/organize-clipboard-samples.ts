import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

type Locale = "en" | "ko";

type SampleEntry = {
  id: string;
  locale: Locale;
  category: string;
  sourceFile: string;
  sourceItemIndex: number;
  outputTextPath: string;
  outputMetaPath: string;
  rarity: string | null;
  itemName: string | null;
  baseType: string | null;
};

const ROOT_DIR = process.cwd();
const SOURCE_DIR = path.join(ROOT_DIR, "samples", "poe_ctrl+c추출데이터모음(kor+en)");
const OUTPUT_DIR = path.join(ROOT_DIR, "samples", "clipboard");
const MANIFEST_PATH = path.join(OUTPUT_DIR, "manifest.json");
const ITEM_SEPARATOR = "---";

const CATEGORY_MAP: Record<string, string> = {
  "rare장비": "rare-equipment",
  "unique장비": "unique-equipment",
  cluster_jewel: "cluster-jewel",
  "일반jewel": "normal-jewel",
  Gem: "skill-gem",
  Awakened_gem: "awakened-gem",
  Vaal_Gem: "vaal-gem",
  "crafted_fractured_influenced_아이템": "crafted-fractured-influenced-item",
};

function normalizeText(raw: string): string {
  return raw.replace(/\r\n/g, "\n").trim();
}

function splitItems(raw: string): string[] {
  const lines = normalizeText(raw).split("\n");
  const items: string[] = [];
  let current: string[] = [];

  for (const line of lines) {
    if (line.trim() === ITEM_SEPARATOR) {
      const itemText = current.join("\n").trim();
      if (itemText) {
        items.push(itemText);
      }
      current = [];
      continue;
    }

    current.push(line);
  }

  const trailing = current.join("\n").trim();
  if (trailing) {
    items.push(trailing);
  }

  return items;
}

function parseLocaleAndCategory(fileName: string): { locale: Locale; category: string } | null {
  const stem = fileName.replace(/\.txt$/i, "");
  const localePrefix = stem.startsWith("EN_")
    ? "EN"
    : stem.startsWith("KOR_")
      ? "KOR"
      : null;

  if (!localePrefix) {
    return null;
  }

  const locale: Locale = localePrefix === "EN" ? "en" : "ko";
  const rawCategory = stem.slice(localePrefix.length + 1);
  const category = CATEGORY_MAP[rawCategory];

  if (!category) {
    throw new Error(`Unknown clipboard sample category: ${rawCategory}`);
  }

  return { locale, category };
}

function parseHeaderFields(
  itemText: string,
): { rarity: string | null; itemName: string | null; baseType: string | null } {
  const lines = itemText.split("\n");
  const rarityLine = lines.find(
    (line) => line.startsWith("Rarity:") || line.startsWith("아이템 희귀도:"),
  );

  const rarity = rarityLine?.startsWith("Rarity:")
    ? rarityLine.slice("Rarity:".length).trim()
    : rarityLine?.startsWith("아이템 희귀도:")
      ? rarityLine.slice("아이템 희귀도:".length).trim()
      : null;

  const itemName = lines[2] && lines[2] !== "--------" ? lines[2] : null;
  const baseType =
    lines[3] && lines[3] !== "--------" ? lines[3] : itemName;

  return {
    rarity,
    itemName,
    baseType,
  };
}

async function ensureCleanOutputDirs(): Promise<void> {
  await mkdir(OUTPUT_DIR, { recursive: true });
  await rm(path.join(OUTPUT_DIR, "en"), { recursive: true, force: true });
  await rm(path.join(OUTPUT_DIR, "ko"), { recursive: true, force: true });
  await mkdir(path.join(OUTPUT_DIR, "en"), { recursive: true });
  await mkdir(path.join(OUTPUT_DIR, "ko"), { recursive: true });
}

async function main(): Promise<void> {
  await ensureCleanOutputDirs();

  const fileNames = (await readdir(SOURCE_DIR))
    .filter((fileName) => fileName.endsWith(".txt"))
    .filter((fileName) => fileName !== "인게임ctrl+c데이터가이드라인.txt")
    .sort();

  const manifest: SampleEntry[] = [];

  for (const fileName of fileNames) {
    const parsed = parseLocaleAndCategory(fileName);
    if (!parsed) {
      continue;
    }

    const raw = await readFile(path.join(SOURCE_DIR, fileName), "utf8");
    const items = splitItems(raw);

    for (const [index, itemText] of items.entries()) {
      const number = String(index + 1).padStart(3, "0");
      const id = `${parsed.category}-${number}`;
      const outputDir = path.join(OUTPUT_DIR, parsed.locale);
      const outputTextPath = path.join(outputDir, `${id}.txt`);
      const outputMetaPath = path.join(outputDir, `${id}.meta.json`);
      const header = parseHeaderFields(itemText);

      const entry: SampleEntry = {
        id,
        locale: parsed.locale,
        category: parsed.category.replace(/-/g, "_"),
        sourceFile: fileName,
        sourceItemIndex: index + 1,
        outputTextPath: path.relative(ROOT_DIR, outputTextPath),
        outputMetaPath: path.relative(ROOT_DIR, outputMetaPath),
        rarity: header.rarity,
        itemName: header.itemName,
        baseType: header.baseType,
      };

      await writeFile(outputTextPath, `${itemText}\n`, "utf8");
      await writeFile(
        outputMetaPath,
        `${JSON.stringify(
          {
            id: entry.id,
            locale: entry.locale,
            category: entry.category,
            sourceFile: entry.sourceFile,
            sourceItemIndex: entry.sourceItemIndex,
            notes: [],
            expected: {
              rarity: entry.rarity,
              itemName: entry.itemName,
              baseType: entry.baseType,
            },
          },
          null,
          2,
        )}\n`,
        "utf8",
      );

      manifest.push(entry);
    }
  }

  await writeFile(`${MANIFEST_PATH}`, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  console.log(
    JSON.stringify(
      {
        sourceDir: path.relative(ROOT_DIR, SOURCE_DIR),
        outputDir: path.relative(ROOT_DIR, OUTPUT_DIR),
        sampleCount: manifest.length,
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
