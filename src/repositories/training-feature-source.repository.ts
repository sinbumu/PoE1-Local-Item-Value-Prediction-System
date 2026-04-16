import { pool } from "../db/client";
import type {
  NormalizedPricedItemSourceRow,
  TrainingFeatureCursor,
} from "../types/training-features.types";

export class TrainingFeatureSourceRepository {
  async getBatch(
    limit: number,
    cursor?: TrainingFeatureCursor | null,
    sinceUpdatedAt?: string,
  ): Promise<NormalizedPricedItemSourceRow[]> {
    const result = await pool.query<NormalizedPricedItemSourceRow>(
      `
        SELECT
          n.listing_key,
          n.item_id,
          n.league,
          n.base_type,
          n.rarity,
          n.frame_type,
          n.listing_mode,
          n.price_amount::text,
          n.price_currency,
          n.item_json,
          n.inserted_at::text,
          n.updated_at::text
        FROM normalized_priced_items n
        WHERE
          ($4::timestamptz IS NULL OR n.updated_at >= $4::timestamptz)
          AND (
            $1::timestamptz IS NULL
            OR (n.updated_at, n.listing_key) > ($1::timestamptz, $2::text)
          )
        ORDER BY n.updated_at ASC, n.listing_key ASC
        LIMIT $3
      `,
      [cursor?.updatedAt ?? null, cursor?.listingKey ?? "", limit, sinceUpdatedAt ?? null],
    );

    return result.rows;
  }
}
