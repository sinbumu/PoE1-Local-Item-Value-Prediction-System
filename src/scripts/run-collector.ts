import { closePool, pool } from "../db/client";
import { logger } from "../utils/logger";
import { CollectorService } from "../services/collector.service";

async function main(): Promise<void> {
  const collectorService = new CollectorService();
  const once = process.argv.includes("--once");

  await pool.query("SELECT 1");
  logger.info({ once }, "Database connection verified");

  if (once) {
    await collectorService.runOnce();
    return;
  }

  await collectorService.runForever();
}

main()
  .catch((error) => {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
      },
      "Collector script failed",
    );

    process.exitCode = 1;
  })
  .finally(async () => {
    if (process.argv.includes("--once")) {
      await closePool();
    }
  });
