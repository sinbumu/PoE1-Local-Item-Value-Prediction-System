#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path
from typing import Any

import pandas as pd
from catboost import CatBoostClassifier, CatBoostRegressor


REPO_ROOT = Path(__file__).resolve().parents[1]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Predict a routed desktop item value decision")
    parser.add_argument("--manifest", required=True, help="Path to desktop model_manifest.json")
    parser.add_argument("--input", default=None, help="Feature JSON file. Defaults to stdin.")
    parser.add_argument("--classifier-search-threshold", type=float, default=None)
    return parser.parse_args()


def read_input(path: str | None) -> dict[str, Any]:
    raw = Path(path).read_text(encoding="utf-8") if path else sys.stdin.read()
    return json.loads(raw)


def resolve_repo_path(value: str) -> Path:
    path = Path(value)
    return path if path.is_absolute() else REPO_ROOT / path


def build_frame(features: dict[str, Any], schema: dict[str, Any]) -> pd.DataFrame:
    feature_columns = schema.get("feature_columns")
    if not isinstance(feature_columns, list) or not feature_columns:
        raise ValueError("feature_schema.json must contain feature_columns")
    categorical_columns = set(schema.get("categorical_columns", []))
    row = {}
    for column in feature_columns:
        value = features.get(column)
        if value is None:
            row[column] = "" if column in categorical_columns else math.nan
        else:
            row[column] = str(value) if column in categorical_columns else value
    return pd.DataFrame([row], columns=feature_columns)


def infer_segment(payload: dict[str, Any]) -> str | None:
    segment = payload.get("routing", {}).get("modelSegment")
    if isinstance(segment, str) and segment:
        return segment
    item = payload.get("item", {})
    item_class = str(item.get("itemClass") or "").lower()
    rarity = str(item.get("rarity") or "").lower()
    if "jewel" in item_class:
        return "jewel"
    if rarity == "gem" or "gem" in item_class:
        return "skill_gem"
    if rarity == "unique":
        return "unique_equipment"
    if rarity == "rare":
        return "rare_equipment"
    return None


def fallback_decision(payload: dict[str, Any], decision: str, recommendation: str, reason: str) -> dict[str, Any]:
    return {
        "decision": decision,
        "score": None,
        "threshold": None,
        "supported": False,
        "recommendation": recommendation,
        "reason": reason,
        "item": payload.get("item"),
        "warnings": payload.get("warnings", []),
        "note": "Prediction skipped by desktop item routing policy.",
    }


def classify_item_policy(payload: dict[str, Any], manifest: dict[str, Any]) -> dict[str, Any] | None:
    item = payload.get("item", {})
    locale = item.get("locale")
    item_class = str(item.get("itemClass") or "")
    if locale and locale != "en":
        return fallback_decision(
            payload,
            "parse failed",
            "현재 MVP는 영문 Ctrl+C 텍스트를 우선 지원합니다.",
            "non-English clipboard text",
        )

    external_classes = [str(value).lower() for value in manifest.get("externalPriceLookupItemClasses", [])]
    if item_class.lower() in external_classes or any(token in item_class.lower() for token in ("currency", "map", "fragment", "scarab", "essence", "card")):
        return fallback_decision(
            payload,
            "external price lookup recommended",
            "이 아이템군은 거래소/닌자류 외부 가격 조회가 더 안정적입니다.",
            "item class is better handled by external price lookup",
        )
    return None


def classifier_decision(score: float, policy: dict[str, Any]) -> tuple[str, float]:
    low_max = float(policy.get("lowMaxScore", 0.50))
    manual_max = float(policy.get("manualCheckMaxScore", 0.70))
    search_max = float(policy.get("searchWorthyMaxScore", 0.88))
    if score < low_max:
        return "low listed value", low_max
    if score < manual_max:
        return "manual check", manual_max
    if score < search_max:
        return "search-worthy", manual_max
    return "high-value candidate", search_max


def regressor_decision(chaos: float, policy: dict[str, Any]) -> tuple[str, float]:
    low_max = float(policy.get("lowMaxChaos", 5))
    manual_max = float(policy.get("manualCheckMaxChaos", 30))
    high_min = float(policy.get("highValueMinChaos", 300))
    if chaos < low_max:
        return "low listed value", low_max
    if chaos < manual_max:
        return "manual check", manual_max
    if chaos < high_min:
        return "search-worthy", manual_max
    return "high-value candidate", high_min


def recommendation(decision: str, model_type: str) -> str:
    if decision == "high-value candidate":
        return "고가 후보입니다. 거래소 직접 검색으로 최종 가격대를 확인하세요."
    if decision == "search-worthy":
        return "검색 또는 판매 시도 가치가 있습니다. 회귀값은 listed price 기반 추정입니다." if model_type == "regressor" else "검색하거나 판매 시도할 가치가 있을 가능성이 높습니다."
    if decision == "manual check":
        return "자동 판단만으로 버리기 애매합니다. 주요 옵션과 거래소 가격을 한 번 확인하세요."
    return "예상 listed value가 낮습니다. 특수 빌드용 아이템이면 직접 확인하세요."


def select_features(payload: dict[str, Any], model_config: dict[str, Any]) -> dict[str, Any]:
    feature_set = model_config.get("featureSet")
    feature_sets = payload.get("featureSets", {})
    if isinstance(feature_sets, dict) and feature_set in feature_sets:
        features = feature_sets[feature_set].get("features")
        if isinstance(features, dict):
            return features
    if isinstance(payload.get("features"), dict):
        return payload["features"]
    raise ValueError(f"Feature payload does not contain feature set: {feature_set}")


def run_model(payload: dict[str, Any], manifest: dict[str, Any], model_id: str, args: argparse.Namespace) -> dict[str, Any]:
    models = manifest.get("models", {})
    model_config = models.get(model_id)
    if not isinstance(model_config, dict):
        return fallback_decision(payload, "direct search recommended", "지원 모델 라우팅을 찾지 못했습니다. 거래소 직접 검색을 권장합니다.", f"missing route model: {model_id}")

    model_path = resolve_repo_path(model_config["modelPath"])
    schema_path = resolve_repo_path(model_config["schemaPath"])
    if not model_path.exists() or not schema_path.exists():
        return fallback_decision(
            payload,
            "direct search recommended",
            "이 아이템 타입의 로컬 모델 파일이 없습니다. 거래소 직접 검색을 권장합니다.",
            f"missing model artifacts for {model_id}",
        )

    schema = json.loads(schema_path.read_text(encoding="utf-8"))
    features = select_features(payload, model_config)
    frame = build_frame(features, schema)
    model_type = model_config.get("modelType")
    policy = manifest.get("decisionPolicy", {})

    if model_type == "classifier":
        model = CatBoostClassifier()
        model.load_model(str(model_path))
        score = float(model.predict_proba(frame)[0][1])
        classifier_policy = dict(policy.get("classifier", {}))
        if args.classifier_search_threshold is not None:
            classifier_policy["manualCheckMaxScore"] = args.classifier_search_threshold
        decision, threshold = classifier_decision(score, classifier_policy)
        return {
            "decision": decision,
            "score": score,
            "threshold": threshold,
            "modelId": model_id,
            "modelType": model_type,
            "modelPath": str(model_path),
            "schemaPath": str(schema_path),
            "supported": True,
            "recommendation": recommendation(decision, model_type),
            "item": payload.get("item"),
            "warnings": payload.get("warnings", []),
            "usedFeatures": features,
            "note": "Prediction is based on listed-item value, not confirmed sale price.",
        }

    if model_type == "regressor":
        model = CatBoostRegressor()
        model.load_model(str(model_path))
        raw_prediction = float(model.predict(frame)[0])
        target_column = model_config.get("targetColumn") or schema.get("target_column", "target_price_log1p")
        chaos = math.expm1(raw_prediction) if str(target_column).endswith("log1p") else raw_prediction
        chaos = max(0.0, chaos)
        decision, threshold = regressor_decision(chaos, policy.get("regressor", {}))
        return {
            "decision": decision,
            "score": None,
            "predictedChaos": chaos,
            "threshold": threshold,
            "modelId": model_id,
            "modelType": model_type,
            "modelPath": str(model_path),
            "schemaPath": str(schema_path),
            "supported": True,
            "recommendation": recommendation(decision, model_type),
            "item": payload.get("item"),
            "warnings": payload.get("warnings", []),
            "usedFeatures": features,
            "note": "Regression predicts listed chaos-equivalent value; verify in trade search before pricing.",
        }

    raise ValueError(f"Unsupported modelType in manifest: {model_type}")


def main() -> int:
    args = parse_args()
    manifest = json.loads(Path(args.manifest).read_text(encoding="utf-8"))
    payload = read_input(args.input)

    policy_fallback = classify_item_policy(payload, manifest)
    if policy_fallback is not None:
        sys.stdout.write(f"{json.dumps(policy_fallback, ensure_ascii=False)}\n")
        return 0

    segment = infer_segment(payload)
    routes = manifest.get("routes", {})
    model_id = routes.get(segment)
    if not segment:
        result = fallback_decision(payload, "parse failed", "아이템 타입을 안정적으로 파악하지 못했습니다.", "missing model segment")
    elif not model_id:
        result = fallback_decision(payload, "direct search recommended", "지원 모델이 없는 아이템 타입입니다. 거래소 직접 검색을 권장합니다.", f"no route for segment: {segment}")
    else:
        result = run_model(payload, manifest, str(model_id), args)
        result["modelSegment"] = segment

    sys.stdout.write(f"{json.dumps(result, ensure_ascii=False)}\n")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        sys.stderr.write(f"{type(exc).__name__}: {exc}\n")
        raise SystemExit(1)
