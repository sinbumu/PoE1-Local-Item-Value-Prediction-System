import { closePool } from "../db/client";
import { TrainingFeatureLabeledBackupStateRepository } from "../repositories/training-feature-labeled-backup-state.repository";
import {
  TrainingFeatureLabeledBackupService,
  type TrainingFeatureLabeledBackupResult,
} from "../services/training-feature-labeled-backup.service";
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
  return argument ? argument.slice(flag.length + 1) : undefined;
}

async function main(): Promise<void> {
  const backupService = new TrainingFeatureLabeledBackupService();
  const stateRepository = new TrainingFeatureLabeledBackupStateRepository();
  const limit = readNumberFlag("--limit");
  const outputDirectory = readStringFlag("--output-dir");
  const maxBatches = readNumberFlag("--max-batches") ?? 1;
  const resetCursor = process.argv.includes("--reset-cursor");

  let batches = 0;
  let exportedRowCount = 0;
  const driveFileIds: string[] = [];

  if (resetCursor) {
    await stateRepository.resetCursor();
  }

  while (batches < maxBatches) {
    const result: TrainingFeatureLabeledBackupResult =
      await backupService.backupNextBatch({
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

    logger.info(
      {
        batch: batches,
        exportedRowCount,
        batchRowCount: result.exportedRowCount,
        driveFileId: result.driveFile?.id ?? null,
        driveFileName: result.driveFile?.name ?? null,
        cursor: result.cursor,
      },
      "Training feature labeled backup batch completed",
    );

    if (result.exportedRowCount < (limit ?? Number.MAX_SAFE_INTEGER)) {
      break;
    }
  }

  logger.info(
    {
      batches,
      exportedRowCount,
      driveFileIds,
    },
    "Training feature labeled backup completed",
  );
}

main()
  .catch((error) => {
    logger.error({ err: error }, "Training feature labeled backup failed");
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool();
  });
