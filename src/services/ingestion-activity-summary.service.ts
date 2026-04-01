import { env } from "../config/env";
import { IngestionActivitySummaryRepository } from "../repositories/ingestion-activity-summary.repository";

export type IngestionActivitySummaryRefreshResult = {
  targetLeague: string;
  affectedRows: number;
  breakdown: Array<{
    summarySource: "raw_response" | "normalized_listing" | "exchange_rate_snapshot";
    bucketGranularity: "hour" | "day";
    affectedRows: number;
  }>;
};

export class IngestionActivitySummaryService {
  private schemaEnsured = false;

  constructor(
    private readonly summaryRepository = new IngestionActivitySummaryRepository(),
  ) {}

  private async ensureSchema(): Promise<void> {
    if (this.schemaEnsured) {
      return;
    }

    await this.summaryRepository.ensureSchema();
    this.schemaEnsured = true;
  }

  async recordCollectorCycle(input: {
    targetLeague?: string;
    observedAt?: Date;
    rawStashCount: number;
    normalizedCount: number;
  }): Promise<number> {
    await this.ensureSchema();

    const targetLeague = input.targetLeague ?? env.TARGET_LEAGUE;
    const observedAt = input.observedAt ?? new Date();
    let affectedRows = 0;

    affectedRows += await this.summaryRepository.incrementSummaryBuckets(
      "raw_response",
      targetLeague,
      observedAt,
      1,
      input.rawStashCount,
    );

    if (input.normalizedCount > 0) {
      affectedRows += await this.summaryRepository.incrementSummaryBuckets(
        "normalized_listing",
        targetLeague,
        observedAt,
        input.normalizedCount,
        null,
      );
    }

    return affectedRows;
  }

  async recordExchangeRateCollection(input: {
    targetLeague?: string;
    observedAt?: Date;
    insertedCount: number;
  }): Promise<number> {
    if (input.insertedCount <= 0) {
      return 0;
    }

    await this.ensureSchema();

    return this.summaryRepository.incrementSummaryBuckets(
      "exchange_rate_snapshot",
      input.targetLeague ?? env.TARGET_LEAGUE,
      input.observedAt ?? new Date(),
      input.insertedCount,
      null,
    );
  }

  async refreshRecentSummaries(): Promise<IngestionActivitySummaryRefreshResult> {
    await this.ensureSchema();
    const breakdown = await this.summaryRepository.refreshRecentSummaries();

    return {
      targetLeague: env.TARGET_LEAGUE,
      affectedRows: breakdown.reduce((sum, item) => sum + item.affectedRows, 0),
      breakdown,
    };
  }
}
