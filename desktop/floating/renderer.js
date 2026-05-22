const card = document.querySelector("#card");
const sourceEl = document.querySelector("#source");
const decisionEl = document.querySelector("#decision");
const itemNameEl = document.querySelector("#itemName");
const valueEl = document.querySelector("#value");
const segmentEl = document.querySelector("#segment");
const recommendationEl = document.querySelector("#recommendation");
const hideButton = document.querySelector("#hideButton");

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
  card.className = decisionClass(result.decision);
  sourceEl.textContent = result.source === "auto" ? "Auto Watch" : "Manual";
  decisionEl.textContent = result.decision ?? "No decision";
  itemNameEl.textContent = [item.itemName, item.baseType].filter(Boolean).join(" / ") || "Unknown item";
  valueEl.textContent = formatValue(result);
  segmentEl.textContent = result.modelSegment ?? item.itemClass ?? "-";
  recommendationEl.textContent = result.recommendation ?? "거래소 직접 검색으로 최종 가격을 확인하세요.";
}

hideButton.addEventListener("click", () => {
  void window.poeValueApp.hideFloatingResult();
});

window.poeValueApp.onFloatingResult(render);
