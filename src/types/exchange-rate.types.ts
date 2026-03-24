export type PoeNinjaCurrencyOverviewResponse = {
  lines: PoeNinjaCurrencyLine[];
  currencyDetails?: Array<Record<string, unknown>>;
};

export type PoeNinjaCurrencyLine = {
  currencyTypeName: string;
  detailsId: string;
  chaosEquivalent?: number;
  pay?: {
    sample_time_utc?: string;
    value?: number;
    count?: number;
    listing_count?: number;
  };
  receive?: {
    sample_time_utc?: string;
    value?: number;
    count?: number;
    listing_count?: number;
  };
};

export type ExchangeRateSnapshot = {
  source: "poe_ninja";
  league: string;
  overviewType: string;
  detailsId: string;
  currencyTypeName: string;
  normalizedCurrencyCode: string | null;
  sampleTimeUtc: string;
  chaosEquivalent: number;
  payValue: number | null;
  receiveValue: number | null;
  payCount: number | null;
  receiveCount: number | null;
  payListingCount: number | null;
  receiveListingCount: number | null;
};
