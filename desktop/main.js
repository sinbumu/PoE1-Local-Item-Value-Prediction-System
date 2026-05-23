const { app, BrowserWindow, clipboard, ipcMain, Menu, nativeImage, Tray } = require("electron");
const { spawn } = require("node:child_process");
const { mkdtemp, readFile, readdir, writeFile, rm } = require("node:fs/promises");
const { existsSync } = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..");
const defaultThreshold = "0.70";

app.commandLine.appendSwitch("disable-gpu-shader-disk-cache");
app.commandLine.appendSwitch("disk-cache-size", "0");
app.setPath("sessionData", path.join(app.getPath("userData"), "session-data"));

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
  "currency-001",
  "map-001",
  "divination-card-001",
  "parse-failure-001",
];
let floatingWindow = null;
let floatingHideTimer = null;
let latestFloatingResult = null;
let mainWindow = null;
let tray = null;
let isQuitting = false;
let floatingPreferences = {
  displayMode: "autoHide",
  opacity: 0.95,
  bounds: null,
};

function floatingPreferencesPath() {
  return path.join(app.getPath("userData"), "floating-preferences.json");
}

async function loadFloatingPreferences() {
  try {
    const loaded = JSON.parse(await readFile(floatingPreferencesPath(), "utf-8"));
    floatingPreferences = {
      displayMode: loaded.displayMode === "keepVisible" ? "keepVisible" : "autoHide",
      opacity: clampOpacity(loaded.opacity),
      bounds: loaded.bounds ?? null,
    };
  } catch {
    // First run or invalid preference file: keep safe defaults.
  }
}

async function saveFloatingPreferences() {
  try {
    await writeFile(floatingPreferencesPath(), `${JSON.stringify(floatingPreferences, null, 2)}\n`, "utf-8");
  } catch (error) {
    console.warn("Failed to save floating preferences:", error);
  }
}

function clampOpacity(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 0.95;
  }
  return Math.min(1, Math.max(0.25, numeric));
}

function appRoot() {
  return app.isPackaged ? process.resourcesPath : repoRoot;
}

function defaultPaths() {
  if (app.isPackaged) {
    return {
      manifestPath: "models/v2_mvp/model_manifest.json",
      modelPath: "models/v2_mvp/model.cbm",
      schemaPath: "models/v2_mvp/feature_schema.json",
    };
  }
  return {
    manifestPath: "desktop/models/v2_mvp/model_manifest.json",
    modelPath: "desktop/models/v2_mvp/model.cbm",
    schemaPath: "desktop/models/v2_mvp/feature_schema.json",
  };
}

function demoSampleDir() {
  return path.join(appRoot(), "samples", "clipboard", "en");
}

function createTrayIcon() {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
      <rect width="32" height="32" rx="7" fill="#0f172a"/>
      <path d="M8 9h16v4H8zM8 15h11v4H8zM8 21h16v2H8z" fill="#93c5fd"/>
    </svg>
  `.trim();
  return nativeImage.createFromDataURL(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
}

function showMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow();
    return;
  }
  mainWindow.show();
  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }
  mainWindow.focus();
}

function createAppTray() {
  if (tray) {
    return;
  }
  tray = new Tray(createTrayIcon());
  tray.setToolTip("PoE1 Item Value Triage");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "Open Main Window", click: showMainWindow },
      {
        label: "Show Floating Card",
        click: () => {
          ensureFloatingWindow().showInactive();
        },
      },
      {
        label: "Hide Floating Card",
        click: () => {
          if (floatingWindow && !floatingWindow.isDestroyed()) {
            floatingWindow.hide();
          }
        },
      },
      { type: "separator" },
      {
        label: "Quit",
        click: () => {
          isQuitting = true;
          app.quit();
        },
      },
    ]),
  );
  tray.on("click", showMainWindow);
}

function createWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    showMainWindow();
    return;
  }
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 760,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, "renderer", "index.html"));
  mainWindow.on("close", (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
      if (tray) {
        tray.displayBalloon?.({
          title: "PoE1 Item Value Triage",
          content: "앱은 tray에서 계속 실행 중입니다. tray 아이콘으로 다시 열 수 있습니다.",
        });
      }
    }
  });
}

function createFloatingWindow() {
  const savedBounds = floatingPreferences.bounds;
  floatingWindow = new BrowserWindow({
    width: 420,
    height: 250,
    x: Number.isFinite(savedBounds?.x) ? savedBounds.x : undefined,
    y: Number.isFinite(savedBounds?.y) ? savedBounds.y : undefined,
    show: false,
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    transparent: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  floatingWindow.setOpacity(floatingPreferences.opacity);
  floatingWindow.loadFile(path.join(__dirname, "floating", "index.html"));
  floatingWindow.on("ready-to-show", () => {
    floatingWindow.webContents.send("floating-preferences", floatingPreferences);
    if (latestFloatingResult) {
      floatingWindow.webContents.send("floating-result", {
        ...latestFloatingResult,
        preferences: floatingPreferences,
      });
    }
    if (floatingPreferences.displayMode === "keepVisible") {
      floatingWindow.showInactive();
    }
  });
  floatingWindow.on("moved", () => {
    floatingPreferences.bounds = floatingWindow.getBounds();
    void saveFloatingPreferences();
  });
  floatingWindow.on("closed", () => {
    floatingWindow = null;
    if (floatingHideTimer) {
      clearTimeout(floatingHideTimer);
      floatingHideTimer = null;
    }
  });
}

function ensureFloatingWindow() {
  if (!floatingWindow || floatingWindow.isDestroyed()) {
    createFloatingWindow();
  }
  return floatingWindow;
}

function showFloatingResult(result) {
  const targetWindow = ensureFloatingWindow();
  if (!targetWindow) {
    return;
  }
  latestFloatingResult = result;

  if (floatingHideTimer) {
    clearTimeout(floatingHideTimer);
    floatingHideTimer = null;
  }

  targetWindow.setOpacity(floatingPreferences.opacity);
  targetWindow.webContents.send("floating-result", {
    ...result,
    preferences: floatingPreferences,
  });
  targetWindow.setAlwaysOnTop(true, "floating");
  targetWindow.showInactive();

  if (floatingPreferences.displayMode !== "keepVisible") {
    floatingHideTimer = setTimeout(() => {
      if (floatingWindow && !floatingWindow.isDestroyed()) {
        floatingWindow.hide();
      }
      floatingHideTimer = null;
    }, Number(result?.autoHideMs ?? 7000));
  }
}

function applyFloatingPreferences(patch = {}) {
  floatingPreferences = {
    ...floatingPreferences,
    displayMode: patch.displayMode === "keepVisible" ? "keepVisible" : "autoHide",
    opacity: clampOpacity(patch.opacity ?? floatingPreferences.opacity),
  };
  if (floatingWindow && !floatingWindow.isDestroyed()) {
    floatingWindow.setOpacity(floatingPreferences.opacity);
    floatingWindow.webContents.send("floating-preferences", floatingPreferences);
    if (floatingPreferences.displayMode === "keepVisible") {
      if (floatingHideTimer) {
        clearTimeout(floatingHideTimer);
        floatingHideTimer = null;
      }
      floatingWindow.showInactive();
    } else if (!latestFloatingResult) {
      floatingWindow.hide();
    }
  }
  void saveFloatingPreferences();
  return floatingPreferences;
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const startedAt = performance.now();
    const useShell = process.platform === "win32" && /\.(cmd|bat)$/i.test(command);
    const child = spawn(command, args, {
      cwd: options.cwd ?? appRoot(),
      env: {
        ...process.env,
        PYTHONIOENCODING: "utf-8",
        PYTHONUTF8: "1",
        ...options.env,
      },
      shell: useShell,
      windowsHide: true,
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
  return path.isAbsolute(normalized) ? normalized : path.join(appRoot(), normalized);
}

function toRepoRelative(absolutePath) {
  if (app.isPackaged) {
    return absolutePath;
  }
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
  const embeddedPython = path.join(
    appRoot(),
    "python",
    process.platform === "win32" ? "python.exe" : "bin/python",
  );
  if (existsSync(embeddedPython)) {
    return embeddedPython;
  }
  const embeddedVenvPython = path.join(
    appRoot(),
    "python",
    process.platform === "win32" ? "Scripts/python.exe" : "bin/python",
  );
  if (existsSync(embeddedVenvPython)) {
    return embeddedVenvPython;
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

function loadDesktopFeatureBuilder() {
  const candidates = [
    path.join(appRoot(), "dist", "services", "desktop-feature-payload.service.js"),
    path.join(repoRoot, "dist", "services", "desktop-feature-payload.service.js"),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return require(candidate);
    }
  }
  return null;
}

async function buildDesktopFeaturesFromText(text, inputPath) {
  const startedAt = performance.now();
  const builder = loadDesktopFeatureBuilder();
  if (builder?.buildDesktopFeaturePayloadFromClipboardText) {
    const payload = builder.buildDesktopFeaturePayloadFromClipboardText(text);
    return {
      stdout: `${JSON.stringify(payload, null, 2)}\n`,
      stderr: "",
      elapsedMs: Math.round(performance.now() - startedAt),
    };
  }

  if (app.isPackaged) {
    throw new Error("Packaged desktop feature builder not found. Run npm run build before packaging.");
  }

  return runCommand(
    resolveNpm(),
    [
      "run",
      "--silent",
      "desktop:clipboard-features",
      "--",
      "--input",
      inputPath,
    ],
    { cwd: repoRoot },
  );
}

async function listDemoSamples() {
  const sampleDir = demoSampleDir();
  if (!existsSync(sampleDir)) {
    return [];
  }
  const entries = await readdir(sampleDir);
  const txtIds = new Set(
    entries.filter((entry) => entry.endsWith(".txt")).map((entry) => entry.replace(/\.txt$/, "")),
  );
  const ids = demoSampleIds.filter((id) => txtIds.has(id));
  for (const id of [...txtIds].sort()) {
    if (
      !ids.includes(id) &&
      /^(rare-equipment|unique-equipment|normal-jewel|cluster-jewel|skill-gem|vaal-gem|awakened-gem|currency|map|divination-card|parse-failure)-/.test(
        id,
      )
    ) {
      ids.push(id);
    }
  }

  return Promise.all(
    ids.map(async (id) => {
      const meta = await readJsonIfExists(path.join(sampleDir, `${id}.meta.json`));
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
  const defaults = defaultPaths();
  const pythonPath = resolvePython();
  const manifest = fileStatus(defaults.manifestPath);
  const model = fileStatus(defaults.modelPath);
  const schema = fileStatus(defaults.schemaPath);
  const npmVersion = app.isPackaged
    ? { ok: true, stdout: "not required in packaged app" }
    : await runCommandCheck(resolveNpm(), ["--version"]);
  const pythonVersion = await runCommandCheck(pythonPath, ["--version"]);
  const pythonPackages = await runCommandCheck(pythonPath, [
    "-c",
    "import catboost, pandas; print('catboost/pandas import OK')",
  ]);
  const samplePath = path.join(demoSampleDir(), "rare-equipment-001.txt");
  const sampleText = existsSync(samplePath) ? await readFile(samplePath, "utf-8") : "";
  const featureBuilder = sampleText
    ? await (async () => {
        try {
          const result = await buildDesktopFeaturesFromText(sampleText, samplePath);
          return {
            ok: true,
            command: app.isPackaged ? "embedded desktop feature builder" : "desktop feature builder",
            elapsedMs: result.elapsedMs,
            stdout: "desktop feature generation OK",
            stderr: result.stderr,
          };
        } catch (error) {
          return {
            ok: false,
            command: "desktop feature builder",
            error: error instanceof Error ? error.message : String(error),
          };
        }
      })()
    : {
        ok: false,
        command: "desktop feature builder",
        error: `missing sample: ${samplePath}`,
      };

  return {
    repoRoot,
    appRoot: appRoot(),
    isPackaged: app.isPackaged,
    platform: process.platform,
    defaults: {
      modelPath: defaults.modelPath,
      schemaPath: defaults.schemaPath,
      manifestPath: defaults.manifestPath,
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
        label: app.isPackaged ? "npm (packaged)" : "npm",
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

ipcMain.handle("get-app-config", async () => {
  const defaults = defaultPaths();
  return {
    repoRoot,
    appRoot: appRoot(),
    isPackaged: app.isPackaged,
    defaults: {
      modelPath: defaults.modelPath,
      schemaPath: defaults.schemaPath,
      manifestPath: defaults.manifestPath,
      threshold: defaultThreshold,
      pythonPath: resolvePython(),
    },
    availability: {
      manifest: fileStatus(defaults.manifestPath),
      model: fileStatus(defaults.modelPath),
      schema: fileStatus(defaults.schemaPath),
      pythonVenv: existsSync(resolvePython()),
    },
    samples: await listDemoSamples(),
  };
});

ipcMain.handle("run-environment-check", async () => buildEnvironmentDiagnostics());

ipcMain.handle("read-clipboard", () => clipboard.readText());

ipcMain.handle("show-floating-result", (_event, result) => {
  showFloatingResult(result);
  return { ok: true };
});

ipcMain.handle("get-floating-preferences", () => floatingPreferences);

ipcMain.handle("set-floating-preferences", (_event, preferences) => applyFloatingPreferences(preferences));

ipcMain.handle("hide-floating-result", () => {
  if (floatingHideTimer) {
    clearTimeout(floatingHideTimer);
    floatingHideTimer = null;
  }
  if (floatingWindow && !floatingWindow.isDestroyed()) {
    floatingWindow.hide();
  }
  latestFloatingResult = null;
  return { ok: true };
});

ipcMain.handle("read-demo-sample", async (_event, sampleId) => {
  const safeId = String(sampleId ?? "").trim();
  if (!/^[a-z0-9-]+$/.test(safeId)) {
    throw new Error("잘못된 샘플 ID입니다.");
  }
  const samplePath = path.join(demoSampleDir(), `${safeId}.txt`);
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
  const manifestPath = String(payload?.manifestPath ?? defaultPaths().manifestPath).trim();
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
    const featureResult = await buildDesktopFeaturesFromText(text, inputPath);
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

app.whenReady().then(async () => {
  await loadFloatingPreferences();
  createAppTray();
  createWindow();
  createFloatingWindow();
  app.on("activate", () => {
    showMainWindow();
  });
});

app.on("window-all-closed", () => {
  if (isQuitting && process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  isQuitting = true;
});
