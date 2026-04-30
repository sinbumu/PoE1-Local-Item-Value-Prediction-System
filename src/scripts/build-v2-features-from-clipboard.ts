import { readFile } from "node:fs/promises";

import { ClipboardParserService } from "../services/clipboard-parser.service";
import {
  buildV2ModAwareFeaturesFromClipboard,
  V2_MOD_AWARE_FEATURE_COLUMNS,
} from "../services/v2-mod-feature-builder.service";

function readFlagValue(flag: string): string | undefined {
  const flagIndex = process.argv.findIndex(
    (value) => value === flag || value.startsWith(`${flag}=`),
  );
  if (flagIndex < 0) {
    return undefined;
  }

  const argument = process.argv[flagIndex];
  if (argument === flag) {
    const nextValue = process.argv[flagIndex + 1]?.trim();
    return nextValue && !nextValue.startsWith("--") ? nextValue : undefined;
  }

  return argument.slice(flag.length + 1).trim();
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf-8");
}

function inferEquipmentSlot(itemClass: string | null): string | null {
  const lowered = (itemClass ?? "").toLowerCase();
  if (lowered.includes("body armour")) {
    return "body_armour";
  }
  if (lowered.includes("helmet")) {
    return "helmet";
  }
  if (lowered.includes("boot")) {
    return "boot";
  }
  if (lowered.includes("glove")) {
    return "glove";
  }
  if (lowered.includes("shield")) {
    return "shield";
  }
  if (lowered.includes("jewel")) {
    return "jewel";
  }
  if (/bow|sword|axe|mace|dagger|claw|wand|staff|stave|sceptre|quiver/.test(lowered)) {
    return "weapon";
  }
  if (/ring|amulet|belt/.test(lowered)) {
    return "accessory";
  }
  return null;
}

async function main(): Promise<void> {
  const inputPath = readFlagValue("--input");
  const rawText = inputPath ? await readFile(inputPath, "utf-8") : await readStdin();
  const parser = new ClipboardParserService();
  const parsed = parser.parse(rawText, { localeHint: "en" });
  const equipmentSlot = inferEquipmentSlot(parsed.itemClass);
  const features = buildV2ModAwareFeaturesFromClipboard({ parsedItem: parsed, equipmentSlot });

  process.stdout.write(
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        source: "clipboard_text",
        item: {
          locale: parsed.locale,
          itemClass: parsed.itemClass,
          rarity: parsed.rarity,
          itemName: parsed.itemName,
          baseType: parsed.baseType,
          equipmentSlot,
        },
        warnings: parsed.warnings,
        featureColumns: V2_MOD_AWARE_FEATURE_COLUMNS,
        features,
        affixLines: parsed.explicitAffixLines,
      },
      null,
      2,
    )}\n`,
  );
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
