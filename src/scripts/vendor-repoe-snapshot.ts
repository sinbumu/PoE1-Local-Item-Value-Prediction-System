import { createHash } from "node:crypto";
import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import type { RePoeVendorManifest } from "../types/affix-dictionary.types";

const ROOT_DIR = process.cwd();
const VENDOR_ROOT = path.join(ROOT_DIR, "vendor", "poe-static");
const SOURCE_REPO_URL = "https://github.com/repoe-fork/repoe";
const EXPORT_BASE_URL = "https://repoe-fork.github.io";
const SNAPSHOT_FILES = [
  "mods.json",
  "stats.json",
  "stat_translations.json",
  "mod_types.json",
  "tags.json",
  "item_classes.json",
  "base_items.json",
] as const;

function readStringFlag(flagName: string): string | null {
  const prefix = `${flagName}=`;
  const argument = process.argv.slice(2).find((value) => value.startsWith(prefix));
  if (!argument) {
    return null;
  }

  return argument.slice(prefix.length).trim() || null;
}

function defaultSnapshotLabel(): string {
  return `repoe-fork-poe1-${new Date().toISOString().slice(0, 10)}`;
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`failed to download ${url}: ${response.status} ${response.statusText}`);
  }

  return response.text();
}

function sha256(contents: string): string {
  return createHash("sha256").update(contents).digest("hex");
}

async function main(): Promise<void> {
  const snapshotLabel = readStringFlag("--snapshot-label") ?? defaultSnapshotLabel();
  const targetDir = path.join(VENDOR_ROOT, snapshotLabel);

  await mkdir(VENDOR_ROOT, { recursive: true });

  try {
    await stat(targetDir);
    throw new Error(`vendor target already exists: ${path.relative(ROOT_DIR, targetDir)}`);
  } catch (error) {
    const isMissingDirectory =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "ENOENT";

    if (!isMissingDirectory) {
      throw error;
    }
  }

  await mkdir(targetDir, { recursive: true });

  const fetchedAt = new Date().toISOString();
  const manifest: RePoeVendorManifest = {
    source: "repoe-fork",
    game: "poe1",
    snapshotLabel,
    sourceRepoUrl: SOURCE_REPO_URL,
    exportBaseUrl: EXPORT_BASE_URL,
    fetchedAt,
    files: [],
  };

  for (const fileName of SNAPSHOT_FILES) {
    const url = `${EXPORT_BASE_URL}/${fileName}`;
    const contents = await fetchText(url);
    const filePath = path.join(targetDir, fileName);
    await writeFile(filePath, contents, "utf8");
    manifest.files.push({
      name: fileName,
      url,
      sha256: sha256(contents),
      size: Buffer.byteLength(contents, "utf8"),
    });
  }

  await writeFile(
    path.join(targetDir, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8",
  );

  await writeFile(
    path.join(targetDir, "README.md"),
    [
      "# RePoE Snapshot",
      "",
      `- snapshot label: \`${snapshotLabel}\``,
      `- source repo: ${SOURCE_REPO_URL}`,
      `- export base url: ${EXPORT_BASE_URL}`,
      `- fetched at: ${fetchedAt}`,
      "- vendored files:",
      ...SNAPSHOT_FILES.map((fileName) => `  - \`${fileName}\``),
      "",
      "이 디렉터리는 English affix dictionary 생성용 canonical input snapshot이다.",
    ].join("\n"),
    "utf8",
  );

  console.log(
    JSON.stringify(
      {
        snapshotLabel,
        targetDir: path.relative(ROOT_DIR, targetDir),
        fileCount: manifest.files.length,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
