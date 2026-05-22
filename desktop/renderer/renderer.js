const itemText = document.querySelector("#itemText");
const manifestPath = document.querySelector("#manifestPath");
const modelPath = document.querySelector("#modelPath");
const schemaPath = document.querySelector("#schemaPath");
const threshold = document.querySelector("#threshold");
const configStatus = document.querySelector("#configStatus");
const envChecks = document.querySelector("#envChecks");
const runEnvCheckButton = document.querySelector("#runEnvCheck");
const sampleSelect = document.querySelector("#sampleSelect");
const loadSampleButton = document.querySelector("#loadSample");
const statusEl = document.querySelector("#status");
const decisionBadge = document.querySelector("#decisionBadge");
const scoreValue = document.querySelector("#scoreValue");
const thresholdValue = document.querySelector("#thresholdValue");
const recommendationValue = document.querySelector("#recommendationValue");
const itemSummary = document.querySelector("#itemSummary");
const warningsEl = document.querySelector("#warnings");
const latencyEl = document.querySelector("#latency");
const predictionEl = document.querySelector("#prediction");
const featuresEl = document.querySelector("#features");
const readClipboardButton = document.querySelector("#readClipboard");
const analyzeButton = document.querySelector("#analyze");

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.className = isError ? "error" : "";
}

function renderEnvironmentChecks(diagnostics) {
  envChecks.innerHTML = "";
  const checks = diagnostics?.checks ?? {};
  for (const check of Object.values(checks)) {
    const row = document.createElement("div");
    row.className = check.ok ? "check-item ok" : "check-item error";
    const title = document.createElement("strong");
    title.textContent = `${check.ok ? "OK" : "FAIL"} - ${check.label}`;
    const detail = document.createElement("span");
    detail.textContent = check.detail ?? "";
    row.append(title, detail);
    envChecks.append(row);
  }
}

function formatScore(score) {
  return typeof score === "number" ? score.toFixed(4) : "-";
}

function decisionClass(decision) {
  if (decision === "high-value candidate") {
    return "decision-badge high";
  }
  if (decision === "search-worthy") {
    return "decision-badge search";
  }
  if (decision === "low listed value") {
    return "decision-badge low";
  }
  if (decision === "manual check") {
    return "decision-badge manual";
  }
  if (decision === "unsupported item type" || decision === "direct search recommended" || decision === "external price lookup recommended" || decision === "parse failed") {
    return "decision-badge unsupported";
  }
  return "decision-badge neutral";
}

function recommendationFor(prediction) {
  if (prediction.recommendation) {
    return prediction.recommendation;
  }
  if (prediction.decision === "high-value candidate") {
    return "High-value 후보입니다. 거래소 직접 검색과 가격 확인을 권장합니다.";
  }
  if (prediction.decision === "search-worthy") {
    return "검색하거나 판매 시도할 가치가 있을 가능성이 높습니다.";
  }
  if (prediction.decision === "low listed value") {
    return "검색 우선순위는 낮습니다. 특수 빌드용 아이템이면 직접 확인하세요.";
  }
  if (prediction.decision === "manual check") {
    return "자동 판단만으로 버리기 애매합니다. 거래소 가격을 한 번 확인하세요.";
  }
  return "지원 범위 또는 모델 상태를 확인하세요.";
}

function renderKeyValues(container, values) {
  container.innerHTML = "";
  for (const [label, value] of values) {
    const row = document.createElement("div");
    row.className = "summary-item";
    const key = document.createElement("span");
    key.textContent = label;
    const val = document.createElement("strong");
    val.textContent = value ?? "-";
    row.append(key, val);
    container.append(row);
  }
}

function renderWarnings(warnings) {
  warningsEl.innerHTML = "";
  if (!warnings || warnings.length === 0) {
    warningsEl.textContent = "No parser warnings.";
    warningsEl.className = "warnings muted";
    return;
  }
  warningsEl.className = "warnings";
  for (const warning of warnings) {
    const item = document.createElement("div");
    item.textContent = warning;
    warningsEl.append(item);
  }
}

function clearResult() {
  predictionEl.textContent = "";
  featuresEl.textContent = "";
  decisionBadge.textContent = "No result yet";
  decisionBadge.className = "decision-badge neutral";
  scoreValue.textContent = "-";
  thresholdValue.textContent = threshold.value || "0.40";
  recommendationValue.textContent = "Paste or load an item.";
  itemSummary.innerHTML = "";
  warningsEl.textContent = "";
  latencyEl.textContent = "";
}

function setBusy(isBusy) {
  analyzeButton.disabled = isBusy;
  readClipboardButton.disabled = isBusy;
  loadSampleButton.disabled = isBusy;
  runEnvCheckButton.disabled = isBusy;
}

async function initializeApp() {
  try {
    const config = await window.poeValueApp.getAppConfig();
    manifestPath.value = config.defaults.manifestPath;
    modelPath.value = config.defaults.modelPath;
    schemaPath.value = config.defaults.schemaPath;
    threshold.value = config.defaults.threshold;
    thresholdValue.textContent = config.defaults.threshold;

    const manifestLabel = config.availability.manifest.exists ? "manifest found" : "manifest missing";
    const modelLabel = config.availability.model.exists ? "legacy model found" : "legacy model missing";
    const schemaLabel = config.availability.schema.exists ? "schema found" : "schema missing";
    configStatus.textContent = `Default bundle: ${manifestLabel}, ${modelLabel}, ${schemaLabel}. Python: ${config.defaults.pythonPath}`;
    configStatus.className =
      config.availability.manifest.exists && config.availability.model.exists && config.availability.schema.exists ? "notice ok" : "notice warning";

    for (const sample of config.samples) {
      const option = document.createElement("option");
      option.value = sample.id;
      option.textContent = `[${sample.category}] ${sample.label}`;
      sampleSelect.append(option);
    }
  } catch (error) {
    configStatus.textContent = error.message ?? String(error);
    configStatus.className = "notice error";
  }
}

runEnvCheckButton.addEventListener("click", async () => {
  setStatus("Running environment check...");
  setBusy(true);
  try {
    const diagnostics = await window.poeValueApp.runEnvironmentCheck();
    renderEnvironmentChecks(diagnostics);
    const failed = Object.values(diagnostics.checks).filter((check) => !check.ok);
    setStatus(failed.length === 0 ? "Environment check passed." : `Environment check failed: ${failed.length} issue(s).`, failed.length > 0);
  } catch (error) {
    setStatus(error.message ?? String(error), true);
  } finally {
    setBusy(false);
  }
});

readClipboardButton.addEventListener("click", async () => {
  try {
    itemText.value = await window.poeValueApp.readClipboard();
    setStatus("Clipboard text loaded.");
  } catch (error) {
    setStatus(error.message ?? String(error), true);
  }
});

loadSampleButton.addEventListener("click", async () => {
  const sampleId = sampleSelect.value;
  if (!sampleId) {
    setStatus("Select a demo sample first.", true);
    return;
  }
  try {
    const sample = await window.poeValueApp.readDemoSample(sampleId);
    itemText.value = sample.text;
    setStatus(`Loaded demo sample: ${sample.id}`);
  } catch (error) {
    setStatus(error.message ?? String(error), true);
  }
});

analyzeButton.addEventListener("click", async () => {
  setStatus("Running local parser and model...");
  clearResult();
  setBusy(true);

  try {
    const result = await window.poeValueApp.analyzeItem({
      text: itemText.value,
      manifestPath: manifestPath.value,
      modelPath: modelPath.value,
      schemaPath: schemaPath.value,
      threshold: threshold.value,
    });
    const prediction = result.prediction;
    const item = result.features.item ?? prediction.item ?? {};

    decisionBadge.textContent = prediction.decision;
    decisionBadge.className = decisionClass(prediction.decision);
    scoreValue.textContent =
      typeof prediction.predictedChaos === "number" ? `${prediction.predictedChaos.toFixed(1)} chaos` : formatScore(prediction.score);
    thresholdValue.textContent = prediction.threshold ?? threshold.value;
    recommendationValue.textContent = recommendationFor(prediction);
    latencyEl.textContent = result.timings
      ? `feature ${result.timings.featureMs ?? "-"}ms / predict ${result.timings.predictMs ?? "skipped"}ms`
      : "";
    renderKeyValues(itemSummary, [
      ["Rarity", item.rarity],
      ["Item", item.itemName],
      ["Base", item.baseType],
      ["Class", item.itemClass],
      ["Slot", item.equipmentSlot],
      ["Segment", prediction.modelSegment ?? result.features.routing?.modelSegment],
      ["Model", prediction.modelId],
      ["Locale", item.locale],
    ]);
    renderWarnings([...(result.features.warnings ?? []), prediction.reason].filter(Boolean));
    predictionEl.textContent = JSON.stringify(result.prediction, null, 2);
    featuresEl.textContent = JSON.stringify(
      {
        item: result.features.item,
        routing: result.features.routing,
        warnings: result.features.warnings,
        featureSets: result.features.featureSets,
        features: result.features.features,
        affixLines: result.features.affixLines,
      },
      null,
      2,
    );
    setStatus(`Decision ready: ${prediction.decision}`);
  } catch (error) {
    setStatus(error.message ?? String(error), true);
  } finally {
    setBusy(false);
  }
});

initializeApp();
