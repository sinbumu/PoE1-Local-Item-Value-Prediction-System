import type {
  TrainingFeatureLabeled,
} from "../types/training-features.types";
import type { TrainingFeatureLabelSourceRow } from "../repositories/training-feature-labeled-source.repository";

type LabelDecision =
  | { keep: true; feature: TrainingFeatureLabeled }
  | { keep: false; reason: string };

export class TrainingFeatureLabelerService {
  label(row: TrainingFeatureLabelSourceRow): LabelDecision {
    if (!row.exchangeRateChaosEquivalent || !row.exchangeRateSampleTimeUtc) {
      return { keep: false, reason: "missing_historical_exchange_rate" };
    }

    const priceAmount = Number(row.targetPriceAmount);
    const exchangeRate = Number(row.exchangeRateChaosEquivalent);

    if (!Number.isFinite(priceAmount) || priceAmount <= 0) {
      return { keep: false, reason: "invalid_clean_target_price_amount" };
    }

    if (!Number.isFinite(exchangeRate) || exchangeRate <= 0) {
      return { keep: false, reason: "invalid_exchange_rate" };
    }

    const targetPriceChaos = priceAmount * exchangeRate;

    return {
      keep: true,
      feature: {
        ...row,
        exchangeRateSource: "poe_ninja",
        exchangeRateSampleTimeUtc: row.exchangeRateSampleTimeUtc,
        exchangeRateChaosEquivalent: row.exchangeRateChaosEquivalent,
        targetPriceChaos: String(targetPriceChaos),
        targetPriceLog1p: Math.log1p(targetPriceChaos),
        labelReason: "historical_latest_leq_source_updated_at",
      },
    };
  }
}
