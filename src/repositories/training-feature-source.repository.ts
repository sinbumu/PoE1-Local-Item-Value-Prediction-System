import { pool } from "../db/client";
import type {
  NormalizedPricedItemSourceRow,
  TrainingFeatureCursor,
} from "../types/training-features.types";

export class TrainingFeatureSourceRepository {
  async getBatch(
    limit: number,
    cursor?: TrainingFeatureCursor | null,
  ): Promise<NormalizedPricedItemSourceRow[]> {
    const result = await pool.query<NormalizedPricedItemSourceRow>(
      `
        SELECT
          listing_key,
          item_id,
          league,
          base_type,
          rarity,
          frame_type,
          listing_mode,
          price_amount::text,
          price_currency,
          item_json,
          inserted_at::text,
          updated_at::text
        FROM normalized_priced_items
        WHERE
          $1::timestamptz IS NULL
          OR updated_at > $1::timestamptz
          OR (updated_at = $1::timestamptz AND listing_key > $2)
        ORDER BY updated_at ASC, listing_key ASC
        LIMIT $3
      `,
      [cursor?.updatedAt ?? null, cursor?.listingKey ?? "", limit],
    );

    return result.rows;
  }
}
