import { pool } from "../db/client";

export type TrainingFeatureLabeledBackupCursor = {
  labeledAt: string;
  listingKey: string;
};

const TRAINING_FEATURE_LABELED_BACKUP_CURSOR_KEY =
  "training_features_labeled_backup_cursor_v1";

export class TrainingFeatureLabeledBackupStateRepository {
  async getCursor(): Promise<TrainingFeatureLabeledBackupCursor | null> {
    const result = await pool.query<{ state_value: string }>(
      `
        SELECT state_value
        FROM collector_state
        WHERE state_key = $1
      `,
      [TRAINING_FEATURE_LABELED_BACKUP_CURSOR_KEY],
    );

    const rawValue = result.rows[0]?.state_value;
    if (!rawValue) {
      return null;
    }

    return JSON.parse(rawValue) as TrainingFeatureLabeledBackupCursor;
  }

  async saveCursor(cursor: TrainingFeatureLabeledBackupCursor): Promise<void> {
    await pool.query(
      `
        INSERT INTO collector_state (state_key, state_value, updated_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT (state_key)
        DO UPDATE SET
          state_value = EXCLUDED.state_value,
          updated_at = NOW()
      `,
      [TRAINING_FEATURE_LABELED_BACKUP_CURSOR_KEY, JSON.stringify(cursor)],
    );
  }

  async resetCursor(): Promise<void> {
    await pool.query(
      `
        DELETE FROM collector_state
        WHERE state_key = $1
      `,
      [TRAINING_FEATURE_LABELED_BACKUP_CURSOR_KEY],
    );
  }
}
