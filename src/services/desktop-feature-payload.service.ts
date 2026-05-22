import { ClipboardParserService } from "./clipboard-parser.service";
import { buildV1SummaryFeaturesFromClipboard } from "./clipboard-v1-summary-feature-builder.service";
import {
  buildV2ModAwareFeaturesFromClipboard,
  V2_MOD_AWARE_FEATURE_COLUMNS,
} from "./v2-mod-feature-builder.service";

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

export function buildDesktopFeaturePayloadFromClipboardText(rawText: string) {
  const parser = new ClipboardParserService();
  const parsed = parser.parse(rawText, { localeHint: "en" });
  const equipmentSlot = inferEquipmentSlot(parsed.itemClass);
  const v1 = buildV1SummaryFeaturesFromClipboard(parsed);
  const v2 = buildV2ModAwareFeaturesFromClipboard({ parsedItem: parsed, equipmentSlot });

  return {
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
    routing: {
      modelSegment: v1.modelSegment,
    },
    warnings: parsed.warnings,
    featureSets: {
      v1_summary: {
        featureColumns: v1.featureColumns,
        categoricalColumns: v1.categoricalColumns,
        features: v1.features,
      },
      v2_mod_aware: {
        featureColumns: V2_MOD_AWARE_FEATURE_COLUMNS,
        features: v2,
      },
    },
    featureColumns: V2_MOD_AWARE_FEATURE_COLUMNS,
    features: v2,
    affixLines: parsed.explicitAffixLines,
  };
}
