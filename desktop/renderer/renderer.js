const itemText = document.querySelector("#itemText");
const modelPath = document.querySelector("#modelPath");
const schemaPath = document.querySelector("#schemaPath");
const threshold = document.querySelector("#threshold");
const configStatus = document.querySelector("#configStatus");
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
  if (decision === "unsupported item type") {
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
}

async function initializeApp() {
  try {
    const config = await window.poeValueApp.getAppConfig();
    modelPath.value = config.defaults.modelPath;
    schemaPath.value = config.defaults.schemaPath;
    threshold.value = config.defaults.threshold;
    thresholdValue.textContent = config.defaults.threshold;

    const modelLabel = config.availability.model.exists ? "model found" : "model missing";
    const schemaLabel = config.availability.schema.exists ? "schema found" : "schema missing";
    configStatus.textContent = `Default run: ${modelLabel}, ${schemaLabel}. Python: ${config.defaults.pythonPath}`;
    configStatus.className =
      config.availability.model.exists && config.availability.schema.exists ? "notice ok" : "notice warning";

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
      modelPath: modelPath.value,
      schemaPath: schemaPath.value,
      threshold: threshold.value,
    });
    const prediction = result.prediction;
    const item = result.features.item ?? prediction.item ?? {};

    decisionBadge.textContent = prediction.decision;
    decisionBadge.className = decisionClass(prediction.decision);
    scoreValue.textContent = formatScore(prediction.score);
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
      ["Locale", item.locale],
    ]);
    renderWarnings([...(result.features.warnings ?? []), prediction.reason].filter(Boolean));
    predictionEl.textContent = JSON.stringify(result.prediction, null, 2);
    featuresEl.textContent = JSON.stringify(
      {
        item: result.features.item,
        warnings: result.features.warnings,
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
