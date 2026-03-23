import { env } from "../config/env";
import { closePool } from "../db/client";
import { ArchiveRepository } from "../repositories/archive.repository";
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
  const archiveRepository = new ArchiveRepository();
  const rawHours = readNumberFlag("--raw-hours") ?? env.RAW_RETENTION_HOURS;
  const deleteNormalized = process.argv.includes("--delete-normalized");
  const normalizedHours =
    readNumberFlag("--normalized-hours") ?? env.NORMALIZED_RETENTION_HOURS;
  const deletedRawCount =
    await archiveRepository.deleteRawResponsesOlderThan(rawHours);
  let deletedNormalizedCount = 0;

  if (deleteNormalized) {
    deletedNormalizedCount =
      await archiveRepository.deleteNormalizedRowsOlderThan(normalizedHours);
  }

  logger.info(
    {
      rawHours,
      deleteNormalized,
      normalizedHours,
      deletedRawCount,
      deletedNormalizedCount,
    },
    "Retention cleanup completed",
  );
}

main()
  .catch((error) => {
    logger.error({ err: error }, "Retention cleanup failed");
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool();
  });
