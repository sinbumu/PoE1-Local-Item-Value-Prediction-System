import type { ParsedPriceNote } from "../types/poe.types";

const PRICE_NOTE_PATTERN =
  /^~(?<mode>b\/o|price)\s+(?<amount>\d+(?:\.\d+)?)\s+(?<currency>[a-zA-Z-]+)$/i;

export class PriceNoteParserService {
  parse(raw: string, source: "note" | "forum_note"): ParsedPriceNote {
    const trimmed = raw.trim();
    const match = PRICE_NOTE_PATTERN.exec(trimmed);

    if (!match?.groups) {
      return {
        raw: trimmed,
        source,
        listingMode: null,
        amount: null,
        currency: null,
      };
    }

    return {
      raw: trimmed,
      source,
      listingMode: match.groups.mode.toLowerCase(),
      amount: Number(match.groups.amount),
      currency: match.groups.currency.toLowerCase(),
    };
  }
}
