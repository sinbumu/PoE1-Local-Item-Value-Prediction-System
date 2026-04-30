from __future__ import annotations

import json
import resource
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from catboost import CatBoostClassifier, Pool


def ensure_output_dir(path_arg: str | None) -> Path:
    if path_arg:
        output_dir = Path(path_arg).resolve()
    else:
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        output_dir = Path("ml/runs").resolve() / f"v2_classifier_{timestamp}"
    output_dir.mkdir(parents=True, exist_ok=True)
    return output_dir


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def load_v2_manifest(path: Path) -> dict[str, Any]:
    manifest = load_json(path)
    required = ["featureSets", "stats", "targetColumn", "splitSpecPath"]
    missing = [key for key in required if key not in manifest]
    if missing:
        raise ValueError(f"V2 staged manifest is missing required keys: {', '.join(missing)}")
    return manifest


def resolve_feature_set(manifest: dict[str, Any], feature_set: str) -> dict[str, Any]:
    feature_sets = manifest.get("featureSets", {})
    if feature_set not in feature_sets:
        available = ", ".join(sorted(feature_sets.keys()))
        raise ValueError(f"Unknown feature set '{feature_set}'. Available: {available}")
    return feature_sets[feature_set]


def resolve_stage_entry(feature_set_entry: dict[str, Any], segment: str | None) -> dict[str, Any]:
    if segment is None:
        return feature_set_entry["global"]
    segments = feature_set_entry.get("segments", {})
    if segment not in segments:
        available = ", ".join(sorted(segments.keys()))
        raise ValueError(f"Unknown segment '{segment}'. Available: {available}")
    return segments[segment]


def resolve_split_paths(
    manifest: dict[str, Any],
    feature_set: str,
    segment: str | None,
) -> dict[str, Path]:
    feature_set_entry = resolve_feature_set(manifest, feature_set)
    stage_entry = resolve_stage_entry(feature_set_entry, segment)
    csv_paths = stage_entry.get("csvPaths", {})
    missing = [name for name in ("train", "valid", "test") if name not in csv_paths]
    if missing:
        raise ValueError(f"Missing split csv paths: {', '.join(missing)}")
    return {name: Path(path).resolve() for name, path in csv_paths.items()}


def resolve_cd_path(manifest: dict[str, Any], feature_set: str) -> Path:
    entry = resolve_feature_set(manifest, feature_set)
    path = entry.get("columnDescriptionPath")
    if not path:
        raise ValueError(f"Missing columnDescriptionPath for feature set: {feature_set}")
    return Path(path).resolve()


def load_file_pool(csv_path: Path, cd_path: Path, thread_count: int) -> Pool:
    return Pool(
        data=str(csv_path),
        column_description=str(cd_path),
        delimiter=",",
        has_header=True,
        thread_count=thread_count,
    )


def max_rss_mb() -> float:
    rss = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
    if sys.platform == "darwin":
        return float(rss) / (1024.0 * 1024.0)
    return float(rss) / 1024.0


def build_classifier(
    *,
    random_seed: int,
    iterations: int,
    learning_rate: float,
    depth: int,
    class_weights: list[float] | None,
) -> CatBoostClassifier:
    return CatBoostClassifier(
        loss_function="Logloss",
        eval_metric="F1",
        random_seed=random_seed,
        iterations=iterations,
        learning_rate=learning_rate,
        depth=depth,
        class_weights=class_weights,
        early_stopping_rounds=100,
        verbose=100,
    )


def read_auxiliary(csv_path: Path) -> pd.DataFrame:
    return pd.read_csv(
        csv_path,
        usecols=["is_search_worthy", "target_price_chaos", "is_high_value_candidate", "model_segment"],
    )


def binary_metrics(
    y_true: np.ndarray,
    score: np.ndarray,
    *,
    threshold: float,
    high_value_true: np.ndarray | None,
) -> dict[str, Any]:
    pred = (score >= threshold).astype(int)
    tp = int(np.sum((pred == 1) & (y_true == 1)))
    fp = int(np.sum((pred == 1) & (y_true == 0)))
    tn = int(np.sum((pred == 0) & (y_true == 0)))
    fn = int(np.sum((pred == 0) & (y_true == 1)))
    precision = tp / (tp + fp) if tp + fp > 0 else 0.0
    recall = tp / (tp + fn) if tp + fn > 0 else 0.0
    f1 = 2 * precision * recall / (precision + recall) if precision + recall > 0 else 0.0
    high_value_miss_rate = None
    if high_value_true is not None:
        high_mask = high_value_true == 1
        high_total = int(np.sum(high_mask))
        high_missed = int(np.sum((pred == 0) & high_mask))
        high_value_miss_rate = high_missed / high_total if high_total > 0 else None

    return {
        "row_count": int(len(y_true)),
        "positive_rows": int(np.sum(y_true == 1)),
        "negative_rows": int(np.sum(y_true == 0)),
        "threshold": threshold,
        "precision": precision,
        "recall": recall,
        "f1": f1,
        "search_worthy_miss_rate": fn / (tp + fn) if tp + fn > 0 else 0.0,
        "valuable_as_low_rate": fn / len(y_true) if len(y_true) > 0 else 0.0,
        "high_value_miss_rate": high_value_miss_rate,
        "confusion_matrix": {
            "true_positive": tp,
            "false_positive": fp,
            "true_negative": tn,
            "false_negative": fn,
        },
    }


def evaluate_split(
    model: CatBoostClassifier,
    csv_path: Path,
    cd_path: Path,
    *,
    thread_count: int,
    threshold: float,
) -> dict[str, Any]:
    pool = load_file_pool(csv_path, cd_path, thread_count)
    probabilities = model.predict_proba(pool)[:, 1]
    y_true = np.asarray(pool.get_label(), dtype="int64")
    aux = read_auxiliary(csv_path)
    high_value_true = aux["is_high_value_candidate"].fillna(0).astype(int).to_numpy()
    metrics = binary_metrics(
        y_true,
        probabilities,
        threshold=threshold,
        high_value_true=high_value_true,
    )
    metrics["mean_score"] = float(np.mean(probabilities)) if len(probabilities) > 0 else 0.0
    metrics["model_segments"] = aux["model_segment"].fillna("missing").astype(str).value_counts().to_dict()
    return metrics


def train_v2_classifier(
    *,
    manifest_path: Path,
    output_dir: Path,
    feature_set: str,
    segment: str | None,
    random_seed: int,
    iterations: int,
    learning_rate: float,
    depth: int,
    thread_count: int,
    threshold: float,
    class_weights: list[float] | None,
) -> dict[str, Any]:
    output_dir.mkdir(parents=True, exist_ok=True)
    manifest = load_v2_manifest(manifest_path)
    cd_path = resolve_cd_path(manifest, feature_set)
    split_paths = resolve_split_paths(manifest, feature_set, segment)
    feature_set_entry = resolve_feature_set(manifest, feature_set)
    feature_columns = feature_set_entry.get("featureColumns", [])
    categorical_columns = feature_set_entry.get("categoricalColumns", [])

    train_pool = load_file_pool(split_paths["train"], cd_path, thread_count)
    valid_pool = load_file_pool(split_paths["valid"], cd_path, thread_count)
    test_pool = load_file_pool(split_paths["test"], cd_path, thread_count)
    model = build_classifier(
        random_seed=random_seed,
        iterations=iterations,
        learning_rate=learning_rate,
        depth=depth,
        class_weights=class_weights,
    )
    started_at = time.time()
    model.fit(train_pool, eval_set=valid_pool, use_best_model=True)
    elapsed_seconds = time.time() - started_at

    metrics = {
        "train": evaluate_split(model, split_paths["train"], cd_path, thread_count=thread_count, threshold=threshold),
        "valid": evaluate_split(model, split_paths["valid"], cd_path, thread_count=thread_count, threshold=threshold),
        "test": evaluate_split(model, split_paths["test"], cd_path, thread_count=thread_count, threshold=threshold),
    }
    model_path = output_dir / "model.cbm"
    schema_path = output_dir / "feature_schema.json"
    run_info_path = output_dir / "run_info.json"
    importance_path = output_dir / "feature_importance.csv"

    model.save_model(str(model_path))
    schema = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "feature_set": feature_set,
        "segment": segment,
        "target_column": "is_search_worthy",
        "feature_columns": feature_columns,
        "categorical_columns": categorical_columns,
        "threshold": threshold,
        "search_worthy_threshold_chaos": manifest.get("searchWorthyThresholdChaos"),
        "high_value_threshold_chaos": manifest.get("highValueThresholdChaos"),
    }
    schema_path.write_text(f"{json.dumps(schema, indent=2)}\n", encoding="utf-8")

    feature_importance = model.get_feature_importance(train_pool)
    with importance_path.open("w", encoding="utf-8") as handle:
        handle.write("feature,importance\n")
        for feature, importance in sorted(
            zip(feature_columns, feature_importance, strict=False),
            key=lambda pair: pair[1],
            reverse=True,
        ):
            handle.write(f"{feature},{float(importance)}\n")

    run_info = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "manifest_path": str(manifest_path),
        "feature_set": feature_set,
        "segment": segment,
        "model_path": str(model_path),
        "feature_schema_path": str(schema_path),
        "metrics": metrics,
        "elapsed_seconds": elapsed_seconds,
        "max_rss_mb": max_rss_mb(),
        "params": {
            "random_seed": random_seed,
            "iterations": iterations,
            "learning_rate": learning_rate,
            "depth": depth,
            "thread_count": thread_count,
            "threshold": threshold,
            "class_weights": class_weights,
        },
    }
    run_info_path.write_text(f"{json.dumps(run_info, indent=2)}\n", encoding="utf-8")
    return {
        **run_info,
        "model": model,
    }
