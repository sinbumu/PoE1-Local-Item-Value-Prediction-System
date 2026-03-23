import axios from "axios";
import { env } from "../config/env";
import { CollectorStateRepository } from "../repositories/collector-state.repository";
import { NormalizedItemRepository } from "../repositories/normalized-item.repository";
import { RawResponseRepository } from "../repositories/raw-response.repository";
import { logger } from "../utils/logger";
import { sleep } from "../utils/time";
import { AuthService } from "./auth.service";
import { LeagueFilterService } from "./league-filter.service";
import { NormalizeService } from "./normalize.service";
import { formatAxiosError, PoeApiService } from "./poe-api.service";

type CollectorCycleResult = {
  nextChangeId: string;
  normalizedCount: number;
  stashCount: number;
};

type CollectorRunOptions = {
  startLatest?: boolean;
};

export class CollectorService {
  constructor(
    private readonly authService = new AuthService(),
    private readonly poeApiService = new PoeApiService(),
    private readonly rawResponseRepository = new RawResponseRepository(),
    private readonly collectorStateRepository = new CollectorStateRepository(),
    private readonly normalizedItemRepository = new NormalizedItemRepository(),
    private readonly normalizeService = new NormalizeService(),
    private readonly leagueFilterService = new LeagueFilterService(),
  ) {}

  private async fetchPublicStashesWithAuthRetry(
    requestedChangeId?: string,
  ) {
    let accessToken = await this.authService.getAccessToken();

    try {
      return await this.poeApiService.getPublicStashes(
        accessToken,
        requestedChangeId,
      );
    } catch (error) {
      if (!axios.isAxiosError(error) || error.response?.status !== 401) {
        throw error;
      }

      logger.warn(
        {
          requestedChangeId: requestedChangeId ?? null,
        },
        "Cached access token rejected, refreshing token",
      );

      this.authService.clearCachedAccessToken();
      accessToken = await this.authService.getAccessToken(true);

      return this.poeApiService.getPublicStashes(accessToken, requestedChangeId);
    }
  }

  private async resolveRequestedChangeId(
    options?: CollectorRunOptions,
  ): Promise<string | undefined> {
    const savedNextChangeId =
      await this.collectorStateRepository.getLatestNextChangeId();
    if (savedNextChangeId) {
      return savedNextChangeId;
    }

    if (options?.startLatest) {
      return this.poeApiService.getLatestPublicStashChangeId();
    }

    return env.START_NEXT_CHANGE_ID ?? undefined;
  }

  async runOnce(options?: CollectorRunOptions): Promise<CollectorCycleResult> {
    const savedNextChangeId =
      await this.collectorStateRepository.getLatestNextChangeId();
    const requestedChangeId = await this.resolveRequestedChangeId(options);

    logger.info(
      {
        requestedChangeId: requestedChangeId ?? null,
        savedNextChangeId,
        configuredStartNextChangeId: env.START_NEXT_CHANGE_ID ?? null,
        startLatest: options?.startLatest ?? false,
      },
      "Starting collector cycle",
    );

    const response = await this.fetchPublicStashesWithAuthRetry(
      requestedChangeId ?? undefined,
    );
    const filteredResponse = this.leagueFilterService.filterResponse(response);

    await this.rawResponseRepository.insert(
      filteredResponse,
      requestedChangeId ?? undefined,
    );
    const normalizedRows = this.normalizeService.normalizeResponse(filteredResponse);
    const normalizedCount =
      await this.normalizedItemRepository.upsertMany(normalizedRows);
    await this.collectorStateRepository.saveLatestNextChangeId(
      response.next_change_id,
    );

    logger.info(
      {
        requestedChangeId: requestedChangeId ?? null,
        nextChangeId: response.next_change_id,
        fetchedStashCount: response.stashes.length,
        filteredStashCount: filteredResponse.stashes.length,
        normalizedCount,
      },
      "Collector cycle completed",
    );

    return {
      nextChangeId: response.next_change_id,
      normalizedCount,
      stashCount: filteredResponse.stashes.length,
    };
  }

  async runForever(options?: CollectorRunOptions): Promise<void> {
    while (true) {
      try {
        const result = await this.runOnce(options);
        const delayMs = result.stashCount === 0 ? env.POLL_INTERVAL_MS : 1000;

        logger.info(
          {
            delayMs,
            nextChangeId: result.nextChangeId,
          },
          "Sleeping before next collector cycle",
        );

        await sleep(delayMs);
      } catch (error) {
        logger.error(
          {
            error: formatAxiosError(error),
          },
          "Collector cycle failed",
        );

        await sleep(env.POLL_INTERVAL_MS);
      }
    }
  }
}
