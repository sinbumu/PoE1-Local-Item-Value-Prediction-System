import { closePool } from "../db/client";
import { ArchiveRepository } from "../repositories/archive.repository";
import { env } from "../config/env";
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

async function main(): Promise<void> {
  const repository = new ArchiveRepository();
  const olderThanHours =
    readNumberFlag("--older-than-hours") ?? env.NORMALIZED_RETENTION_HOURS;
  const limit = readNumberFlag("--limit") ?? env.NORMALIZED_CLEANUP_LIMIT;
  const maxBatches =
    readNumberFlag("--max-batches") ?? env.MAINTENANCE_NORMALIZED_CLEANUP_MAX_BATCHES;

  let batches = 0;
  let deletedRowCount = 0;

  while (batches < maxBatches) {
    const deletedCount = await repository.deleteNormalizedRowsOlderThanLimited(
      olderThanHours,
      limit,
    );

    if (deletedCount === 0) {
      break;
    }

    batches += 1;
    deletedRowCount += deletedCount;

    logger.info(
      {
        batch: batches,
        olderThanHours,
        limit,
        deletedCount,
        deletedRowCount,
      },
      "Normalized stale cleanup batch completed",
    );

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
    "Normalized stale cleanup completed",
  );
}

main()
  .catch((error) => {
    logger.error({ err: error }, "Normalized stale cleanup failed");
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool();
  });
