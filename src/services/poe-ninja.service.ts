import axios from "axios";
import { env } from "../config/env";
import { withRetry } from "../utils/retry";
import { logger } from "../utils/logger";
import type {
  ExchangeRateSnapshot,
  PoeNinjaCurrencyLine,
  PoeNinjaCurrencyOverviewResponse,
} from "../types/exchange-rate.types";

const POE_NINJA_BASE_URL = "https://poe.ninja/api/data";
const OVERVIEW_TYPE = "Currency";

function normalizeCurrencyCode(line: PoeNinjaCurrencyLine): string | null {
  const detailsId = line.detailsId.toLowerCase();

  if (detailsId === "chaos-orb") {
    return "chaos";
  }

  if (detailsId === "divine-orb") {
    return "divine";
  }

  return null;
}

function toSnapshot(
  league: string,
  line: PoeNinjaCurrencyLine,
): ExchangeRateSnapshot | null {
  if (typeof line.chaosEquivalent !== "number" || !Number.isFinite(line.chaosEquivalent)) {
    return null;
  }

  const sampleTimeUtc =
    line.receive?.sample_time_utc ?? line.pay?.sample_time_utc ?? null;
  if (!sampleTimeUtc) {
    return null;
  }

  return {
    source: "poe_ninja",
    league,
    overviewType: OVERVIEW_TYPE,
    detailsId: line.detailsId,
    currencyTypeName: line.currencyTypeName,
    normalizedCurrencyCode: normalizeCurrencyCode(line),
    sampleTimeUtc,
    chaosEquivalent: line.chaosEquivalent,
    payValue:
      typeof line.pay?.value === "number" && Number.isFinite(line.pay.value)
        ? line.pay.value
        : null,
    receiveValue:
      typeof line.receive?.value === "number" && Number.isFinite(line.receive.value)
        ? line.receive.value
        : null,
    payCount: typeof line.pay?.count === "number" ? line.pay.count : null,
    receiveCount:
      typeof line.receive?.count === "number" ? line.receive.count : null,
    payListingCount:
      typeof line.pay?.listing_count === "number" ? line.pay.listing_count : null,
    receiveListingCount:
      typeof line.receive?.listing_count === "number"
        ? line.receive.listing_count
        : null,
  };
}

export class PoeNinjaService {
  async fetchCurrencyOverview(
    league = env.TARGET_LEAGUE,
  ): Promise<PoeNinjaCurrencyOverviewResponse> {
    return withRetry(
      async () => {
        const response = await axios.get<PoeNinjaCurrencyOverviewResponse>(
          `${POE_NINJA_BASE_URL}/currencyoverview`,
          {
            headers: {
              "User-Agent": env.POE_USER_AGENT,
              Accept: "application/json",
            },
            params: {
              league,
              type: OVERVIEW_TYPE,
            },
            timeout: 15000,
          },
        );

        logger.info(
          {
            league,
            lineCount: response.data.lines.length,
          },
          "Fetched poe.ninja currency overview",
        );

        return response.data;
      },
      {
        retries: 4,
        baseDelayMs: 2000,
        shouldRetry: (error) => {
          if (!axios.isAxiosError(error)) {
            return false;
          }

          const status = error.response?.status;
          return status === 429 || status === 500 || status === 502 || status === 503;
        },
        onRetry: (error, attempt, delayMs) => {
          const status = axios.isAxiosError(error) ? error.response?.status : undefined;
          logger.warn(
            {
              attempt,
              delayMs,
              status,
              league,
            },
            "Retrying poe.ninja currency overview request",
          );
        },
      },
    );
  }

  async fetchExchangeRateSnapshots(
    league = env.TARGET_LEAGUE,
  ): Promise<ExchangeRateSnapshot[]> {
    const overview = await this.fetchCurrencyOverview(league);
    const snapshots = overview.lines
      .map((line) => toSnapshot(league, line))
      .filter((line): line is ExchangeRateSnapshot => line !== null);

    const hasChaosSnapshot = snapshots.some(
      (snapshot) => snapshot.normalizedCurrencyCode === "chaos",
    );
    if (!hasChaosSnapshot) {
      const fallbackSampleTimeUtc =
        snapshots.find((snapshot) => snapshot.normalizedCurrencyCode === "divine")
          ?.sampleTimeUtc ??
        snapshots[0]?.sampleTimeUtc;

      if (fallbackSampleTimeUtc) {
        snapshots.push({
          source: "poe_ninja",
          league,
          overviewType: OVERVIEW_TYPE,
          detailsId: "chaos-orb",
          currencyTypeName: "Chaos Orb",
          normalizedCurrencyCode: "chaos",
          sampleTimeUtc: fallbackSampleTimeUtc,
          chaosEquivalent: 1,
          payValue: 1,
          receiveValue: 1,
          payCount: null,
          receiveCount: null,
          payListingCount: null,
          receiveListingCount: null,
        });
      }
    }

    return snapshots;
  }
}
