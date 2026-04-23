#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from training_pipeline import (
    ensure_output_dir,
    evaluate_staged_split,
    load_staged_manifest,
    resolve_cd_path,
    resolve_split_paths,
    resolve_split_stats,
    train_staged_catboost,
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run global vs segment CatBoost comparison from a staged manifest"
    )
    parser.add_argument(
        "--staged-manifest",
        required=True,
        help="Path to staged manifest.json produced by stage-training-dataset.ts",
    )
    parser.add_argument(
        "--output-dir",
        default=None,
        help="Directory to save comparison run outputs",
    )
    parser.add_argument(
        "--target-column",
        default="target_price_log1p",
        choices=["target_price_log1p", "target_price_chaos"],
        help="Regression target column",
    )
    parser.add_argument("--random-seed", type=int, default=42)
    parser.add_argument("--iterations", type=int, default=2000)
    parser.add_argument("--learning-rate", type=float, default=0.05)
    parser.add_argument("--depth", type=int, default=8)
    parser.add_argument("--thread-count", type=int, default=-1)
    parser.add_argument(
        "--min-segment-rows",
        type=int,
        default=100,
        help="Skip segment model training when any split has fewer than this many rows",
    )
    return parser.parse_args()


def flatten_run_result(result: dict[str, Any]) -> dict[str, Any]:
    return {key: value for key, value in result.items() if key != "model"}


def decide_winner(
    global_metrics: dict[str, float],
    segment_metrics: dict[str, float],
    primary_target_column: str,
) -> str:
    primary_rmse_key = f"{primary_target_column}_rmse"
    primary_mae_key = f"{primary_target_column}_mae"

    if segment_metrics[primary_rmse_key] < global_metrics[primary_rmse_key]:
        return "segment"
    if segment_metrics[primary_rmse_key] > global_metrics[primary_rmse_key]:
        return "global"

    if segment_metrics[primary_mae_key] < global_metrics[primary_mae_key]:
        return "segment"
    if segment_metrics[primary_mae_key] > global_metrics[primary_mae_key]:
        return "global"

    if segment_metrics["target_price_chaos_rmse"] < global_metrics["target_price_chaos_rmse"]:
        return "segment"
    return "global"


def main() -> int:
    args = parse_args()
    manifest_path = Path(args.staged_manifest).resolve()
    manifest = load_staged_manifest(manifest_path)
    output_dir = ensure_output_dir(args.output_dir)
    comparison_csv_path = output_dir / "comparison_summary.csv"
    comparison_json_path = output_dir / "comparison_summary.json"
    run_info_path = output_dir / "run_info.json"

    global_output_dir = output_dir / "global"
    global_result = train_staged_catboost(
        manifest_path=manifest_path,
        output_dir=global_output_dir,
        target_column=args.target_column,
        segment=None,
        random_seed=args.random_seed,
        iterations=args.iterations,
        learning_rate=args.learning_rate,
        depth=args.depth,
        thread_count=args.thread_count,
    )
    global_model = global_result["model"]
    cd_path = resolve_cd_path(manifest, args.target_column)

    segment_names = sorted(manifest.get("segments", {}).keys())
    comparison_rows: list[dict[str, Any]] = []
    segment_runs: dict[str, Any] = {}
    skipped_segments: dict[str, Any] = {}

    for segment in segment_names:
        split_stats = resolve_split_stats(manifest, segment)
        split_paths = resolve_split_paths(manifest, segment)
        train_rows = int(split_stats.get("train", {}).get("rowCount", 0))
        valid_rows = int(split_stats.get("valid", {}).get("rowCount", 0))
        test_rows = int(split_stats.get("test", {}).get("rowCount", 0))

        global_segment_test = evaluate_staged_split(
            global_model,
            split_paths["test"],
            cd_path,
            args.target_column,
            args.thread_count,
        )

        if min(train_rows, valid_rows, test_rows) < args.min_segment_rows:
            skipped_segments[segment] = {
                "reason": "insufficient_rows",
                "train_rows": train_rows,
                "valid_rows": valid_rows,
                "test_rows": test_rows,
                "global_test_metrics": global_segment_test["metrics"],
            }
            comparison_rows.append(
                {
                    "segment": segment,
                    "train_rows": train_rows,
                    "valid_rows": valid_rows,
                    "test_rows": test_rows,
                    "global_target_rmse": global_segment_test["metrics"][f"{args.target_column}_rmse"],
                    "global_target_mae": global_segment_test["metrics"][f"{args.target_column}_mae"],
                    "global_chaos_rmse": global_segment_test["metrics"]["target_price_chaos_rmse"],
                    "global_chaos_mae": global_segment_test["metrics"]["target_price_chaos_mae"],
                    "global_chaos_mape": global_segment_test["metrics"]["target_price_chaos_mape"],
                    "segment_target_rmse": "",
                    "segment_target_mae": "",
                    "segment_chaos_rmse": "",
                    "segment_chaos_mae": "",
                    "segment_chaos_mape": "",
                    "winner": "global",
                    "status": "skipped",
                }
            )
            continue

        segment_output_dir = output_dir / "segments" / segment
        segment_result = train_staged_catboost(
            manifest_path=manifest_path,
            output_dir=segment_output_dir,
            target_column=args.target_column,
            segment=segment,
            random_seed=args.random_seed,
            iterations=args.iterations,
            learning_rate=args.learning_rate,
            depth=args.depth,
            thread_count=args.thread_count,
        )
        segment_runs[segment] = {
            "global_test": global_segment_test,
            "segment_model": flatten_run_result(segment_result),
            "winner": decide_winner(
                global_segment_test["metrics"],
                segment_result["metrics"]["test"],
                args.target_column,
            ),
        }

        comparison_rows.append(
            {
                "segment": segment,
                "train_rows": train_rows,
                "valid_rows": valid_rows,
                "test_rows": test_rows,
                "global_target_rmse": global_segment_test["metrics"][f"{args.target_column}_rmse"],
                "global_target_mae": global_segment_test["metrics"][f"{args.target_column}_mae"],
                "global_chaos_rmse": global_segment_test["metrics"]["target_price_chaos_rmse"],
                "global_chaos_mae": global_segment_test["metrics"]["target_price_chaos_mae"],
                "global_chaos_mape": global_segment_test["metrics"]["target_price_chaos_mape"],
                "segment_target_rmse": segment_result["metrics"]["test"][f"{args.target_column}_rmse"],
                "segment_target_mae": segment_result["metrics"]["test"][f"{args.target_column}_mae"],
                "segment_chaos_rmse": segment_result["metrics"]["test"]["target_price_chaos_rmse"],
                "segment_chaos_mae": segment_result["metrics"]["test"]["target_price_chaos_mae"],
                "segment_chaos_mape": segment_result["metrics"]["test"]["target_price_chaos_mape"],
                "winner": decide_winner(
                    global_segment_test["metrics"],
                    segment_result["metrics"]["test"],
                    args.target_column,
                ),
                "status": "trained",
            }
        )

    with comparison_csv_path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=[
                "segment",
                "train_rows",
                "valid_rows",
                "test_rows",
                "global_target_rmse",
                "global_target_mae",
                "global_chaos_rmse",
                "global_chaos_mae",
                "global_chaos_mape",
                "segment_target_rmse",
                "segment_target_mae",
                "segment_chaos_rmse",
                "segment_chaos_mae",
                "segment_chaos_mape",
                "winner",
                "status",
            ],
        )
        writer.writeheader()
        writer.writerows(comparison_rows)

    comparison_summary = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "manifest_path": str(manifest_path),
        "target_column": args.target_column,
        "winner_rule": {
            "primary_metric": f"{args.target_column}_rmse",
            "tie_breakers": [
                f"{args.target_column}_mae",
                "target_price_chaos_rmse",
            ],
        },
        "global": flatten_run_result(global_result),
        "segments": segment_runs,
        "skipped_segments": skipped_segments,
        "comparison_rows": comparison_rows,
    }
    comparison_json_path.write_text(
        f"{json.dumps(comparison_summary, indent=2)}\n",
        encoding="utf-8",
    )

    run_info = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "manifest_path": str(manifest_path),
        "output_dir": str(output_dir),
        "target_column": args.target_column,
        "winner_primary_metric": f"{args.target_column}_rmse",
        "segment_count": len(segment_names),
        "trained_segment_count": len(segment_runs),
        "skipped_segment_count": len(skipped_segments),
        "global_run_dir": str(global_output_dir),
        "comparison_csv_path": str(comparison_csv_path),
        "comparison_json_path": str(comparison_json_path),
    }
    run_info_path.write_text(f"{json.dumps(run_info, indent=2)}\n", encoding="utf-8")

    print("comparison completed")
    print(f"global run: {global_output_dir}")
    print(f"comparison csv: {comparison_csv_path}")
    print(f"comparison json: {comparison_json_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
