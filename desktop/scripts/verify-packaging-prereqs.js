#!/usr/bin/env node
const { existsSync } = require("node:fs");
const path = require("node:path");

const desktopDir = path.resolve(__dirname, "..");
const repoRoot = path.resolve(desktopDir, "..");

const required = [
  path.join(repoRoot, "dist", "services", "desktop-feature-payload.service.js"),
  path.join(repoRoot, "ml", "predict_desktop_item_value.py"),
  path.join(desktopDir, "models", "v2_mvp", "model_manifest.json"),
  path.join(desktopDir, "models", "v2_mvp", "rare_unique_classifier", "model.cbm"),
  path.join(desktopDir, "models", "v2_mvp", "jewel_regressor", "model.cbm"),
  path.join(desktopDir, "models", "v2_mvp", "skill_gem_regressor", "model.cbm"),
  path.join(repoRoot, "samples", "clipboard", "en", "rare-equipment-001.txt"),
];

const pythonCandidates = [
  path.join(desktopDir, "vendor", "python-win", "python.exe"),
  path.join(desktopDir, "vendor", "python-win", "Scripts", "python.exe"),
];

const missing = required.filter((filePath) => !existsSync(filePath));
if (!pythonCandidates.some((filePath) => existsSync(filePath))) {
  missing.push(path.join(desktopDir, "vendor", "python-win", "(python.exe or Scripts/python.exe)"));
}

if (missing.length > 0) {
  console.error("Packaging prerequisites are missing:");
  for (const filePath of missing) {
    console.error(`- ${path.relative(repoRoot, filePath)}`);
  }
  console.error("");
  console.error("Run these first:");
  console.error("  npm run build");
  console.error("  npm run prepare:desktop-models -- --days=7");
  console.error("  powershell -ExecutionPolicy Bypass -File desktop/scripts/prepare-embedded-python.ps1");
  process.exit(1);
}

console.log("Packaging prerequisites OK.");
