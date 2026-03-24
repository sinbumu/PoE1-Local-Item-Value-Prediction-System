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

async function main(): Promise<void> {
  const pipelineService = new TrainingFeaturePipelineService();
  const limit = readNumberFlag("--limit");
  const maxBatches = readNumberFlag("--max-batches");
  const resetCursor = process.argv.includes("--reset-cursor");

  await pool.query("SELECT 1");
  logger.info({ limit, maxBatches, resetCursor }, "Database connection verified");

  const result = await pipelineService.buildRawFeatures({
    limit,
    maxBatches,
    resetCursor,
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
