import axios from "axios";
import { env } from "../config/env";
import type { OAuthTokenResponse } from "../types/poe.types";
import { logger } from "../utils/logger";

const TOKEN_URL = "https://www.pathofexile.com/oauth/token";

export class AuthService {
  private cachedAccessToken: string | null = null;

  async getAccessToken(forceRefresh = false): Promise<string> {
    if (!forceRefresh && this.cachedAccessToken) {
      return this.cachedAccessToken;
    }

    const body = new URLSearchParams({
      client_id: env.POE_CLIENT_ID,
      client_secret: env.POE_CLIENT_SECRET,
      grant_type: "client_credentials",
      scope: "service:psapi",
    });

    const response = await axios.post<OAuthTokenResponse>(TOKEN_URL, body, {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": env.POE_USER_AGENT,
        Accept: "application/json",
      },
      timeout: 15000,
    });

    logger.info(
      {
        scope: response.data.scope,
        tokenType: response.data.token_type,
      },
      "Successfully fetched OAuth token",
    );

    this.cachedAccessToken = response.data.access_token;
    return response.data.access_token;
  }

  clearCachedAccessToken(): void {
    this.cachedAccessToken = null;
  }
}
