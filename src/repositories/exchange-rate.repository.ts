import { pool } from "../db/client";
import type { ExchangeRateSnapshot } from "../types/exchange-rate.types";

const EXCHANGE_RATE_COLUMNS = [
  "source",
  "league",
  "overview_type",
  "details_id",
  "currency_type_name",
  "normalized_currency_code",
  "sample_time_utc",
  "chaos_equivalent",
  "pay_value",
  "receive_value",
  "pay_count",
  "receive_count",
  "pay_listing_count",
  "receive_listing_count",
] as const;

function buildRowValues(snapshot: ExchangeRateSnapshot): Array<unknown> {
  return [
    snapshot.source,
    snapshot.league,
    snapshot.overviewType,
    snapshot.detailsId,
    snapshot.currencyTypeName,
    snapshot.normalizedCurrencyCode,
    snapshot.sampleTimeUtc,
    snapshot.chaosEquivalent,
    snapshot.payValue,
    snapshot.receiveValue,
    snapshot.payCount,
    snapshot.receiveCount,
    snapshot.payListingCount,
    snapshot.receiveListingCount,
  ];
}

export class ExchangeRateRepository {
  async ensureSchema(): Promise<void> {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS exchange_rate_snapshots (
        id BIGSERIAL PRIMARY KEY,
        source TEXT NOT NULL,
        league TEXT NOT NULL,
        overview_type TEXT NOT NULL,
        details_id TEXT NOT NULL,
        currency_type_name TEXT NOT NULL,
        normalized_currency_code TEXT,
        sample_time_utc TIMESTAMPTZ NOT NULL,
        chaos_equivalent NUMERIC NOT NULL,
        pay_value NUMERIC,
        receive_value NUMERIC,
        pay_count INTEGER,
        receive_count INTEGER,
        pay_listing_count INTEGER,
        receive_listing_count INTEGER,
        collected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (source, league, overview_type, details_id, sample_time_utc)
      );
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_exchange_rate_snapshots_lookup
        ON exchange_rate_snapshots (league, normalized_currency_code, sample_time_utc DESC);
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_exchange_rate_snapshots_details
        ON exchange_rate_snapshots (league, details_id, sample_time_utc DESC);
    `);
  }

  async upsertMany(snapshots: ExchangeRateSnapshot[]): Promise<number> {
    if (snapshots.length === 0) {
      return 0;
    }

    const values = snapshots.flatMap((snapshot) => buildRowValues(snapshot));
    const placeholders = snapshots
      .map((_snapshot, rowIndex) => {
        const start = rowIndex * EXCHANGE_RATE_COLUMNS.length;
        const rowPlaceholders = EXCHANGE_RATE_COLUMNS.map(
          (_column, columnIndex) => `$${start + columnIndex + 1}`,
        );

        return `(${rowPlaceholders.join(", ")})`;
      })
      .join(", ");

    await pool.query(
      `
        INSERT INTO exchange_rate_snapshots (
          ${EXCHANGE_RATE_COLUMNS.join(", ")}
        )
        VALUES ${placeholders}
        ON CONFLICT (source, league, overview_type, details_id, sample_time_utc)
        DO UPDATE SET
          currency_type_name = EXCLUDED.currency_type_name,
          normalized_currency_code = EXCLUDED.normalized_currency_code,
          chaos_equivalent = EXCLUDED.chaos_equivalent,
          pay_value = EXCLUDED.pay_value,
          receive_value = EXCLUDED.receive_value,
          pay_count = EXCLUDED.pay_count,
          receive_count = EXCLUDED.receive_count,
          pay_listing_count = EXCLUDED.pay_listing_count,
          receive_listing_count = EXCLUDED.receive_listing_count
      `,
      values,
    );

    return snapshots.length;
  }
}
