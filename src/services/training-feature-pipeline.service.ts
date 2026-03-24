import { TrainingFeatureRepository } from "../repositories/training-feature.repository";
import { TrainingFeatureSourceRepository } from "../repositories/training-feature-source.repository";
import { TrainingFeatureStateRepository } from "../repositories/training-feature-state.repository";
import type { TrainingFeatureCursor } from "../types/training-features.types";
import { logger } from "../utils/logger";
import { TrainingFeatureExtractorService } from "./training-feature-extractor.service";

type BuildTrainingFeaturesOptions = {
  limit?: number;
  maxBatches?: number;
  resetCursor?: boolean;
};

export type BuildTrainingFeaturesResult = {
  processedRows: number;
  batches: number;
  finalCursor: TrainingFeatureCursor | null;
  reachedEnd: boolean;
};

const DEFAULT_BATCH_LIMIT = 500;
const DEFAULT_MAX_BATCHES = 10;

export class TrainingFeaturePipelineService {
  constructor(
    private readonly sourceRepository = new TrainingFeatureSourceRepository(),
    private readonly featureRepository = new TrainingFeatureRepository(),
    private readonly stateRepository = new TrainingFeatureStateRepository(),
    private readonly extractor = new TrainingFeatureExtractorService(),
  ) {}

  async buildRawFeatures(
    options?: BuildTrainingFeaturesOptions,
  ): Promise<BuildTrainingFeaturesResult> {
    const limit = options?.limit ?? DEFAULT_BATCH_LIMIT;
    const maxBatches = options?.maxBatches ?? DEFAULT_MAX_BATCHES;

    await this.featureRepository.ensureSchema();

    if (options?.resetCursor) {
      await this.stateRepository.resetCursor();
    }

    let cursor = await this.stateRepository.getCursor();
    let processedRows = 0;
    let batches = 0;
    let reachedEnd = false;

    while (batches < maxBatches) {
      const sourceRows = await this.sourceRepository.getBatch(limit, cursor);
      if (sourceRows.length === 0) {
        reachedEnd = true;
        break;
      }

      const features = sourceRows.map((row) => this.extractor.extract(row));
      await this.featureRepository.upsertMany(features);

      const lastRow = sourceRows[sourceRows.length - 1];
      cursor = {
        updatedAt: lastRow.updated_at,
        listingKey: lastRow.listing_key,
      };
      await this.stateRepository.saveCursor(cursor);

      processedRows += sourceRows.length;
      batches += 1;

      logger.info(
        {
          batch: batches,
          processedRows,
          batchRowCount: sourceRows.length,
          cursorUpdatedAt: cursor.updatedAt,
          cursorListingKey: cursor.listingKey,
        },
        "Training feature batch completed",
      );

      if (sourceRows.length < limit) {
        reachedEnd = true;
        break;
      }
    }

    return {
      processedRows,
      batches,
      finalCursor: cursor,
      reachedEnd,
    };
  }
}
