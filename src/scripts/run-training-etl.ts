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

function readStringFlag(flag: string): string | undefined {
  const argument = process.argv.find((value) => value.startsWith(`${flag}=`));
  if (!argument) {
    return undefined;
  }

  const rawValue = argument.slice(flag.length + 1).trim();
  return rawValue.length > 0 ? rawValue : undefined;
}

function resolveSinceUpdatedAt(): string | undefined {
  const sinceTimestamp = readStringFlag("--since-timestamp");
  const sinceHours = readNumberFlag("--since-hours");

  if (sinceTimestamp && sinceHours) {
    throw new Error("--since-timestamp와 --since-hours는 동시에 사용할 수 없습니다.");
  }

  if (sinceTimestamp) {
    const parsedTimestamp = new Date(sinceTimestamp);
    if (Number.isNaN(parsedTimestamp.getTime())) {
      throw new Error(`--since-timestamp 값이 올바르지 않습니다: ${sinceTimestamp}`);
    }

    return parsedTimestamp.toISOString();
  }

  if (sinceHours) {
    return new Date(Date.now() - sinceHours * 60 * 60 * 1000).toISOString();
  }

  return undefined;
}

async function main(): Promise<void> {
  const etlRunnerService = new TrainingEtlRunnerService();
  const daemon = process.argv.includes("--daemon");
  const resetCursors = process.argv.includes("--reset-cursors");
  const pruneBeforeRun = process.argv.includes("--prune-before-run");
  const limit = readNumberFlag("--limit");
  const rawLimit = readNumberFlag("--raw-limit");
  const cleanLimit = readNumberFlag("--clean-limit");
  const labeledLimit = readNumberFlag("--labeled-limit");
  const maxBatchesPerStage = readNumberFlag("--max-batches-per-stage");
  const rawMaxBatches = readNumberFlag("--raw-max-batches");
  const cleanMaxBatches = readNumberFlag("--clean-max-batches");
  const labeledMaxBatches = readNumberFlag("--labeled-max-batches");
  const pollIntervalMs = readNumberFlag("--poll-interval-ms");
  const sinceUpdatedAt = resolveSinceUpdatedAt();

  if (pruneBeforeRun && !sinceUpdatedAt) {
    throw new Error("--prune-before-run은 --since-hours 또는 --since-timestamp와 함께 사용해야 합니다.");
  }

  await pool.query("SELECT 1");
  logger.info(
    {
      daemon,
      resetCursors,
      pruneBeforeRun,
      limit,
      rawLimit,
      cleanLimit,
      labeledLimit,
      maxBatchesPerStage,
      rawMaxBatches,
      cleanMaxBatches,
      labeledMaxBatches,
      pollIntervalMs,
      sinceUpdatedAt,
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
      sinceUpdatedAt,
      pruneBeforeRun,
    });
    return;
  }

  const result = await etlRunnerService.runUntilStable({
    limit,
    rawLimit,
    cleanLimit,
    labeledLimit,
    maxBatchesPerStage,
    rawMaxBatches,
    cleanMaxBatches,
    labeledMaxBatches,
    resetCursors,
    sinceUpdatedAt,
    pruneBeforeRun,
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
