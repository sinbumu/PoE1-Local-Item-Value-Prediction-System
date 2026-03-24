import { TrainingFeatureCleanRepository } from "../repositories/training-feature-clean.repository";
import { TrainingFeatureCleanSourceRepository } from "../repositories/training-feature-clean-source.repository";
import { TrainingFeatureCleanStateRepository } from "../repositories/training-feature-clean-state.repository";
import type { TrainingFeatureCursor } from "../types/training-features.types";
import { logger } from "../utils/logger";
import { TrainingFeatureCleanerService } from "./training-feature-cleaner.service";

type BuildTrainingFeatureCleanOptions = {
  limit?: number;
  maxBatches?: number;
  resetCursor?: boolean;
};

export type BuildTrainingFeatureCleanResult = {
  processedRows: number;
  keptRows: number;
  droppedRows: number;
  batches: number;
  finalCursor: TrainingFeatureCursor | null;
  reachedEnd: boolean;
};

const DEFAULT_BATCH_LIMIT = 500;
const DEFAULT_MAX_BATCHES = 10;

export class TrainingFeatureCleanPipelineService {
  constructor(
    private readonly sourceRepository = new TrainingFeatureCleanSourceRepository(),
    private readonly cleanRepository = new TrainingFeatureCleanRepository(),
    private readonly stateRepository = new TrainingFeatureCleanStateRepository(),
    private readonly cleaner = new TrainingFeatureCleanerService(),
  ) {}

  async buildCleanFeatures(
    options?: BuildTrainingFeatureCleanOptions,
  ): Promise<BuildTrainingFeatureCleanResult> {
    const limit = options?.limit ?? DEFAULT_BATCH_LIMIT;
    const maxBatches = options?.maxBatches ?? DEFAULT_MAX_BATCHES;

    await this.cleanRepository.ensureSchema();

    if (options?.resetCursor) {
      await this.stateRepository.resetCursor();
    }

    let cursor = await this.stateRepository.getCursor();
    let processedRows = 0;
    let keptRows = 0;
    let droppedRows = 0;
    let batches = 0;
    let reachedEnd = false;

    while (batches < maxBatches) {
      const sourceRows = await this.sourceRepository.getBatch(limit, cursor);
      if (sourceRows.length === 0) {
        reachedEnd = true;
        break;
      }

      const kept = [];
      const dropReasons = new Map<string, number>();

      for (const row of sourceRows) {
        const decision = this.cleaner.clean(row);
        if (decision.keep) {
          kept.push(decision.feature);
        } else {
          dropReasons.set(decision.reason, (dropReasons.get(decision.reason) ?? 0) + 1);
        }
      }

      await this.cleanRepository.upsertMany(kept);

      const lastRow = sourceRows[sourceRows.length - 1];
      cursor = {
        updatedAt: lastRow.sourceUpdatedAt,
        listingKey: lastRow.listingKey,
      };
      await this.stateRepository.saveCursor(cursor);

      processedRows += sourceRows.length;
      keptRows += kept.length;
      droppedRows += sourceRows.length - kept.length;
      batches += 1;

      logger.info(
        {
          batch: batches,
          processedRows,
          keptRows,
          droppedRows,
          batchRowCount: sourceRows.length,
          batchKeptRows: kept.length,
          batchDroppedRows: sourceRows.length - kept.length,
          dropReasons: Object.fromEntries(dropReasons),
          cursorUpdatedAt: cursor.updatedAt,
          cursorListingKey: cursor.listingKey,
        },
        "Training feature clean batch completed",
      );

      if (sourceRows.length < limit) {
        reachedEnd = true;
        break;
      }
    }

    return {
      processedRows,
      keptRows,
      droppedRows,
      batches,
      finalCursor: cursor,
      reachedEnd,
    };
  }
}
