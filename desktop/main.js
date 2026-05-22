const { app, BrowserWindow, clipboard, ipcMain } = require("electron");
const { spawn } = require("node:child_process");
const { mkdtemp, readFile, readdir, writeFile, rm } = require("node:fs/promises");
const { existsSync } = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..");
const defaultThreshold = "0.70";
const defaultManifestPath = "desktop/models/v2_mvp/model_manifest.json";
const defaultModelPath = "desktop/models/v2_mvp/model.cbm";
const defaultSchemaPath = "desktop/models/v2_mvp/feature_schema.json";
const demoSampleDir = path.join(repoRoot, "samples", "clipboard", "en");
const demoSampleIds = [
  "rare-equipment-001",
  "rare-equipment-002",
  "rare-equipment-003",
  "unique-equipment-001",
  "unique-equipment-002",
  "normal-jewel-001",
  "cluster-jewel-001",
  "skill-gem-001",
  "vaal-gem-001",
  "awakened-gem-001",
];

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1000,
    height: 760,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, "renderer", "index.html"));
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const startedAt = performance.now();
    const useShell = process.platform === "win32" && /\.(cmd|bat)$/i.test(command);
    const child = spawn(command, args, {
      cwd: repoRoot,
      env: { ...process.env, ...options.env },
      shell: useShell,
    });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr, elapsedMs: Math.round(performance.now() - startedAt) });
      } else {
        reject(new Error(`${command} exited with code ${code}\n${stderr}`));
      }
    });
  });
}

async function runCommandCheck(command, args, options = {}) {
  try {
    const result = await runCommand(command, args, options);
    return {
      ok: true,
      command,
      elapsedMs: result.elapsedMs,
      stdout: result.stdout.trim(),
      stderr: result.stderr.trim(),
    };
  } catch (error) {
    return {
      ok: false,
      command,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function resolveNpm() {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

function resolveRepoPath(value) {
  const normalized = String(value ?? "").trim();
  if (!normalized) {
    return "";
  }
  return path.isAbsolute(normalized) ? normalized : path.join(repoRoot, normalized);
}

function toRepoRelative(absolutePath) {
  return path.relative(repoRoot, absolutePath).split(path.sep).join("/");
}

function fileStatus(relativePath) {
  const absolutePath = resolveRepoPath(relativePath);
  return {
    path: relativePath,
    exists: Boolean(relativePath) && existsSync(absolutePath),
  };
}

function resolvePython() {
  if (process.env.POE_VALUE_APP_PYTHON) {
    return process.env.POE_VALUE_APP_PYTHON;
  }
  const venvPython = path.join(repoRoot, "ml", ".venv", process.platform === "win32" ? "Scripts/python.exe" : "bin/python");
  if (existsSync(venvPython)) {
    return venvPython;
  }
  return process.platform === "win32" ? "python" : "python3";
}

async function readJsonIfExists(filePath) {
  if (!existsSync(filePath)) {
    return null;
  }
  return JSON.parse(await readFile(filePath, "utf-8"));
}

async function listDemoSamples() {
  if (!existsSync(demoSampleDir)) {
    return [];
  }
  const entries = await readdir(demoSampleDir);
  const txtIds = new Set(
    entries.filter((entry) => entry.endsWith(".txt")).map((entry) => entry.replace(/\.txt$/, "")),
  );
  const ids = demoSampleIds.filter((id) => txtIds.has(id));
  for (const id of [...txtIds].sort()) {
    if (!ids.includes(id) && /^(rare-equipment|unique-equipment|normal-jewel|cluster-jewel|skill-gem|vaal-gem|awakened-gem)-/.test(id)) {
      ids.push(id);
    }
  }

  return Promise.all(
    ids.map(async (id) => {
      const meta = await readJsonIfExists(path.join(demoSampleDir, `${id}.meta.json`));
      return {
        id,
        label: `${id}${meta?.expected?.itemName ? ` - ${meta.expected.itemName}` : ""}`,
        category: meta?.category ?? "unknown",
        expected: meta?.expected ?? null,
      };
    }),
  );
}

function friendlyError(error) {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("ENOENT") || message.includes("spawn")) {
    return "필요한 실행 파일을 찾지 못했습니다. `npm install`, `desktop/npm install`, Python venv 상태를 확인하세요.";
  }
  if (message.includes("No such file") || message.includes("can't open file")) {
    return "모델, 스키마 또는 입력 파일 경로를 찾지 못했습니다. 앱의 경로 입력값을 확인하세요.";
  }
  if (message.includes("CatBoost") || message.includes("feature_schema") || message.includes("model_manifest")) {
    return "CatBoost 모델, feature_schema.json 또는 model_manifest.json을 읽는 중 오류가 발생했습니다. 서로 같은 desktop 모델 번들의 파일인지 확인하세요.";
  }
  return message;
}

async function buildEnvironmentDiagnostics() {
  const pythonPath = resolvePython();
  const manifest = fileStatus(defaultManifestPath);
  const model = fileStatus(defaultModelPath);
  const schema = fileStatus(defaultSchemaPath);
  const npmVersion = await runCommandCheck(resolveNpm(), ["--version"]);
  const pythonVersion = await runCommandCheck(pythonPath, ["--version"]);
  const pythonPackages = await runCommandCheck(pythonPath, [
    "-c",
    "import catboost, pandas; print('catboost/pandas import OK')",
  ]);
  const featureBuilder = await runCommandCheck(resolveNpm(), [
    "run",
    "--silent",
    "desktop:clipboard-features",
    "--",
    "--input",
    "samples/clipboard/en/rare-equipment-001.txt",
  ]);

  return {
    repoRoot,
    platform: process.platform,
    defaults: {
      modelPath: defaultModelPath,
      schemaPath: defaultSchemaPath,
      manifestPath: defaultManifestPath,
      threshold: defaultThreshold,
      pythonPath,
      npmPath: resolveNpm(),
    },
    checks: {
      manifest: {
        ok: manifest.exists,
        label: "Desktop model_manifest.json",
        detail: manifest.exists ? manifest.path : `missing: ${manifest.path}`,
      },
      model: {
        ok: model.exists,
        label: "Legacy rare/unique model.cbm",
        detail: model.exists ? model.path : `missing: ${model.path}`,
      },
      schema: {
        ok: schema.exists,
        label: "MVP feature_schema.json",
        detail: schema.exists ? schema.path : `missing: ${schema.path}`,
      },
      npm: {
        ok: npmVersion.ok,
        label: "npm",
        detail: npmVersion.ok ? npmVersion.stdout : npmVersion.error,
      },
      python: {
        ok: pythonVersion.ok,
        label: "Python executable",
        detail: pythonVersion.ok ? `${pythonPath} (${pythonVersion.stdout})` : pythonVersion.error,
      },
      pythonPackages: {
        ok: pythonPackages.ok,
        label: "Python catboost/pandas",
        detail: pythonPackages.ok ? pythonPackages.stdout : pythonPackages.error,
      },
      featureBuilder: {
        ok: featureBuilder.ok,
        label: "TypeScript desktop feature builder",
        detail: featureBuilder.ok
          ? `sample feature generation OK (${featureBuilder.elapsedMs}ms)`
          : featureBuilder.error,
      },
    },
  };
}

ipcMain.handle("get-app-config", async () => ({
  repoRoot,
  defaults: {
    modelPath: defaultModelPath,
    schemaPath: defaultSchemaPath,
    manifestPath: defaultManifestPath,
    threshold: defaultThreshold,
    pythonPath: resolvePython(),
  },
  availability: {
    manifest: fileStatus(defaultManifestPath),
    model: fileStatus(defaultModelPath),
    schema: fileStatus(defaultSchemaPath),
    pythonVenv: existsSync(resolvePython()),
  },
  samples: await listDemoSamples(),
}));

ipcMain.handle("run-environment-check", async () => buildEnvironmentDiagnostics());

ipcMain.handle("read-clipboard", () => clipboard.readText());

ipcMain.handle("read-demo-sample", async (_event, sampleId) => {
  const safeId = String(sampleId ?? "").trim();
  if (!/^[a-z0-9-]+$/.test(safeId)) {
    throw new Error("잘못된 샘플 ID입니다.");
  }
  const samplePath = path.join(demoSampleDir, `${safeId}.txt`);
  if (!existsSync(samplePath)) {
    throw new Error(`샘플 파일을 찾지 못했습니다: ${safeId}`);
  }
  return {
    id: safeId,
    text: await readFile(samplePath, "utf-8"),
  };
});

ipcMain.handle("analyze-item", async (_event, payload) => {
  const text = String(payload?.text ?? "").trim();
  const manifestPath = String(payload?.manifestPath ?? defaultManifestPath).trim();
  const threshold = String(payload?.threshold ?? defaultThreshold).trim() || defaultThreshold;
  const thresholdNumber = Number(threshold);

  if (!text) {
    throw new Error("아이템 텍스트가 비어 있습니다.");
  }
  if (!Number.isFinite(thresholdNumber) || thresholdNumber <= 0 || thresholdNumber >= 1) {
    throw new Error("classifier search threshold는 0과 1 사이의 숫자여야 합니다. 예: 0.70");
  }

  const tempDir = await mkdtemp(path.join(os.tmpdir(), "poe1-v2-item-"));
  const inputPath = path.join(tempDir, "item.txt");
  const featurePath = path.join(tempDir, "features.json");
  const timings = {};

  try {
    await writeFile(inputPath, text, "utf-8");
    const featureResult = await runCommand(resolveNpm(), [
      "run",
      "--silent",
      "desktop:clipboard-features",
      "--",
      "--input",
      inputPath,
    ]);
    timings.featureMs = featureResult.elapsedMs;
    await writeFile(featurePath, featureResult.stdout, "utf-8");
    const features = JSON.parse(featureResult.stdout);
    const resolvedManifestPath = resolveRepoPath(manifestPath);
    if (!manifestPath) {
      throw new Error("model_manifest.json 경로가 필요합니다.");
    }
    if (!existsSync(resolvedManifestPath)) {
      throw new Error(`model_manifest.json 파일을 찾지 못했습니다: ${manifestPath}`);
    }

    const predictionArgs = [
      "ml/predict_desktop_item_value.py",
      "--manifest",
      toRepoRelative(resolvedManifestPath),
      "--input",
      featurePath,
    ];
    if (threshold) {
      predictionArgs.push("--classifier-search-threshold", threshold);
    }
    const predictionResult = await runCommand(resolvePython(), predictionArgs);
    timings.predictMs = predictionResult.elapsedMs;

    return {
      features,
      prediction: JSON.parse(predictionResult.stdout),
      timings,
      stderr: [featureResult.stderr, predictionResult.stderr].filter(Boolean).join("\n"),
    };
  } catch (error) {
    console.error("Analyze item failed:", error);
    throw new Error(friendlyError(error));
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
