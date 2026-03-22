import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const rawEnv = process.env;

function readOptionalString(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  const trimmed = value.trim();
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
});

export const env = envSchema.parse(resolvedEnv);
