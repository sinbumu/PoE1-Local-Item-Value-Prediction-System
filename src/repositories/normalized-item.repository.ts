import { pool } from "../db/client";
import type { NormalizedPricedItem } from "../types/poe.types";

export class NormalizedItemRepository {
  async upsertMany(items: NormalizedPricedItem[]): Promise<number> {
    for (const item of items) {
      await pool.query(
        `
          INSERT INTO normalized_priced_items (
            listing_key,
            stash_change_id,
            item_id,
            account_name,
            stash_name,
            stash_type,
            league,
            item_name,
            type_line,
            base_type,
            rarity,
            frame_type,
            note_raw,
            note_source,
            listing_mode,
            price_amount,
            price_currency,
            item_json,
            updated_at
          )
          VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9,
            $10, $11, $12, $13, $14, $15, $16, $17, $18::jsonb, NOW()
          )
          ON CONFLICT (listing_key)
          DO UPDATE SET
            stash_change_id = EXCLUDED.stash_change_id,
            item_id = EXCLUDED.item_id,
            account_name = EXCLUDED.account_name,
            stash_name = EXCLUDED.stash_name,
            stash_type = EXCLUDED.stash_type,
            league = EXCLUDED.league,
            item_name = EXCLUDED.item_name,
            type_line = EXCLUDED.type_line,
            base_type = EXCLUDED.base_type,
            rarity = EXCLUDED.rarity,
            frame_type = EXCLUDED.frame_type,
            note_raw = EXCLUDED.note_raw,
            note_source = EXCLUDED.note_source,
            listing_mode = EXCLUDED.listing_mode,
            price_amount = EXCLUDED.price_amount,
            price_currency = EXCLUDED.price_currency,
            item_json = EXCLUDED.item_json,
            updated_at = NOW()
        `,
        [
          item.listingKey,
          item.stashChangeId,
          item.itemId,
          item.accountName,
          item.stashName,
          item.stashType,
          item.league,
          item.itemName,
          item.typeLine,
          item.baseType,
          item.rarity,
          item.frameType,
          item.noteRaw,
          item.noteSource,
          item.listingMode,
          item.priceAmount,
          item.priceCurrency,
          JSON.stringify(item.itemJson),
        ],
      );
    }

    return items.length;
  }
}
