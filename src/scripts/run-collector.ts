import { closePool, pool } from "../db/client";
import { logger } from "../utils/logger";
import { CollectorService } from "../services/collector.service";

async function main(): Promise<void> {
  const collectorService = new CollectorService();
  const once = process.argv.includes("--once");
  const startLatest = process.argv.includes("--start-latest");

  await pool.query("SELECT 1");
  logger.info({ once, startLatest }, "Database connection verified");

  if (once) {
    await collectorService.runOnce({ startLatest });
    return;
  }

  await collectorService.runForever({ startLatest });
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
