import { closePool, pool } from "../db/client";
import { IngestionActivitySummaryRepository } from "../repositories/ingestion-activity-summary.repository";

async function main(): Promise<void> {
  const summaryRepository = new IngestionActivitySummaryRepository();
  await summaryRepository.ensureSchema();

  const [hourly, daily] = await Promise.all([
    pool.query<{
      summary_source: string;
      bucket_start: string;
      event_count: string;
      auxiliary_count: string | null;
    }>(`
      SELECT
        summary_source,
        bucket_start::text,
        event_count::text,
        auxiliary_count::text
      FROM ingestion_activity_summaries
      WHERE bucket_granularity = 'hour'
      ORDER BY bucket_start DESC, summary_source ASC
      LIMIT 24
    `),
    pool.query<{
      summary_source: string;
      bucket_start: string;
      event_count: string;
      auxiliary_count: string | null;
    }>(`
      SELECT
        summary_source,
        bucket_start::text,
        event_count::text,
        auxiliary_count::text
      FROM ingestion_activity_summaries
      WHERE bucket_granularity = 'day'
      ORDER BY bucket_start DESC, summary_source ASC
      LIMIT 21
    `),
  ]);

  console.log("hourly summaries:", hourly.rows);
  console.log("daily summaries:", daily.rows);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool();
  });
