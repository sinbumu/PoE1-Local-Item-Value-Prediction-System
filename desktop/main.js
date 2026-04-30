const { app, BrowserWindow, clipboard, ipcMain } = require("electron");
const { spawn } = require("node:child_process");
const { mkdtemp, writeFile, rm } = require("node:fs/promises");
const { existsSync } = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..");

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
    const child = spawn(command, args, {
      cwd: repoRoot,
      env: { ...process.env, ...options.env },
      shell: process.platform === "win32",
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
        resolve({ stdout, stderr });
      } else {
        reject(new Error(`${command} exited with code ${code}\n${stderr}`));
      }
    });
  });
}

function resolvePython() {
  const venvPython = path.join(repoRoot, "ml", ".venv", process.platform === "win32" ? "Scripts/python.exe" : "bin/python");
  return existsSync(venvPython) ? venvPython : "python3";
}

ipcMain.handle("read-clipboard", () => clipboard.readText());

ipcMain.handle("analyze-item", async (_event, payload) => {
  const text = String(payload?.text ?? "").trim();
  const modelPath = String(payload?.modelPath ?? "").trim();
  const schemaPath = String(payload?.schemaPath ?? "").trim();

  if (!text) {
    throw new Error("아이템 텍스트가 비어 있습니다.");
  }
  if (!modelPath || !schemaPath) {
    throw new Error("model.cbm 경로와 feature_schema.json 경로가 필요합니다.");
  }

  const tempDir = await mkdtemp(path.join(os.tmpdir(), "poe1-v2-item-"));
  const inputPath = path.join(tempDir, "item.txt");
  const featurePath = path.join(tempDir, "features.json");

  try {
    await writeFile(inputPath, text, "utf-8");
    const featureResult = await runCommand("npm", [
      "run",
      "--silent",
      "v2:clipboard-features",
      "--",
      "--input",
      inputPath,
    ]);
    await writeFile(featurePath, featureResult.stdout, "utf-8");

    const predictionResult = await runCommand(resolvePython(), [
      "ml/predict_item_value.py",
      "--model",
      modelPath,
      "--schema",
      schemaPath,
      "--input",
      featurePath,
    ]);

    return {
      features: JSON.parse(featureResult.stdout),
      prediction: JSON.parse(predictionResult.stdout),
      stderr: [featureResult.stderr, predictionResult.stderr].filter(Boolean).join("\n"),
    };
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
