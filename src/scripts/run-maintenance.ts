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
  const olderThanHours = readNumberFlag("--older-than-hours");
  const limit = readNumberFlag("--limit");
  const outputDirectory = readStringFlag("--output-dir");
  const archiveIntervalMs = readNumberFlag("--archive-interval-ms");
  const rawCleanupIntervalMs = readNumberFlag("--raw-cleanup-interval-ms");
  const pollIntervalMs = readNumberFlag("--poll-interval-ms");
  const archiveMaxBatches = readNumberFlag("--max-batches");

  await pool.query("SELECT 1");
  logger.info({ once }, "Database connection verified for maintenance");

  if (once) {
    const result = await maintenanceService.runOnce({
      olderThanHours,
      limit,
      outputDirectory,
      archiveMaxBatches,
    });

    logger.info(result, "Maintenance run completed");
    return;
  }

  await maintenanceService.runForever({
    olderThanHours,
    limit,
    outputDirectory,
    archiveIntervalMs,
    rawCleanupIntervalMs,
    pollIntervalMs,
    archiveMaxBatches,
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
