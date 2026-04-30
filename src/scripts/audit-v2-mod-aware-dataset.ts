import { createWriteStream } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

import type { PoolClient, QueryResult } from "pg";

import { closePool, pool } from "../db/client";
import {
  analyzeV2AffixesFromItemJson,
  buildV2ModAwareFeatures,
} from "../services/v2-mod-feature-builder.service";
import type { PublicItem } from "../types/poe.types";
import { logger } from "../utils/logger";

const DEFAULT_DAYS = 7;
const DEFAULT_BATCH_SIZE = 1000;
const DEFAULT_OUTPUT_ROOT = resolve(process.cwd(), "artifacts", "v2_mod_audit");
const REPOE_BASE_ITEMS_PATH = resolve(
  process.cwd(),
  "vendor",
  "poe-static",
  "repoe-fork-poe1-2026-04-16",
  "base_items.json",
);

type AuditRow = {
  listing_key: string;
  source_updated_at: string;
  model_segment: string;
  target_price_chaos: string;
  item_class: string | null;
  base_type: string | null;
  rarity: string | null;
  item_name: string | null;
  type_line: string | null;
  item_json: PublicItem & Record<string, unknown>;
};

type SegmentSummary = {
  rows: number;
  pricedRows: number;
  explicitLines: number;
  matchedLines: number;
  ambiguousLines: number;
  unmatchedLines: number;
  preservedExplicitRows: number;
  uniqueNameRows: number;
  searchWorthyRows: number;
  highValueRows: number;
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

  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${flag} 값이 올바르지 않습니다: ${rawValue}`);
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

function buildOutputDir(): string {
  const timestamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  return join(DEFAULT_OUTPUT_ROOT, timestamp);
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function createSummary(): SegmentSummary {
  return {
    rows: 0,
    pricedRows: 0,
    explicitLines: 0,
    matchedLines: 0,
    ambiguousLines: 0,
    unmatchedLines: 0,
    preservedExplicitRows: 0,
    uniqueNameRows: 0,
    searchWorthyRows: 0,
    highValueRows: 0,
  };
}

function csvValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  const stringValue = String(value);
  return /[",\n]/.test(stringValue) ? `"${stringValue.replace(/"/g, '""')}"` : stringValue;
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
  if (
    /bow|sword|axe|mace|dagger|claw|wand|staff|stave|sceptre|quiver/.test(lowered)
  ) {
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
    const itemClass = asString(item.item_class);
    const slot = inferEquipmentSlotFromItemClass(itemClass);
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

function writeCsvLine(stream: NodeJS.WritableStream, values: unknown[]): void {
  stream.write(`${values.map(csvValue).join(",")}\n`);
}

function addBreakdown(
  breakdown: Map<string, SegmentSummary>,
  key: string,
  update: (summary: SegmentSummary) => void,
): void {
  const summary = breakdown.get(key) ?? createSummary();
  update(summary);
  breakdown.set(key, summary);
}

function summaryToReport(summary: SegmentSummary): Record<string, number> {
  return {
    rows: summary.rows,
    pricedRows: summary.pricedRows,
    explicitLines: summary.explicitLines,
    matchedLines: summary.matchedLines,
    ambiguousLines: summary.ambiguousLines,
    unmatchedLines: summary.unmatchedLines,
    matchedRate: summary.explicitLines === 0 ? 0 : summary.matchedLines / summary.explicitLines,
    ambiguousOrUnmatchedRate:
      summary.explicitLines === 0
        ? 0
        : (summary.ambiguousLines + summary.unmatchedLines) / summary.explicitLines,
    explicitModPreservationRate:
      summary.rows === 0 ? 0 : summary.preservedExplicitRows / summary.rows,
    uniqueNamePreservationRate: summary.rows === 0 ? 0 : summary.uniqueNameRows / summary.rows,
    searchWorthyRows: summary.searchWorthyRows,
    highValueRows: summary.highValueRows,
  };
}

async function main(): Promise<void> {
  const days = readNumberFlag("--days", DEFAULT_DAYS);
  const batchSize = readNumberFlag("--batch-size", DEFAULT_BATCH_SIZE);
  const maxRows = readNumberFlag("--limit", 0);
  const searchWorthyThresholdChaos = readNumberFlag("--search-worthy-threshold-chaos", 30);
  const segments = readSegmentsFlag();
  const outputDir = resolve(readStringFlag("--output-dir") ?? buildOutputDir());

  await mkdir(outputDir, { recursive: true });
  const slotMap = await loadBaseTypeSlotMap();
  await writeFile(
    join(outputDir, "base_type_equipment_slot_map.json"),
    `${JSON.stringify(slotMap, null, 2)}\n`,
    "utf-8",
  );

  const client = await pool.connect();
  const detailStream = createWriteStream(join(outputDir, "affix_match_sample.csv"), {
    encoding: "utf-8",
  });
  writeCsvLine(detailStream, [
    "listing_key",
    "model_segment",
    "equipment_slot",
    "line",
    "normalized_line",
    "matched_canonical_mod_id",
    "is_ambiguous",
    "section_kind",
  ]);

  try {
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
      throw new Error("audit window를 계산하지 못했습니다.");
    }
    const highValueThresholdChaos = await lookupDivineThresholdChaos(client, snapshotNow);
    const bySegment = new Map<string, SegmentSummary>();
    const bySlot = new Map<string, SegmentSummary>();

    let processedRows = 0;
    let lastUpdatedAt: string | null = null;
    let lastListingKey: string | null = null;

    while (maxRows === 0 || processedRows < maxRows) {
      const remainingLimit = maxRows === 0 ? batchSize : Math.min(batchSize, maxRows - processedRows);
      if (remainingLimit <= 0) {
        break;
      }

      const result: QueryResult<AuditRow> = await client.query<AuditRow>(
        `
          SELECT
            t.listing_key,
            t.source_updated_at::text AS source_updated_at,
            t.model_segment,
            t.target_price_chaos::text,
            t.item_class,
            t.base_type,
            t.rarity,
            n.item_name,
            n.type_line,
            n.item_json
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
        [lowerBound, snapshotNow, segments, lastUpdatedAt, lastListingKey, remainingLimit],
      );

      if (result.rows.length === 0) {
        break;
      }

      for (const row of result.rows) {
        processedRows += 1;
        const item = row.item_json;
        const explicitMods = asArray<string>(item.explicitMods);
        const uniqueName = asString(item.name);
        const equipmentSlot =
          slotMap[row.base_type ?? ""] ??
          slotMap[row.type_line ?? ""] ??
          inferEquipmentSlotFromItemClass(asString(item.itemClass));
        const features = buildV2ModAwareFeatures({
          itemJson: item,
          itemClass: row.item_class,
          baseType: row.base_type,
          rarity: row.rarity,
          modelSegment: row.model_segment,
          equipmentSlot,
        });
        const affixLines = analyzeV2AffixesFromItemJson({
          itemJson: item,
          itemClass: row.item_class,
          baseType: row.base_type,
          rarity: row.rarity,
          modelSegment: row.model_segment,
          equipmentSlot,
        });
        const matched = Number(features.matched_explicit_mod_count ?? 0);
        const ambiguous = Number(features.ambiguous_explicit_mod_count ?? 0);
        const unmatched = Number(features.unmatched_explicit_mod_count ?? 0);
        const explicitLineCount = matched + ambiguous + unmatched;
        const targetPriceChaos = Number(row.target_price_chaos);
        const isSearchWorthy = targetPriceChaos >= searchWorthyThresholdChaos;
        const isHighValue =
          highValueThresholdChaos !== null && targetPriceChaos >= highValueThresholdChaos;

        const updateSummary = (summary: SegmentSummary): void => {
          summary.rows += 1;
          summary.pricedRows += Number.isFinite(targetPriceChaos) && targetPriceChaos > 0 ? 1 : 0;
          summary.explicitLines += explicitLineCount;
          summary.matchedLines += matched;
          summary.ambiguousLines += ambiguous;
          summary.unmatchedLines += unmatched;
          summary.preservedExplicitRows += explicitMods.length > 0 ? 1 : 0;
          summary.uniqueNameRows += row.model_segment === "unique_equipment" && uniqueName ? 1 : 0;
          summary.searchWorthyRows += isSearchWorthy ? 1 : 0;
          summary.highValueRows += isHighValue ? 1 : 0;
        };

        addBreakdown(bySegment, row.model_segment, updateSummary);
        addBreakdown(bySlot, equipmentSlot ?? "unknown", updateSummary);

        if (processedRows <= 500 && affixLines.length > 0) {
          for (const line of affixLines.slice(0, 3)) {
            writeCsvLine(detailStream, [
              row.listing_key,
              row.model_segment,
              equipmentSlot,
              line.line,
              line.normalizedLine,
              line.matchedCanonicalModId,
              line.isAmbiguous,
              line.sectionKind,
            ]);
          }
        }
      }

      const lastRow: AuditRow = result.rows[result.rows.length - 1];
      lastUpdatedAt = lastRow.source_updated_at;
      lastListingKey = lastRow.listing_key;

      logger.info(
        {
          processedRows,
          batchRows: result.rows.length,
          cursorUpdatedAt: lastUpdatedAt,
          cursorListingKey: lastListingKey,
        },
        "V2 audit batch completed",
      );
    }

    const summary = {
      generatedAt: new Date().toISOString(),
      sourceWindowDays: days,
      snapshotNow,
      lowerBound,
      processedRows,
      maxRows: maxRows === 0 ? null : maxRows,
      segments,
      searchWorthyThresholdChaos,
      highValueThresholdChaos,
      bySegment: Object.fromEntries(
        [...bySegment.entries()].map(([key, value]) => [key, summaryToReport(value)]),
      ),
      byEquipmentSlot: Object.fromEntries(
        [...bySlot.entries()].map(([key, value]) => [key, summaryToReport(value)]),
      ),
      notes: [
        "Phase 0 audit writes artifacts only; it does not create or mutate DB schema.",
        "Explicit mod preservation is measured from Public Stash item_json explicitMods arrays.",
        "Affix match rates are based on the shared V2 feature builder and English dictionary path.",
      ],
    };

    await writeFile(
      join(outputDir, "summary.json"),
      `${JSON.stringify(summary, null, 2)}\n`,
      "utf-8",
    );
    await writeFile(
      join(outputDir, "summary.md"),
      [
        "# V2 Phase 0 Audit Summary",
        "",
        `- Generated at: ${summary.generatedAt}`,
        `- Source window: last ${days} days`,
        `- Processed rows: ${processedRows}`,
        `- Search-worthy threshold: ${searchWorthyThresholdChaos} chaos`,
        `- High-value threshold: ${highValueThresholdChaos ?? "not available"} chaos`,
        "",
        "## Segment Summary",
        "",
        "| segment | rows | explicit_lines | matched_rate | ambiguous_or_unmatched_rate | search_worthy_rows | high_value_rows |",
        "| --- | ---: | ---: | ---: | ---: | ---: | ---: |",
        ...Object.entries(summary.bySegment).map(([segment, row]) => {
          const values = row as Record<string, number>;
          return `| ${segment} | ${values.rows} | ${values.explicitLines} | ${values.matchedRate.toFixed(4)} | ${values.ambiguousOrUnmatchedRate.toFixed(4)} | ${values.searchWorthyRows} | ${values.highValueRows} |`;
        }),
        "",
        "## Equipment Slot Summary",
        "",
        "| slot | rows | explicit_lines | matched_rate | ambiguous_or_unmatched_rate |",
        "| --- | ---: | ---: | ---: | ---: |",
        ...Object.entries(summary.byEquipmentSlot).map(([slot, row]) => {
          const values = row as Record<string, number>;
          return `| ${slot} | ${values.rows} | ${values.explicitLines} | ${values.matchedRate.toFixed(4)} | ${values.ambiguousOrUnmatchedRate.toFixed(4)} |`;
        }),
        "",
      ].join("\n"),
      "utf-8",
    );

    logger.info({ outputDir }, "V2 Phase 0 audit completed");
  } finally {
    detailStream.end();
    client.release();
  }
}

main()
  .catch((error) => {
    logger.error({ error }, "V2 Phase 0 audit failed");
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool();
  });
