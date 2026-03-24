import { env } from "../config/env";
import { pool } from "../db/client";
import { ArchiveRepository } from "../repositories/archive.repository";
import { logger } from "../utils/logger";
import { sleep } from "../utils/time";
import {
  NormalizedArchiveService,
  type NormalizedArchiveResult,
} from "./normalized-archive.service";

type MaintenanceLoopOptions = {
  olderThanHours?: number;
  limit?: number;
  outputDirectory?: string;
  archiveIntervalMs?: number;
  rawCleanupIntervalMs?: number;
  pollIntervalMs?: number;
  archiveMaxBatches?: number;
};

type MaintenanceOnceResult = {
  deletedRawCount: number | null;
  rawCleanupSkipped: boolean;
  archiveBatches: number;
  exportedRowCount: number;
  purgedRowCount: number;
  archiveSkipped: boolean;
};

type ArchiveSweepResult = {
  batches: number;
  exportedRowCount: number;
  purgedRowCount: number;
  driveFileIds: string[];
};

const ARCHIVE_LOCK_KEY = 71001;
const RAW_CLEANUP_LOCK_KEY = 71002;

export class MaintenanceService {
  constructor(
    private readonly archiveRepository = new ArchiveRepository(),
    private readonly normalizedArchiveService = new NormalizedArchiveService(),
  ) {}

  async runOnce(options?: MaintenanceLoopOptions): Promise<MaintenanceOnceResult> {
    const rawCleanup = await this.runRawCleanup(env.RAW_RETENTION_HOURS);
    const archiveSweep = await this.runArchiveSweep(options);

    return {
      deletedRawCount: rawCleanup.deletedRawCount,
      rawCleanupSkipped: rawCleanup.skipped,
      archiveBatches: archiveSweep.batches,
      exportedRowCount: archiveSweep.exportedRowCount,
      purgedRowCount: archiveSweep.purgedRowCount,
      archiveSkipped: archiveSweep.skipped,
    };
  }

  async runForever(options?: MaintenanceLoopOptions): Promise<void> {
    const archiveIntervalMs =
      options?.archiveIntervalMs ?? env.MAINTENANCE_ARCHIVE_INTERVAL_MS;
    const rawCleanupIntervalMs =
      options?.rawCleanupIntervalMs ?? env.MAINTENANCE_RAW_CLEANUP_INTERVAL_MS;
    const pollIntervalMs =
      options?.pollIntervalMs ?? env.MAINTENANCE_POLL_INTERVAL_MS;
    let lastArchiveRunAt = 0;
    let lastRawCleanupRunAt = 0;

    while (true) {
      const startedAt = Date.now();

      try {
        if (
          lastArchiveRunAt === 0 ||
          startedAt - lastArchiveRunAt >= archiveIntervalMs
        ) {
          const archiveSweep = await this.runArchiveSweep(options);

          logger.info(
            {
              archiveIntervalMs,
              archiveBatches: archiveSweep.batches,
              exportedRowCount: archiveSweep.exportedRowCount,
              purgedRowCount: archiveSweep.purgedRowCount,
              archiveSkipped: archiveSweep.skipped,
            },
            "Maintenance archive tick completed",
          );
          lastArchiveRunAt = Date.now();
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

  private async runArchiveSweep(
    options?: MaintenanceLoopOptions,
  ): Promise<ArchiveSweepResult & { skipped: boolean }> {
    const olderThanHours =
      options?.olderThanHours ?? env.NORMALIZED_RETENTION_HOURS;
    const limit = options?.limit ?? env.NORMALIZED_ARCHIVE_LIMIT;
    const outputDirectory = options?.outputDirectory ?? env.ARCHIVE_OUTPUT_DIR;
    const archiveMaxBatches =
      options?.archiveMaxBatches ?? env.MAINTENANCE_ARCHIVE_MAX_BATCHES;

    const lockResult = await this.withAdvisoryLock(
      "normalized_archive",
      ARCHIVE_LOCK_KEY,
      async () => {
        const driveFileIds: string[] = [];
        let batches = 0;
        let exportedRowCount = 0;
        let purgedRowCount = 0;

        while (batches < archiveMaxBatches) {
          const result: NormalizedArchiveResult =
            await this.normalizedArchiveService.archiveAndUpload({
              olderThanHours,
              limit,
              outputDirectory,
              purgeAfterUpload: true,
            });

          if (result.exportedRowCount === 0) {
            break;
          }

          batches += 1;
          exportedRowCount += result.exportedRowCount;
          purgedRowCount += result.purgedRowCount;

          if (result.driveFile?.id) {
            driveFileIds.push(result.driveFile.id);
          }

          if (result.exportedRowCount < limit) {
            break;
          }
        }

        logger.info(
          {
            olderThanHours,
            limit,
            archiveMaxBatches,
            batches,
            exportedRowCount,
            purgedRowCount,
            driveFileIds,
          },
          "Maintenance normalized archive sweep completed",
        );

        return {
          batches,
          exportedRowCount,
          purgedRowCount,
          driveFileIds,
        };
      },
    );

    return {
      batches: lockResult.result?.batches ?? 0,
      exportedRowCount: lockResult.result?.exportedRowCount ?? 0,
      purgedRowCount: lockResult.result?.purgedRowCount ?? 0,
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
