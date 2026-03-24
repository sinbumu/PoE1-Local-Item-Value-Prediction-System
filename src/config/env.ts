import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const rawEnv = process.env;

function readOptionalString(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  const trimmed = value.replace(/\s+#.*$/, "").trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

const resolvedEnv = {
  POE_CLIENT_ID:
    readOptionalString(rawEnv.POE_CLIENT_ID) ??
    readOptionalString(rawEnv.POE_API_CLIENT_ID),
  POE_CLIENT_SECRET:
    readOptionalString(rawEnv.POE_CLIENT_SECRET) ??
    readOptionalString(rawEnv.POE_API_SECRET_KEY) ??
    readOptionalString(rawEnv.POE_API_SCRET_KEY),
  POE_USER_AGENT: readOptionalString(rawEnv.POE_USER_AGENT),
  DATABASE_URL: readOptionalString(rawEnv.DATABASE_URL),
  START_NEXT_CHANGE_ID: readOptionalString(rawEnv.START_NEXT_CHANGE_ID),
  TARGET_LEAGUE: readOptionalString(rawEnv.TARGET_LEAGUE) ?? "Mirage",
  POE_REALM: readOptionalString(rawEnv.POE_REALM) ?? "pc",
  POLL_INTERVAL_MS: readOptionalString(rawEnv.POLL_INTERVAL_MS) ?? "10000",
  GOOGLE_CLIENT_ID: readOptionalString(rawEnv.GOOGLE_CLIENT_ID),
  GOOGLE_CLIENT_SECRET: readOptionalString(rawEnv.GOOGLE_CLIENT_SECRET),
  GOOGLE_REDIRECT_URI: readOptionalString(rawEnv.GOOGLE_REDIRECT_URI),
  GOOGLE_REFRESH_TOKEN: readOptionalString(rawEnv.GOOGLE_REFRESH_TOKEN),
  GOOGLE_DRIVE_FOLDER_ID: readOptionalString(rawEnv.GOOGLE_DRIVE_FOLDER_ID),
  ARCHIVE_OUTPUT_DIR:
    readOptionalString(rawEnv.ARCHIVE_OUTPUT_DIR) ?? ".archive/normalized",
  RAW_RETENTION_HOURS: readOptionalString(rawEnv.RAW_RETENTION_HOURS) ?? "24",
  NORMALIZED_RETENTION_HOURS:
    readOptionalString(rawEnv.NORMALIZED_RETENTION_HOURS) ?? "72",
  NORMALIZED_ARCHIVE_LIMIT:
    readOptionalString(rawEnv.NORMALIZED_ARCHIVE_LIMIT) ?? "10000",
};

const envSchema = z.object({
  POE_CLIENT_ID: z.string().min(1, "POE_CLIENT_ID is required"),
  POE_CLIENT_SECRET: z.string().min(1, "POE_CLIENT_SECRET is required"),
  POE_USER_AGENT: z
    .string()
    .min(1, "POE_USER_AGENT is required")
    .refine((value) => value.startsWith("OAuth "), {
      message: "POE_USER_AGENT must start with 'OAuth '",
    }),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  START_NEXT_CHANGE_ID: z.string().optional(),
  TARGET_LEAGUE: z.string().min(1).default("Mirage"),
  POE_REALM: z.enum(["pc", "xbox", "sony"]).default("pc"),
  POLL_INTERVAL_MS: z.coerce.number().int().positive().default(10000),
  GOOGLE_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
  GOOGLE_REDIRECT_URI: z.string().url().optional(),
  GOOGLE_REFRESH_TOKEN: z.string().min(1).optional(),
  GOOGLE_DRIVE_FOLDER_ID: z.string().min(1).optional(),
  ARCHIVE_OUTPUT_DIR: z.string().min(1).default(".archive/normalized"),
  RAW_RETENTION_HOURS: z.coerce.number().int().positive().default(24),
  NORMALIZED_RETENTION_HOURS: z.coerce.number().int().positive().default(72),
  NORMALIZED_ARCHIVE_LIMIT: z.coerce.number().int().positive().default(10000),
});

export const env = envSchema.parse(resolvedEnv);
