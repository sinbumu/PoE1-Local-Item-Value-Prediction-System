import axios, { AxiosError } from "axios";
import { env } from "../config/env";
import type { PublicStashResponse } from "../types/poe.types";
import { logger } from "../utils/logger";
import { withRetry } from "../utils/retry";

const API_BASE_URL = "https://api.pathofexile.com";

export class PoeApiService {
  async getPublicStashes(
    accessToken: string,
    nextChangeId?: string,
  ): Promise<PublicStashResponse> {
    const realmSegment = env.POE_REALM === "pc" ? "" : `/${env.POE_REALM}`;

    return withRetry(
      async () => {
        const response = await axios.get<PublicStashResponse>(
          `${API_BASE_URL}/public-stash-tabs${realmSegment}`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "User-Agent": env.POE_USER_AGENT,
              Accept: "application/json",
            },
            params: nextChangeId ? { id: nextChangeId } : undefined,
            timeout: 30000,
          },
        );

        logger.info(
          {
            requestedChangeId: nextChangeId ?? null,
            responseNextChangeId: response.data.next_change_id,
            stashCount: response.data.stashes.length,
          },
          "Public stash request succeeded",
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
        getDelayMs: (error, attempt, baseDelayMs) => {
          if (axios.isAxiosError(error)) {
            const retryAfterHeader = error.response?.headers["retry-after"];
            const retryAfterSeconds = Number(retryAfterHeader);

            if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
              return retryAfterSeconds * 1000;
            }
          }

          return baseDelayMs * 2 ** (attempt - 1);
        },
        onRetry: (error, attempt, delayMs) => {
          const status = axios.isAxiosError(error) ? error.response?.status : undefined;
          logger.warn(
            {
              attempt,
              delayMs,
              status,
            },
            "Retrying public stash request",
          );
        },
      },
    );
  }
}

export function formatAxiosError(error: unknown): Record<string, unknown> {
  if (!axios.isAxiosError(error)) {
    return { message: error instanceof Error ? error.message : String(error) };
  }

  const axiosError = error as AxiosError;

  return {
    message: axiosError.message,
    status: axiosError.response?.status,
    data: axiosError.response?.data,
  };
}
