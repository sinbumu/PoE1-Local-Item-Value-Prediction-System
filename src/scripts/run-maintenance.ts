import { closePool, pool } from "../db/client";
import { MaintenanceService } from "../services/maintenance.service";
import { logger } from "../utils/logger";

function readNumberFlag(flag: string): number | undefined {
  const argument = process.argv.find((value) => value.startsWith(`${flag}=`));

  if (!argument) {
    return undefined;
  }

  const rawValue = argument.slice(flag.length + 1);
  const parsedValue = Number(rawValue);

  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    throw new Error(`${flag} 값이 올바르지 않습니다: ${rawValue}`);
  }

  return parsedValue;
}

function readStringFlag(flag: string): string | undefined {
  const argument = process.argv.find((value) => value.startsWith(`${flag}=`));

  if (!argument) {
    return undefined;
  }

  return argument.slice(flag.length + 1);
}

async function main(): Promise<void> {
  const maintenanceService = new MaintenanceService();
  const once = process.argv.includes("--once");
  const normalizedOlderThanHours = readNumberFlag("--older-than-hours");
  const normalizedCleanupLimit = readNumberFlag("--normalized-cleanup-limit");
  const normalizedCleanupIntervalMs = readNumberFlag(
    "--normalized-cleanup-interval-ms",
  );
  const normalizedCleanupMaxBatches = readNumberFlag(
    "--normalized-cleanup-max-batches",
  );
  const labeledBackupLimit = readNumberFlag("--labeled-backup-limit");
  const labeledBackupOutputDirectory = readStringFlag(
    "--labeled-backup-output-dir",
  );
  const labeledBackupIntervalMs = readNumberFlag(
    "--labeled-backup-interval-ms",
  );
  const labeledBackupMaxBatches = readNumberFlag(
    "--labeled-backup-max-batches",
  );
  const rawCleanupIntervalMs = readNumberFlag("--raw-cleanup-interval-ms");
  const pollIntervalMs = readNumberFlag("--poll-interval-ms");

  await pool.query("SELECT 1");
  logger.info({ once }, "Database connection verified for maintenance");

  if (once) {
    const result = await maintenanceService.runOnce({
      normalizedOlderThanHours,
      normalizedCleanupLimit,
      normalizedCleanupMaxBatches,
      labeledBackupLimit,
      labeledBackupOutputDirectory,
      labeledBackupMaxBatches,
    });

    logger.info(result, "Maintenance run completed");
    return;
  }

  await maintenanceService.runForever({
    normalizedOlderThanHours,
    normalizedCleanupLimit,
    normalizedCleanupIntervalMs,
    normalizedCleanupMaxBatches,
    labeledBackupLimit,
    labeledBackupOutputDirectory,
    labeledBackupIntervalMs,
    labeledBackupMaxBatches,
    rawCleanupIntervalMs,
    pollIntervalMs,
  });
}

main()
  .catch((error) => {
    logger.error({ err: error }, "Maintenance script failed");
    process.exitCode = 1;
  })
  .finally(async () => {
    if (process.argv.includes("--once")) {
      await closePool();
    }
  });
