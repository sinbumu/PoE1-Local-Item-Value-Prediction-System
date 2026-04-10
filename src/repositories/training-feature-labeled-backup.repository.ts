import { pool } from "../db/client";
import type { TrainingFeatureLabeledBackupCursor } from "./training-feature-labeled-backup-state.repository";

export type TrainingFeatureLabeledBackupRow = {
  listing_key: string;
  labeled_at: string;
  row_json: Record<string, unknown>;
};

export class TrainingFeatureLabeledBackupRepository {
  async getBatch(
    limit: number,
    cursor?: TrainingFeatureLabeledBackupCursor | null,
  ): Promise<TrainingFeatureLabeledBackupRow[]> {
    const result = await pool.query<TrainingFeatureLabeledBackupRow>(
      `
        SELECT
          listing_key,
          labeled_at::text,
          (to_jsonb(training_features_labeled) - 'id') AS row_json
        FROM training_features_labeled
        WHERE
          $1::timestamptz IS NULL
          OR labeled_at > $1::timestamptz
          OR (labeled_at = $1::timestamptz AND listing_key > $2)
        ORDER BY labeled_at ASC, listing_key ASC
        LIMIT $3
      `,
      [cursor?.labeledAt ?? null, cursor?.listingKey ?? "", limit],
    );

    return result.rows;
  }
}
