import { closePool, pool } from "../db/client";
import { TrainingFeaturePipelineService } from "../services/training-feature-pipeline.service";
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
  const pipelineService = new TrainingFeaturePipelineService();
  const limit = readNumberFlag("--limit");
  const maxBatches = readNumberFlag("--max-batches");
  const untilEnd = process.argv.includes("--until-end");
  const resetCursor = process.argv.includes("--reset-cursor");
  const pruneBeforeRun = process.argv.includes("--prune-before-run");
  const sinceUpdatedAt = resolveSinceUpdatedAt();
  const effectiveMaxBatches = untilEnd ? Number.MAX_SAFE_INTEGER : maxBatches;

  if (pruneBeforeRun && !sinceUpdatedAt) {
    throw new Error("--prune-before-run은 --since-hours 또는 --since-timestamp와 함께 사용해야 합니다.");
  }

  await pool.query("SELECT 1");
  logger.info(
    {
      limit,
      maxBatches: effectiveMaxBatches,
      untilEnd,
      resetCursor,
      pruneBeforeRun,
      sinceUpdatedAt,
    },
    "Database connection verified",
  );

  const result = await pipelineService.buildRawFeatures({
    limit,
    maxBatches: effectiveMaxBatches,
    resetCursor,
    sinceUpdatedAt,
    pruneBeforeRun,
  });

  logger.info(result, "Training feature build completed");
}

main()
  .catch((error) => {
    logger.error({ err: error }, "Training feature build failed");
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool();
  });
