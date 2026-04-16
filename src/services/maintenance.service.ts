import { env } from "../config/env";
import { pool } from "../db/client";
import { ArchiveRepository } from "../repositories/archive.repository";
import { logger } from "../utils/logger";
import { sleep } from "../utils/time";
import {
  TrainingFeatureLabeledBackupService,
  type TrainingFeatureLabeledBackupResult,
} from "./training-feature-labeled-backup.service";

type MaintenanceLoopOptions = {
  normalizedOlderThanHours?: number;
  normalizedCleanupLimit?: number;
  normalizedCleanupIntervalMs?: number;
  normalizedCleanupMaxBatches?: number;
  labeledBackupLimit?: number;
  labeledBackupOutputDirectory?: string;
  labeledBackupIntervalMs?: number;
  labeledBackupMaxBatches?: number;
  rawCleanupIntervalMs?: number;
  pollIntervalMs?: number;
};

type MaintenanceOnceResult = {
  deletedRawCount: number | null;
  rawCleanupSkipped: boolean;
  normalizedCleanupBatches: number;
  deletedNormalizedCount: number;
  normalizedCleanupSkipped: boolean;
  labeledBackupBatches: number;
  labeledBackupRowCount: number;
  labeledBackupSkipped: boolean;
};

type NormalizedCleanupSweepResult = {
  batches: number;
  deletedRowCount: number;
};

type LabeledBackupSweepResult = {
  batches: number;
  exportedRowCount: number;
  driveFileIds: string[];
};

const NORMALIZED_CLEANUP_LOCK_KEY = 71001;
const RAW_CLEANUP_LOCK_KEY = 71002;
const LABELED_BACKUP_LOCK_KEY = 71004;

export class MaintenanceService {
  constructor(
    private readonly archiveRepository = new ArchiveRepository(),
    private readonly labeledBackupService = new TrainingFeatureLabeledBackupService(),
  ) {}

  async runOnce(options?: MaintenanceLoopOptions): Promise<MaintenanceOnceResult> {
    const rawCleanup = await this.runRawCleanup(env.RAW_RETENTION_HOURS);
    const normalizedCleanup = await this.runNormalizedCleanupSweep(options);
    const labeledBackup = await this.runLabeledBackupSweep(options);

    return {
      deletedRawCount: rawCleanup.deletedRawCount,
      rawCleanupSkipped: rawCleanup.skipped,
      normalizedCleanupBatches: normalizedCleanup.batches,
      deletedNormalizedCount: normalizedCleanup.deletedRowCount,
      normalizedCleanupSkipped: normalizedCleanup.skipped,
      labeledBackupBatches: labeledBackup.batches,
      labeledBackupRowCount: labeledBackup.exportedRowCount,
      labeledBackupSkipped: labeledBackup.skipped,
    };
  }

  async runForever(options?: MaintenanceLoopOptions): Promise<void> {
    const normalizedCleanupIntervalMs =
      options?.normalizedCleanupIntervalMs ??
      env.MAINTENANCE_NORMALIZED_CLEANUP_INTERVAL_MS;
    const labeledBackupIntervalMs =
      options?.labeledBackupIntervalMs ??
      env.MAINTENANCE_LABELED_BACKUP_INTERVAL_MS;
    const rawCleanupIntervalMs =
      options?.rawCleanupIntervalMs ?? env.MAINTENANCE_RAW_CLEANUP_INTERVAL_MS;
    const pollIntervalMs =
      options?.pollIntervalMs ?? env.MAINTENANCE_POLL_INTERVAL_MS;
    let lastNormalizedCleanupRunAt = 0;
    let lastLabeledBackupRunAt = 0;
    let lastRawCleanupRunAt = 0;

    while (true) {
      const startedAt = Date.now();

      try {
        if (
          lastNormalizedCleanupRunAt === 0 ||
          startedAt - lastNormalizedCleanupRunAt >= normalizedCleanupIntervalMs
        ) {
          const normalizedCleanup =
            await this.runNormalizedCleanupSweep(options);

          logger.info(
            {
              normalizedCleanupIntervalMs,
              normalizedCleanupBatches: normalizedCleanup.batches,
              deletedNormalizedCount: normalizedCleanup.deletedRowCount,
              normalizedCleanupSkipped: normalizedCleanup.skipped,
            },
            "Maintenance normalized cleanup tick completed",
          );
          lastNormalizedCleanupRunAt = Date.now();
        }

        if (
          lastLabeledBackupRunAt === 0 ||
          startedAt - lastLabeledBackupRunAt >= labeledBackupIntervalMs
        ) {
          const labeledBackup = await this.runLabeledBackupSweep(options);

          logger.info(
            {
              labeledBackupIntervalMs,
              labeledBackupBatches: labeledBackup.batches,
              labeledBackupRowCount: labeledBackup.exportedRowCount,
              labeledBackupSkipped: labeledBackup.skipped,
            },
            "Maintenance labeled backup tick completed",
          );
          lastLabeledBackupRunAt = Date.now();
        }

        if (
          lastRawCleanupRunAt === 0 ||
          startedAt - lastRawCleanupRunAt >= rawCleanupIntervalMs
        ) {
          const rawCleanup = await this.runRawCleanup(
            env.RAW_RETENTION_HOURS,
          );

          logger.info(
            {
              rawCleanupIntervalMs,
              deletedRawCount: rawCleanup.deletedRawCount,
              rawCleanupSkipped: rawCleanup.skipped,
            },
            "Maintenance raw cleanup tick completed",
          );
          lastRawCleanupRunAt = Date.now();
        }
      } catch (error) {
        logger.error({ err: error }, "Maintenance loop iteration failed");
      }

      await sleep(pollIntervalMs);
    }
  }

  private async runNormalizedCleanupSweep(
    options?: MaintenanceLoopOptions,
  ): Promise<NormalizedCleanupSweepResult & { skipped: boolean }> {
    const olderThanHours =
      options?.normalizedOlderThanHours ?? env.NORMALIZED_RETENTION_HOURS;
    const limit =
      options?.normalizedCleanupLimit ?? env.NORMALIZED_CLEANUP_LIMIT;
    const maxBatches =
      options?.normalizedCleanupMaxBatches ??
      env.MAINTENANCE_NORMALIZED_CLEANUP_MAX_BATCHES;

    const lockResult = await this.withAdvisoryLock(
      "normalized_cleanup",
      NORMALIZED_CLEANUP_LOCK_KEY,
      async () => {
        let batches = 0;
        let deletedRowCount = 0;

        while (batches < maxBatches) {
          const deletedCount =
            await this.archiveRepository.deleteNormalizedRowsOlderThanLimited(
              olderThanHours,
              limit,
            );

          if (deletedCount === 0) {
            break;
          }

          batches += 1;
          deletedRowCount += deletedCount;

          if (deletedCount < limit) {
            break;
          }
        }

        logger.info(
          {
            olderThanHours,
            limit,
            maxBatches,
            batches,
            deletedRowCount,
          },
          "Maintenance normalized cleanup sweep completed",
        );

        return {
          batches,
          deletedRowCount,
        };
      },
    );

    return {
      batches: lockResult.result?.batches ?? 0,
      deletedRowCount: lockResult.result?.deletedRowCount ?? 0,
      skipped: lockResult.skipped,
    };
  }

  private async runLabeledBackupSweep(
    options?: MaintenanceLoopOptions,
  ): Promise<LabeledBackupSweepResult & { skipped: boolean }> {
    const limit = options?.labeledBackupLimit ?? env.LABELED_BACKUP_LIMIT;
    const outputDirectory =
      options?.labeledBackupOutputDirectory ?? env.LABELED_BACKUP_OUTPUT_DIR;
    const maxBatches =
      options?.labeledBackupMaxBatches ??
      env.MAINTENANCE_LABELED_BACKUP_MAX_BATCHES;

    const lockResult = await this.withAdvisoryLock(
      "labeled_backup",
      LABELED_BACKUP_LOCK_KEY,
      async () => {
        const driveFileIds: string[] = [];
        let batches = 0;
        let exportedRowCount = 0;

        while (batches < maxBatches) {
          const result: TrainingFeatureLabeledBackupResult =
            await this.labeledBackupService.backupNextBatch({
              limit,
              outputDirectory,
            });

          if (result.exportedRowCount === 0) {
            break;
          }

          batches += 1;
          exportedRowCount += result.exportedRowCount;

          if (result.driveFile?.id) {
            driveFileIds.push(result.driveFile.id);
          }

          if (result.exportedRowCount < limit) {
            break;
          }
        }

        logger.info(
          {
            limit,
            outputDirectory,
            maxBatches,
            batches,
            exportedRowCount,
            driveFileIds,
          },
          "Maintenance labeled backup sweep completed",
        );

        return {
          batches,
          exportedRowCount,
          driveFileIds,
        };
      },
    );

    return {
      batches: lockResult.result?.batches ?? 0,
      exportedRowCount: lockResult.result?.exportedRowCount ?? 0,
      driveFileIds: lockResult.result?.driveFileIds ?? [],
      skipped: lockResult.skipped,
    };
  }

  private async runRawCleanup(
    rawHours: number,
  ): Promise<{ deletedRawCount: number | null; skipped: boolean }> {
    const result = await this.withAdvisoryLock(
      "raw_cleanup",
      RAW_CLEANUP_LOCK_KEY,
      async () => {
        const deletedRawCount =
          await this.archiveRepository.deleteRawResponsesOlderThan(rawHours);

        logger.info(
          {
            rawHours,
            deletedRawCount,
          },
          "Maintenance raw cleanup completed",
        );

        return deletedRawCount;
      },
    );

    return {
      deletedRawCount: result.result ?? null,
      skipped: result.skipped,
    };
  }

  private async withAdvisoryLock<T>(
    lockName: string,
    lockKey: number,
    work: () => Promise<T>,
  ): Promise<{ result: T | null; skipped: boolean }> {
    const client = await pool.connect();

    try {
      const lockResult = await client.query<{ locked: boolean }>(
        "SELECT pg_try_advisory_lock($1) AS locked",
        [lockKey],
      );

      if (!lockResult.rows[0]?.locked) {
        logger.warn({ lockName }, "Maintenance job skipped because lock is busy");
        return {
          result: null,
          skipped: true,
        };
      }

      try {
        return {
          result: await work(),
          skipped: false,
        };
      } finally {
        await client.query("SELECT pg_advisory_unlock($1)", [lockKey]);
      }
    } finally {
      client.release();
    }
  }
}
