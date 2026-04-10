#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd
from catboost import CatBoostRegressor, Pool

DEFAULT_FEATURE_POLICY_PATH = (
    Path(__file__).resolve().parents[1]
    / "src"
    / "config"
    / "clipboard-safe-feature-policy.json"
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Train first CatBoost regressor from labeled CSV")
    parser.add_argument("--dataset", required=True, help="Path to exported labeled CSV")
    parser.add_argument(
        "--output-dir",
        default=None,
        help="Directory to save model, metrics, and feature importance",
    )
    parser.add_argument(
        "--target-column",
        default="target_price_log1p",
        choices=["target_price_log1p", "target_price_chaos"],
        help="Regression target column",
    )
    parser.add_argument("--train-ratio", type=float, default=0.8)
    parser.add_argument("--valid-ratio", type=float, default=0.1)
    parser.add_argument("--random-seed", type=int, default=42)
    parser.add_argument("--iterations", type=int, default=2000)
    parser.add_argument("--learning-rate", type=float, default=0.05)
    parser.add_argument("--depth", type=int, default=8)
    parser.add_argument(
        "--feature-policy",
        default=str(DEFAULT_FEATURE_POLICY_PATH),
        help="Path to clipboard-safe feature policy JSON",
    )
    return parser.parse_args()


def ensure_output_dir(path_arg: str | None) -> Path:
    if path_arg:
        output_dir = Path(path_arg).resolve()
    else:
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        output_dir = Path("ml/runs").resolve() / timestamp

    output_dir.mkdir(parents=True, exist_ok=True)
    return output_dir


def validate_split_ratios(train_ratio: float, valid_ratio: float) -> None:
    if not (0 < train_ratio < 1):
        raise ValueError("--train-ratio must be between 0 and 1")
    if not (0 < valid_ratio < 1):
        raise ValueError("--valid-ratio must be between 0 and 1")
    if train_ratio + valid_ratio >= 1:
        raise ValueError("train_ratio + valid_ratio must be less than 1")


def load_feature_policy(policy_path: Path) -> dict[str, object]:
    feature_policy = json.loads(policy_path.read_text(encoding="utf-8"))
    required_keys = [
        "policyName",
        "version",
        "activeFeatureColumns",
        "derivedFeatureColumns",
        "categoricalColumns",
        "booleanColumns",
    ]

    missing_keys = [key for key in required_keys if key not in feature_policy]
    if missing_keys:
        raise ValueError(
            f"Feature policy is missing required keys: {', '.join(missing_keys)}"
        )

    return feature_policy


def load_dataset(dataset_path: Path, feature_policy: dict[str, object]) -> pd.DataFrame:
    dataframe = pd.read_csv(dataset_path)
    if dataframe.empty:
        raise ValueError("Dataset is empty")

    dataframe["source_updated_at"] = pd.to_datetime(
        dataframe["source_updated_at"],
        utc=True,
        errors="coerce",
    )
    dataframe = dataframe.dropna(subset=["source_updated_at"]).sort_values("source_updated_at")
    dataframe = dataframe.reset_index(drop=True)

    dataframe["observed_hour_utc"] = dataframe["source_updated_at"].dt.hour
    dataframe["observed_weekday_utc"] = dataframe["source_updated_at"].dt.weekday

    boolean_columns = feature_policy["booleanColumns"]
    categorical_columns = feature_policy["categoricalColumns"]

    for column in boolean_columns:
        if column in dataframe.columns:
            dataframe[column] = (
                dataframe[column]
                .replace({"true": 1, "false": 0, True: 1, False: 0})
                .astype("float64")
            )

    for column in categorical_columns:
        if column in dataframe.columns:
            dataframe[column] = dataframe[column].fillna("missing").astype(str)

    return dataframe


def build_feature_frame(
    dataframe: pd.DataFrame,
    feature_policy: dict[str, object],
) -> tuple[pd.DataFrame, list[str], list[str]]:
    dataset_feature_columns = feature_policy["activeFeatureColumns"]
    derived_feature_columns = feature_policy["derivedFeatureColumns"]
    categorical_policy_columns = feature_policy["categoricalColumns"]

    missing_feature_columns = [
        column for column in dataset_feature_columns if column not in dataframe.columns
    ]
    if missing_feature_columns:
        raise ValueError(
            "Dataset is missing clipboard-safe feature columns: "
            + ", ".join(missing_feature_columns)
        )

    feature_columns = [*dataset_feature_columns, *derived_feature_columns]
    categorical_columns = [
        column for column in categorical_policy_columns if column in feature_columns
    ]

    feature_frame = dataframe[feature_columns].copy()
    for column in feature_columns:
        if column in categorical_columns:
            feature_frame[column] = feature_frame[column].fillna("missing").astype(str)
        else:
            feature_frame[column] = pd.to_numeric(feature_frame[column], errors="coerce")

    return feature_frame, categorical_columns, missing_feature_columns


def split_time_ordered(
    dataframe: pd.DataFrame,
    train_ratio: float,
    valid_ratio: float,
) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    row_count = len(dataframe)
    if row_count < 100:
        raise ValueError("At least 100 rows are recommended before training")

    train_end = int(row_count * train_ratio)
    valid_end = train_end + int(row_count * valid_ratio)

    train_end = max(train_end, 1)
    valid_end = max(valid_end, train_end + 1)
    valid_end = min(valid_end, row_count - 1)

    train_df = dataframe.iloc[:train_end].copy()
    valid_df = dataframe.iloc[train_end:valid_end].copy()
    test_df = dataframe.iloc[valid_end:].copy()

    if train_df.empty or valid_df.empty or test_df.empty:
        raise ValueError("Train/valid/test split resulted in an empty partition")

    return train_df, valid_df, test_df


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


def main() -> int:
    args = parse_args()
    validate_split_ratios(args.train_ratio, args.valid_ratio)

    dataset_path = Path(args.dataset).resolve()
    output_dir = ensure_output_dir(args.output_dir)
    feature_policy_path = Path(args.feature_policy).resolve()
    feature_policy = load_feature_policy(feature_policy_path)

    dataframe = load_dataset(dataset_path, feature_policy)
    train_df, valid_df, test_df = split_time_ordered(
        dataframe,
        args.train_ratio,
        args.valid_ratio,
    )

    feature_frame, categorical_columns, missing_feature_columns = build_feature_frame(
        dataframe,
        feature_policy,
    )
    train_x = feature_frame.loc[train_df.index]
    valid_x = feature_frame.loc[valid_df.index]
    test_x = feature_frame.loc[test_df.index]

    train_y = pd.to_numeric(train_df[args.target_column], errors="coerce")
    valid_y = pd.to_numeric(valid_df[args.target_column], errors="coerce")
    test_y = pd.to_numeric(test_df[args.target_column], errors="coerce")

    train_pool = Pool(train_x, label=train_y, cat_features=categorical_columns)
    valid_pool = Pool(valid_x, label=valid_y, cat_features=categorical_columns)
    test_pool = Pool(test_x, label=test_y, cat_features=categorical_columns)

    model = CatBoostRegressor(
        loss_function="RMSE",
        eval_metric="RMSE",
        random_seed=args.random_seed,
        iterations=args.iterations,
        learning_rate=args.learning_rate,
        depth=args.depth,
        early_stopping_rounds=100,
        verbose=100,
    )

    model.fit(train_pool, eval_set=valid_pool, use_best_model=True)

    valid_predictions = model.predict(valid_pool)
    test_predictions = model.predict(test_pool)

    valid_chaos_true = pd.to_numeric(valid_df["target_price_chaos"], errors="coerce").to_numpy()
    test_chaos_true = pd.to_numeric(test_df["target_price_chaos"], errors="coerce").to_numpy()

    metrics = {
        "train_rows": int(len(train_df)),
        "valid_rows": int(len(valid_df)),
        "test_rows": int(len(test_df)),
        "feature_count": int(train_x.shape[1]),
        "categorical_feature_count": int(len(categorical_columns)),
        "best_iteration": int(model.get_best_iteration()),
        "validation": evaluate_predictions(
            args.target_column,
            valid_y.to_numpy(),
            valid_predictions,
            valid_chaos_true,
        ),
        "test": evaluate_predictions(
            args.target_column,
            test_y.to_numpy(),
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
            "feature": train_x.columns,
            "importance": model.get_feature_importance(train_pool),
        }
    ).sort_values("importance", ascending=False)
    feature_importance.to_csv(feature_importance_path, index=False)

    run_info = {
      "generated_at": datetime.now(timezone.utc).isoformat(),
      "dataset_path": str(dataset_path),
      "feature_policy_path": str(feature_policy_path),
      "feature_policy_name": feature_policy["policyName"],
      "feature_policy_version": feature_policy["version"],
      "target_column": args.target_column,
      "feature_columns": train_x.columns.tolist(),
      "categorical_columns": categorical_columns,
      "missing_feature_columns": missing_feature_columns,
      "metrics": metrics,
      "split": {
          "train_ratio": args.train_ratio,
          "valid_ratio": args.valid_ratio,
          "test_ratio": 1.0 - args.train_ratio - args.valid_ratio,
          "train_range": [
              train_df["source_updated_at"].min().isoformat(),
              train_df["source_updated_at"].max().isoformat(),
          ],
          "valid_range": [
              valid_df["source_updated_at"].min().isoformat(),
              valid_df["source_updated_at"].max().isoformat(),
          ],
          "test_range": [
              test_df["source_updated_at"].min().isoformat(),
              test_df["source_updated_at"].max().isoformat(),
          ],
      },
    }

    metrics_path.write_text(f"{json.dumps(metrics, indent=2)}\n", encoding="utf-8")
    run_info_path.write_text(f"{json.dumps(run_info, indent=2)}\n", encoding="utf-8")

    print("training completed")
    print(f"model: {model_path}")
    print(f"metrics: {metrics_path}")
    print(f"feature importance: {feature_importance_path}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
