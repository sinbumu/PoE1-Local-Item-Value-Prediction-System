import { mkdir, writeFile } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { dirname, join, resolve } from "node:path";

import type { QueryResult } from "pg";

import { closePool, pool } from "../db/client";
import { logger } from "../utils/logger";

const DEFAULT_DAYS = 7;
const DEFAULT_BATCH_SIZE = 5000;
const DEFAULT_OUTPUT_DIR = resolve(process.cwd(), "artifacts", "datasets");

const CSV_HEADERS = [
  "listing_key",
  "source_updated_at",
  "league",
  "model_segment",
  "clean_reason",
  "target_price_amount",
  "target_price_currency",
  "item_class",
  "base_type",
  "rarity",
  "frame_type",
  "ilvl",
  "identified",
  "corrupted",
  "fractured",
  "synthesised",
  "duplicated",
  "influence_shaper",
  "influence_elder",
  "influence_crusader",
  "influence_redeemer",
  "influence_hunter",
  "influence_warlord",
  "influence_searing",
  "influence_tangled",
  "socket_count",
  "link_count",
  "white_socket_count",
  "prefix_count",
  "suffix_count",
  "explicit_mod_count",
  "implicit_mod_count",
  "crafted_mod_count",
  "fractured_mod_count",
  "enchant_mod_count",
  "quality",
  "armour",
  "evasion",
  "energy_shield",
  "ward",
  "physical_dps",
  "elemental_dps",
  "attack_speed",
  "crit_chance",
  "move_speed",
  "life_roll_sum",
  "resistance_roll_sum",
  "attribute_roll_sum",
  "jewel_type",
  "cluster_size",
  "cluster_passive_count",
  "notable_count",
  "damage_mod_count",
  "defence_mod_count",
  "utility_mod_count",
  "gem_level",
  "gem_quality",
  "is_awakened",
  "is_vaal",
  "is_support_gem",
  "gem_tags",
  "exchange_rate_source",
  "exchange_rate_sample_time_utc",
  "exchange_rate_chaos_equivalent",
  "target_price_chaos",
  "target_price_log1p",
  "label_reason",
] as const;

type ExportRow = {
  [key: string]: unknown;
  listing_key: string | null;
  source_updated_at: string | null;
};

function readNumberFlag(flag: string, defaultValue: number): number {
  const argument = process.argv.find((value) => value.startsWith(`${flag}=`));
  if (!argument) {
    return defaultValue;
  }

  const rawValue = argument.slice(flag.length + 1);
  const parsedValue = Number(rawValue);
  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    throw new Error(`${flag} 값이 올바르지 않습니다: ${rawValue}`);
  }

  return parsedValue;
}

function readStringFlag(flag: string): string | undefined {
  const argument = process.argv.find((value) => value.startsWith(`${flag}=`));
  if (!argument) {
    return undefined;
  }

  const rawValue = argument.slice(flag.length + 1).trim();
  return rawValue.length > 0 ? rawValue : undefined;
}

function readSegmentsFlag(): string[] | null {
  const rawValue = readStringFlag("--segments");
  if (!rawValue) {
    return null;
  }

  const values = rawValue
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  return values.length > 0 ? values : null;
}

function buildDefaultOutputPath(days: number): string {
  const timestamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  return join(
    DEFAULT_OUTPUT_DIR,
    `training_features_labeled_last_${days}d_${timestamp}.csv`,
  );
}

function formatCsvValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  const stringValue = Array.isArray(value)
    ? value.join("|")
    : typeof value === "boolean"
      ? String(value)
      : String(value);

  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

async function writeLine(
  stream: NodeJS.WritableStream,
  content: string,
): Promise<void> {
  if (stream.write(content)) {
    return;
  }

  await new Promise<void>((resolveWrite, rejectWrite) => {
    stream.once("drain", resolveWrite);
    stream.once("error", rejectWrite);
  });
}

async function main(): Promise<void> {
  const days = readNumberFlag("--days", DEFAULT_DAYS);
  const batchSize = readNumberFlag("--batch-size", DEFAULT_BATCH_SIZE);
  const modelSegments = readSegmentsFlag();
  const outputPath = resolve(readStringFlag("--output") ?? buildDefaultOutputPath(days));
  const manifestPath = outputPath.replace(/\.csv$/i, ".manifest.json");

  await pool.query("SELECT 1");

  logger.info(
    {
      days,
      batchSize,
      modelSegments,
      outputPath,
      manifestPath,
    },
    "Starting labeled training dataset export",
  );

  await mkdir(dirname(outputPath), { recursive: true });

  const summaryResult = await pool.query<{
    row_count: string;
    min_source_updated_at: string | null;
    max_source_updated_at: string | null;
  }>(
    `
      SELECT
        COUNT(*)::text AS row_count,
        MIN(source_updated_at)::text AS min_source_updated_at,
        MAX(source_updated_at)::text AS max_source_updated_at
      FROM training_features_labeled
      WHERE source_updated_at >= NOW() - ($1::int * INTERVAL '1 day')
        AND ($2::text[] IS NULL OR model_segment = ANY($2::text[]))
    `,
    [days, modelSegments],
  );

  const summaryRow = summaryResult.rows[0];
  const totalRows = Number(summaryRow?.row_count ?? "0");

  const stream = createWriteStream(outputPath, { encoding: "utf-8" });
  await writeLine(stream, `${CSV_HEADERS.join(",")}\n`);

  let exportedRows = 0;
  let lastUpdatedAt: string | null = null;
  let lastListingKey: string | null = null;

  try {
    while (true) {
      const result: QueryResult<ExportRow> = await pool.query<ExportRow>(
        `
          SELECT
            listing_key,
            source_updated_at::text,
            league,
            model_segment,
            clean_reason,
            target_price_amount::text,
            target_price_currency,
            item_class,
            base_type,
            rarity,
            frame_type,
            ilvl,
            identified,
            corrupted,
            fractured,
            synthesised,
            duplicated,
            influence_shaper,
            influence_elder,
            influence_crusader,
            influence_redeemer,
            influence_hunter,
            influence_warlord,
            influence_searing,
            influence_tangled,
            socket_count,
            link_count,
            white_socket_count,
            prefix_count,
            suffix_count,
            explicit_mod_count,
            implicit_mod_count,
            crafted_mod_count,
            fractured_mod_count,
            enchant_mod_count,
            quality::text,
            armour::text,
            evasion::text,
            energy_shield::text,
            ward::text,
            physical_dps::text,
            elemental_dps::text,
            attack_speed::text,
            crit_chance::text,
            move_speed::text,
            life_roll_sum::text,
            resistance_roll_sum::text,
            attribute_roll_sum::text,
            jewel_type,
            cluster_size,
            cluster_passive_count,
            notable_count,
            damage_mod_count,
            defence_mod_count,
            utility_mod_count,
            gem_level,
            gem_quality::text,
            is_awakened,
            is_vaal,
            is_support_gem,
            array_to_string(gem_tags, '|') AS gem_tags,
            exchange_rate_source,
            exchange_rate_sample_time_utc::text,
            exchange_rate_chaos_equivalent::text,
            target_price_chaos::text,
            target_price_log1p::text,
            label_reason
          FROM training_features_labeled
          WHERE source_updated_at >= NOW() - ($1::int * INTERVAL '1 day')
            AND ($2::text[] IS NULL OR model_segment = ANY($2::text[]))
            AND (
              $3::timestamptz IS NULL
              OR source_updated_at > $3::timestamptz
              OR (source_updated_at = $3::timestamptz AND listing_key > $4::text)
            )
          ORDER BY source_updated_at ASC, listing_key ASC
          LIMIT $5
        `,
        [days, modelSegments, lastUpdatedAt, lastListingKey, batchSize],
      );

      if (result.rows.length === 0) {
        break;
      }

      for (const row of result.rows) {
        const line = CSV_HEADERS.map((header) => formatCsvValue(row[header])).join(",");
        await writeLine(stream, `${line}\n`);
      }

      exportedRows += result.rows.length;

      const lastRow: ExportRow = result.rows[result.rows.length - 1];
      lastUpdatedAt = String(lastRow.source_updated_at ?? "");
      lastListingKey = String(lastRow.listing_key ?? "");

      logger.info(
        {
          batchRowCount: result.rows.length,
          exportedRows,
          totalRows,
          cursorUpdatedAt: lastUpdatedAt,
          cursorListingKey: lastListingKey,
        },
        "Training dataset export batch completed",
      );
    }
  } finally {
    await new Promise<void>((resolveClose, rejectClose) => {
      stream.end(() => resolveClose());
      stream.once("error", rejectClose);
    });
  }

  const manifest = {
    generatedAt: new Date().toISOString(),
    sourceTable: "training_features_labeled",
    outputPath,
    days,
    batchSize,
    modelSegments,
    rowCount: exportedRows,
    sourceUpdatedAtMin: summaryRow?.min_source_updated_at ?? null,
    sourceUpdatedAtMax: summaryRow?.max_source_updated_at ?? null,
    targetColumns: ["target_price_chaos", "target_price_log1p"],
    suggestedCategoricalColumns: [
      "model_segment",
      "clean_reason",
      "item_class",
      "base_type",
      "rarity",
      "jewel_type",
      "cluster_size",
      "gem_tags",
    ],
    suggestedIgnoredFeatureColumns: [
      "listing_key",
      "source_updated_at",
      "target_price_amount",
      "target_price_currency",
      "exchange_rate_source",
      "exchange_rate_sample_time_utc",
      "exchange_rate_chaos_equivalent",
      "target_price_chaos",
      "target_price_log1p",
      "label_reason",
    ],
  };

  await mkdir(dirname(manifestPath), { recursive: true });
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf-8");

  logger.info(
    {
      outputPath,
      manifestPath,
      exportedRows,
      totalRows,
    },
    "Training dataset export completed",
  );
}

main()
  .catch((error) => {
    logger.error({ err: error }, "Training dataset export failed");
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool();
  });
