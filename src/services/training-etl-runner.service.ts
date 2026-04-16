import { pool } from "../db/client";
import { logger } from "../utils/logger";
import { sleep } from "../utils/time";
import {
  TrainingFeatureCleanPipelineService,
  type BuildTrainingFeatureCleanResult,
} from "./training-feature-clean-pipeline.service";
import {
  TrainingFeatureLabeledPipelineService,
  type BuildTrainingFeatureLabeledResult,
} from "./training-feature-labeled-pipeline.service";
import {
  TrainingFeaturePipelineService,
  type BuildTrainingFeaturesResult,
} from "./training-feature-pipeline.service";

type TrainingEtlStageOptions = {
  limit: number;
  maxBatches: number;
  resetCursor: boolean;
  sinceUpdatedAt?: string;
  pruneBeforeRun: boolean;
};

type TrainingEtlRunOptions = {
  raw: TrainingEtlStageOptions;
  clean: TrainingEtlStageOptions;
  labeled: TrainingEtlStageOptions;
};

export type TrainingEtlCycleResult = {
  raw: BuildTrainingFeaturesResult;
  clean: BuildTrainingFeatureCleanResult;
  labeled: BuildTrainingFeatureLabeledResult;
};

type RunUntilStableOptions = {
  limit?: number;
  rawLimit?: number;
  cleanLimit?: number;
  labeledLimit?: number;
  maxBatchesPerStage?: number;
  rawMaxBatches?: number;
  cleanMaxBatches?: number;
  labeledMaxBatches?: number;
  resetCursors?: boolean;
  sinceUpdatedAt?: string;
  pruneBeforeRun?: boolean;
};

type RunForeverOptions = RunUntilStableOptions & {
  maxBatchesPerStage?: number;
  rawMaxBatches?: number;
  cleanMaxBatches?: number;
  labeledMaxBatches?: number;
  pollIntervalMs?: number;
};

const DEFAULT_LIMIT = 10000;
const DEFAULT_RUN_UNTIL_STABLE_MAX_BATCHES_PER_STAGE = 1;
const DEFAULT_MAX_BATCHES_PER_STAGE = 10;
const DEFAULT_POLL_INTERVAL_MS = 60000;
const TRAINING_ETL_LOCK_KEY = 71005;

export class TrainingEtlRunnerService {
  constructor(
    private readonly rawPipeline = new TrainingFeaturePipelineService(),
    private readonly cleanPipeline = new TrainingFeatureCleanPipelineService(),
    private readonly labeledPipeline = new TrainingFeatureLabeledPipelineService(),
  ) {}

  async runUntilStable(options?: RunUntilStableOptions): Promise<TrainingEtlCycleResult> {
    const result = await this.withAdvisoryLock("training_etl_runner", async () => {
      let shouldResetCursors = options?.resetCursors ?? false;
      let cycleCount = 0;
      let rawResult = this.createEmptyRawResult();
      let cleanResult = this.createEmptyCleanResult();
      let labeledResult = this.createEmptyLabeledResult();

      while (true) {
        cycleCount += 1;
        const cycleOptions = this.resolveRunUntilStableCycleOptions({
          ...options,
          resetCursors: shouldResetCursors,
          pruneBeforeRun: shouldResetCursors && (options?.pruneBeforeRun ?? false),
        });
        const cycleResult = await this.runCycle(cycleOptions);
        rawResult = this.mergeRawResults(rawResult, cycleResult.raw);
        cleanResult = this.mergeCleanResults(cleanResult, cycleResult.clean);
        labeledResult = this.mergeLabeledResults(labeledResult, cycleResult.labeled);
        shouldResetCursors = false;

        logger.info(
          {
            cycle: cycleCount,
            rawProcessedRows: cycleResult.raw.processedRows,
            cleanProcessedRows: cycleResult.clean.processedRows,
            labeledProcessedRows: cycleResult.labeled.processedRows,
            rawReachedEnd: cycleResult.raw.reachedEnd,
            cleanReachedEnd: cycleResult.clean.reachedEnd,
            labeledReachedEnd: cycleResult.labeled.reachedEnd,
          },
          "Training ETL run-until-stable cycle checkpoint",
        );

        if (
          cycleResult.raw.reachedEnd &&
          cycleResult.clean.reachedEnd &&
          cycleResult.labeled.reachedEnd
        ) {
          break;
        }

        if (
          cycleResult.raw.processedRows === 0 &&
          cycleResult.clean.processedRows === 0 &&
          cycleResult.labeled.processedRows === 0
        ) {
          logger.warn(
            { cycle: cycleCount },
            "Training ETL run-until-stable made no progress; stopping early",
          );
          break;
        }
      }

      logger.info(
        {
          cycles: cycleCount,
          rawProcessedRows: rawResult.processedRows,
          cleanProcessedRows: cleanResult.processedRows,
          labeledProcessedRows: labeledResult.processedRows,
          rawReachedEnd: rawResult.reachedEnd,
          cleanReachedEnd: cleanResult.reachedEnd,
          labeledReachedEnd: labeledResult.reachedEnd,
        },
        "Training ETL run-until-stable cycle completed",
      );
      return {
        raw: rawResult,
        clean: cleanResult,
        labeled: labeledResult,
      };
    });

    if (result === null) {
      throw new Error("다른 training ETL runner가 이미 실행 중입니다.");
    }

    return result;
  }

  async runForever(options?: RunForeverOptions): Promise<void> {
    const maxBatchesPerStage =
      options?.maxBatchesPerStage ?? DEFAULT_MAX_BATCHES_PER_STAGE;
    const pollIntervalMs = options?.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
    let shouldResetCursors = options?.resetCursors ?? false;

    while (true) {
      const cycleOptions = this.resolveRunForeverCycleOptions({
        limit: options?.limit,
        rawLimit: options?.rawLimit,
        cleanLimit: options?.cleanLimit,
        labeledLimit: options?.labeledLimit,
        maxBatchesPerStage,
        rawMaxBatches: options?.rawMaxBatches,
        cleanMaxBatches: options?.cleanMaxBatches,
        labeledMaxBatches: options?.labeledMaxBatches,
        resetCursors: shouldResetCursors,
        sinceUpdatedAt: options?.sinceUpdatedAt,
        pruneBeforeRun: shouldResetCursors && (options?.pruneBeforeRun ?? false),
      });

      const cycleResult = await this.withAdvisoryLock(
        "training_etl_runner",
        async () => {
          const result = await this.runCycle(cycleOptions);
          logger.info(
            {
              rawProcessedRows: result.raw.processedRows,
              cleanProcessedRows: result.clean.processedRows,
              labeledProcessedRows: result.labeled.processedRows,
              rawReachedEnd: result.raw.reachedEnd,
              cleanReachedEnd: result.clean.reachedEnd,
              labeledReachedEnd: result.labeled.reachedEnd,
              sinceUpdatedAt: cycleOptions.raw.sinceUpdatedAt,
              pollIntervalMs,
            },
            "Training ETL daemon cycle completed",
          );
          return result;
        },
      );

      if (cycleResult === null) {
        logger.warn("Training ETL daemon cycle skipped because lock is busy");
      } else {
        shouldResetCursors = false;
      }

      await sleep(pollIntervalMs);
    }
  }

  private async runCycle(
    options: TrainingEtlRunOptions,
  ): Promise<TrainingEtlCycleResult> {
    logger.info(
      {
        rawLimit: options.raw.limit,
        rawMaxBatches: options.raw.maxBatches,
        cleanLimit: options.clean.limit,
        cleanMaxBatches: options.clean.maxBatches,
        labeledLimit: options.labeled.limit,
        labeledMaxBatches: options.labeled.maxBatches,
        resetRawCursor: options.raw.resetCursor,
        resetCleanCursor: options.clean.resetCursor,
        resetLabeledCursor: options.labeled.resetCursor,
        sinceUpdatedAt: options.raw.sinceUpdatedAt,
        pruneBeforeRun: options.raw.pruneBeforeRun,
      },
      "Training ETL cycle started",
    );

    const raw = await this.rawPipeline.buildRawFeatures({
      limit: options.raw.limit,
      maxBatches: options.raw.maxBatches,
      resetCursor: options.raw.resetCursor,
      sinceUpdatedAt: options.raw.sinceUpdatedAt,
      pruneBeforeRun: options.raw.pruneBeforeRun,
    });

    const clean = await this.cleanPipeline.buildCleanFeatures({
      limit: options.clean.limit,
      maxBatches: options.clean.maxBatches,
      resetCursor: options.clean.resetCursor,
      sinceUpdatedAt: options.clean.sinceUpdatedAt,
      pruneBeforeRun: options.clean.pruneBeforeRun,
    });

    const labeled = await this.labeledPipeline.buildLabeledFeatures({
      limit: options.labeled.limit,
      maxBatches: options.labeled.maxBatches,
      resetCursor: options.labeled.resetCursor,
      sinceUpdatedAt: options.labeled.sinceUpdatedAt,
      pruneBeforeRun: options.labeled.pruneBeforeRun,
    });

    return {
      raw,
      clean,
      labeled,
    };
  }

  private resolveRunUntilStableCycleOptions(
    options?: RunUntilStableOptions,
  ): TrainingEtlRunOptions {
    const sharedLimit = options?.limit ?? DEFAULT_LIMIT;
    const resetCursors = options?.resetCursors ?? false;
    const maxBatchesPerStage =
      options?.maxBatchesPerStage ?? DEFAULT_RUN_UNTIL_STABLE_MAX_BATCHES_PER_STAGE;
    const sinceUpdatedAt = options?.sinceUpdatedAt;
    const pruneBeforeRun = options?.pruneBeforeRun ?? false;

    return {
      raw: {
        limit: options?.rawLimit ?? sharedLimit,
        maxBatches: options?.rawMaxBatches ?? maxBatchesPerStage,
        resetCursor: resetCursors,
        sinceUpdatedAt,
        pruneBeforeRun,
      },
      clean: {
        limit: options?.cleanLimit ?? sharedLimit,
        maxBatches: options?.cleanMaxBatches ?? maxBatchesPerStage,
        resetCursor: resetCursors,
        sinceUpdatedAt,
        pruneBeforeRun,
      },
      labeled: {
        limit: options?.labeledLimit ?? sharedLimit,
        maxBatches: options?.labeledMaxBatches ?? maxBatchesPerStage,
        resetCursor: resetCursors,
        sinceUpdatedAt,
        pruneBeforeRun,
      },
    };
  }

  private createEmptyRawResult(): BuildTrainingFeaturesResult {
    return {
      processedRows: 0,
      batches: 0,
      finalCursor: null,
      reachedEnd: false,
    };
  }

  private createEmptyCleanResult(): BuildTrainingFeatureCleanResult {
    return {
      processedRows: 0,
      keptRows: 0,
      droppedRows: 0,
      batches: 0,
      finalCursor: null,
      reachedEnd: false,
    };
  }

  private createEmptyLabeledResult(): BuildTrainingFeatureLabeledResult {
    return {
      processedRows: 0,
      keptRows: 0,
      droppedRows: 0,
      batches: 0,
      finalCursor: null,
      reachedEnd: false,
    };
  }

  private mergeRawResults(
    aggregate: BuildTrainingFeaturesResult,
    cycle: BuildTrainingFeaturesResult,
  ): BuildTrainingFeaturesResult {
    return {
      processedRows: aggregate.processedRows + cycle.processedRows,
      batches: aggregate.batches + cycle.batches,
      finalCursor: cycle.finalCursor ?? aggregate.finalCursor,
      reachedEnd: cycle.reachedEnd,
    };
  }

  private mergeCleanResults(
    aggregate: BuildTrainingFeatureCleanResult,
    cycle: BuildTrainingFeatureCleanResult,
  ): BuildTrainingFeatureCleanResult {
    return {
      processedRows: aggregate.processedRows + cycle.processedRows,
      keptRows: aggregate.keptRows + cycle.keptRows,
      droppedRows: aggregate.droppedRows + cycle.droppedRows,
      batches: aggregate.batches + cycle.batches,
      finalCursor: cycle.finalCursor ?? aggregate.finalCursor,
      reachedEnd: cycle.reachedEnd,
    };
  }

  private mergeLabeledResults(
    aggregate: BuildTrainingFeatureLabeledResult,
    cycle: BuildTrainingFeatureLabeledResult,
  ): BuildTrainingFeatureLabeledResult {
    return {
      processedRows: aggregate.processedRows + cycle.processedRows,
      keptRows: aggregate.keptRows + cycle.keptRows,
      droppedRows: aggregate.droppedRows + cycle.droppedRows,
      batches: aggregate.batches + cycle.batches,
      finalCursor: cycle.finalCursor ?? aggregate.finalCursor,
      reachedEnd: cycle.reachedEnd,
    };
  }

  private resolveRunForeverCycleOptions(
    options: Required<
      Pick<RunForeverOptions, "maxBatchesPerStage" | "resetCursors">
    > &
      Pick<
        RunForeverOptions,
        | "limit"
        | "rawLimit"
        | "cleanLimit"
        | "labeledLimit"
        | "rawMaxBatches"
        | "cleanMaxBatches"
        | "labeledMaxBatches"
        | "sinceUpdatedAt"
        | "pruneBeforeRun"
      >,
  ): TrainingEtlRunOptions {
    const sharedLimit = options.limit ?? DEFAULT_LIMIT;

    return {
      raw: {
        limit: options.rawLimit ?? sharedLimit,
        maxBatches: options.rawMaxBatches ?? options.maxBatchesPerStage,
        resetCursor: options.resetCursors,
        sinceUpdatedAt: options.sinceUpdatedAt,
        pruneBeforeRun: options.pruneBeforeRun ?? false,
      },
      clean: {
        limit: options.cleanLimit ?? sharedLimit,
        maxBatches: options.cleanMaxBatches ?? options.maxBatchesPerStage,
        resetCursor: options.resetCursors,
        sinceUpdatedAt: options.sinceUpdatedAt,
        pruneBeforeRun: options.pruneBeforeRun ?? false,
      },
      labeled: {
        limit: options.labeledLimit ?? sharedLimit,
        maxBatches: options.labeledMaxBatches ?? options.maxBatchesPerStage,
        resetCursor: options.resetCursors,
        sinceUpdatedAt: options.sinceUpdatedAt,
        pruneBeforeRun: options.pruneBeforeRun ?? false,
      },
    };
  }

  private async withAdvisoryLock<T>(
    lockName: string,
    work: () => Promise<T>,
  ): Promise<T | null> {
    const client = await pool.connect();

    try {
      const lockResult = await client.query<{ locked: boolean }>(
        "SELECT pg_try_advisory_lock($1) AS locked",
        [TRAINING_ETL_LOCK_KEY],
      );

      if (!lockResult.rows[0]?.locked) {
        logger.warn({ lockName }, "Training ETL runner skipped because lock is busy");
        return null;
      }

      try {
        return await work();
      } finally {
        await client.query("SELECT pg_advisory_unlock($1)", [TRAINING_ETL_LOCK_KEY]);
      }
    } finally {
      client.release();
    }
  }
}
