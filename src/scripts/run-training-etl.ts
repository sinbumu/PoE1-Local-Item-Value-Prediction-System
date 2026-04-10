import { closePool, pool } from "../db/client";
import { TrainingEtlRunnerService } from "../services/training-etl-runner.service";
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
  const etlRunnerService = new TrainingEtlRunnerService();
  const daemon = process.argv.includes("--daemon");
  const resetCursors = process.argv.includes("--reset-cursors");
  const limit = readNumberFlag("--limit");
  const rawLimit = readNumberFlag("--raw-limit");
  const cleanLimit = readNumberFlag("--clean-limit");
  const labeledLimit = readNumberFlag("--labeled-limit");
  const maxBatchesPerStage = readNumberFlag("--max-batches-per-stage");
  const rawMaxBatches = readNumberFlag("--raw-max-batches");
  const cleanMaxBatches = readNumberFlag("--clean-max-batches");
  const labeledMaxBatches = readNumberFlag("--labeled-max-batches");
  const pollIntervalMs = readNumberFlag("--poll-interval-ms");

  await pool.query("SELECT 1");
  logger.info(
    {
      daemon,
      resetCursors,
      limit,
      rawLimit,
      cleanLimit,
      labeledLimit,
      maxBatchesPerStage,
      rawMaxBatches,
      cleanMaxBatches,
      labeledMaxBatches,
      pollIntervalMs,
    },
    "Database connection verified for training ETL runner",
  );

  if (daemon) {
    await etlRunnerService.runForever({
      limit,
      rawLimit,
      cleanLimit,
      labeledLimit,
      maxBatchesPerStage,
      rawMaxBatches,
      cleanMaxBatches,
      labeledMaxBatches,
      pollIntervalMs,
      resetCursors,
    });
    return;
  }

  const result = await etlRunnerService.runUntilStable({
    limit,
    rawLimit,
    cleanLimit,
    labeledLimit,
    resetCursors,
  });

  logger.info(result, "Training ETL run completed");
}

main()
  .catch((error) => {
    logger.error({ err: error }, "Training ETL runner failed");
    process.exitCode = 1;
  })
  .finally(async () => {
    if (!process.argv.includes("--daemon")) {
      await closePool();
    }
  });
