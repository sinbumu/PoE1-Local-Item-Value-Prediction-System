import { env } from "../config/env";
import { CollectorStateRepository } from "../repositories/collector-state.repository";
import { NormalizedItemRepository } from "../repositories/normalized-item.repository";
import { RawResponseRepository } from "../repositories/raw-response.repository";
import { logger } from "../utils/logger";
import { sleep } from "../utils/time";
import { AuthService } from "./auth.service";
import { NormalizeService } from "./normalize.service";
import { formatAxiosError, PoeApiService } from "./poe-api.service";

type CollectorCycleResult = {
  nextChangeId: string;
  normalizedCount: number;
  stashCount: number;
};

export class CollectorService {
  constructor(
    private readonly authService = new AuthService(),
    private readonly poeApiService = new PoeApiService(),
    private readonly rawResponseRepository = new RawResponseRepository(),
    private readonly collectorStateRepository = new CollectorStateRepository(),
    private readonly normalizedItemRepository = new NormalizedItemRepository(),
    private readonly normalizeService = new NormalizeService(),
  ) {}

  async runOnce(): Promise<CollectorCycleResult> {
    const savedNextChangeId =
      await this.collectorStateRepository.getLatestNextChangeId();
    const requestedChangeId = savedNextChangeId ?? env.START_NEXT_CHANGE_ID;

    logger.info(
      {
        requestedChangeId: requestedChangeId ?? null,
        savedNextChangeId,
        configuredStartNextChangeId: env.START_NEXT_CHANGE_ID ?? null,
      },
      "Starting collector cycle",
    );

    const accessToken = await this.authService.getAccessToken();
    const response = await this.poeApiService.getPublicStashes(
      accessToken,
      requestedChangeId ?? undefined,
    );

    await this.rawResponseRepository.insert(response, requestedChangeId ?? undefined);
    const normalizedRows = this.normalizeService.normalizeResponse(response);
    const normalizedCount =
      await this.normalizedItemRepository.upsertMany(normalizedRows);
    await this.collectorStateRepository.saveLatestNextChangeId(
      response.next_change_id,
    );

    logger.info(
      {
        requestedChangeId: requestedChangeId ?? null,
        nextChangeId: response.next_change_id,
        stashCount: response.stashes.length,
        normalizedCount,
      },
      "Collector cycle completed",
    );

    return {
      nextChangeId: response.next_change_id,
      normalizedCount,
      stashCount: response.stashes.length,
    };
  }

  async runForever(): Promise<void> {
    while (true) {
      try {
        const result = await this.runOnce();
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
