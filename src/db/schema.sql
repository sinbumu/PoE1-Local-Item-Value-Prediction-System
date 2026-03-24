CREATE TABLE IF NOT EXISTS raw_api_responses (
  id BIGSERIAL PRIMARY KEY,
  requested_change_id TEXT,
  response_next_change_id TEXT NOT NULL,
  stash_count INTEGER NOT NULL,
  payload JSONB NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_raw_api_responses_fetched_at
  ON raw_api_responses (fetched_at DESC);

CREATE INDEX IF NOT EXISTS idx_raw_api_responses_response_next_change_id
  ON raw_api_responses (response_next_change_id);

CREATE TABLE IF NOT EXISTS collector_state (
  state_key TEXT PRIMARY KEY,
  state_value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS normalized_priced_items (
  id BIGSERIAL PRIMARY KEY,
  listing_key TEXT NOT NULL UNIQUE,
  stash_change_id TEXT NOT NULL,
  item_id TEXT,
  account_name TEXT,
  stash_name TEXT,
  stash_type TEXT,
  league TEXT,
  item_name TEXT NOT NULL,
  type_line TEXT NOT NULL,
  base_type TEXT,
  rarity TEXT,
  frame_type INTEGER,
  note_raw TEXT NOT NULL,
  note_source TEXT NOT NULL,
  listing_mode TEXT,
  price_amount NUMERIC,
  price_currency TEXT,
  item_json JSONB NOT NULL,
  inserted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_normalized_priced_items_league
  ON normalized_priced_items (league);

CREATE INDEX IF NOT EXISTS idx_normalized_priced_items_price_currency
  ON normalized_priced_items (price_currency);

CREATE INDEX IF NOT EXISTS idx_normalized_priced_items_type_line
  ON normalized_priced_items (type_line);

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

CREATE INDEX IF NOT EXISTS idx_training_features_raw_source_updated_at
  ON training_features_raw (source_updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_training_features_raw_item_class
  ON training_features_raw (item_class);

CREATE INDEX IF NOT EXISTS idx_training_features_raw_price_currency
  ON training_features_raw (price_currency);

CREATE TABLE IF NOT EXISTS training_features_clean (
  id BIGSERIAL PRIMARY KEY,
  listing_key TEXT NOT NULL UNIQUE,
  source_updated_at TIMESTAMPTZ NOT NULL,
  league TEXT,
  model_segment TEXT NOT NULL,
  clean_reason TEXT NOT NULL,
  target_price_amount NUMERIC NOT NULL,
  target_price_currency TEXT NOT NULL,
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
  cleaned_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_training_features_clean_source_updated_at
  ON training_features_clean (source_updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_training_features_clean_model_segment
  ON training_features_clean (model_segment);

CREATE INDEX IF NOT EXISTS idx_training_features_clean_target_currency
  ON training_features_clean (target_price_currency);
