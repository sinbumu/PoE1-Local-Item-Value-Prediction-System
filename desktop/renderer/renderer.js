const itemText = document.querySelector("#itemText");
const modelPath = document.querySelector("#modelPath");
const schemaPath = document.querySelector("#schemaPath");
const threshold = document.querySelector("#threshold");
const statusEl = document.querySelector("#status");
const predictionEl = document.querySelector("#prediction");
const featuresEl = document.querySelector("#features");
const readClipboardButton = document.querySelector("#readClipboard");
const analyzeButton = document.querySelector("#analyze");

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.className = isError ? "error" : "";
}

readClipboardButton.addEventListener("click", async () => {
  try {
    itemText.value = await window.poeValueApp.readClipboard();
    setStatus("Clipboard text loaded.");
  } catch (error) {
    setStatus(error.message ?? String(error), true);
  }
});

analyzeButton.addEventListener("click", async () => {
  setStatus("Running local parser and model...");
  predictionEl.textContent = "";
  featuresEl.textContent = "";
  analyzeButton.disabled = true;

  try {
    const result = await window.poeValueApp.analyzeItem({
      text: itemText.value,
      modelPath: modelPath.value,
      schemaPath: schemaPath.value,
      threshold: threshold.value,
    });
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
    setStatus(`Decision: ${result.prediction.decision} (${result.prediction.score.toFixed(4)})`);
  } catch (error) {
    setStatus(error.message ?? String(error), true);
  } finally {
    analyzeButton.disabled = false;
  }
});
