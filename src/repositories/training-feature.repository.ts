import { pool } from "../db/client";
import type { TrainingFeatureRaw } from "../types/training-features.types";

const TRAINING_FEATURE_COLUMNS = [
  "listing_key",
  "source_item_id",
  "source_inserted_at",
  "source_updated_at",
  "league",
  "item_class",
  "base_type",
  "rarity",
  "frame_type",
  "ilvl",
  "identified",
  "corrupted",
  "fractured",
  "synthesised",
  "duplicated",
  "influence_shaper",
  "influence_elder",
  "influence_crusader",
  "influence_redeemer",
  "influence_hunter",
  "influence_warlord",
  "influence_searing",
  "influence_tangled",
  "socket_count",
  "link_count",
  "white_socket_count",
  "prefix_count",
  "suffix_count",
  "explicit_mod_count",
  "implicit_mod_count",
  "crafted_mod_count",
  "fractured_mod_count",
  "enchant_mod_count",
  "price_amount",
  "price_currency",
  "listing_mode",
  "quality",
  "armour",
  "evasion",
  "energy_shield",
  "ward",
  "physical_dps",
  "elemental_dps",
  "attack_speed",
  "crit_chance",
  "move_speed",
  "life_roll_sum",
  "resistance_roll_sum",
  "attribute_roll_sum",
  "jewel_type",
  "cluster_size",
  "cluster_passive_count",
  "notable_count",
  "damage_mod_count",
  "defence_mod_count",
  "utility_mod_count",
  "gem_level",
  "gem_quality",
  "is_awakened",
  "is_vaal",
  "is_support_gem",
  "gem_tags",
  "extracted_at",
] as const;

function buildRowValues(feature: TrainingFeatureRaw): Array<unknown> {
  return [
    feature.listingKey,
    feature.sourceItemId,
    feature.sourceInsertedAt,
    feature.sourceUpdatedAt,
    feature.league,
    feature.itemClass,
    feature.baseType,
    feature.rarity,
    feature.frameType,
    feature.ilvl,
    feature.identified,
    feature.corrupted,
    feature.fractured,
    feature.synthesised,
    feature.duplicated,
    feature.influenceShaper,
    feature.influenceElder,
    feature.influenceCrusader,
    feature.influenceRedeemer,
    feature.influenceHunter,
    feature.influenceWarlord,
    feature.influenceSearing,
    feature.influenceTangled,
    feature.socketCount,
    feature.linkCount,
    feature.whiteSocketCount,
    feature.prefixCount,
    feature.suffixCount,
    feature.explicitModCount,
    feature.implicitModCount,
    feature.craftedModCount,
    feature.fracturedModCount,
    feature.enchantModCount,
    feature.priceAmount,
    feature.priceCurrency,
    feature.listingMode,
    feature.quality,
    feature.armour,
    feature.evasion,
    feature.energyShield,
    feature.ward,
    feature.physicalDps,
    feature.elementalDps,
    feature.attackSpeed,
    feature.critChance,
    feature.moveSpeed,
    feature.lifeRollSum,
    feature.resistanceRollSum,
    feature.attributeRollSum,
    feature.jewelType,
    feature.clusterSize,
    feature.clusterPassiveCount,
    feature.notableCount,
    feature.damageModCount,
    feature.defenceModCount,
    feature.utilityModCount,
    feature.gemLevel,
    feature.gemQuality,
    feature.isAwakened,
    feature.isVaal,
    feature.isSupportGem,
    feature.gemTags,
    new Date().toISOString(),
  ];
}

export class TrainingFeatureRepository {
  async ensureSchema(): Promise<void> {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS training_features_raw (
        id BIGSERIAL PRIMARY KEY,
        listing_key TEXT NOT NULL UNIQUE,
        source_item_id TEXT,
        source_inserted_at TIMESTAMPTZ NOT NULL,
        source_updated_at TIMESTAMPTZ NOT NULL,
        league TEXT,
        item_class TEXT NOT NULL,
        base_type TEXT,
        rarity TEXT,
        frame_type INTEGER,
        ilvl INTEGER,
        identified BOOLEAN NOT NULL,
        corrupted BOOLEAN NOT NULL,
        fractured BOOLEAN NOT NULL,
        synthesised BOOLEAN NOT NULL,
        duplicated BOOLEAN NOT NULL,
        influence_shaper BOOLEAN NOT NULL,
        influence_elder BOOLEAN NOT NULL,
        influence_crusader BOOLEAN NOT NULL,
        influence_redeemer BOOLEAN NOT NULL,
        influence_hunter BOOLEAN NOT NULL,
        influence_warlord BOOLEAN NOT NULL,
        influence_searing BOOLEAN NOT NULL,
        influence_tangled BOOLEAN NOT NULL,
        socket_count INTEGER NOT NULL,
        link_count INTEGER NOT NULL,
        white_socket_count INTEGER NOT NULL,
        prefix_count INTEGER,
        suffix_count INTEGER,
        explicit_mod_count INTEGER NOT NULL,
        implicit_mod_count INTEGER NOT NULL,
        crafted_mod_count INTEGER NOT NULL,
        fractured_mod_count INTEGER NOT NULL,
        enchant_mod_count INTEGER NOT NULL,
        price_amount NUMERIC,
        price_currency TEXT,
        listing_mode TEXT,
        quality NUMERIC,
        armour NUMERIC,
        evasion NUMERIC,
        energy_shield NUMERIC,
        ward NUMERIC,
        physical_dps NUMERIC,
        elemental_dps NUMERIC,
        attack_speed NUMERIC,
        crit_chance NUMERIC,
        move_speed NUMERIC,
        life_roll_sum NUMERIC,
        resistance_roll_sum NUMERIC,
        attribute_roll_sum NUMERIC,
        jewel_type TEXT,
        cluster_size TEXT,
        cluster_passive_count INTEGER,
        notable_count INTEGER,
        damage_mod_count INTEGER,
        defence_mod_count INTEGER,
        utility_mod_count INTEGER,
        gem_level INTEGER,
        gem_quality NUMERIC,
        is_awakened BOOLEAN,
        is_vaal BOOLEAN,
        is_support_gem BOOLEAN,
        gem_tags TEXT[] NOT NULL DEFAULT '{}',
        extracted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_training_features_raw_source_updated_at
        ON training_features_raw (source_updated_at DESC);
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_training_features_raw_item_class
        ON training_features_raw (item_class);
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_training_features_raw_price_currency
        ON training_features_raw (price_currency);
    `);
  }

  async upsertMany(features: TrainingFeatureRaw[]): Promise<number> {
    if (features.length === 0) {
      return 0;
    }

    const values = features.flatMap((feature) => buildRowValues(feature));
    const placeholders = features
      .map((feature, rowIndex) => {
        const start = rowIndex * TRAINING_FEATURE_COLUMNS.length;
        const rowPlaceholders = TRAINING_FEATURE_COLUMNS.map(
          (_column, columnIndex) => `$${start + columnIndex + 1}`,
        );

        return `(${rowPlaceholders.join(", ")})`;
      })
      .join(", ");

    await pool.query(
      `
        INSERT INTO training_features_raw (
          ${TRAINING_FEATURE_COLUMNS.join(", ")}
        )
        VALUES ${placeholders}
        ON CONFLICT (listing_key)
        DO UPDATE SET
          source_item_id = EXCLUDED.source_item_id,
          source_inserted_at = EXCLUDED.source_inserted_at,
          source_updated_at = EXCLUDED.source_updated_at,
          league = EXCLUDED.league,
          item_class = EXCLUDED.item_class,
          base_type = EXCLUDED.base_type,
          rarity = EXCLUDED.rarity,
          frame_type = EXCLUDED.frame_type,
          ilvl = EXCLUDED.ilvl,
          identified = EXCLUDED.identified,
          corrupted = EXCLUDED.corrupted,
          fractured = EXCLUDED.fractured,
          synthesised = EXCLUDED.synthesised,
          duplicated = EXCLUDED.duplicated,
          influence_shaper = EXCLUDED.influence_shaper,
          influence_elder = EXCLUDED.influence_elder,
          influence_crusader = EXCLUDED.influence_crusader,
          influence_redeemer = EXCLUDED.influence_redeemer,
          influence_hunter = EXCLUDED.influence_hunter,
          influence_warlord = EXCLUDED.influence_warlord,
          influence_searing = EXCLUDED.influence_searing,
          influence_tangled = EXCLUDED.influence_tangled,
          socket_count = EXCLUDED.socket_count,
          link_count = EXCLUDED.link_count,
          white_socket_count = EXCLUDED.white_socket_count,
          prefix_count = EXCLUDED.prefix_count,
          suffix_count = EXCLUDED.suffix_count,
          explicit_mod_count = EXCLUDED.explicit_mod_count,
          implicit_mod_count = EXCLUDED.implicit_mod_count,
          crafted_mod_count = EXCLUDED.crafted_mod_count,
          fractured_mod_count = EXCLUDED.fractured_mod_count,
          enchant_mod_count = EXCLUDED.enchant_mod_count,
          price_amount = EXCLUDED.price_amount,
          price_currency = EXCLUDED.price_currency,
          listing_mode = EXCLUDED.listing_mode,
          quality = EXCLUDED.quality,
          armour = EXCLUDED.armour,
          evasion = EXCLUDED.evasion,
          energy_shield = EXCLUDED.energy_shield,
          ward = EXCLUDED.ward,
          physical_dps = EXCLUDED.physical_dps,
          elemental_dps = EXCLUDED.elemental_dps,
          attack_speed = EXCLUDED.attack_speed,
          crit_chance = EXCLUDED.crit_chance,
          move_speed = EXCLUDED.move_speed,
          life_roll_sum = EXCLUDED.life_roll_sum,
          resistance_roll_sum = EXCLUDED.resistance_roll_sum,
          attribute_roll_sum = EXCLUDED.attribute_roll_sum,
          jewel_type = EXCLUDED.jewel_type,
          cluster_size = EXCLUDED.cluster_size,
          cluster_passive_count = EXCLUDED.cluster_passive_count,
          notable_count = EXCLUDED.notable_count,
          damage_mod_count = EXCLUDED.damage_mod_count,
          defence_mod_count = EXCLUDED.defence_mod_count,
          utility_mod_count = EXCLUDED.utility_mod_count,
          gem_level = EXCLUDED.gem_level,
          gem_quality = EXCLUDED.gem_quality,
          is_awakened = EXCLUDED.is_awakened,
          is_vaal = EXCLUDED.is_vaal,
          is_support_gem = EXCLUDED.is_support_gem,
          gem_tags = EXCLUDED.gem_tags,
          extracted_at = EXCLUDED.extracted_at
      `,
      values,
    );

    return features.length;
  }
}
