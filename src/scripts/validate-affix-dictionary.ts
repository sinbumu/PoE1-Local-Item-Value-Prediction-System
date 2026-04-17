import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { ClipboardParserService } from "../services/clipboard-parser.service";
import type { ClipboardAffixValidationReport } from "../types/affix-dictionary.types";
import countingPolicy from "../generated/affix-dictionary/counting_policy.generated.json";

type ManifestEntry = {
  id: string;
  locale: "en" | "ko";
  category: string;
  outputTextPath: string;
};

const ROOT_DIR = process.cwd();
const MANIFEST_PATH = path.join(ROOT_DIR, "samples", "clipboard", "manifest.json");
const REPORT_DIR = path.join(ROOT_DIR, "artifacts", "affix-dictionary");
const REPORT_PATH = path.join(REPORT_DIR, "validation-report.json");
const DEFAULT_SCOPE_CATEGORIES = new Set([
  "rare_equipment",
  "normal_jewel",
  "crafted_fractured_influenced_item",
]);

function readBooleanFlag(flagName: string): boolean {
  return process.argv.slice(2).includes(flagName);
}

async function main(): Promise<void> {
  const failOnUnmatched = readBooleanFlag("--fail-on-unmatched");
  const includeAllEnglish = readBooleanFlag("--all-en");
  const parser = new ClipboardParserService();
  const manifest = JSON.parse(await readFile(MANIFEST_PATH, "utf8")) as ManifestEntry[];

  const englishEntries = manifest.filter(
    (entry) =>
      entry.locale === "en" &&
      (includeAllEnglish || DEFAULT_SCOPE_CATEGORIES.has(entry.category)),
  );
  const unmatchedExamples: ClipboardAffixValidationReport["unmatchedExamples"] = [];
  let candidateLineCount = 0;
  let matchedCandidateCount = 0;
  let ambiguousCandidateCount = 0;

  for (const entry of englishEntries) {
    const rawText = await readFile(path.join(ROOT_DIR, entry.outputTextPath), "utf8");
    const parsed = parser.parse(rawText, { localeHint: "en" });
    const analysisLines = parsed.explicitAffixLines;

    for (const line of analysisLines) {
      candidateLineCount += 1;
      if (line.candidateCanonicalModIds.length > 0) {
        matchedCandidateCount += 1;
        if (line.isAmbiguous) {
          ambiguousCandidateCount += 1;
        }
      } else if (unmatchedExamples.length < 50) {
        unmatchedExamples.push({
          sampleId: entry.id,
          category: entry.category,
          line: line.line,
          sectionKind: line.sectionKind,
        });
      }
    }
  }

  const unmatchedCandidateCount = candidateLineCount - matchedCandidateCount;
  const report: ClipboardAffixValidationReport = {
    sourceVersion: countingPolicy.sourceVersion,
    scopeCategories: includeAllEnglish ? ["all_en"] : [...DEFAULT_SCOPE_CATEGORIES].sort(),
    checkedSampleCount: englishEntries.length,
    candidateLineCount,
    matchedCandidateCount,
    ambiguousCandidateCount,
    unmatchedCandidateCount,
    matchRate: candidateLineCount === 0 ? 0 : matchedCandidateCount / candidateLineCount,
    unmatchedExamples,
  };

  await mkdir(REPORT_DIR, { recursive: true });
  await writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  console.log(
    JSON.stringify(
      {
        ...report,
        reportPath: path.relative(ROOT_DIR, REPORT_PATH),
      },
      null,
      2,
    ),
  );

  if (failOnUnmatched && unmatchedCandidateCount > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
