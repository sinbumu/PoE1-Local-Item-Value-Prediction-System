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
  resetCursors?: boolean;
};

type RunForeverOptions = RunUntilStableOptions & {
  maxBatchesPerStage?: number;
  rawMaxBatches?: number;
  cleanMaxBatches?: number;
  labeledMaxBatches?: number;
  pollIntervalMs?: number;
};

const DEFAULT_LIMIT = 10000;
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
    const runOptions = this.resolveRunUntilStableOptions(options);
    const result = await this.withAdvisoryLock("training_etl_runner", async () => {
      const cycleResult = await this.runCycle(runOptions);
      logger.info(
        {
          rawProcessedRows: cycleResult.raw.processedRows,
          cleanProcessedRows: cycleResult.clean.processedRows,
          labeledProcessedRows: cycleResult.labeled.processedRows,
          rawReachedEnd: cycleResult.raw.reachedEnd,
          cleanReachedEnd: cycleResult.clean.reachedEnd,
          labeledReachedEnd: cycleResult.labeled.reachedEnd,
        },
        "Training ETL run-until-stable cycle completed",
      );
      return cycleResult;
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
      },
      "Training ETL cycle started",
    );

    const raw = await this.rawPipeline.buildRawFeatures({
      limit: options.raw.limit,
      maxBatches: options.raw.maxBatches,
      resetCursor: options.raw.resetCursor,
    });

    const clean = await this.cleanPipeline.buildCleanFeatures({
      limit: options.clean.limit,
      maxBatches: options.clean.maxBatches,
      resetCursor: options.clean.resetCursor,
    });

    const labeled = await this.labeledPipeline.buildLabeledFeatures({
      limit: options.labeled.limit,
      maxBatches: options.labeled.maxBatches,
      resetCursor: options.labeled.resetCursor,
    });

    return {
      raw,
      clean,
      labeled,
    };
  }

  private resolveRunUntilStableOptions(
    options?: RunUntilStableOptions,
  ): TrainingEtlRunOptions {
    const sharedLimit = options?.limit ?? DEFAULT_LIMIT;
    const resetCursors = options?.resetCursors ?? false;

    return {
      raw: {
        limit: options?.rawLimit ?? sharedLimit,
        maxBatches: Number.MAX_SAFE_INTEGER,
        resetCursor: resetCursors,
      },
      clean: {
        limit: options?.cleanLimit ?? sharedLimit,
        maxBatches: Number.MAX_SAFE_INTEGER,
        resetCursor: resetCursors,
      },
      labeled: {
        limit: options?.labeledLimit ?? sharedLimit,
        maxBatches: Number.MAX_SAFE_INTEGER,
        resetCursor: resetCursors,
      },
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
      >,
  ): TrainingEtlRunOptions {
    const sharedLimit = options.limit ?? DEFAULT_LIMIT;

    return {
      raw: {
        limit: options.rawLimit ?? sharedLimit,
        maxBatches: options.rawMaxBatches ?? options.maxBatchesPerStage,
        resetCursor: options.resetCursors,
      },
      clean: {
        limit: options.cleanLimit ?? sharedLimit,
        maxBatches: options.cleanMaxBatches ?? options.maxBatchesPerStage,
        resetCursor: options.resetCursors,
      },
      labeled: {
        limit: options.labeledLimit ?? sharedLimit,
        maxBatches: options.labeledMaxBatches ?? options.maxBatchesPerStage,
        resetCursor: options.resetCursors,
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
