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
from catboost import CatBoostRegressor, Pool


def ensure_output_dir(path_arg: str | None) -> Path:
    if path_arg:
        output_dir = Path(path_arg).resolve()
    else:
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        output_dir = Path("ml/runs").resolve() / timestamp

    output_dir.mkdir(parents=True, exist_ok=True)
    return output_dir


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def load_staged_manifest(path: Path) -> dict[str, Any]:
    manifest = load_json(path)
    required_keys = [
        "featureColumns",
        "categoricalColumns",
        "columnDescriptions",
        "global",
        "segments",
        "splitSpecPath",
    ]
    missing = [key for key in required_keys if key not in manifest]
    if missing:
        raise ValueError(f"Staged manifest is missing required keys: {', '.join(missing)}")
    return manifest


def resolve_stage_entry(manifest: dict[str, Any], segment: str | None) -> dict[str, Any]:
    if segment is None:
        return manifest["global"]

    segments = manifest.get("segments", {})
    if segment not in segments:
        available = ", ".join(sorted(segments.keys()))
        raise ValueError(f"Unknown segment '{segment}'. Available: {available}")
    return segments[segment]


def resolve_cd_path(manifest: dict[str, Any], target_column: str) -> Path:
    column_descriptions = manifest.get("columnDescriptions", {})
    path = column_descriptions.get(target_column)
    if not path:
        raise ValueError(f"Missing column description for target column: {target_column}")
    return Path(path).resolve()


def resolve_split_paths(
    manifest: dict[str, Any],
    segment: str | None,
) -> dict[str, Path]:
    stage_entry = resolve_stage_entry(manifest, segment)
    csv_paths = stage_entry.get("csvPaths", {})
    missing = [split_name for split_name in ("train", "valid", "test") if split_name not in csv_paths]
    if missing:
        raise ValueError(f"Missing staged csv paths for splits: {', '.join(missing)}")

    return {split_name: Path(path).resolve() for split_name, path in csv_paths.items()}


def resolve_split_stats(
    manifest: dict[str, Any],
    segment: str | None,
) -> dict[str, Any]:
    stage_entry = resolve_stage_entry(manifest, segment)
    return stage_entry.get("stats", {})


def load_file_pool(csv_path: Path, cd_path: Path, thread_count: int) -> Pool:
    return Pool(
        data=str(csv_path),
        column_description=str(cd_path),
        delimiter=",",
        has_header=True,
        thread_count=thread_count,
    )


def read_csv_columns(csv_path: Path, columns: list[str]) -> pd.DataFrame:
    return pd.read_csv(csv_path, usecols=columns)


def to_float_array(values: Any) -> np.ndarray:
    if isinstance(values, np.ndarray):
        return values.astype("float64")
    series = pd.to_numeric(pd.Series(values), errors="coerce")
    return series.to_numpy(dtype="float64")


def rmse(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    return float(np.sqrt(np.mean(np.square(y_true - y_pred))))


def mae(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    return float(np.mean(np.abs(y_true - y_pred)))


def mape(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    denominator = np.where(np.abs(y_true) < 1e-9, 1.0, y_true)
    return float(np.mean(np.abs((y_true - y_pred) / denominator)) * 100.0)


def evaluate_predictions(
    target_column: str,
    y_true: np.ndarray,
    y_pred: np.ndarray,
    chaos_true: np.ndarray,
) -> dict[str, float]:
    metrics = {
        f"{target_column}_rmse": rmse(y_true, y_pred),
        f"{target_column}_mae": mae(y_true, y_pred),
    }

    if target_column == "target_price_log1p":
        chaos_pred = np.expm1(y_pred)
        metrics["target_price_chaos_rmse"] = rmse(chaos_true, chaos_pred)
        metrics["target_price_chaos_mae"] = mae(chaos_true, chaos_pred)
        metrics["target_price_chaos_mape"] = mape(chaos_true, chaos_pred)
    else:
        metrics["target_price_chaos_rmse"] = rmse(chaos_true, y_pred)
        metrics["target_price_chaos_mae"] = mae(chaos_true, y_pred)
        metrics["target_price_chaos_mape"] = mape(chaos_true, y_pred)

    return metrics


def max_rss_mb() -> float:
    rss = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
    if sys.platform == "darwin":
        return float(rss) / (1024.0 * 1024.0)
    return float(rss) / 1024.0


def build_model(
    random_seed: int,
    iterations: int,
    learning_rate: float,
    depth: int,
) -> CatBoostRegressor:
    return CatBoostRegressor(
        loss_function="RMSE",
        eval_metric="RMSE",
        random_seed=random_seed,
        iterations=iterations,
        learning_rate=learning_rate,
        depth=depth,
        early_stopping_rounds=100,
        verbose=100,
    )


def evaluate_staged_split(
    model: CatBoostRegressor,
    csv_path: Path,
    cd_path: Path,
    target_column: str,
    thread_count: int,
) -> dict[str, Any]:
    pool = load_file_pool(csv_path, cd_path, thread_count)
    predictions = model.predict(pool)
    y_true = to_float_array(pool.get_label())
    aux_frame = read_csv_columns(csv_path, ["target_price_chaos", "model_segment"])
    chaos_true = pd.to_numeric(aux_frame["target_price_chaos"], errors="coerce").to_numpy(dtype="float64")

    return {
        "row_count": int(len(y_true)),
        "metrics": evaluate_predictions(target_column, y_true, predictions, chaos_true),
        "model_segments": aux_frame["model_segment"].fillna("missing").astype(str).value_counts().to_dict(),
    }


def train_staged_catboost(
    *,
    manifest_path: Path,
    output_dir: Path,
    target_column: str,
    segment: str | None,
    random_seed: int,
    iterations: int,
    learning_rate: float,
    depth: int,
    thread_count: int,
) -> dict[str, Any]:
    output_dir.mkdir(parents=True, exist_ok=True)
    manifest = load_staged_manifest(manifest_path)
    split_paths = resolve_split_paths(manifest, segment)
    split_stats = resolve_split_stats(manifest, segment)
    cd_path = resolve_cd_path(manifest, target_column)
    feature_columns = manifest["featureColumns"]
    categorical_columns = manifest["categoricalColumns"]

    train_pool = load_file_pool(split_paths["train"], cd_path, thread_count)
    valid_pool = load_file_pool(split_paths["valid"], cd_path, thread_count)
    test_pool = load_file_pool(split_paths["test"], cd_path, thread_count)

    model = build_model(
        random_seed=random_seed,
        iterations=iterations,
        learning_rate=learning_rate,
        depth=depth,
    )

    fit_started_at = time.perf_counter()
    model.fit(train_pool, eval_set=valid_pool, use_best_model=True)
    fit_elapsed_seconds = time.perf_counter() - fit_started_at

    valid_predictions = model.predict(valid_pool)
    test_predictions = model.predict(test_pool)

    valid_true = to_float_array(valid_pool.get_label())
    test_true = to_float_array(test_pool.get_label())

    valid_aux = read_csv_columns(split_paths["valid"], ["target_price_chaos", "model_segment"])
    test_aux = read_csv_columns(split_paths["test"], ["target_price_chaos", "model_segment"])
    valid_chaos_true = pd.to_numeric(valid_aux["target_price_chaos"], errors="coerce").to_numpy(dtype="float64")
    test_chaos_true = pd.to_numeric(test_aux["target_price_chaos"], errors="coerce").to_numpy(dtype="float64")

    metrics = {
        "train_rows": int(train_pool.num_row()),
        "valid_rows": int(valid_pool.num_row()),
        "test_rows": int(test_pool.num_row()),
        "feature_count": int(len(feature_columns)),
        "categorical_feature_count": int(len(categorical_columns)),
        "best_iteration": int(model.get_best_iteration()),
        "fit_elapsed_seconds": fit_elapsed_seconds,
        "max_rss_mb": max_rss_mb(),
        "validation": evaluate_predictions(
            target_column,
            valid_true,
            valid_predictions,
            valid_chaos_true,
        ),
        "test": evaluate_predictions(
            target_column,
            test_true,
            test_predictions,
            test_chaos_true,
        ),
    }

    model_path = output_dir / "model.cbm"
    metrics_path = output_dir / "metrics.json"
    feature_importance_path = output_dir / "feature_importance.csv"
    run_info_path = output_dir / "run_info.json"

    model.save_model(model_path)

    feature_importance = pd.DataFrame(
        {
            "feature": feature_columns,
            "importance": model.get_feature_importance(train_pool),
        }
    ).sort_values("importance", ascending=False)
    feature_importance.to_csv(feature_importance_path, index=False)

    run_info = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "manifest_path": str(manifest_path),
        "split_spec_path": manifest["splitSpecPath"],
        "target_column": target_column,
        "segment": segment,
        "feature_columns": feature_columns,
        "categorical_columns": categorical_columns,
        "split_paths": {name: str(path) for name, path in split_paths.items()},
        "split_stats": split_stats,
        "metrics": metrics,
        "model_segments_valid": valid_aux["model_segment"].fillna("missing").astype(str).value_counts().to_dict(),
        "model_segments_test": test_aux["model_segment"].fillna("missing").astype(str).value_counts().to_dict(),
    }

    metrics_path.write_text(f"{json.dumps(metrics, indent=2)}\n", encoding="utf-8")
    run_info_path.write_text(f"{json.dumps(run_info, indent=2)}\n", encoding="utf-8")

    return {
        "model": model,
        "metrics": metrics,
        "output_dir": str(output_dir),
        "model_path": str(model_path),
        "metrics_path": str(metrics_path),
        "feature_importance_path": str(feature_importance_path),
        "run_info_path": str(run_info_path),
        "feature_columns": feature_columns,
        "categorical_columns": categorical_columns,
        "split_paths": {name: str(path) for name, path in split_paths.items()},
        "split_stats": split_stats,
        "valid_segment_counts": valid_aux["model_segment"].fillna("missing").astype(str).value_counts().to_dict(),
        "test_segment_counts": test_aux["model_segment"].fillna("missing").astype(str).value_counts().to_dict(),
    }
