#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from v2_classifier_pipeline import (
    ensure_output_dir,
    evaluate_split,
    load_v2_manifest,
    resolve_cd_path,
    resolve_split_paths,
    train_v2_classifier,
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run V1 summary vs V2 mod-aware CatBoostClassifier comparison"
    )
    parser.add_argument("--staged-manifest", required=True)
    parser.add_argument("--output-dir", default=None)
    parser.add_argument("--random-seed", type=int, default=42)
    parser.add_argument("--iterations", type=int, default=1000)
    parser.add_argument("--learning-rate", type=float, default=0.05)
    parser.add_argument("--depth", type=int, default=8)
    parser.add_argument("--thread-count", type=int, default=-1)
    parser.add_argument("--threshold", type=float, default=0.5)
    parser.add_argument(
        "--class-weights",
        default=None,
        help="Optional comma-separated CatBoost class weights, e.g. 1,2",
    )
    parser.add_argument("--min-segment-rows", type=int, default=100)
    return parser.parse_args()


def parse_class_weights(raw: str | None) -> list[float] | None:
    if not raw:
        return None
    values = [float(value.strip()) for value in raw.split(",") if value.strip()]
    if len(values) != 2:
        raise ValueError("--class-weights must contain exactly two values")
    return values


def flatten_result(result: dict[str, Any]) -> dict[str, Any]:
    return {key: value for key, value in result.items() if key != "model"}


def score_for_winner(metrics: dict[str, Any]) -> tuple[float, float, float]:
    # High recall is the first MVP priority: missing search-worthy items is worse
    # than over-flagging cheap listings for manual checking.
    return (
        float(metrics.get("recall", 0.0)),
        float(metrics.get("f1", 0.0)),
        float(metrics.get("precision", 0.0)),
    )


def decide_winner(v1_metrics: dict[str, Any], v2_metrics: dict[str, Any]) -> str:
    return "v2_mod_aware" if score_for_winner(v2_metrics) >= score_for_winner(v1_metrics) else "v1_summary"


def split_has_enough_rows(stats: dict[str, Any], min_rows: int) -> bool:
    return min(int(stats.get(name, {}).get("rowCount", 0)) for name in ("train", "valid", "test")) >= min_rows


def main() -> int:
    args = parse_args()
    class_weights = parse_class_weights(args.class_weights)
    manifest_path = Path(args.staged_manifest).resolve()
    manifest = load_v2_manifest(manifest_path)
    output_dir = ensure_output_dir(args.output_dir)
    feature_sets = ["v1_summary", "v2_mod_aware"]
    comparison_rows: list[dict[str, Any]] = []
    run_results: dict[str, Any] = {}
    skipped_segments: dict[str, Any] = {}

    for feature_set in feature_sets:
        feature_output_dir = output_dir / feature_set / "global"
        run_results[f"{feature_set}:global"] = flatten_result(
            train_v2_classifier(
                manifest_path=manifest_path,
                output_dir=feature_output_dir,
                feature_set=feature_set,
                segment=None,
                random_seed=args.random_seed,
                iterations=args.iterations,
                learning_rate=args.learning_rate,
                depth=args.depth,
                thread_count=args.thread_count,
                threshold=args.threshold,
                class_weights=class_weights,
            )
        )

    v1_global_model = run_results["v1_summary:global"]
    v2_global_model = run_results["v2_mod_aware:global"]
    comparison_rows.append(
        {
            "scope": "global",
            "segment": "",
            "v1_precision": v1_global_model["metrics"]["test"]["precision"],
            "v1_recall": v1_global_model["metrics"]["test"]["recall"],
            "v1_f1": v1_global_model["metrics"]["test"]["f1"],
            "v1_false_negative": v1_global_model["metrics"]["test"]["confusion_matrix"]["false_negative"],
            "v2_precision": v2_global_model["metrics"]["test"]["precision"],
            "v2_recall": v2_global_model["metrics"]["test"]["recall"],
            "v2_f1": v2_global_model["metrics"]["test"]["f1"],
            "v2_false_negative": v2_global_model["metrics"]["test"]["confusion_matrix"]["false_negative"],
            "winner": decide_winner(v1_global_model["metrics"]["test"], v2_global_model["metrics"]["test"]),
            "status": "trained",
        }
    )

    segment_stats = manifest.get("stats", {}).get("segments", {})
    for segment in sorted(segment_stats.keys()):
        stats = segment_stats[segment]
        if not split_has_enough_rows(stats, args.min_segment_rows):
            skipped_segments[segment] = {"reason": "insufficient_rows", "stats": stats}
            continue

        segment_metrics: dict[str, Any] = {}
        for feature_set in feature_sets:
            result = train_v2_classifier(
                manifest_path=manifest_path,
                output_dir=output_dir / feature_set / "segments" / segment,
                feature_set=feature_set,
                segment=segment,
                random_seed=args.random_seed,
                iterations=args.iterations,
                learning_rate=args.learning_rate,
                depth=args.depth,
                thread_count=args.thread_count,
                threshold=args.threshold,
                class_weights=class_weights,
            )
            run_results[f"{feature_set}:{segment}"] = flatten_result(result)
            segment_metrics[feature_set] = result["metrics"]["test"]

        comparison_rows.append(
            {
                "scope": "segment",
                "segment": segment,
                "v1_precision": segment_metrics["v1_summary"]["precision"],
                "v1_recall": segment_metrics["v1_summary"]["recall"],
                "v1_f1": segment_metrics["v1_summary"]["f1"],
                "v1_false_negative": segment_metrics["v1_summary"]["confusion_matrix"]["false_negative"],
                "v2_precision": segment_metrics["v2_mod_aware"]["precision"],
                "v2_recall": segment_metrics["v2_mod_aware"]["recall"],
                "v2_f1": segment_metrics["v2_mod_aware"]["f1"],
                "v2_false_negative": segment_metrics["v2_mod_aware"]["confusion_matrix"]["false_negative"],
                "winner": decide_winner(
                    segment_metrics["v1_summary"],
                    segment_metrics["v2_mod_aware"],
                ),
                "status": "trained",
            }
        )

    comparison_csv_path = output_dir / "v2_classifier_comparison_summary.csv"
    with comparison_csv_path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=[
                "scope",
                "segment",
                "v1_precision",
                "v1_recall",
                "v1_f1",
                "v1_false_negative",
                "v2_precision",
                "v2_recall",
                "v2_f1",
                "v2_false_negative",
                "winner",
                "status",
            ],
        )
        writer.writeheader()
        writer.writerows(comparison_rows)

    summary = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "manifest_path": str(manifest_path),
        "output_dir": str(output_dir),
        "winner_rule": {
            "primary": "higher recall",
            "tie_breakers": ["higher f1", "higher precision"],
            "reason": "MVP 앱은 search-worthy 아이템을 놓치지 않는 것을 우선한다.",
        },
        "params": {
            "iterations": args.iterations,
            "learning_rate": args.learning_rate,
            "depth": args.depth,
            "threshold": args.threshold,
            "class_weights": class_weights,
            "min_segment_rows": args.min_segment_rows,
        },
        "comparison_rows": comparison_rows,
        "runs": run_results,
        "skipped_segments": skipped_segments,
    }
    (output_dir / "v2_classifier_comparison_summary.json").write_text(
        f"{json.dumps(summary, indent=2)}\n",
        encoding="utf-8",
    )
    (output_dir / "run_info.json").write_text(
        f"{json.dumps({k: v for k, v in summary.items() if k != 'runs'}, indent=2)}\n",
        encoding="utf-8",
    )

    print(json.dumps({"output_dir": str(output_dir), "comparison_csv": str(comparison_csv_path)}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
