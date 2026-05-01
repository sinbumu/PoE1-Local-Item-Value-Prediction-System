#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import numpy as np

from v2_classifier_pipeline import (
    binary_metrics,
    load_file_pool,
    load_v2_manifest,
    read_auxiliary,
    resolve_cd_path,
    resolve_split_paths,
)
from catboost import CatBoostClassifier


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Evaluate saved V2 classifier across thresholds")
    parser.add_argument("--staged-manifest", required=True)
    parser.add_argument("--model", required=True)
    parser.add_argument("--feature-set", default="v2_mod_aware", choices=["v1_summary", "v2_mod_aware"])
    parser.add_argument("--segment", default=None)
    parser.add_argument("--split", default="test", choices=["train", "valid", "test"])
    parser.add_argument("--thresholds", default="0.30,0.35,0.40,0.45,0.50,0.55,0.60,0.65,0.70")
    parser.add_argument("--thread-count", type=int, default=-1)
    parser.add_argument("--output-dir", required=True)
    return parser.parse_args()


def parse_thresholds(raw: str) -> list[float]:
    thresholds = [float(value.strip()) for value in raw.split(",") if value.strip()]
    if not thresholds:
        raise ValueError("--thresholds must contain at least one threshold")
    for threshold in thresholds:
        if threshold <= 0 or threshold >= 1:
            raise ValueError(f"threshold must be between 0 and 1: {threshold}")
    return thresholds


def choose_recall_first(rows: list[dict[str, Any]]) -> dict[str, Any]:
    # Prefer F1 among thresholds with recall >= 0.85 if possible. Otherwise choose
    # highest recall, then F1. This matches the MVP goal of not missing valuable items.
    high_recall = [row for row in rows if float(row["recall"]) >= 0.85]
    candidates = high_recall if high_recall else rows
    return max(
        candidates,
        key=lambda row: (
            float(row["f1"]) if high_recall else float(row["recall"]),
            float(row["recall"]),
            float(row["precision"]),
        ),
    )


def choose_balanced(rows: list[dict[str, Any]]) -> dict[str, Any]:
    return max(rows, key=lambda row: (float(row["f1"]), float(row["recall"]), float(row["precision"])))


def main() -> int:
    args = parse_args()
    manifest_path = Path(args.staged_manifest).resolve()
    manifest = load_v2_manifest(manifest_path)
    split_paths = resolve_split_paths(manifest, args.feature_set, args.segment)
    cd_path = resolve_cd_path(manifest, args.feature_set)
    csv_path = split_paths[args.split]
    model = CatBoostClassifier()
    model.load_model(str(Path(args.model).resolve()))
    pool = load_file_pool(csv_path, cd_path, args.thread_count)
    probabilities = model.predict_proba(pool)[:, 1]
    y_true = np.asarray(pool.get_label(), dtype="int64")
    aux = read_auxiliary(csv_path)
    high_value_true = aux["is_high_value_candidate"].fillna(0).astype(int).to_numpy()
    rows: list[dict[str, Any]] = []

    for threshold in parse_thresholds(args.thresholds):
        metrics = binary_metrics(
            y_true,
            probabilities,
            threshold=threshold,
            high_value_true=high_value_true,
        )
        rows.append(
            {
                "threshold": threshold,
                "precision": metrics["precision"],
                "recall": metrics["recall"],
                "f1": metrics["f1"],
                "false_positive": metrics["confusion_matrix"]["false_positive"],
                "false_negative": metrics["confusion_matrix"]["false_negative"],
                "true_positive": metrics["confusion_matrix"]["true_positive"],
                "true_negative": metrics["confusion_matrix"]["true_negative"],
                "search_worthy_miss_rate": metrics["search_worthy_miss_rate"],
                "high_value_miss_rate": metrics["high_value_miss_rate"],
            }
        )

    output_dir = Path(args.output_dir).resolve()
    output_dir.mkdir(parents=True, exist_ok=True)
    csv_path_out = output_dir / "threshold_summary.csv"
    json_path_out = output_dir / "threshold_summary.json"
    with csv_path_out.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)

    summary = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "manifest_path": str(manifest_path),
        "model_path": str(Path(args.model).resolve()),
        "feature_set": args.feature_set,
        "segment": args.segment,
        "split": args.split,
        "row_count": int(len(y_true)),
        "positive_rows": int(np.sum(y_true == 1)),
        "negative_rows": int(np.sum(y_true == 0)),
        "balanced_recommendation": choose_balanced(rows),
        "recall_first_recommendation": choose_recall_first(rows),
        "rows": rows,
    }
    json_path_out.write_text(f"{json.dumps(summary, indent=2)}\n", encoding="utf-8")
    print(json.dumps({"output_dir": str(output_dir), "csv": str(csv_path_out)}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
