import type {
  NormalizedPricedItem,
  PublicItem,
  PublicStashChange,
  PublicStashResponse,
} from "../types/poe.types";
import { LeagueFilterService } from "./league-filter.service";
import { PriceNoteParserService } from "./price-note-parser.service";

export class NormalizeService {
  constructor(
    private readonly priceNoteParser = new PriceNoteParserService(),
    private readonly leagueFilterService = new LeagueFilterService(),
  ) {}

  normalizeResponse(response: PublicStashResponse): NormalizedPricedItem[] {
    const rows: NormalizedPricedItem[] = [];

    response.stashes.forEach((stashChange) => {
      if (!stashChange.public) {
        return;
      }

      if (!this.leagueFilterService.isTargetLeague(stashChange.league)) {
        return;
      }

      stashChange.items.forEach((item, index) => {
        if (!this.leagueFilterService.isTargetLeague(item.league)) {
          return;
        }

        const extracted = this.extractPricedItem(stashChange, item, index);
        if (extracted) {
          rows.push(extracted);
        }
      });
    });

    return rows;
  }

  private extractPricedItem(
    stashChange: PublicStashChange,
    item: PublicItem,
    itemIndex: number,
  ): NormalizedPricedItem | null {
    const noteSource = item.note ? "note" : item.forum_note ? "forum_note" : null;

    if (!noteSource) {
      return null;
    }

    const rawNote = noteSource === "note" ? item.note : item.forum_note;

    if (!rawNote) {
      return null;
    }

    const parsed = this.priceNoteParser.parse(rawNote, noteSource);

    return {
      listingKey: item.id ?? `${stashChange.id}:${itemIndex}`,
      stashChangeId: stashChange.id,
      itemId: item.id ?? null,
      accountName: stashChange.accountName ?? null,
      stashName: stashChange.stash ?? null,
      stashType: stashChange.stashType,
      league: stashChange.league ?? null,
      itemName: item.name || item.typeLine,
      typeLine: item.typeLine,
      baseType: item.baseType ?? null,
      rarity: item.rarity ?? null,
      frameType: item.frameType ?? null,
      noteRaw: parsed.raw,
      noteSource: parsed.source,
      listingMode: parsed.listingMode,
      priceAmount: parsed.amount,
      priceCurrency: parsed.currency,
      itemJson: item,
    };
  }
}
