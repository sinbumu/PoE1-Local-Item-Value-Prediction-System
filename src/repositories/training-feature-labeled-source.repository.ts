import { pool } from "../db/client";
import type { TrainingFeatureCursor, TrainingFeatureClean } from "../types/training-features.types";

export type TrainingFeatureLabelSourceRow = TrainingFeatureClean & {
  exchangeRateSampleTimeUtc: string | null;
  exchangeRateChaosEquivalent: string | null;
};

export class TrainingFeatureLabeledSourceRepository {
  async getBatch(
    limit: number,
    cursor?: TrainingFeatureCursor | null,
  ): Promise<TrainingFeatureLabelSourceRow[]> {
    const result = await pool.query<{
      listing_key: string;
      source_updated_at: string;
      league: string | null;
      model_segment: "rare_equipment" | "unique_equipment" | "jewel" | "skill_gem";
      clean_reason: string;
      target_price_amount: string;
      target_price_currency: "chaos" | "divine";
      item_class: string;
      base_type: string | null;
      rarity: string | null;
      frame_type: number | null;
      ilvl: number | null;
      identified: boolean;
      corrupted: boolean;
      fractured: boolean;
      synthesised: boolean;
      duplicated: boolean;
      influence_shaper: boolean;
      influence_elder: boolean;
      influence_crusader: boolean;
      influence_redeemer: boolean;
      influence_hunter: boolean;
      influence_warlord: boolean;
      influence_searing: boolean;
      influence_tangled: boolean;
      socket_count: number;
      link_count: number;
      white_socket_count: number;
      prefix_count: number | null;
      suffix_count: number | null;
      explicit_mod_count: number;
      implicit_mod_count: number;
      crafted_mod_count: number;
      fractured_mod_count: number;
      enchant_mod_count: number;
      quality: number | null;
      armour: number | null;
      evasion: number | null;
      energy_shield: number | null;
      ward: number | null;
      physical_dps: number | null;
      elemental_dps: number | null;
      attack_speed: number | null;
      crit_chance: number | null;
      move_speed: number | null;
      life_roll_sum: number | null;
      resistance_roll_sum: number | null;
      attribute_roll_sum: number | null;
      jewel_type: string | null;
      cluster_size: string | null;
      cluster_passive_count: number | null;
      notable_count: number | null;
      damage_mod_count: number | null;
      defence_mod_count: number | null;
      utility_mod_count: number | null;
      gem_level: number | null;
      gem_quality: number | null;
      is_awakened: boolean | null;
      is_vaal: boolean | null;
      is_support_gem: boolean | null;
      gem_tags: string[];
      exchange_rate_sample_time_utc: string | null;
      exchange_rate_chaos_equivalent: string | null;
    }>(
      `
        SELECT
          c.listing_key,
          c.source_updated_at::text,
          c.league,
          c.model_segment,
          c.clean_reason,
          c.target_price_amount::text,
          c.target_price_currency,
          c.item_class,
          c.base_type,
          c.rarity,
          c.frame_type,
          c.ilvl,
          c.identified,
          c.corrupted,
          c.fractured,
          c.synthesised,
          c.duplicated,
          c.influence_shaper,
          c.influence_elder,
          c.influence_crusader,
          c.influence_redeemer,
          c.influence_hunter,
          c.influence_warlord,
          c.influence_searing,
          c.influence_tangled,
          c.socket_count,
          c.link_count,
          c.white_socket_count,
          c.prefix_count,
          c.suffix_count,
          c.explicit_mod_count,
          c.implicit_mod_count,
          c.crafted_mod_count,
          c.fractured_mod_count,
          c.enchant_mod_count,
          c.quality,
          c.armour,
          c.evasion,
          c.energy_shield,
          c.ward,
          c.physical_dps,
          c.elemental_dps,
          c.attack_speed,
          c.crit_chance,
          c.move_speed,
          c.life_roll_sum,
          c.resistance_roll_sum,
          c.attribute_roll_sum,
          c.jewel_type,
          c.cluster_size,
          c.cluster_passive_count,
          c.notable_count,
          c.damage_mod_count,
          c.defence_mod_count,
          c.utility_mod_count,
          c.gem_level,
          c.gem_quality,
          c.is_awakened,
          c.is_vaal,
          c.is_support_gem,
          c.gem_tags,
          r.sample_time_utc::text AS exchange_rate_sample_time_utc,
          r.chaos_equivalent::text AS exchange_rate_chaos_equivalent
        FROM training_features_clean c
        LEFT JOIN LATERAL (
          SELECT sample_time_utc, chaos_equivalent
          FROM exchange_rate_snapshots
          WHERE league = c.league
            AND normalized_currency_code = c.target_price_currency
            AND sample_time_utc <= c.source_updated_at
          ORDER BY sample_time_utc DESC
          LIMIT 1
        ) r ON TRUE
        WHERE
          ($1::timestamptz IS NULL
            OR c.source_updated_at > $1::timestamptz
            OR (c.source_updated_at = $1::timestamptz AND c.listing_key > $2))
        ORDER BY c.source_updated_at ASC, c.listing_key ASC
        LIMIT $3
      `,
      [cursor?.updatedAt ?? null, cursor?.listingKey ?? "", limit],
    );

    return result.rows.map((row) => ({
      listingKey: row.listing_key,
      sourceUpdatedAt: row.source_updated_at,
      league: row.league,
      modelSegment: row.model_segment,
      cleanReason: row.clean_reason,
      targetPriceAmount: row.target_price_amount,
      targetPriceCurrency: row.target_price_currency,
      itemClass: row.item_class,
      baseType: row.base_type,
      rarity: row.rarity,
      frameType: row.frame_type,
      ilvl: row.ilvl,
      identified: row.identified,
      corrupted: row.corrupted,
      fractured: row.fractured,
      synthesised: row.synthesised,
      duplicated: row.duplicated,
      influenceShaper: row.influence_shaper,
      influenceElder: row.influence_elder,
      influenceCrusader: row.influence_crusader,
      influenceRedeemer: row.influence_redeemer,
      influenceHunter: row.influence_hunter,
      influenceWarlord: row.influence_warlord,
      influenceSearing: row.influence_searing,
      influenceTangled: row.influence_tangled,
      socketCount: row.socket_count,
      linkCount: row.link_count,
      whiteSocketCount: row.white_socket_count,
      prefixCount: row.prefix_count,
      suffixCount: row.suffix_count,
      explicitModCount: row.explicit_mod_count,
      implicitModCount: row.implicit_mod_count,
      craftedModCount: row.crafted_mod_count,
      fracturedModCount: row.fractured_mod_count,
      enchantModCount: row.enchant_mod_count,
      quality: row.quality,
      armour: row.armour,
      evasion: row.evasion,
      energyShield: row.energy_shield,
      ward: row.ward,
      physicalDps: row.physical_dps,
      elementalDps: row.elemental_dps,
      attackSpeed: row.attack_speed,
      critChance: row.crit_chance,
      moveSpeed: row.move_speed,
      lifeRollSum: row.life_roll_sum,
      resistanceRollSum: row.resistance_roll_sum,
      attributeRollSum: row.attribute_roll_sum,
      jewelType: row.jewel_type,
      clusterSize: row.cluster_size,
      clusterPassiveCount: row.cluster_passive_count,
      notableCount: row.notable_count,
      damageModCount: row.damage_mod_count,
      defenceModCount: row.defence_mod_count,
      utilityModCount: row.utility_mod_count,
      gemLevel: row.gem_level,
      gemQuality: row.gem_quality,
      isAwakened: row.is_awakened,
      isVaal: row.is_vaal,
      isSupportGem: row.is_support_gem,
      gemTags: row.gem_tags ?? [],
      exchangeRateSampleTimeUtc: row.exchange_rate_sample_time_utc,
      exchangeRateChaosEquivalent: row.exchange_rate_chaos_equivalent,
    }));
  }
}
