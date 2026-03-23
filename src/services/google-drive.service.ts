import axios from "axios";
import { createReadStream } from "fs";
import { stat } from "fs/promises";
import { basename } from "path";
import { env } from "../config/env";
import { logger } from "../utils/logger";

type GoogleDriveTokenResponse = {
  access_token: string;
  expires_in: number;
  token_type: string;
  scope?: string;
};

export type GoogleDriveFileMetadata = {
  id: string;
  name: string;
  mimeType?: string;
  size?: string;
  parents?: string[];
  createdTime?: string;
  webViewLink?: string;
};

type UploadFileOptions = {
  filePath: string;
  fileName?: string;
  mimeType?: string;
  parentFolderId?: string;
};

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_DRIVE_METADATA_URL = "https://www.googleapis.com/drive/v3/files";
const GOOGLE_DRIVE_MEDIA_UPLOAD_URL =
  "https://www.googleapis.com/upload/drive/v3/files";

export class GoogleDriveService {
  private cachedAccessToken: string | null = null;
  private cachedAccessTokenExpiresAt = 0;

  private validateConfig(): void {
    const missingKeys = [
      !env.GOOGLE_CLIENT_ID && "GOOGLE_CLIENT_ID",
      !env.GOOGLE_CLIENT_SECRET && "GOOGLE_CLIENT_SECRET",
      !env.GOOGLE_REFRESH_TOKEN && "GOOGLE_REFRESH_TOKEN",
    ].filter((value): value is string => Boolean(value));

    if (missingKeys.length > 0) {
      throw new Error(
        `Google Drive 업로드 설정이 부족합니다: ${missingKeys.join(", ")}`,
      );
    }
  }

  async getAccessToken(forceRefresh = false): Promise<string> {
    this.validateConfig();

    if (
      !forceRefresh &&
      this.cachedAccessToken &&
      Date.now() < this.cachedAccessTokenExpiresAt
    ) {
      return this.cachedAccessToken;
    }

    const body = new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID!,
      client_secret: env.GOOGLE_CLIENT_SECRET!,
      refresh_token: env.GOOGLE_REFRESH_TOKEN!,
      grant_type: "refresh_token",
    });

    const response = await axios.post<GoogleDriveTokenResponse>(
      GOOGLE_TOKEN_URL,
      body,
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        timeout: 15000,
      },
    );

    this.cachedAccessToken = response.data.access_token;
    this.cachedAccessTokenExpiresAt =
      Date.now() + Math.max(response.data.expires_in - 60, 60) * 1000;

    logger.info("Google Drive access token refreshed");

    return response.data.access_token;
  }

  async uploadFile(options: UploadFileOptions): Promise<GoogleDriveFileMetadata> {
    const fileName = options.fileName ?? basename(options.filePath);
    const mimeType = options.mimeType ?? "application/octet-stream";
    const parentFolderId = options.parentFolderId ?? env.GOOGLE_DRIVE_FOLDER_ID;
    const accessToken = await this.getAccessToken();
    const metadata: Record<string, unknown> = {
      name: fileName,
    };

    if (parentFolderId) {
      metadata.parents = [parentFolderId];
    }

    const fileStats = await stat(options.filePath);
    const createResponse = await axios.post<GoogleDriveFileMetadata>(
      `${GOOGLE_DRIVE_METADATA_URL}?supportsAllDrives=true`,
      metadata,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json; charset=UTF-8",
        },
        params: {
          fields: "id,name,mimeType,size,parents,createdTime,webViewLink",
        },
        timeout: 15000,
      },
    );

    const response = await axios.patch<GoogleDriveFileMetadata>(
      `${GOOGLE_DRIVE_MEDIA_UPLOAD_URL}/${createResponse.data.id}`,
      createReadStream(options.filePath),
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": mimeType,
          "Content-Length": fileStats.size,
        },
        params: {
          uploadType: "media",
          supportsAllDrives: true,
          fields: "id,name,mimeType,size,parents,createdTime,webViewLink",
        },
        timeout: 60000,
      },
    );

    logger.info(
      {
        fileId: response.data.id,
        fileName: response.data.name,
      },
      "Uploaded file to Google Drive",
    );

    return response.data;
  }

  async getFileMetadata(fileId: string): Promise<GoogleDriveFileMetadata> {
    const accessToken = await this.getAccessToken();
    const response = await axios.get<GoogleDriveFileMetadata>(
      `${GOOGLE_DRIVE_METADATA_URL}/${fileId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
        },
        params: {
          fields: "id,name,mimeType,size,parents,createdTime,webViewLink",
          supportsAllDrives: true,
        },
        timeout: 15000,
      },
    );

    return response.data;
  }
}
