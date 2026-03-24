import { pool } from "../db/client";
import type {
  TrainingFeatureCursor,
  TrainingFeatureRaw,
} from "../types/training-features.types";

export class TrainingFeatureCleanSourceRepository {
  async getBatch(
    limit: number,
    cursor?: TrainingFeatureCursor | null,
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
          listing_key,
          source_item_id,
          source_inserted_at::text,
          source_updated_at::text,
          league,
          item_class,
          base_type,
          rarity,
          frame_type,
          ilvl,
          identified,
          corrupted,
          fractured,
          synthesised,
          duplicated,
          influence_shaper,
          influence_elder,
          influence_crusader,
          influence_redeemer,
          influence_hunter,
          influence_warlord,
          influence_searing,
          influence_tangled,
          socket_count,
          link_count,
          white_socket_count,
          prefix_count,
          suffix_count,
          explicit_mod_count,
          implicit_mod_count,
          crafted_mod_count,
          fractured_mod_count,
          enchant_mod_count,
          price_amount::text,
          price_currency,
          listing_mode,
          quality,
          armour,
          evasion,
          energy_shield,
          ward,
          physical_dps,
          elemental_dps,
          attack_speed,
          crit_chance,
          move_speed,
          life_roll_sum,
          resistance_roll_sum,
          attribute_roll_sum,
          jewel_type,
          cluster_size,
          cluster_passive_count,
          notable_count,
          damage_mod_count,
          defence_mod_count,
          utility_mod_count,
          gem_level,
          gem_quality,
          is_awakened,
          is_vaal,
          is_support_gem,
          gem_tags
        FROM training_features_raw
        WHERE
          $1::timestamptz IS NULL
          OR source_updated_at > $1::timestamptz
          OR (source_updated_at = $1::timestamptz AND listing_key > $2)
        ORDER BY source_updated_at ASC, listing_key ASC
        LIMIT $3
      `,
      [cursor?.updatedAt ?? null, cursor?.listingKey ?? "", limit],
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
