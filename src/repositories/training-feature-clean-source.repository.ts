import { pool } from "../db/client";
import type {
  TrainingFeatureCursor,
  TrainingFeatureRaw,
} from "../types/training-features.types";

export class TrainingFeatureCleanSourceRepository {
  async getBatch(
    limit: number,
    cursor?: TrainingFeatureCursor | null,
    sinceUpdatedAt?: string,
  ): Promise<TrainingFeatureRaw[]> {
    const result = await pool.query<{
      listing_key: string;
      source_item_id: string | null;
      source_inserted_at: string;
      source_updated_at: string;
      league: string | null;
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
      price_amount: string | null;
      price_currency: string | null;
      listing_mode: string | null;
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
    }>(
      `
        SELECT
          r.listing_key,
          r.source_item_id,
          r.source_inserted_at::text,
          r.source_updated_at::text,
          r.league,
          r.item_class,
          r.base_type,
          r.rarity,
          r.frame_type,
          r.ilvl,
          r.identified,
          r.corrupted,
          r.fractured,
          r.synthesised,
          r.duplicated,
          r.influence_shaper,
          r.influence_elder,
          r.influence_crusader,
          r.influence_redeemer,
          r.influence_hunter,
          r.influence_warlord,
          r.influence_searing,
          r.influence_tangled,
          r.socket_count,
          r.link_count,
          r.white_socket_count,
          r.prefix_count,
          r.suffix_count,
          r.explicit_mod_count,
          r.implicit_mod_count,
          r.crafted_mod_count,
          r.fractured_mod_count,
          r.enchant_mod_count,
          r.price_amount::text,
          r.price_currency,
          r.listing_mode,
          r.quality,
          r.armour,
          r.evasion,
          r.energy_shield,
          r.ward,
          r.physical_dps,
          r.elemental_dps,
          r.attack_speed,
          r.crit_chance,
          r.move_speed,
          r.life_roll_sum,
          r.resistance_roll_sum,
          r.attribute_roll_sum,
          r.jewel_type,
          r.cluster_size,
          r.cluster_passive_count,
          r.notable_count,
          r.damage_mod_count,
          r.defence_mod_count,
          r.utility_mod_count,
          r.gem_level,
          r.gem_quality,
          r.is_awakened,
          r.is_vaal,
          r.is_support_gem,
          r.gem_tags
        FROM training_features_raw r
        WHERE
          ($4::timestamptz IS NULL OR r.source_updated_at >= $4::timestamptz)
          AND (
            $1::timestamptz IS NULL
            OR (r.source_updated_at, r.listing_key) > ($1::timestamptz, $2::text)
          )
        ORDER BY r.source_updated_at ASC, r.listing_key ASC
        LIMIT $3
      `,
      [cursor?.updatedAt ?? null, cursor?.listingKey ?? "", limit, sinceUpdatedAt ?? null],
    );

    return result.rows.map((row) => ({
      listingKey: row.listing_key,
      sourceItemId: row.source_item_id,
      sourceInsertedAt: row.source_inserted_at,
      sourceUpdatedAt: row.source_updated_at,
      league: row.league,
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
      priceAmount: row.price_amount,
      priceCurrency: row.price_currency,
      listingMode: row.listing_mode,
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
    }));
  }
}
