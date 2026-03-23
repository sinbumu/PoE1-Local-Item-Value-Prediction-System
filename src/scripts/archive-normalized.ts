import { closePool } from "../db/client";
import { NormalizedArchiveService } from "../services/normalized-archive.service";
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
  const archiveService = new NormalizedArchiveService();
  const olderThanHours = readNumberFlag("--older-than-hours");
  const limit = readNumberFlag("--limit");
  const outputDirectory = readStringFlag("--output-dir");
  const purgeAfterUpload = process.argv.includes("--purge");
  const result = await archiveService.archiveAndUpload({
    olderThanHours,
    limit,
    outputDirectory,
    purgeAfterUpload,
  });

  logger.info(
    {
      olderThanHours: olderThanHours ?? null,
      limit: limit ?? null,
      outputDirectory: outputDirectory ?? null,
      purgeAfterUpload,
      exportedRowCount: result.exportedRowCount,
      archivePath: result.archivePath,
      driveFileId: result.driveFile?.id ?? null,
      driveFileName: result.driveFile?.name ?? null,
      purgedRowCount: result.purgedRowCount,
    },
    "Normalized archive job completed",
  );
}

main()
  .catch((error) => {
    logger.error({ err: error }, "Normalized archive job failed");
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool();
  });
