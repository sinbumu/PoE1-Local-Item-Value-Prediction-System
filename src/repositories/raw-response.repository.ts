import { pool } from "../db/client";
import type { PublicStashResponse } from "../types/poe.types";

export class RawResponseRepository {
  async insert(
    payload: PublicStashResponse,
    requestedChangeId?: string,
  ): Promise<void> {
    await pool.query(
      `
        INSERT INTO raw_api_responses (
          requested_change_id,
          response_next_change_id,
          stash_count,
          payload
        )
        VALUES ($1, $2, $3, $4::jsonb)
      `,
      [
        requestedChangeId ?? null,
        payload.next_change_id,
        payload.stashes.length,
        JSON.stringify(payload),
      ],
    );
  }
}
