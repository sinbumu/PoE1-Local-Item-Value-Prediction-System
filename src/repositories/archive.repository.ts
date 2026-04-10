import { pool } from "../db/client";

export type ArchivedNormalizedRow = {
  id: string;
  listing_key: string;
  stash_change_id: string;
  item_id: string | null;
  account_name: string | null;
  stash_name: string | null;
  stash_type: string;
  league: string | null;
  item_name: string;
  type_line: string;
  base_type: string | null;
  rarity: string | null;
  frame_type: number | null;
  note_raw: string;
  note_source: string;
  listing_mode: string | null;
  price_amount: string | null;
  price_currency: string | null;
  item_json: unknown;
  inserted_at: string;
  updated_at: string;
};

export class ArchiveRepository {
  async deleteNormalizedRowsByIds(
    ids: string[],
    olderThanHours?: number,
  ): Promise<number> {
    if (ids.length === 0) {
      return 0;
    }

    const staleCondition =
      olderThanHours === undefined
        ? ""
        : "AND updated_at < NOW() - ($2 * INTERVAL '1 hour')";
    const parameters =
      olderThanHours === undefined ? [ids] : [ids, olderThanHours];
    const result = await pool.query<{ id: string }>(
      `
        DELETE FROM normalized_priced_items
        WHERE id = ANY($1::bigint[])
        ${staleCondition}
        RETURNING id::text
      `,
      parameters,
    );

    return result.rowCount ?? result.rows.length;
  }

  async deleteNormalizedRowsOlderThan(olderThanHours: number): Promise<number> {
    const result = await pool.query<{ id: string }>(
      `
        DELETE FROM normalized_priced_items
        WHERE updated_at < NOW() - ($1 * INTERVAL '1 hour')
        RETURNING id::text
      `,
      [olderThanHours],
    );

    return result.rowCount ?? result.rows.length;
  }

  async deleteNormalizedRowsOlderThanLimited(
    olderThanHours: number,
    limit: number,
  ): Promise<number> {
    const result = await pool.query<{ id: string }>(
      `
        WITH stale_rows AS (
          SELECT id
          FROM normalized_priced_items
          WHERE updated_at < NOW() - ($1 * INTERVAL '1 hour')
          ORDER BY updated_at ASC, id ASC
          LIMIT $2
        )
        DELETE FROM normalized_priced_items
        WHERE id IN (SELECT id FROM stale_rows)
        RETURNING id::text
      `,
      [olderThanHours, limit],
    );

    return result.rowCount ?? result.rows.length;
  }

  async deleteRawResponsesOlderThan(olderThanHours: number): Promise<number> {
    const result = await pool.query<{ id: string }>(
      `
        DELETE FROM raw_api_responses
        WHERE fetched_at < NOW() - ($1 * INTERVAL '1 hour')
        RETURNING id::text
      `,
      [olderThanHours],
    );

    return result.rowCount ?? result.rows.length;
  }
}
