import { mkdir, writeFile } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { dirname, join, resolve } from "node:path";

import type { QueryResult } from "pg";

import featurePolicy from "../config/clipboard-safe-feature-policy.json";
import { closePool, pool } from "../db/client";
import { logger } from "../utils/logger";

const DEFAULT_DAYS = 7;
const DEFAULT_BATCH_SIZE = 5000;
const DEFAULT_TRAIN_RATIO = 0.8;
const DEFAULT_VALID_RATIO = 0.1;
const DEFAULT_OUTPUT_ROOT = resolve(process.cwd(), "artifacts", "training-staging");

const TARGET_COLUMNS = ["target_price_log1p", "target_price_chaos"] as const;
const SPLIT_NAMES = ["train", "valid", "test"] as const;

type SplitName = (typeof SPLIT_NAMES)[number];

type FeaturePolicy = {
  policyName: string;
  version: number;
  activeFeatureColumns: string[];
  derivedFeatureColumns: string[];
  categoricalColumns: string[];
  booleanColumns: string[];
};

type StageRow = Record<string, unknown> & {
  listing_key: string | null;
  source_updated_at: string | null;
  model_segment: string | null;
};

type SplitCursor = {
  updatedAt: string;
  listingKey: string;
};

type SplitStats = {
  rowCount: number;
  minUpdatedAt: string | null;
  maxUpdatedAt: string | null;
};

type SplitStreams = Record<SplitName, NodeJS.WritableStream>;

type SegmentStageInfo = {
  csvPaths: Record<SplitName, string>;
  stats: Record<SplitName, SplitStats>;
};

type SummaryRow = {
  row_count: string;
  min_source_updated_at: string | null;
  max_source_updated_at: string | null;
};

type SnapshotWindowRow = {
  snapshot_now: string;
  lower_bound: string;
};

const policy = featurePolicy as FeaturePolicy;
const FEATURE_COLUMNS = [...policy.activeFeatureColumns, ...policy.derivedFeatureColumns];
const CATEGORICAL_COLUMNS = policy.categoricalColumns.filter((column) =>
  FEATURE_COLUMNS.includes(column),
);
const BOOLEAN_COLUMNS = new Set(policy.booleanColumns);
const TRAINING_HEADERS = [...TARGET_COLUMNS, ...FEATURE_COLUMNS];

const COLUMN_SELECTORS: Record<string, string> = {
  item_class: "t.item_class AS item_class",
  base_type: "t.base_type AS base_type",
  rarity: "t.rarity AS rarity",
  ilvl: "t.ilvl AS ilvl",
  identified:
    "CASE WHEN t.identified IS TRUE THEN 1 WHEN t.identified IS FALSE THEN 0 ELSE NULL END AS identified",
  corrupted:
    "CASE WHEN t.corrupted IS TRUE THEN 1 WHEN t.corrupted IS FALSE THEN 0 ELSE NULL END AS corrupted",
  fractured:
    "CASE WHEN t.fractured IS TRUE THEN 1 WHEN t.fractured IS FALSE THEN 0 ELSE NULL END AS fractured",
  synthesised:
    "CASE WHEN t.synthesised IS TRUE THEN 1 WHEN t.synthesised IS FALSE THEN 0 ELSE NULL END AS synthesised",
  influence_shaper:
    "CASE WHEN t.influence_shaper IS TRUE THEN 1 WHEN t.influence_shaper IS FALSE THEN 0 ELSE NULL END AS influence_shaper",
  influence_elder:
    "CASE WHEN t.influence_elder IS TRUE THEN 1 WHEN t.influence_elder IS FALSE THEN 0 ELSE NULL END AS influence_elder",
  influence_crusader:
    "CASE WHEN t.influence_crusader IS TRUE THEN 1 WHEN t.influence_crusader IS FALSE THEN 0 ELSE NULL END AS influence_crusader",
  influence_redeemer:
    "CASE WHEN t.influence_redeemer IS TRUE THEN 1 WHEN t.influence_redeemer IS FALSE THEN 0 ELSE NULL END AS influence_redeemer",
  influence_hunter:
    "CASE WHEN t.influence_hunter IS TRUE THEN 1 WHEN t.influence_hunter IS FALSE THEN 0 ELSE NULL END AS influence_hunter",
  influence_warlord:
    "CASE WHEN t.influence_warlord IS TRUE THEN 1 WHEN t.influence_warlord IS FALSE THEN 0 ELSE NULL END AS influence_warlord",
  influence_searing:
    "CASE WHEN t.influence_searing IS TRUE THEN 1 WHEN t.influence_searing IS FALSE THEN 0 ELSE NULL END AS influence_searing",
  influence_tangled:
    "CASE WHEN t.influence_tangled IS TRUE THEN 1 WHEN t.influence_tangled IS FALSE THEN 0 ELSE NULL END AS influence_tangled",
  socket_count: "t.socket_count AS socket_count",
  link_count: "t.link_count AS link_count",
  white_socket_count: "t.white_socket_count AS white_socket_count",
  explicit_mod_count: "t.explicit_mod_count AS explicit_mod_count",
  implicit_mod_count: "t.implicit_mod_count AS implicit_mod_count",
  crafted_mod_count: "t.crafted_mod_count AS crafted_mod_count",
  fractured_mod_count: "t.fractured_mod_count AS fractured_mod_count",
  enchant_mod_count: "t.enchant_mod_count AS enchant_mod_count",
  quality: "t.quality::text AS quality",
  armour: "t.armour::text AS armour",
  evasion: "t.evasion::text AS evasion",
  energy_shield: "t.energy_shield::text AS energy_shield",
  ward: "t.ward::text AS ward",
  physical_dps: "t.physical_dps::text AS physical_dps",
  elemental_dps: "t.elemental_dps::text AS elemental_dps",
  attack_speed: "t.attack_speed::text AS attack_speed",
  crit_chance: "t.crit_chance::text AS crit_chance",
  move_speed: "t.move_speed::text AS move_speed",
  life_roll_sum: "t.life_roll_sum::text AS life_roll_sum",
  resistance_roll_sum: "t.resistance_roll_sum::text AS resistance_roll_sum",
  attribute_roll_sum: "t.attribute_roll_sum::text AS attribute_roll_sum",
  jewel_type: "t.jewel_type AS jewel_type",
  cluster_size: "t.cluster_size AS cluster_size",
  cluster_passive_count: "t.cluster_passive_count AS cluster_passive_count",
  notable_count: "t.notable_count AS notable_count",
  damage_mod_count: "t.damage_mod_count AS damage_mod_count",
  defence_mod_count: "t.defence_mod_count AS defence_mod_count",
  utility_mod_count: "t.utility_mod_count AS utility_mod_count",
  gem_level: "t.gem_level AS gem_level",
  gem_quality: "t.gem_quality::text AS gem_quality",
  is_awakened:
    "CASE WHEN t.is_awakened IS TRUE THEN 1 WHEN t.is_awakened IS FALSE THEN 0 ELSE NULL END AS is_awakened",
  is_vaal:
    "CASE WHEN t.is_vaal IS TRUE THEN 1 WHEN t.is_vaal IS FALSE THEN 0 ELSE NULL END AS is_vaal",
  model_segment: "t.model_segment AS model_segment",
  observed_hour_utc: "EXTRACT(HOUR FROM t.source_updated_at AT TIME ZONE 'UTC')::int AS observed_hour_utc",
  observed_weekday_utc:
    "((EXTRACT(DOW FROM t.source_updated_at AT TIME ZONE 'UTC')::int + 6) % 7) AS observed_weekday_utc",
};

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

  const parsedValue = Number(rawValue);
  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    throw new Error(`${flag} 값이 올바르지 않습니다: ${rawValue}`);
  }

  return parsedValue;
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
  if (!rawValue) {
    return undefined;
  }

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

function buildDefaultOutputDir(days: number): string {
  const timestamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  return join(DEFAULT_OUTPUT_ROOT, `last_${days}d_${timestamp}`);
}

function formatCsvValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  const stringValue = Array.isArray(value) ? value.join("|") : String(value);

  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
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

function createEmptyStats(): Record<SplitName, SplitStats> {
  return {
    train: { rowCount: 0, minUpdatedAt: null, maxUpdatedAt: null },
    valid: { rowCount: 0, minUpdatedAt: null, maxUpdatedAt: null },
    test: { rowCount: 0, minUpdatedAt: null, maxUpdatedAt: null },
  };
}

function updateStats(stats: SplitStats, updatedAt: string): void {
  stats.rowCount += 1;
  if (stats.minUpdatedAt === null || updatedAt < stats.minUpdatedAt) {
    stats.minUpdatedAt = updatedAt;
  }
  if (stats.maxUpdatedAt === null || updatedAt > stats.maxUpdatedAt) {
    stats.maxUpdatedAt = updatedAt;
  }
}

function buildColumnSelectors(): string[] {
  return TRAINING_HEADERS.map((column) => {
    if (column === "target_price_log1p") {
      return "t.target_price_log1p::text AS target_price_log1p";
    }
    if (column === "target_price_chaos") {
      return "t.target_price_chaos::text AS target_price_chaos";
    }

    const selector = COLUMN_SELECTORS[column];
    if (!selector) {
      throw new Error(`학습 스테이징 selector가 없는 컬럼입니다: ${column}`);
    }

    return selector;
  });
}

function buildCdLines(targetColumn: (typeof TARGET_COLUMNS)[number]): string[] {
  const targetIndex = TRAINING_HEADERS.indexOf(targetColumn);
  const auxiliaryTargetIndex = TRAINING_HEADERS.indexOf(
    targetColumn === "target_price_log1p" ? "target_price_chaos" : "target_price_log1p",
  );

  const lines = [
    `${targetIndex}\tLabel\t${targetColumn}`,
    `${auxiliaryTargetIndex}\tAuxiliary\t${
      targetColumn === "target_price_log1p" ? "target_price_chaos" : "target_price_log1p"
    }`,
  ];

  for (const column of CATEGORICAL_COLUMNS) {
    const columnIndex = TRAINING_HEADERS.indexOf(column);
    if (columnIndex >= 0) {
      lines.push(`${columnIndex}\tCateg\t${column}`);
    }
  }

  return lines;
}

function splitForRow(
  rowNumber: number,
  trainRowEnd: number,
  validRowEnd: number,
): SplitName {
  if (rowNumber <= trainRowEnd) {
    return "train";
  }
  if (rowNumber <= validRowEnd) {
    return "valid";
  }
  return "test";
}

async function createSplitStreams(rootDir: string): Promise<{
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
    SPLIT_NAMES.map((splitName) => writeLine(streams[splitName], `${TRAINING_HEADERS.join(",")}\n`)),
  );

  return { streams, csvPaths };
}

async function closeSplitStreams(streams: SplitStreams): Promise<void> {
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

async function main(): Promise<void> {
  const days = readNumberFlag("--days", DEFAULT_DAYS);
  const batchSize = readNumberFlag("--batch-size", DEFAULT_BATCH_SIZE);
  const trainRatio = readRatioFlag("--train-ratio", DEFAULT_TRAIN_RATIO);
  const validRatio = readRatioFlag("--valid-ratio", DEFAULT_VALID_RATIO);
  const modelSegments = readSegmentsFlag();
  const outputDir = resolve(readStringFlag("--output-dir") ?? buildDefaultOutputDir(days));

  if (trainRatio + validRatio >= 1) {
    throw new Error("--train-ratio + --valid-ratio 합은 1보다 작아야 합니다.");
  }

  const outputManifestPath = join(outputDir, "manifest.json");
  const splitSpecPath = join(outputDir, "split_spec.json");
  const log1pCdPath = join(outputDir, "target_price_log1p.cd");
  const chaosCdPath = join(outputDir, "target_price_chaos.cd");

  await pool.query("SELECT 1");

  const snapshotWindowResult = await pool.query<SnapshotWindowRow>(
    `
      SELECT
        NOW()::text AS snapshot_now,
        (NOW() - ($1::int * INTERVAL '1 day'))::text AS lower_bound
    `,
    [days],
  );
  const snapshotWindow = snapshotWindowResult.rows[0];
  const snapshotNow = snapshotWindow?.snapshot_now;
  const lowerBound = snapshotWindow?.lower_bound;
  if (!snapshotNow || !lowerBound) {
    throw new Error("snapshot window를 계산하지 못했습니다.");
  }

  const summaryResult = await pool.query<SummaryRow>(
    `
      SELECT
        COUNT(*)::text AS row_count,
        MIN(t.source_updated_at)::text AS min_source_updated_at,
        MAX(t.source_updated_at)::text AS max_source_updated_at
      FROM training_features_labeled t
      WHERE t.source_updated_at >= $1::timestamptz
        AND t.source_updated_at <= $2::timestamptz
        AND ($3::text[] IS NULL OR t.model_segment = ANY($3::text[]))
    `,
    [lowerBound, snapshotNow, modelSegments],
  );

  const summary = summaryResult.rows[0];
  const totalRows = Number(summary?.row_count ?? "0");
  if (!Number.isFinite(totalRows) || totalRows < 100) {
    throw new Error(`학습 스테이징 대상 row 수가 너무 적습니다: ${totalRows}`);
  }

  const trainRowEnd = Math.max(Math.floor(totalRows * trainRatio), 1);
  const validRowEnd = Math.max(trainRowEnd + Math.floor(totalRows * validRatio), trainRowEnd + 1);
  const adjustedValidRowEnd = Math.min(validRowEnd, totalRows - 1);

  logger.info(
    {
      days,
      batchSize,
      modelSegments,
      outputDir,
      totalRows,
      snapshotNow,
      lowerBound,
      trainRatio,
      validRatio,
      trainRowEnd,
      validRowEnd: adjustedValidRowEnd,
    },
    "Starting training dataset staging",
  );

  const { streams: globalStreams, csvPaths: globalCsvPaths } = await createSplitStreams(
    join(outputDir, "global"),
  );
  const segmentStreams = new Map<string, SplitStreams>();
  const segmentInfo = new Map<string, SegmentStageInfo>();
  const globalStats = createEmptyStats();

  const ensureSegment = async (segment: string): Promise<SplitStreams> => {
    const existing = segmentStreams.get(segment);
    if (existing) {
      return existing;
    }

    const { streams, csvPaths } = await createSplitStreams(join(outputDir, "segments", segment));
    segmentStreams.set(segment, streams);
    segmentInfo.set(segment, {
      csvPaths,
      stats: createEmptyStats(),
    });
    return streams;
  };

  let rowNumber = 0;
  let lastUpdatedAt: string | null = null;
  let lastListingKey: string | null = null;
  let trainBoundary: SplitCursor | null = null;
  let validBoundary: SplitCursor | null = null;

  try {
    while (true) {
      const result: QueryResult<StageRow> = await pool.query<StageRow>(
        `
          SELECT
            t.listing_key,
            t.source_updated_at::text AS source_updated_at,
            ${buildColumnSelectors().join(",\n            ")}
          FROM training_features_labeled t
          WHERE t.source_updated_at >= $1::timestamptz
            AND t.source_updated_at <= $2::timestamptz
            AND ($3::text[] IS NULL OR t.model_segment = ANY($3::text[]))
            AND (
              $4::timestamptz IS NULL
              OR (t.source_updated_at, t.listing_key) > ($4::timestamptz, $5::text)
            )
          ORDER BY t.source_updated_at ASC, t.listing_key ASC
          LIMIT $6
        `,
        [lowerBound, snapshotNow, modelSegments, lastUpdatedAt, lastListingKey, batchSize],
      );

      if (result.rows.length === 0) {
        break;
      }

      for (const row of result.rows) {
        rowNumber += 1;
        const splitName = splitForRow(rowNumber, trainRowEnd, adjustedValidRowEnd);
        const updatedAt = String(row.source_updated_at ?? "");
        const listingKey = String(row.listing_key ?? "");
        const modelSegment = String(row.model_segment ?? "");
        const csvLine = `${TRAINING_HEADERS.map((header) => formatCsvValue(row[header])).join(",")}\n`;

        await writeLine(globalStreams[splitName], csvLine);
        updateStats(globalStats[splitName], updatedAt);

        const perSegmentStreams = await ensureSegment(modelSegment);
        await writeLine(perSegmentStreams[splitName], csvLine);

        const perSegmentInfo = segmentInfo.get(modelSegment);
        if (!perSegmentInfo) {
          throw new Error(`세그먼트 정보가 초기화되지 않았습니다: ${modelSegment}`);
        }
        updateStats(perSegmentInfo.stats[splitName], updatedAt);

        if (rowNumber === trainRowEnd) {
          trainBoundary = { updatedAt, listingKey };
        }
        if (rowNumber === adjustedValidRowEnd) {
          validBoundary = { updatedAt, listingKey };
        }
      }

      const lastRow = result.rows[result.rows.length - 1];
      lastUpdatedAt = String(lastRow.source_updated_at ?? "");
      lastListingKey = String(lastRow.listing_key ?? "");

      logger.info(
        {
          batchRowCount: result.rows.length,
          stagedRows: rowNumber,
          totalRows,
          cursorUpdatedAt: lastUpdatedAt,
          cursorListingKey: lastListingKey,
        },
        "Training staging batch completed",
      );
    }
  } finally {
    await closeSplitStreams(globalStreams);
    for (const streams of segmentStreams.values()) {
      await closeSplitStreams(streams);
    }
  }

  if (rowNumber !== totalRows) {
    throw new Error(`스테이징 row 수 불일치: expected=${totalRows}, actual=${rowNumber}`);
  }
  if (!trainBoundary || !validBoundary) {
    throw new Error("split boundary cursor를 계산하지 못했습니다.");
  }

  const splitSpec = {
    generatedAt: new Date().toISOString(),
    sourceTable: "training_features_labeled",
    days,
    snapshotNow,
    lowerBound,
    totalRows,
    trainRatio,
    validRatio,
    testRatio: 1 - trainRatio - validRatio,
    trainRowEnd,
    validRowEnd: adjustedValidRowEnd,
    trainBoundary,
    validBoundary,
    sourceUpdatedAtMin: summary?.min_source_updated_at ?? null,
    sourceUpdatedAtMax: summary?.max_source_updated_at ?? null,
    globalRanges: globalStats,
  };

  const manifest = {
    generatedAt: new Date().toISOString(),
    outputDir,
    sourceTable: "training_features_labeled",
    sourceWindowDays: days,
    snapshotNow,
    lowerBound,
    rowCount: totalRows,
    modelSegmentsFilter: modelSegments,
    featurePolicyName: policy.policyName,
    featurePolicyVersion: policy.version,
    featureColumns: FEATURE_COLUMNS,
    categoricalColumns: CATEGORICAL_COLUMNS,
    booleanColumns: [...BOOLEAN_COLUMNS],
    targetColumns: [...TARGET_COLUMNS],
    headers: TRAINING_HEADERS,
    splitSpecPath,
    columnDescriptions: {
      target_price_log1p: log1pCdPath,
      target_price_chaos: chaosCdPath,
    },
    global: {
      csvPaths: globalCsvPaths,
      stats: globalStats,
    },
    segments: Object.fromEntries(
      [...segmentInfo.entries()].sort(([left], [right]) => left.localeCompare(right)).map(
        ([segment, info]) => [
          segment,
          {
            csvPaths: info.csvPaths,
            stats: info.stats,
          },
        ],
      ),
    ),
  };

  await mkdir(dirname(outputManifestPath), { recursive: true });
  await writeFile(splitSpecPath, `${JSON.stringify(splitSpec, null, 2)}\n`, "utf-8");
  await writeFile(log1pCdPath, `${buildCdLines("target_price_log1p").join("\n")}\n`, "utf-8");
  await writeFile(chaosCdPath, `${buildCdLines("target_price_chaos").join("\n")}\n`, "utf-8");
  await writeFile(outputManifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf-8");

  logger.info(
    {
      outputDir,
      manifestPath: outputManifestPath,
      splitSpecPath,
      segmentCount: segmentInfo.size,
    },
    "Training dataset staging completed",
  );
}

main()
  .catch((error) => {
    logger.error({ error }, "Training dataset staging failed");
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool();
  });
