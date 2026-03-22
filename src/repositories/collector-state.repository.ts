import { pool } from "../db/client";

const COLLECTOR_NEXT_CHANGE_ID_KEY = "latest_next_change_id";

export class CollectorStateRepository {
  async getLatestNextChangeId(): Promise<string | null> {
    const result = await pool.query<{ state_value: string }>(
      `
        SELECT state_value
        FROM collector_state
        WHERE state_key = $1
      `,
      [COLLECTOR_NEXT_CHANGE_ID_KEY],
    );

    return result.rows[0]?.state_value ?? null;
  }

  async saveLatestNextChangeId(nextChangeId: string): Promise<void> {
    await pool.query(
      `
        INSERT INTO collector_state (state_key, state_value, updated_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT (state_key)
        DO UPDATE SET
          state_value = EXCLUDED.state_value,
          updated_at = NOW()
      `,
      [COLLECTOR_NEXT_CHANGE_ID_KEY, nextChangeId],
    );
  }
}
