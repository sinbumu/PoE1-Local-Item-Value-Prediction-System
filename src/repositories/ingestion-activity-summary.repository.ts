import { env } from "../config/env";
import { pool } from "../db/client";

type BucketGranularity = "hour" | "day";
type SummarySource = "raw_response" | "normalized_listing" | "exchange_rate_snapshot";

type RefreshResult = {
  affectedRows: number;
  bucketGranularity: BucketGranularity;
  summarySource: SummarySource;
};

const NORMALIZED_HOURLY_REFRESH_HOURS = 3;
const NORMALIZED_DAILY_REFRESH_DAYS = 2;

function isIgnorableDuplicateSchemaError(error: unknown): boolean {
  if (!error || typeof error !== "object" || !("code" in error)) {
    return false;
  }

  const code = String(error.code);
  return code === "42P07" || code === "23505";
}

export class IngestionActivitySummaryRepository {
  async ensureSchema(): Promise<void> {
    const schemaStatements = [
      `
        CREATE INDEX IF NOT EXISTS idx_normalized_priced_items_updated_at
          ON normalized_priced_items (updated_at DESC);
      `,
      `
        CREATE TABLE IF NOT EXISTS ingestion_activity_summaries (
          id BIGSERIAL PRIMARY KEY,
          summary_source TEXT NOT NULL,
          bucket_granularity TEXT NOT NULL,
          bucket_start TIMESTAMPTZ NOT NULL,
          target_league TEXT NOT NULL,
          event_count INTEGER NOT NULL DEFAULT 0,
          auxiliary_count INTEGER,
          refreshed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE (summary_source, bucket_granularity, bucket_start, target_league)
        );
      `,
      `
        CREATE INDEX IF NOT EXISTS idx_ingestion_activity_summaries_bucket
          ON ingestion_activity_summaries (bucket_granularity, bucket_start DESC);
      `,
      `
        CREATE INDEX IF NOT EXISTS idx_ingestion_activity_summaries_source
          ON ingestion_activity_summaries (summary_source, target_league, bucket_start DESC);
      `,
    ];

    for (const statement of schemaStatements) {
      try {
        await pool.query(statement);
      } catch (error) {
        if (!isIgnorableDuplicateSchemaError(error)) {
          throw error;
        }
      }
    }
  }

  async refreshRecentSummaries(): Promise<RefreshResult[]> {
    const results: RefreshResult[] = [];

    results.push(await this.refreshRawHourlySummary());
    results.push(await this.refreshRawDailySummary());
    results.push(await this.refreshNormalizedHourlySummary());
    results.push(await this.refreshNormalizedDailySummary());
    results.push(await this.refreshExchangeRateHourlySummary());
    results.push(await this.refreshExchangeRateDailySummary());

    return results;
  }

  async incrementSummaryBuckets(
    summarySource: SummarySource,
    targetLeague: string,
    observedAt: Date,
    eventCount: number,
    auxiliaryCount?: number | null,
  ): Promise<number> {
    if (eventCount === 0 && (auxiliaryCount === undefined || auxiliaryCount === null)) {
      return 0;
    }

    const result = await pool.query(
      `
        INSERT INTO ingestion_activity_summaries (
          summary_source,
          bucket_granularity,
          bucket_start,
          target_league,
          event_count,
          auxiliary_count,
          refreshed_at
        )
        VALUES
          ($1, 'hour', date_trunc('hour', $2::timestamptz), $3, $4, $5, NOW()),
          ($1, 'day', date_trunc('day', $2::timestamptz), $3, $4, $5, NOW())
        ON CONFLICT (summary_source, bucket_granularity, bucket_start, target_league)
        DO UPDATE SET
          event_count = ingestion_activity_summaries.event_count + EXCLUDED.event_count,
          auxiliary_count = CASE
            WHEN EXCLUDED.auxiliary_count IS NULL THEN ingestion_activity_summaries.auxiliary_count
            ELSE COALESCE(ingestion_activity_summaries.auxiliary_count, 0) + EXCLUDED.auxiliary_count
          END,
          refreshed_at = NOW()
      `,
      [summarySource, observedAt.toISOString(), targetLeague, eventCount, auxiliaryCount ?? null],
    );

    return result.rowCount ?? 0;
  }

  private async refreshRawHourlySummary(): Promise<RefreshResult> {
    const result = await pool.query(
      `
        INSERT INTO ingestion_activity_summaries (
          summary_source,
          bucket_granularity,
          bucket_start,
          target_league,
          event_count,
          auxiliary_count,
          refreshed_at
        )
        SELECT
          'raw_response',
          'hour',
          bucket.bucket_start,
          $1,
          COALESCE(raw_counts.event_count, 0),
          COALESCE(raw_counts.auxiliary_count, 0),
          NOW()
        FROM (
          SELECT generate_series(
            date_trunc('hour', NOW() - (($2 - 1) * INTERVAL '1 hour')),
            date_trunc('hour', NOW()),
            INTERVAL '1 hour'
          ) AS bucket_start
        ) AS bucket
        LEFT JOIN (
          SELECT
            date_trunc('hour', fetched_at) AS bucket_start,
            COUNT(*)::int AS event_count,
            COALESCE(SUM(stash_count), 0)::int AS auxiliary_count
          FROM raw_api_responses
          WHERE fetched_at >= NOW() - ($2 * INTERVAL '1 hour')
          GROUP BY 1
        ) AS raw_counts
          ON raw_counts.bucket_start = bucket.bucket_start
        ON CONFLICT (summary_source, bucket_granularity, bucket_start, target_league)
        DO UPDATE SET
          event_count = EXCLUDED.event_count,
          auxiliary_count = EXCLUDED.auxiliary_count,
          refreshed_at = NOW()
      `,
      [env.TARGET_LEAGUE, env.RAW_RETENTION_HOURS + 1],
    );

    return {
      affectedRows: result.rowCount ?? 0,
      bucketGranularity: "hour",
      summarySource: "raw_response",
    };
  }

  private async refreshRawDailySummary(): Promise<RefreshResult> {
    const result = await pool.query(
      `
        INSERT INTO ingestion_activity_summaries (
          summary_source,
          bucket_granularity,
          bucket_start,
          target_league,
          event_count,
          auxiliary_count,
          refreshed_at
        )
        SELECT
          'raw_response',
          'day',
          bucket.bucket_start,
          $1,
          COALESCE(raw_counts.event_count, 0),
          COALESCE(raw_counts.auxiliary_count, 0),
          NOW()
        FROM (
          SELECT generate_series(
            date_trunc('day', NOW() - (($2 - 1) * INTERVAL '1 day')),
            date_trunc('day', NOW()),
            INTERVAL '1 day'
          ) AS bucket_start
        ) AS bucket
        LEFT JOIN (
          SELECT
            date_trunc('day', fetched_at) AS bucket_start,
            COUNT(*)::int AS event_count,
            COALESCE(SUM(stash_count), 0)::int AS auxiliary_count
          FROM raw_api_responses
          WHERE fetched_at >= NOW() - ($3 * INTERVAL '1 hour')
          GROUP BY 1
        ) AS raw_counts
          ON raw_counts.bucket_start = bucket.bucket_start
        ON CONFLICT (summary_source, bucket_granularity, bucket_start, target_league)
        DO UPDATE SET
          event_count = EXCLUDED.event_count,
          auxiliary_count = EXCLUDED.auxiliary_count,
          refreshed_at = NOW()
      `,
      [
        env.TARGET_LEAGUE,
        Math.ceil(env.RAW_RETENTION_HOURS / 24) + 1,
        env.RAW_RETENTION_HOURS,
      ],
    );

    return {
      affectedRows: result.rowCount ?? 0,
      bucketGranularity: "day",
      summarySource: "raw_response",
    };
  }

  private async refreshNormalizedHourlySummary(): Promise<RefreshResult> {
    const result = await pool.query(
      `
        INSERT INTO ingestion_activity_summaries (
          summary_source,
          bucket_granularity,
          bucket_start,
          target_league,
          event_count,
          auxiliary_count,
          refreshed_at
        )
        SELECT
          'normalized_listing',
          'hour',
          bucket.bucket_start,
          $1,
          COALESCE(normalized_counts.event_count, 0),
          NULL,
          NOW()
        FROM (
          SELECT generate_series(
            date_trunc('hour', NOW() - (($2 - 1) * INTERVAL '1 hour')),
            date_trunc('hour', NOW()),
            INTERVAL '1 hour'
          ) AS bucket_start
        ) AS bucket
        LEFT JOIN (
          SELECT
            date_trunc('hour', updated_at) AS bucket_start,
            COUNT(*)::int AS event_count
          FROM normalized_priced_items
          WHERE updated_at >= NOW() - ($2 * INTERVAL '1 hour')
          GROUP BY 1
        ) AS normalized_counts
          ON normalized_counts.bucket_start = bucket.bucket_start
        ON CONFLICT (summary_source, bucket_granularity, bucket_start, target_league)
        DO UPDATE SET
          event_count = EXCLUDED.event_count,
          auxiliary_count = EXCLUDED.auxiliary_count,
          refreshed_at = NOW()
      `,
      [env.TARGET_LEAGUE, NORMALIZED_HOURLY_REFRESH_HOURS],
    );

    return {
      affectedRows: result.rowCount ?? 0,
      bucketGranularity: "hour",
      summarySource: "normalized_listing",
    };
  }

  private async refreshNormalizedDailySummary(): Promise<RefreshResult> {
    const result = await pool.query(
      `
        INSERT INTO ingestion_activity_summaries (
          summary_source,
          bucket_granularity,
          bucket_start,
          target_league,
          event_count,
          auxiliary_count,
          refreshed_at
        )
        SELECT
          'normalized_listing',
          'day',
          bucket.bucket_start,
          $1,
          COALESCE(normalized_counts.event_count, 0),
          NULL,
          NOW()
        FROM (
          SELECT generate_series(
            date_trunc('day', NOW() - (($2 - 1) * INTERVAL '1 day')),
            date_trunc('day', NOW()),
            INTERVAL '1 day'
          ) AS bucket_start
        ) AS bucket
        LEFT JOIN (
          SELECT
            date_trunc('day', updated_at) AS bucket_start,
            COUNT(*)::int AS event_count
          FROM normalized_priced_items
          WHERE updated_at >= NOW() - ($3 * INTERVAL '1 hour')
          GROUP BY 1
        ) AS normalized_counts
          ON normalized_counts.bucket_start = bucket.bucket_start
        ON CONFLICT (summary_source, bucket_granularity, bucket_start, target_league)
        DO UPDATE SET
          event_count = EXCLUDED.event_count,
          auxiliary_count = EXCLUDED.auxiliary_count,
          refreshed_at = NOW()
      `,
      [
        env.TARGET_LEAGUE,
        NORMALIZED_DAILY_REFRESH_DAYS,
        NORMALIZED_DAILY_REFRESH_DAYS * 24,
      ],
    );

    return {
      affectedRows: result.rowCount ?? 0,
      bucketGranularity: "day",
      summarySource: "normalized_listing",
    };
  }

  private async refreshExchangeRateHourlySummary(): Promise<RefreshResult> {
    const result = await pool.query(
      `
        INSERT INTO ingestion_activity_summaries (
          summary_source,
          bucket_granularity,
          bucket_start,
          target_league,
          event_count,
          auxiliary_count,
          refreshed_at
        )
        SELECT
          'exchange_rate_snapshot',
          'hour',
          bucket.bucket_start,
          $1,
          COALESCE(exchange_counts.event_count, 0),
          NULL,
          NOW()
        FROM (
          SELECT generate_series(
            date_trunc('hour', NOW() - (($2 - 1) * INTERVAL '1 hour')),
            date_trunc('hour', NOW()),
            INTERVAL '1 hour'
          ) AS bucket_start
        ) AS bucket
        LEFT JOIN (
          SELECT
            date_trunc('hour', sample_time_utc) AS bucket_start,
            COUNT(*)::int AS event_count
          FROM exchange_rate_snapshots
          WHERE league = $1
            AND sample_time_utc >= NOW() - ($2 * INTERVAL '1 hour')
          GROUP BY 1
        ) AS exchange_counts
          ON exchange_counts.bucket_start = bucket.bucket_start
        ON CONFLICT (summary_source, bucket_granularity, bucket_start, target_league)
        DO UPDATE SET
          event_count = EXCLUDED.event_count,
          auxiliary_count = EXCLUDED.auxiliary_count,
          refreshed_at = NOW()
      `,
      [env.TARGET_LEAGUE, 24 * 14],
    );

    return {
      affectedRows: result.rowCount ?? 0,
      bucketGranularity: "hour",
      summarySource: "exchange_rate_snapshot",
    };
  }

  private async refreshExchangeRateDailySummary(): Promise<RefreshResult> {
    const result = await pool.query(
      `
        INSERT INTO ingestion_activity_summaries (
          summary_source,
          bucket_granularity,
          bucket_start,
          target_league,
          event_count,
          auxiliary_count,
          refreshed_at
        )
        SELECT
          'exchange_rate_snapshot',
          'day',
          bucket.bucket_start,
          $1,
          COALESCE(exchange_counts.event_count, 0),
          NULL,
          NOW()
        FROM (
          SELECT generate_series(
            date_trunc('day', NOW() - (($2 - 1) * INTERVAL '1 day')),
            date_trunc('day', NOW()),
            INTERVAL '1 day'
          ) AS bucket_start
        ) AS bucket
        LEFT JOIN (
          SELECT
            date_trunc('day', sample_time_utc) AS bucket_start,
            COUNT(*)::int AS event_count
          FROM exchange_rate_snapshots
          WHERE league = $1
            AND sample_time_utc >= NOW() - ($2 * INTERVAL '1 day')
          GROUP BY 1
        ) AS exchange_counts
          ON exchange_counts.bucket_start = bucket.bucket_start
        ON CONFLICT (summary_source, bucket_granularity, bucket_start, target_league)
        DO UPDATE SET
          event_count = EXCLUDED.event_count,
          auxiliary_count = EXCLUDED.auxiliary_count,
          refreshed_at = NOW()
      `,
      [env.TARGET_LEAGUE, 30],
    );

    return {
      affectedRows: result.rowCount ?? 0,
      bucketGranularity: "day",
      summarySource: "exchange_rate_snapshot",
    };
  }
}
