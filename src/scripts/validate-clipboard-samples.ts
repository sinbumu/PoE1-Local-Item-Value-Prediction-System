import { readFile } from "node:fs/promises";
import path from "node:path";
import { ClipboardParserService } from "../services/clipboard-parser.service";

type ManifestEntry = {
  id: string;
  locale: "en" | "ko";
  outputTextPath: string;
  rarity: string | null;
  itemName: string | null;
  baseType: string | null;
};

type Failure = {
  id: string;
  field: string;
  expected: string | null;
  actual: string | null;
};

const ROOT_DIR = process.cwd();
const MANIFEST_PATH = path.join(ROOT_DIR, "samples", "clipboard", "manifest.json");

async function main(): Promise<void> {
  const parser = new ClipboardParserService();
  const manifest = JSON.parse(
    await readFile(MANIFEST_PATH, "utf8"),
  ) as ManifestEntry[];

  const failures: Failure[] = [];

  for (const entry of manifest) {
    const rawText = await readFile(path.join(ROOT_DIR, entry.outputTextPath), "utf8");
    const parsed = parser.parse(rawText);

    if (parsed.locale !== entry.locale) {
      failures.push({
        id: entry.id,
        field: "locale",
        expected: entry.locale,
        actual: parsed.locale,
      });
    }

    if (parsed.rarity !== entry.rarity) {
      failures.push({
        id: entry.id,
        field: "rarity",
        expected: entry.rarity,
        actual: parsed.rarity,
      });
    }

    if (parsed.itemName !== entry.itemName) {
      failures.push({
        id: entry.id,
        field: "itemName",
        expected: entry.itemName,
        actual: parsed.itemName,
      });
    }

    if (parsed.baseType !== entry.baseType) {
      failures.push({
        id: entry.id,
        field: "baseType",
        expected: entry.baseType,
        actual: parsed.baseType,
      });
    }
  }

  if (failures.length > 0) {
    console.error(
      JSON.stringify(
        {
          manifestPath: path.relative(ROOT_DIR, MANIFEST_PATH),
          checkedSampleCount: manifest.length,
          failureCount: failures.length,
          failures: failures.slice(0, 50),
        },
        null,
        2,
      ),
    );
    process.exitCode = 1;
    return;
  }

  console.log(
    JSON.stringify(
      {
        manifestPath: path.relative(ROOT_DIR, MANIFEST_PATH),
        checkedSampleCount: manifest.length,
        failureCount: 0,
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
