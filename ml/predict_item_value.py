#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path
from typing import Any

import pandas as pd
from catboost import CatBoostClassifier


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Predict V2 item value decision from feature JSON")
    parser.add_argument("--model", required=True, help="Path to CatBoost .cbm model")
    parser.add_argument("--schema", required=True, help="Path to feature_schema.json")
    parser.add_argument("--input", default=None, help="Feature JSON file. Defaults to stdin.")
    parser.add_argument("--threshold", type=float, default=None)
    parser.add_argument("--high-score-threshold", type=float, default=0.85)
    return parser.parse_args()


def read_input(path: str | None) -> dict[str, Any]:
    raw = Path(path).read_text(encoding="utf-8") if path else sys.stdin.read()
    return json.loads(raw)


def normalize_feature_payload(payload: dict[str, Any]) -> dict[str, Any]:
    if isinstance(payload.get("features"), dict):
        return payload["features"]
    return payload


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


def decision_from_score(score: float, threshold: float, high_score_threshold: float) -> str:
    if score >= high_score_threshold:
        return "high-value candidate"
    if score >= threshold:
        return "search-worthy"
    return "low listed value"


def main() -> int:
    args = parse_args()
    schema = json.loads(Path(args.schema).read_text(encoding="utf-8"))
    threshold = args.threshold if args.threshold is not None else float(schema.get("threshold", 0.5))
    payload = read_input(args.input)
    features = normalize_feature_payload(payload)
    frame = build_frame(features, schema)
    model = CatBoostClassifier()
    model.load_model(args.model)
    score = float(model.predict_proba(frame)[0][1])
    decision = decision_from_score(score, threshold, args.high_score_threshold)
    output = {
        "decision": decision,
        "score": score,
        "threshold": threshold,
        "highScoreThreshold": args.high_score_threshold,
        "modelPath": str(Path(args.model).resolve()),
        "schemaPath": str(Path(args.schema).resolve()),
        "item": payload.get("item"),
        "warnings": payload.get("warnings", []),
        "usedFeatures": features,
        "note": "Prediction is based on listed-item value, not confirmed sale price.",
    }
    sys.stdout.write(f"{json.dumps(output, ensure_ascii=False)}\n")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        sys.stderr.write(f"{type(exc).__name__}: {exc}\n")
        raise SystemExit(1)
