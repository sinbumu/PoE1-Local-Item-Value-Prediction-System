#!/usr/bin/env node
const { spawnSync } = require("node:child_process");
const { existsSync } = require("node:fs");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..");
const venvPython = path.join(
  repoRoot,
  "ml",
  ".venv",
  process.platform === "win32" ? "Scripts/python.exe" : "bin/python",
);
const candidates = [
  process.env.POE_VALUE_APP_PYTHON,
  existsSync(venvPython) ? venvPython : null,
  process.platform === "win32" ? "python" : "python3",
  "python",
].filter(Boolean);

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("Usage: node scripts/run-python.js <script.py> [args...]");
  process.exit(2);
}

for (const command of candidates) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    stdio: "inherit",
    shell: process.platform === "win32" && /\.(cmd|bat)$/i.test(command),
  });
  if (result.error && result.error.code === "ENOENT") {
    continue;
  }
  process.exit(result.status ?? 1);
}

console.error("Could not find Python. Set POE_VALUE_APP_PYTHON or create ml/.venv.");
process.exit(1);
