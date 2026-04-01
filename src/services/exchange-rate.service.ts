import { env } from "../config/env";
import { ExchangeRateRepository } from "../repositories/exchange-rate.repository";
import type { ExchangeRateSnapshot } from "../types/exchange-rate.types";
import { logger } from "../utils/logger";
import { IngestionActivitySummaryService } from "./ingestion-activity-summary.service";
import { PoeNinjaService } from "./poe-ninja.service";

export type CollectExchangeRatesResult = {
  insertedCount: number;
  league: string;
  source: "poe_ninja";
  sampleTimeUtc: string | null;
  divineChaosEquivalent: number | null;
};

export class ExchangeRateService {
  constructor(
    private readonly poeNinjaService = new PoeNinjaService(),
    private readonly exchangeRateRepository = new ExchangeRateRepository(),
    private readonly ingestionActivitySummaryService = new IngestionActivitySummaryService(),
  ) {}

  async collectSnapshots(
    league = env.TARGET_LEAGUE,
  ): Promise<CollectExchangeRatesResult> {
    await this.exchangeRateRepository.ensureSchema();

    const snapshots = await this.poeNinjaService.fetchExchangeRateSnapshots(league);
    const insertedCount = await this.exchangeRateRepository.upsertMany(snapshots);
    const divineLine = snapshots.find(
      (snapshot) => snapshot.normalizedCurrencyCode === "divine",
    );

    logger.info(
      {
        league,
        insertedCount,
        sampleTimeUtc: divineLine?.sampleTimeUtc ?? null,
        divineChaosEquivalent: divineLine?.chaosEquivalent ?? null,
      },
      "Collected exchange rate snapshots",
    );

    try {
      await this.ingestionActivitySummaryService.recordExchangeRateCollection({
        targetLeague: league,
        observedAt: divineLine?.sampleTimeUtc
          ? new Date(divineLine.sampleTimeUtc)
          : snapshots[0]?.sampleTimeUtc
            ? new Date(snapshots[0].sampleTimeUtc)
            : new Date(),
        insertedCount,
      });
    } catch (error) {
      logger.warn(
        {
          err: error,
          league,
          insertedCount,
        },
        "Exchange rate activity summary update failed",
      );
    }

    return {
      insertedCount,
      league,
      source: "poe_ninja",
      sampleTimeUtc: divineLine?.sampleTimeUtc ?? snapshots[0]?.sampleTimeUtc ?? null,
      divineChaosEquivalent: divineLine?.chaosEquivalent ?? null,
    };
  }
}
