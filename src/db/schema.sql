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
