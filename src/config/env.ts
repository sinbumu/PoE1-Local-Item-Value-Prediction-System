import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const rawEnv = process.env;

const resolvedEnv = {
  POE_CLIENT_ID: rawEnv.POE_CLIENT_ID ?? rawEnv.POE_API_CLIENT_ID,
  POE_CLIENT_SECRET:
    rawEnv.POE_CLIENT_SECRET ??
    rawEnv.POE_API_SECRET_KEY ??
    rawEnv.POE_API_SCRET_KEY,
  POE_USER_AGENT: rawEnv.POE_USER_AGENT,
  DATABASE_URL: rawEnv.DATABASE_URL,
  START_NEXT_CHANGE_ID: rawEnv.START_NEXT_CHANGE_ID,
  TARGET_LEAGUE: rawEnv.TARGET_LEAGUE,
  POE_REALM: rawEnv.POE_REALM ?? "pc",
  POLL_INTERVAL_MS: rawEnv.POLL_INTERVAL_MS ?? "10000",
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
  TARGET_LEAGUE: z.string().optional(),
  POE_REALM: z.enum(["pc", "xbox", "sony"]).default("pc"),
  POLL_INTERVAL_MS: z.coerce.number().int().positive().default(10000),
});

export const env = envSchema.parse(resolvedEnv);
