import { createWriteStream } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

import type { PoolClient, QueryResult } from "pg";

import featurePolicy from "../config/clipboard-safe-feature-policy.json";
import { closePool, pool } from "../db/client";
import {
  buildV2ModAwareFeatures,
  V2_CATEGORICAL_FEATURE_COLUMNS,
  V2_MOD_AWARE_FEATURE_COLUMNS,
} from "../services/v2-mod-feature-builder.service";
import type { PublicItem } from "../types/poe.types";
import { logger } from "../utils/logger";

const DEFAULT_DAYS = 7;
const DEFAULT_BATCH_SIZE = 3000;
const DEFAULT_TRAIN_RATIO = 0.8;
const DEFAULT_VALID_RATIO = 0.1;
const DEFAULT_SEARCH_WORTHY_THRESHOLD_CHAOS = 30;
const DEFAULT_OUTPUT_ROOT = resolve(process.cwd(), "artifacts", "v2-mod-aware-staging");
const SPLIT_NAMES = ["train", "valid", "test"] as const;
const TARGET_COLUMNS = ["is_search_worthy", "target_price_chaos", "is_high_value_candidate"] as const;
const REPOE_BASE_ITEMS_PATH = resolve(
  process.cwd(),
  "vendor",
  "poe-static",
  "repoe-fork-poe1-2026-04-16",
  "base_items.json",
);

type SplitName = (typeof SPLIT_NAMES)[number];

type FeaturePolicy = {
  activeFeatureColumns: string[];
  derivedFeatureColumns: string[];
  categoricalColumns: string[];
  booleanColumns: string[];
};

type StageRow = Record<string, unknown> & {
  listing_key: string;
  source_updated_at: string;
  model_segment: string;
  target_price_chaos: string;
  item_json: PublicItem & Record<string, unknown>;
  item_name: string | null;
  type_line: string | null;
};

type SplitStats = {
  rowCount: number;
  minUpdatedAt: string | null;
  maxUpdatedAt: string | null;
  searchWorthyRows: number;
  highValueRows: number;
};

type SplitStreams = Record<SplitName, NodeJS.WritableStream>;

type FeatureSetWriters = {
  globalStreams: SplitStreams;
  segmentStreams: Map<string, SplitStreams>;
  globalCsvPaths: Record<SplitName, string>;
  segmentCsvPaths: Map<string, Record<SplitName, string>>;
};

const policy = featurePolicy as FeaturePolicy;
const V1_FEATURE_COLUMNS = [...policy.activeFeatureColumns, ...policy.derivedFeatureColumns];
const V2_FEATURE_COLUMNS = [...V2_MOD_AWARE_FEATURE_COLUMNS];
const FEATURE_SETS = {
  v1_summary: {
    featureColumns: V1_FEATURE_COLUMNS,
    categoricalColumns: policy.categoricalColumns.filter((column) => V1_FEATURE_COLUMNS.includes(column)),
  },
  v2_mod_aware: {
    featureColumns: V2_FEATURE_COLUMNS,
    categoricalColumns: [
      ...new Set([
        ...policy.categoricalColumns.filter((column) => V2_FEATURE_COLUMNS.includes(column)),
        ...V2_CATEGORICAL_FEATURE_COLUMNS.filter((column) => V2_FEATURE_COLUMNS.includes(column)),
      ]),
    ],
  },
} as const;

function readFlagValue(flag: string): string | undefined {
  const flagIndex = process.argv.findIndex(
    (value) => value === flag || value.startsWith(`${flag}=`),
  );
  if (flagIndex < 0) {
    return undefined;
  }

  const argument = process.argv[flagIndex];
  if (argument === flag) {
    const nextValue = process.argv[flagIndex + 1]?.trim();
    return nextValue && !nextValue.startsWith("--") ? nextValue : undefined;
  }

  return argument.slice(flag.length + 1).trim();
}

function readNumberFlag(flag: string, defaultValue: number): number {
  const rawValue = readFlagValue(flag);
  if (!rawValue) {
    return defaultValue;
  }
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${flag} 값이 올바르지 않습니다: ${rawValue}`);
  }
  return parsed;
}

function readRatioFlag(flag: string, defaultValue: number): number {
  const parsed = readNumberFlag(flag, defaultValue);
  if (parsed <= 0 || parsed >= 1) {
    throw new Error(`${flag} 값은 0과 1 사이여야 합니다.`);
  }
  return parsed;
}

function readStringFlag(flag: string): string | undefined {
  const rawValue = readFlagValue(flag);
  return rawValue && rawValue.length > 0 ? rawValue : undefined;
}

function readSegmentsFlag(): string[] {
  const rawValue = readStringFlag("--segments");
  if (!rawValue) {
    return ["rare_equipment", "unique_equipment"];
  }
  return rawValue
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function buildDefaultOutputDir(days: number): string {
  const timestamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  return join(DEFAULT_OUTPUT_ROOT, `last_${days}d_${timestamp}`);
}

function csvValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  const stringValue = String(value);
  return /[",\n]/.test(stringValue) ? `"${stringValue.replace(/"/g, '""')}"` : stringValue;
}

async function writeLine(stream: NodeJS.WritableStream, content: string): Promise<void> {
  if (stream.write(content)) {
    return;
  }
  await new Promise<void>((resolveWrite, rejectWrite) => {
    const handleDrain = (): void => {
      stream.off("error", handleError);
      resolveWrite();
    };
    const handleError = (error: Error): void => {
      stream.off("drain", handleDrain);
      rejectWrite(error);
    };
    stream.once("drain", handleDrain);
    stream.once("error", handleError);
  });
}

function createStats(): Record<SplitName, SplitStats> {
  return {
    train: { rowCount: 0, minUpdatedAt: null, maxUpdatedAt: null, searchWorthyRows: 0, highValueRows: 0 },
    valid: { rowCount: 0, minUpdatedAt: null, maxUpdatedAt: null, searchWorthyRows: 0, highValueRows: 0 },
    test: { rowCount: 0, minUpdatedAt: null, maxUpdatedAt: null, searchWorthyRows: 0, highValueRows: 0 },
  };
}

function updateStats(
  stats: SplitStats,
  updatedAt: string,
  isSearchWorthy: number,
  isHighValueCandidate: number,
): void {
  stats.rowCount += 1;
  stats.searchWorthyRows += isSearchWorthy;
  stats.highValueRows += isHighValueCandidate;
  if (stats.minUpdatedAt === null || updatedAt < stats.minUpdatedAt) {
    stats.minUpdatedAt = updatedAt;
  }
  if (stats.maxUpdatedAt === null || updatedAt > stats.maxUpdatedAt) {
    stats.maxUpdatedAt = updatedAt;
  }
}

function splitForRow(rowNumber: number, trainRowEnd: number, validRowEnd: number): SplitName {
  if (rowNumber <= trainRowEnd) {
    return "train";
  }
  if (rowNumber <= validRowEnd) {
    return "valid";
  }
  return "test";
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function inferEquipmentSlotFromItemClass(itemClass: string | null): string | null {
  if (!itemClass) {
    return null;
  }
  const lowered = itemClass.toLowerCase();
  if (lowered.includes("body armour")) {
    return "body_armour";
  }
  if (lowered.includes("helmet")) {
    return "helmet";
  }
  if (lowered.includes("boot")) {
    return "boot";
  }
  if (lowered.includes("glove")) {
    return "glove";
  }
  if (lowered.includes("shield")) {
    return "shield";
  }
  if (lowered.includes("jewel")) {
    return "jewel";
  }
  if (/bow|sword|axe|mace|dagger|claw|wand|staff|stave|sceptre|quiver/.test(lowered)) {
    return "weapon";
  }
  if (/ring|amulet|belt/.test(lowered)) {
    return "accessory";
  }
  return null;
}

async function loadBaseTypeSlotMap(): Promise<Record<string, string>> {
  const raw = await readFile(REPOE_BASE_ITEMS_PATH, "utf-8");
  const baseItems = JSON.parse(raw) as Record<string, { name?: unknown; item_class?: unknown }>;
  const slotMap: Record<string, string> = {};
  for (const item of Object.values(baseItems)) {
    const name = asString(item.name);
    const slot = inferEquipmentSlotFromItemClass(asString(item.item_class));
    if (name && slot) {
      slotMap[name] = slot;
    }
  }
  return slotMap;
}

async function lookupDivineThresholdChaos(
  client: PoolClient,
  snapshotNow: string,
): Promise<number | null> {
  const result = await client.query<{ chaos_equivalent: string }>(
    `
      SELECT chaos_equivalent::text
      FROM exchange_rate_snapshots
      WHERE normalized_currency_code = 'divine'
        AND sample_time_utc <= $1::timestamptz
      ORDER BY sample_time_utc DESC
      LIMIT 1
    `,
    [snapshotNow],
  );
  const value = Number(result.rows[0]?.chaos_equivalent);
  return Number.isFinite(value) && value > 0 ? value : null;
}

async function createSplitStreams(rootDir: string, headers: string[]): Promise<{
  streams: SplitStreams;
  csvPaths: Record<SplitName, string>;
}> {
  await mkdir(rootDir, { recursive: true });
  const csvPaths = {
    train: join(rootDir, "train.csv"),
    valid: join(rootDir, "valid.csv"),
    test: join(rootDir, "test.csv"),
  } satisfies Record<SplitName, string>;
  const streams: SplitStreams = {
    train: createWriteStream(csvPaths.train, { encoding: "utf-8" }),
    valid: createWriteStream(csvPaths.valid, { encoding: "utf-8" }),
    test: createWriteStream(csvPaths.test, { encoding: "utf-8" }),
  };
  await Promise.all(
    SPLIT_NAMES.map((splitName) => writeLine(streams[splitName], `${headers.join(",")}\n`)),
  );
  return { streams, csvPaths };
}

async function closeStreams(streams: SplitStreams): Promise<void> {
  await Promise.all(
    SPLIT_NAMES.map(
      (splitName) =>
        new Promise<void>((resolveClose, rejectClose) => {
          const stream = streams[splitName];
          stream.end(() => resolveClose());
          stream.once("error", rejectClose);
        }),
    ),
  );
}

function buildCdLines(headers: string[], categoricalColumns: readonly string[]): string[] {
  const lines = [`0\tLabel\tis_search_worthy`, `1\tAuxiliary\ttarget_price_chaos`, `2\tAuxiliary\tis_high_value_candidate`];
  for (const column of categoricalColumns) {
    const index = headers.indexOf(column);
    if (index >= 0) {
      lines.push(`${index}\tCateg\t${column}`);
    }
  }
  return lines;
}

function rowValue(row: StageRow, column: string): unknown {
  const rawValue = row[column];
  if (typeof rawValue === "boolean") {
    return rawValue ? 1 : 0;
  }
  return rawValue;
}

async function main(): Promise<void> {
  const days = readNumberFlag("--days", DEFAULT_DAYS);
  const batchSize = readNumberFlag("--batch-size", DEFAULT_BATCH_SIZE);
  const trainRatio = readRatioFlag("--train-ratio", DEFAULT_TRAIN_RATIO);
  const validRatio = readRatioFlag("--valid-ratio", DEFAULT_VALID_RATIO);
  const searchWorthyThresholdChaos = readNumberFlag(
    "--search-worthy-threshold-chaos",
    DEFAULT_SEARCH_WORTHY_THRESHOLD_CHAOS,
  );
  const segments = readSegmentsFlag();
  const outputDir = resolve(readStringFlag("--output-dir") ?? buildDefaultOutputDir(days));

  if (trainRatio + validRatio >= 1) {
    throw new Error("--train-ratio + --valid-ratio 합은 1보다 작아야 합니다.");
  }

  const slotMap = await loadBaseTypeSlotMap();
  const client = await pool.connect();
  let transactionOpen = false;

  try {
    await client.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
    transactionOpen = true;

    const windowResult = await client.query<{ snapshot_now: string; lower_bound: string }>(
      `
        SELECT
          NOW()::text AS snapshot_now,
          (NOW() - ($1::int * INTERVAL '1 day'))::text AS lower_bound
      `,
      [days],
    );
    const snapshotNow = windowResult.rows[0]?.snapshot_now;
    const lowerBound = windowResult.rows[0]?.lower_bound;
    if (!snapshotNow || !lowerBound) {
      throw new Error("V2 staging window를 계산하지 못했습니다.");
    }
    const highValueThresholdChaos = await lookupDivineThresholdChaos(client, snapshotNow);

    const countResult = await client.query<{ row_count: string }>(
      `
        SELECT COUNT(*)::text AS row_count
        FROM training_features_labeled t
        JOIN normalized_priced_items n ON n.listing_key = t.listing_key
        WHERE t.source_updated_at >= $1::timestamptz
          AND t.source_updated_at <= $2::timestamptz
          AND t.model_segment = ANY($3::text[])
      `,
      [lowerBound, snapshotNow, segments],
    );
    const totalRows = Number(countResult.rows[0]?.row_count ?? "0");
    if (!Number.isFinite(totalRows) || totalRows < 100) {
      throw new Error(`V2 staging 대상 row 수가 너무 적습니다: ${totalRows}`);
    }

    const trainRowEnd = Math.max(Math.floor(totalRows * trainRatio), 1);
    const validRowEnd = Math.min(
      Math.max(trainRowEnd + Math.floor(totalRows * validRatio), trainRowEnd + 1),
      totalRows - 1,
    );

    const featureSetWriters = new Map<keyof typeof FEATURE_SETS, FeatureSetWriters>();
    const stats = {
      global: createStats(),
      segments: new Map<string, Record<SplitName, SplitStats>>(),
    };
    const featureSetMetadata: Record<string, unknown> = {};

    for (const [featureSetName, featureSet] of Object.entries(FEATURE_SETS) as Array<
      [keyof typeof FEATURE_SETS, (typeof FEATURE_SETS)[keyof typeof FEATURE_SETS]]
    >) {
      const headers = [...TARGET_COLUMNS, ...featureSet.featureColumns];
      const featureSetDir = join(outputDir, featureSetName);
      const { streams: globalStreams, csvPaths: globalCsvPaths } = await createSplitStreams(
        join(featureSetDir, "global"),
        headers,
      );
      const cdPath = join(featureSetDir, "is_search_worthy.cd");
      await mkdir(dirname(cdPath), { recursive: true });
      await writeFile(cdPath, `${buildCdLines(headers, featureSet.categoricalColumns).join("\n")}\n`, "utf-8");
      featureSetWriters.set(featureSetName, {
        globalStreams,
        segmentStreams: new Map(),
        globalCsvPaths,
        segmentCsvPaths: new Map(),
      });
      featureSetMetadata[featureSetName] = {
        featureColumns: featureSet.featureColumns,
        categoricalColumns: featureSet.categoricalColumns,
        headers,
        columnDescriptionPath: cdPath,
        global: {
          csvPaths: globalCsvPaths,
        },
        segments: {},
      };
    }

    const ensureSegmentStreams = async (
      featureSetName: keyof typeof FEATURE_SETS,
      segment: string,
    ): Promise<SplitStreams> => {
      const writer = featureSetWriters.get(featureSetName);
      if (!writer) {
        throw new Error(`feature set writer가 없습니다: ${featureSetName}`);
      }
      const existing = writer.segmentStreams.get(segment);
      if (existing) {
        return existing;
      }
      const featureSet = FEATURE_SETS[featureSetName];
      const headers = [...TARGET_COLUMNS, ...featureSet.featureColumns];
      const { streams, csvPaths } = await createSplitStreams(
        join(outputDir, featureSetName, "segments", segment),
        headers,
      );
      writer.segmentStreams.set(segment, streams);
      writer.segmentCsvPaths.set(segment, csvPaths);

      const metadata = featureSetMetadata[featureSetName] as {
        segments: Record<string, { csvPaths: Record<SplitName, string> }>;
      };
      metadata.segments[segment] = { csvPaths };
      return streams;
    };

    let rowNumber = 0;
    let lastUpdatedAt: string | null = null;
    let lastListingKey: string | null = null;

    try {
      while (true) {
        const result: QueryResult<StageRow> = await client.query<StageRow>(
          `
            SELECT
              t.*,
              EXTRACT(HOUR FROM t.source_updated_at AT TIME ZONE 'UTC')::int AS observed_hour_utc,
              ((EXTRACT(DOW FROM t.source_updated_at AT TIME ZONE 'UTC')::int + 6) % 7) AS observed_weekday_utc,
              t.source_updated_at::text AS source_updated_at,
              t.target_price_chaos::text AS target_price_chaos,
              n.item_json,
              n.item_name,
              n.type_line
            FROM training_features_labeled t
            JOIN normalized_priced_items n ON n.listing_key = t.listing_key
            WHERE t.source_updated_at >= $1::timestamptz
              AND t.source_updated_at <= $2::timestamptz
              AND t.model_segment = ANY($3::text[])
              AND (
                $4::timestamptz IS NULL
                OR (t.source_updated_at, t.listing_key) > ($4::timestamptz, $5::text)
              )
            ORDER BY t.source_updated_at ASC, t.listing_key ASC
            LIMIT $6
          `,
          [lowerBound, snapshotNow, segments, lastUpdatedAt, lastListingKey, batchSize],
        );

        if (result.rows.length === 0) {
          break;
        }

        for (const row of result.rows) {
          rowNumber += 1;
          const splitName = splitForRow(rowNumber, trainRowEnd, validRowEnd);
          const equipmentSlot =
            slotMap[String(row.base_type ?? "")] ??
            slotMap[String(row.type_line ?? "")] ??
            inferEquipmentSlotFromItemClass(asString(row.item_json.itemClass));
          const v2Features = buildV2ModAwareFeatures({
            itemJson: row.item_json,
            itemClass: asString(row.item_class),
            baseType: asString(row.base_type),
            rarity: asString(row.rarity),
            modelSegment: row.model_segment,
            equipmentSlot,
          });
          const targetPriceChaos = Number(row.target_price_chaos);
          const isSearchWorthy = targetPriceChaos >= searchWorthyThresholdChaos ? 1 : 0;
          const isHighValueCandidate =
            highValueThresholdChaos !== null && targetPriceChaos >= highValueThresholdChaos ? 1 : 0;
          const baseValues: Record<string, unknown> = {
            is_search_worthy: isSearchWorthy,
            target_price_chaos: row.target_price_chaos,
            is_high_value_candidate: isHighValueCandidate,
          };
          const modelSegment = row.model_segment;

          for (const [featureSetName, featureSet] of Object.entries(FEATURE_SETS) as Array<
            [keyof typeof FEATURE_SETS, (typeof FEATURE_SETS)[keyof typeof FEATURE_SETS]]
          >) {
            const writer = featureSetWriters.get(featureSetName);
            if (!writer) {
              throw new Error(`feature set writer가 없습니다: ${featureSetName}`);
            }
            const rowValues = [
              ...TARGET_COLUMNS.map((column) => baseValues[column]),
              ...featureSet.featureColumns.map((column) =>
                column in v2Features ? v2Features[column] : rowValue(row, column),
              ),
            ];
            const csvLine = `${rowValues.map(csvValue).join(",")}\n`;
            await writeLine(writer.globalStreams[splitName], csvLine);
            const segmentStreams = await ensureSegmentStreams(featureSetName, modelSegment);
            await writeLine(segmentStreams[splitName], csvLine);
          }

          updateStats(stats.global[splitName], row.source_updated_at, isSearchWorthy, isHighValueCandidate);
          const segmentStats = stats.segments.get(modelSegment) ?? createStats();
          updateStats(segmentStats[splitName], row.source_updated_at, isSearchWorthy, isHighValueCandidate);
          stats.segments.set(modelSegment, segmentStats);
        }

        const lastRow = result.rows[result.rows.length - 1];
        lastUpdatedAt = lastRow.source_updated_at;
        lastListingKey = lastRow.listing_key;

        logger.info(
          {
            batchRows: result.rows.length,
            stagedRows: rowNumber,
            totalRows,
            cursorUpdatedAt: lastUpdatedAt,
            cursorListingKey: lastListingKey,
          },
          "V2 staging batch completed",
        );
      }
    } finally {
      for (const writer of featureSetWriters.values()) {
        await closeStreams(writer.globalStreams);
        for (const streams of writer.segmentStreams.values()) {
          await closeStreams(streams);
        }
      }
    }

    if (rowNumber !== totalRows) {
      throw new Error(`V2 staging row 수 불일치: expected=${totalRows}, actual=${rowNumber}`);
    }

    const splitSpec = {
      generatedAt: new Date().toISOString(),
      sourceTable: "training_features_labeled + normalized_priced_items.item_json",
      sourceWindowDays: days,
      snapshotNow,
      lowerBound,
      totalRows,
      trainRatio,
      validRatio,
      testRatio: 1 - trainRatio - validRatio,
      trainRowEnd,
      validRowEnd,
    };
    const splitSpecPath = join(outputDir, "split_spec.json");
    const manifest = {
      generatedAt: new Date().toISOString(),
      outputDir,
      sourceWindowDays: days,
      snapshotNow,
      lowerBound,
      rowCount: totalRows,
      modelSegmentsFilter: segments,
      targetColumn: "is_search_worthy",
      auxiliaryTargetColumns: ["target_price_chaos", "is_high_value_candidate"],
      searchWorthyThresholdChaos,
      highValueThresholdChaos,
      splitSpecPath,
      featureSets: featureSetMetadata,
      stats: {
        global: stats.global,
        segments: Object.fromEntries([...stats.segments.entries()].sort(([left], [right]) => left.localeCompare(right))),
      },
      baseTypeEquipmentSlotMapPath: join(outputDir, "base_type_equipment_slot_map.json"),
    };

    await mkdir(outputDir, { recursive: true });
    await writeFile(join(outputDir, "base_type_equipment_slot_map.json"), `${JSON.stringify(slotMap, null, 2)}\n`, "utf-8");
    await writeFile(splitSpecPath, `${JSON.stringify(splitSpec, null, 2)}\n`, "utf-8");
    await writeFile(join(outputDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf-8");
    await client.query("COMMIT");
    transactionOpen = false;

    logger.info({ outputDir, totalRows }, "V2 mod-aware staging completed");
  } catch (error) {
    if (transactionOpen) {
      await client.query("ROLLBACK");
      transactionOpen = false;
    }
    throw error;
  } finally {
    client.release();
  }
}

main()
  .catch((error) => {
    logger.error({ error }, "V2 mod-aware staging failed");
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool();
  });
