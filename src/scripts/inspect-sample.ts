import { closePool, pool } from "../db/client";

async function main(): Promise<void> {
  const [rawCount, normalizedCount, topLeagues, topCurrencies] = await Promise.all([
    pool.query<{ count: string }>("SELECT COUNT(*)::text AS count FROM raw_api_responses"),
    pool.query<{ count: string }>(
      "SELECT COUNT(*)::text AS count FROM normalized_priced_items",
    ),
    pool.query<{ league: string | null; count: string }>(`
      SELECT league, COUNT(*)::text AS count
      FROM normalized_priced_items
      GROUP BY league
      ORDER BY COUNT(*) DESC
      LIMIT 10
    `),
    pool.query<{ price_currency: string | null; count: string }>(`
      SELECT price_currency, COUNT(*)::text AS count
      FROM normalized_priced_items
      GROUP BY price_currency
      ORDER BY COUNT(*) DESC
      LIMIT 10
    `),
  ]);

  console.log("raw_api_responses:", rawCount.rows[0]?.count ?? "0");
  console.log("normalized_priced_items:", normalizedCount.rows[0]?.count ?? "0");
  console.log("top leagues:", topLeagues.rows);
  console.log("top currencies:", topCurrencies.rows);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool();
  });
