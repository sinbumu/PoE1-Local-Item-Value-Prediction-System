import { matchNeverSinkStrictUniqueRule } from "../config/unique-allowlist";
import type {
  TrainingFeatureClean,
  TrainingFeatureRaw,
} from "../types/training-features.types";

type CleanDecision =
  | { keep: true; feature: TrainingFeatureClean }
  | { keep: false; reason: string };

const SUPPORTED_TARGET_CURRENCIES = new Set(["chaos", "divine"]);

function isPositiveAmount(value: string | null): boolean {
  if (!value) {
    return false;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0;
}

export class TrainingFeatureCleanerService {
  clean(raw: TrainingFeatureRaw): CleanDecision {
    if (!isPositiveAmount(raw.priceAmount)) {
      return { keep: false, reason: "invalid_price_amount" };
    }

    if (!raw.priceCurrency || !SUPPORTED_TARGET_CURRENCIES.has(raw.priceCurrency)) {
      return { keep: false, reason: "unsupported_price_currency" };
    }

    if (raw.itemClass === "map") {
      return { keep: false, reason: "external_price_map" };
    }

    if (raw.itemClass === "skill_gem") {
      return {
        keep: true,
        feature: {
          ...this.copyCommonFields(raw),
          modelSegment: "skill_gem",
          cleanReason: "skill_gem_candidate",
          targetPriceAmount: raw.priceAmount!,
          targetPriceCurrency: raw.priceCurrency as "chaos" | "divine",
        },
      };
    }

    if (raw.itemClass === "jewel") {
      if (raw.jewelType === "timeless") {
        return { keep: false, reason: "timeless_jewel_phase2" };
      }

      if (!raw.identified) {
        return { keep: false, reason: "unidentified_jewel" };
      }

      return {
        keep: true,
        feature: {
          ...this.copyCommonFields(raw),
          modelSegment: "jewel",
          cleanReason: "jewel_candidate",
          targetPriceAmount: raw.priceAmount!,
          targetPriceCurrency: raw.priceCurrency as "chaos" | "divine",
        },
      };
    }

    if (raw.itemClass === "equipment") {
      if (raw.rarity === "Rare") {
        if (!raw.identified) {
          return { keep: false, reason: "unidentified_rare_equipment" };
        }

        return {
          keep: true,
          feature: {
            ...this.copyCommonFields(raw),
            modelSegment: "rare_equipment",
            cleanReason: "rare_equipment_candidate",
            targetPriceAmount: raw.priceAmount!,
            targetPriceCurrency: raw.priceCurrency as "chaos" | "divine",
          },
        };
      }

      if (raw.rarity === "Unique") {
        if (!raw.identified) {
          return { keep: false, reason: "unidentified_unique_equipment" };
        }

        const uniqueRuleId = matchNeverSinkStrictUniqueRule(raw);
        if (!uniqueRuleId) {
          return { keep: false, reason: "unique_not_in_neversink_allowlist" };
        }

        return {
          keep: true,
          feature: {
            ...this.copyCommonFields(raw),
            modelSegment: "unique_equipment",
            cleanReason: uniqueRuleId,
            targetPriceAmount: raw.priceAmount!,
            targetPriceCurrency: raw.priceCurrency as "chaos" | "divine",
          },
        };
      }

      return { keep: false, reason: "unsupported_equipment_rarity" };
    }

    return { keep: false, reason: "unsupported_item_class" };
  }

  private copyCommonFields(raw: TrainingFeatureRaw): Omit<
    TrainingFeatureClean,
    "modelSegment" | "cleanReason" | "targetPriceAmount" | "targetPriceCurrency"
  > {
    return {
      listingKey: raw.listingKey,
      sourceUpdatedAt: raw.sourceUpdatedAt,
      league: raw.league,
      itemClass: raw.itemClass,
      baseType: raw.baseType,
      rarity: raw.rarity,
      frameType: raw.frameType,
      ilvl: raw.ilvl,
      identified: raw.identified,
      corrupted: raw.corrupted,
      fractured: raw.fractured,
      synthesised: raw.synthesised,
      duplicated: raw.duplicated,
      influenceShaper: raw.influenceShaper,
      influenceElder: raw.influenceElder,
      influenceCrusader: raw.influenceCrusader,
      influenceRedeemer: raw.influenceRedeemer,
      influenceHunter: raw.influenceHunter,
      influenceWarlord: raw.influenceWarlord,
      influenceSearing: raw.influenceSearing,
      influenceTangled: raw.influenceTangled,
      socketCount: raw.socketCount,
      linkCount: raw.linkCount,
      whiteSocketCount: raw.whiteSocketCount,
      prefixCount: raw.prefixCount,
      suffixCount: raw.suffixCount,
      explicitModCount: raw.explicitModCount,
      implicitModCount: raw.implicitModCount,
      craftedModCount: raw.craftedModCount,
      fracturedModCount: raw.fracturedModCount,
      enchantModCount: raw.enchantModCount,
      quality: raw.quality,
      armour: raw.armour,
      evasion: raw.evasion,
      energyShield: raw.energyShield,
      ward: raw.ward,
      physicalDps: raw.physicalDps,
      elementalDps: raw.elementalDps,
      attackSpeed: raw.attackSpeed,
      critChance: raw.critChance,
      moveSpeed: raw.moveSpeed,
      lifeRollSum: raw.lifeRollSum,
      resistanceRollSum: raw.resistanceRollSum,
      attributeRollSum: raw.attributeRollSum,
      jewelType: raw.jewelType,
      clusterSize: raw.clusterSize,
      clusterPassiveCount: raw.clusterPassiveCount,
      notableCount: raw.notableCount,
      damageModCount: raw.damageModCount,
      defenceModCount: raw.defenceModCount,
      utilityModCount: raw.utilityModCount,
      gemLevel: raw.gemLevel,
      gemQuality: raw.gemQuality,
      isAwakened: raw.isAwakened,
      isVaal: raw.isVaal,
      isSupportGem: raw.isSupportGem,
      gemTags: raw.gemTags,
    };
  }
}
