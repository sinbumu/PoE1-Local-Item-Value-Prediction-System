const card = document.querySelector("#card");
const sourceEl = document.querySelector("#source");
const decisionEl = document.querySelector("#decision");
const itemNameEl = document.querySelector("#itemName");
const valueEl = document.querySelector("#value");
const segmentEl = document.querySelector("#segment");
const recommendationEl = document.querySelector("#recommendation");
const hideButton = document.querySelector("#hideButton");
const settingsButton = document.querySelector("#settingsButton");
const controls = document.querySelector("#controls");
const displayMode = document.querySelector("#displayMode");
const opacitySlider = document.querySelector("#opacitySlider");
const opacityValue = document.querySelector("#opacityValue");
const resetPosition = document.querySelector("#resetPosition");
let preferences = {
  displayMode: "autoHide",
  opacity: 0.95,
};

function decisionClass(decision) {
  if (decision === "high-value candidate") {
    return "card high";
  }
  if (decision === "search-worthy") {
    return "card search";
  }
  if (decision === "low listed value") {
    return "card low";
  }
  if (decision === "manual check") {
    return "card manual";
  }
  if (decision === "direct search recommended" || decision === "external price lookup recommended" || decision === "parse failed") {
    return "card unsupported";
  }
  return "card neutral";
}

function formatValue(result) {
  if (typeof result.predictedChaos === "number") {
    return `${result.predictedChaos.toFixed(1)} chaos`;
  }
  if (typeof result.score === "number") {
    return `score ${result.score.toFixed(3)}`;
  }
  return "no model score";
}

function render(result) {
  const item = result.item ?? {};
  if (result.preferences) {
    renderPreferences(result.preferences);
  }
  card.className = decisionClass(result.decision);
  sourceEl.textContent = result.source === "auto" ? "Auto Watch" : "Manual";
  decisionEl.textContent = result.decision ?? "No decision";
  itemNameEl.textContent = [item.itemName, item.baseType].filter(Boolean).join(" / ") || "Unknown item";
  valueEl.textContent = formatValue(result);
  segmentEl.textContent = result.modelSegment ?? item.itemClass ?? "-";
  recommendationEl.textContent = result.recommendation ?? "거래소 직접 검색으로 최종 가격을 확인하세요.";
}

function renderPreferences(nextPreferences) {
  preferences = {
    displayMode: nextPreferences?.displayMode === "keepVisible" ? "keepVisible" : "autoHide",
    opacity: typeof nextPreferences?.opacity === "number" ? nextPreferences.opacity : 0.95,
  };
  displayMode.value = preferences.displayMode;
  opacitySlider.value = String(Math.round(preferences.opacity * 100));
  opacityValue.textContent = `${opacitySlider.value}%`;
}

async function syncPreferences() {
  const saved = await window.poeValueApp.setFloatingPreferences({
    displayMode: displayMode.value,
    opacity: Number(opacitySlider.value) / 100,
  });
  renderPreferences(saved);
}

hideButton.addEventListener("click", () => {
  void window.poeValueApp.hideFloatingResult();
});

settingsButton.addEventListener("click", () => {
  controls.classList.toggle("collapsed");
});

displayMode.addEventListener("change", () => {
  void syncPreferences();
});

opacitySlider.addEventListener("input", () => {
  opacityValue.textContent = `${opacitySlider.value}%`;
  void syncPreferences();
});

resetPosition.addEventListener("click", () => {
  void window.poeValueApp.resetFloatingPosition();
});

window.poeValueApp.onFloatingResult(render);
window.poeValueApp.onFloatingPreferences(renderPreferences);

window.poeValueApp.getFloatingPreferences().then(renderPreferences).catch(() => {
  renderPreferences(preferences);
});
