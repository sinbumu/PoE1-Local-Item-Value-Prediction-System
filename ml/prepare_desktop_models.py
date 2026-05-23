#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


REPO_ROOT = Path(__file__).resolve().parents[1]
DESKTOP_MODEL_DIR = REPO_ROOT / "desktop" / "models" / "v2_mvp"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Stage/train/copy the model bundle used by the Electron desktop MVP."
    )
    parser.add_argument("--days", type=int, default=7)
    parser.add_argument("--iterations", type=int, default=1000)
    parser.add_argument("--depth", type=int, default=8)
    parser.add_argument("--learning-rate", type=float, default=0.05)
    parser.add_argument("--thread-count", type=int, default=-1)
    parser.add_argument("--skip-staging", action="store_true")
    parser.add_argument("--skip-training", action="store_true")
    parser.add_argument("--v2-staging-dir", default="artifacts/v2-mod-aware-staging/desktop_latest")
    parser.add_argument("--v1-staging-dir", default="artifacts/training-staging/desktop_v1_segments_latest")
    parser.add_argument("--v2-run-dir", default="ml/runs/desktop_v2_classifier_latest")
    parser.add_argument("--jewel-run-dir", default="ml/runs/desktop_jewel_regressor_latest")
    parser.add_argument("--skill-gem-run-dir", default="ml/runs/desktop_skill_gem_regressor_latest")
    return parser.parse_args()


def run(command: list[str]) -> None:
    print(f"==> {' '.join(command)}", flush=True)
    subprocess.run(command, cwd=REPO_ROOT, check=True)


def python_executable() -> str:
    if sys.executable:
        return sys.executable
    venv_python = REPO_ROOT / "ml" / ".venv" / ("Scripts/python.exe" if sys.platform == "win32" else "bin/python")
    return str(venv_python) if venv_python.exists() else "python"


def npm_executable() -> str:
    return "npm.cmd" if sys.platform == "win32" else "npm"


def copy_required(src_dir: Path, dst_dir: Path, *, schema_from_run_info: bool = False) -> dict[str, str]:
    dst_dir.mkdir(parents=True, exist_ok=True)
    copied: dict[str, str] = {}
    for name in ("model.cbm", "run_info.json", "feature_importance.csv"):
        src = src_dir / name
        if src.exists():
            dst = dst_dir / name
            shutil.copy2(src, dst)
            copied[name] = str(dst.relative_to(REPO_ROOT))

    schema_src = src_dir / "feature_schema.json"
    if schema_src.exists():
        dst = dst_dir / "feature_schema.json"
        shutil.copy2(schema_src, dst)
        copied["feature_schema.json"] = str(dst.relative_to(REPO_ROOT))
    elif schema_from_run_info:
        run_info = json.loads((src_dir / "run_info.json").read_text(encoding="utf-8"))
        schema = {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "model_type": "regressor",
            "target_column": run_info.get("target_column", "target_price_log1p"),
            "segment": run_info.get("segment"),
            "feature_columns": run_info["feature_columns"],
            "categorical_columns": run_info["categorical_columns"],
        }
        dst = dst_dir / "feature_schema.json"
        dst.write_text(f"{json.dumps(schema, indent=2)}\n", encoding="utf-8")
        copied["feature_schema.json"] = str(dst.relative_to(REPO_ROOT))

    required = {"model.cbm", "feature_schema.json", "run_info.json"}
    missing = sorted(required - set(copied))
    if missing:
        raise FileNotFoundError(f"Missing required model artifacts in {src_dir}: {', '.join(missing)}")
    return copied


def build_manifest(args: argparse.Namespace) -> dict[str, Any]:
    return {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "version": 1,
        "description": "Electron desktop MVP model routing manifest.",
        "decisionPolicy": {
            "classifier": {
                "lowMaxScore": 0.50,
                "manualCheckMaxScore": 0.70,
                "searchWorthyMaxScore": 0.88,
            },
            "regressor": {
                "lowMaxChaos": 5,
                "manualCheckMaxChaos": 30,
                "highValueMinChaos": 300,
            },
        },
        "routes": {
            "rare_equipment": "rare_unique_classifier",
            "unique_equipment": "rare_unique_classifier",
            "jewel": "jewel_regressor",
            "skill_gem": "skill_gem_regressor",
        },
        "externalPriceLookupItemClasses": [
            "Currency",
            "Stackable Currency",
            "Maps",
            "Map Fragments",
            "Divination Cards",
            "Incubators",
            "Heist Target",
        ],
        "models": {
            "rare_unique_classifier": {
                "modelType": "classifier",
                "featureSet": "v2_mod_aware",
                "segments": ["rare_equipment", "unique_equipment"],
                "modelPath": "rare_unique_classifier/model.cbm",
                "schemaPath": "rare_unique_classifier/feature_schema.json",
                "runInfoPath": "rare_unique_classifier/run_info.json",
            },
            "jewel_regressor": {
                "modelType": "regressor",
                "featureSet": "v1_summary",
                "segments": ["jewel"],
                "targetColumn": "target_price_log1p",
                "modelPath": "jewel_regressor/model.cbm",
                "schemaPath": "jewel_regressor/feature_schema.json",
                "runInfoPath": "jewel_regressor/run_info.json",
            },
            "skill_gem_regressor": {
                "modelType": "regressor",
                "featureSet": "v1_summary",
                "segments": ["skill_gem"],
                "targetColumn": "target_price_log1p",
                "modelPath": "skill_gem_regressor/model.cbm",
                "schemaPath": "skill_gem_regressor/feature_schema.json",
                "runInfoPath": "skill_gem_regressor/run_info.json",
            },
        },
        "training": {
            "days": args.days,
            "iterations": args.iterations,
            "depth": args.depth,
            "learningRate": args.learning_rate,
        },
    }


def main() -> int:
    args = parse_args()
    py = python_executable()
    v2_staging = REPO_ROOT / args.v2_staging_dir
    v1_staging = REPO_ROOT / args.v1_staging_dir
    v2_run = REPO_ROOT / args.v2_run_dir
    jewel_run = REPO_ROOT / args.jewel_run_dir
    skill_gem_run = REPO_ROOT / args.skill_gem_run_dir

    if not args.skip_staging:
        run([
            npm_executable(),
            "run",
            "stage:v2-mod-aware",
            "--",
            f"--days={args.days}",
            "--segments=rare_equipment,unique_equipment",
            f"--output-dir={args.v2_staging_dir}",
        ])
        run([
            npm_executable(),
            "run",
            "stage:training-dataset",
            "--",
            f"--days={args.days}",
            "--segments=jewel,skill_gem",
            f"--output-dir={args.v1_staging_dir}",
        ])

    if not args.skip_training:
        run([
            py,
            "ml/run_v2_classifier_comparison.py",
            "--staged-manifest",
            str(v2_staging / "manifest.json"),
            "--iterations",
            str(args.iterations),
            "--depth",
            str(args.depth),
            "--learning-rate",
            str(args.learning_rate),
            "--thread-count",
            str(args.thread_count),
            "--output-dir",
            str(v2_run),
        ])
        for segment, run_dir in (("jewel", jewel_run), ("skill_gem", skill_gem_run)):
            run([
                py,
                "ml/train_catboost.py",
                "--staged-manifest",
                str(v1_staging / "manifest.json"),
                "--segment",
                segment,
                "--iterations",
                str(args.iterations),
                "--depth",
                str(args.depth),
                "--learning-rate",
                str(args.learning_rate),
                "--thread-count",
                str(args.thread_count),
                "--output-dir",
                str(run_dir),
            ])

    DESKTOP_MODEL_DIR.mkdir(parents=True, exist_ok=True)
    copy_required(v2_run / "v2_mod_aware" / "global", DESKTOP_MODEL_DIR / "rare_unique_classifier")
    copy_required(jewel_run, DESKTOP_MODEL_DIR / "jewel_regressor", schema_from_run_info=True)
    copy_required(skill_gem_run, DESKTOP_MODEL_DIR / "skill_gem_regressor", schema_from_run_info=True)

    manifest = build_manifest(args)
    (DESKTOP_MODEL_DIR / "model_manifest.json").write_text(
        f"{json.dumps(manifest, indent=2)}\n",
        encoding="utf-8",
    )
    print(json.dumps({"desktopModelDir": str(DESKTOP_MODEL_DIR), "manifest": "desktop/models/v2_mvp/model_manifest.json"}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
