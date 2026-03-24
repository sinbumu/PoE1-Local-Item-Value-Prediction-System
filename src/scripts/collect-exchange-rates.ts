import { closePool, pool } from "../db/client";
import { ExchangeRateService } from "../services/exchange-rate.service";
import { logger } from "../utils/logger";

function readStringFlag(flag: string): string | undefined {
  const argument = process.argv.find((value) => value.startsWith(`${flag}=`));

  if (!argument) {
    return undefined;
  }

  return argument.slice(flag.length + 1);
}

async function main(): Promise<void> {
  const exchangeRateService = new ExchangeRateService();
  const league = readStringFlag("--league");

  await pool.query("SELECT 1");
  logger.info({ league: league ?? null }, "Database connection verified");

  const result = await exchangeRateService.collectSnapshots(league);
  logger.info(result, "Exchange rate collection completed");
}

main()
  .catch((error) => {
    logger.error({ err: error }, "Exchange rate collection failed");
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool();
  });
