export type OAuthTokenResponse = {
  access_token: string;
  expires_in: number | null;
  token_type: string;
  scope: string;
  username?: string;
  sub?: string;
};

export type PublicItem = {
  id?: string;
  name: string;
  typeLine: string;
  baseType?: string;
  rarity?: string;
  frameType?: number;
  note?: string;
  forum_note?: string;
  ilvl: number;
  [key: string]: unknown;
};

export type PublicStashChange = {
  id: string;
  public: boolean;
  accountName?: string | null;
  stash?: string | null;
  stashType: string;
  league?: string | null;
  items: PublicItem[];
};

export type PublicStashResponse = {
  next_change_id: string;
  stashes: PublicStashChange[];
};

export type ParsedPriceNote = {
  raw: string;
  source: "note" | "forum_note";
  listingMode: string | null;
  amount: number | null;
  currency: string | null;
};

export type NormalizedPricedItem = {
  listingKey: string;
  stashChangeId: string;
  itemId: string | null;
  accountName: string | null;
  stashName: string | null;
  stashType: string;
  league: string | null;
  itemName: string;
  typeLine: string;
  baseType: string | null;
  rarity: string | null;
  frameType: number | null;
  noteRaw: string;
  noteSource: "note" | "forum_note";
  listingMode: string | null;
  priceAmount: number | null;
  priceCurrency: string | null;
  itemJson: PublicItem;
};
