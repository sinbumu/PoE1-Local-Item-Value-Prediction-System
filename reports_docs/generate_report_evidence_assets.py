#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import json
import math
import os
import platform
import subprocess
import sys
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable

REPORTS_DIR = Path(__file__).resolve().parent
ROOT_DIR = REPORTS_DIR.parent
DEFAULT_DATE = "2026-04-24"
DEFAULT_DAILY_DAYS = 14
DEFAULT_HOURLY_HOURS = 72
DEFAULT_SAMPLE_PERCENT = 0.2

os.environ.setdefault("MPLCONFIGDIR", str(REPORTS_DIR / ".mplconfig"))
os.environ.setdefault("XDG_CACHE_HOME", str(REPORTS_DIR / ".cache"))
Path(os.environ["MPLCONFIGDIR"]).mkdir(parents=True, exist_ok=True)
Path(os.environ["XDG_CACHE_HOME"]).mkdir(parents=True, exist_ok=True)

try:
    import matplotlib.dates as mdates
    import matplotlib.pyplot as plt
    from matplotlib.patches import FancyArrowPatch, FancyBboxPatch
except ModuleNotFoundError:
    print(
        "matplotlib is required. Example: python3 -m pip install matplotlib",
        file=sys.stderr,
    )
    raise


@dataclass
class CsvResult:
    header: list[str]
    rows: list[dict[str, str]]


def load_env_file(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not path.exists():
        return values
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        cleaned = value.split(" #", 1)[0].strip().strip('"').strip("'")
        values[key.strip()] = cleaned
    return values


def resolve_env() -> dict[str, str]:
    env_path = ROOT_DIR / ".env"
    env_values = load_env_file(env_path)
    resolved = dict(env_values)
    resolved.setdefault("TARGET_LEAGUE", "Mirage")
    resolved.setdefault("POE_REALM", "pc")
    resolved.setdefault("POLL_INTERVAL_MS", "10000")
    resolved.setdefault("COLLECTOR_EXCHANGE_RATE_INTERVAL_MS", "900000")
    resolved.setdefault("RAW_RETENTION_HOURS", "24")
    resolved.setdefault("NORMALIZED_RETENTION_HOURS", "168")
    resolved.setdefault("MAINTENANCE_POLL_INTERVAL_MS", "60000")
    resolved.setdefault("NORMALIZED_CLEANUP_LIMIT", "100000")
    resolved.setdefault("MAINTENANCE_NORMALIZED_CLEANUP_MAX_BATCHES", "10")
    return resolved


def resolve_database_url(env_values: dict[str, str]) -> str:
    database_url = os.environ.get("DATABASE_URL") or env_values.get("DATABASE_URL")
    if not database_url:
        raise RuntimeError("DATABASE_URL is required via .env or environment variable.")
    return database_url


def run_psql_csv(database_url: str, query: str) -> CsvResult:
    command = [
        "psql",
        database_url,
        "-P",
        "pager=off",
        "--csv",
        "-c",
        query,
    ]
    completed = subprocess.run(
        command,
        cwd=ROOT_DIR,
        capture_output=True,
        text=True,
        check=False,
    )
    if completed.returncode != 0:
        raise RuntimeError(completed.stderr.strip() or completed.stdout.strip())
    raw_output = completed.stdout.strip()
    if not raw_output:
        return CsvResult(header=[], rows=[])
    reader = csv.DictReader(raw_output.splitlines())
    rows = [dict(row) for row in reader]
    return CsvResult(header=reader.fieldnames or [], rows=rows)


def run_command(args: list[str], cwd: Path | None = None) -> str:
    completed = subprocess.run(
        args,
        cwd=cwd or ROOT_DIR,
        capture_output=True,
        text=True,
        check=False,
    )
    if completed.returncode != 0:
        return ""
    return completed.stdout.strip()


def parse_utc(value: str) -> datetime:
    normalized = value.replace(" ", "T")
    if normalized.endswith("+00"):
        normalized += ":00"
    return datetime.fromisoformat(normalized).astimezone(timezone.utc)


def as_int(value: str | None) -> int:
    if value is None or value == "":
        return 0
    return int(float(value))


def as_float(value: str | None) -> float:
    if value is None or value == "":
        return 0.0
    return float(value)


def ensure_dir(path: Path) -> Path:
    path.mkdir(parents=True, exist_ok=True)
    return path


def md_escape(value: object) -> str:
    return str(value).replace("|", "\\|")


def write_csv(path: Path, fieldnames: list[str], rows: list[dict[str, object]]) -> None:
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            writer.writerow({key: row.get(key, "") for key in fieldnames})


def write_md_table(path: Path, fieldnames: list[str], rows: list[dict[str, object]]) -> None:
    with path.open("w", encoding="utf-8") as handle:
        handle.write("| " + " | ".join(fieldnames) + " |\n")
        handle.write("| " + " | ".join(["---"] * len(fieldnames)) + " |\n")
        for row in rows:
            values = [md_escape(row.get(field, "")) for field in fieldnames]
            handle.write("| " + " | ".join(values) + " |\n")


def save_figure(figure, output_path: Path) -> None:
    figure.tight_layout()
    figure.savefig(output_path, dpi=180, bbox_inches="tight")
    plt.close(figure)


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def load_feature_importance(path: Path, top_n: int | None = None) -> list[dict[str, object]]:
    with path.open("r", encoding="utf-8") as handle:
        rows = list(csv.DictReader(handle))
    parsed = [
        {"feature": row["feature"], "importance": float(row["importance"])}
        for row in rows
    ]
    if top_n is not None:
        return parsed[:top_n]
    return parsed


def draw_box(axis, x: float, y: float, w: float, h: float, text: str, color: str) -> None:
    patch = FancyBboxPatch(
        (x, y),
        w,
        h,
        boxstyle="round,pad=0.02,rounding_size=0.02",
        linewidth=1.6,
        edgecolor=color,
        facecolor=color,
        alpha=0.14,
    )
    axis.add_patch(patch)
    axis.text(x + w / 2, y + h / 2, text, ha="center", va="center", fontsize=10)


def draw_arrow(axis, start: tuple[float, float], end: tuple[float, float], color: str = "#475569") -> None:
    arrow = FancyArrowPatch(
        start,
        end,
        arrowstyle="->",
        mutation_scale=12,
        linewidth=1.5,
        color=color,
    )
    axis.add_patch(arrow)


class AssetBuilder:
    def __init__(self, report_date: str, env_values: dict[str, str], database_url: str) -> None:
        self.report_date = report_date
        self.env_values = env_values
        self.database_url = database_url
        self.base_dir = ensure_dir(ROOT_DIR / "report_assets" / report_date)
        self.chapter_dirs = {
            "chapter2": ensure_dir(self.base_dir / "chapter2"),
            "chapter3": ensure_dir(self.base_dir / "chapter3"),
            "chapter4": ensure_dir(self.base_dir / "chapter4"),
            "chapter5": ensure_dir(self.base_dir / "chapter5"),
            "chapter6": ensure_dir(self.base_dir / "chapter6"),
            "appendix": ensure_dir(self.base_dir / "appendix"),
            "references": ensure_dir(self.base_dir / "references"),
        }
        self.manifest_entries: list[dict[str, object]] = []
        self.caption_lines: list[str] = []

    def add_table(
        self,
        chapter: str,
        name: str,
        fieldnames: list[str],
        rows: list[dict[str, object]],
        title: str,
        description: str,
        sources: list[str],
        claims: list[str],
    ) -> None:
        chapter_dir = self.chapter_dirs[chapter]
        csv_path = chapter_dir / f"{name}.csv"
        md_path = chapter_dir / f"{name}.md"
        write_csv(csv_path, fieldnames, rows)
        write_md_table(md_path, fieldnames, rows)
        self.manifest_entries.append(
            {
                "chapter": chapter,
                "type": "table",
                "name": name,
                "title": title,
                "description": description,
                "csv": str(csv_path.relative_to(ROOT_DIR)),
                "md": str(md_path.relative_to(ROOT_DIR)),
                "sources": sources,
                "claims": claims,
            }
        )
        self.caption_lines.append(f"- `{chapter}/{name}`: {title} - {description}")

    def add_figure(
        self,
        chapter: str,
        name: str,
        title: str,
        description: str,
        sources: list[str],
        claims: list[str],
    ) -> Path:
        chapter_dir = self.chapter_dirs[chapter]
        figure_path = chapter_dir / f"{name}.png"
        self.manifest_entries.append(
            {
                "chapter": chapter,
                "type": "figure",
                "name": name,
                "title": title,
                "description": description,
                "png": str(figure_path.relative_to(ROOT_DIR)),
                "sources": sources,
                "claims": claims,
            }
        )
        self.caption_lines.append(f"- `{chapter}/{name}`: {title} - {description}")
        return figure_path

    def finalize(self, generation_script: str) -> None:
        manifest = {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "report_date": self.report_date,
            "base_dir": str(self.base_dir.relative_to(ROOT_DIR)),
            "generation_script": generation_script,
            "assets": self.manifest_entries,
        }
        (self.base_dir / "manifest.json").write_text(
            json.dumps(manifest, indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )
        (self.base_dir / "captions.md").write_text(
            "# Captions\n\n" + "\n".join(self.caption_lines) + "\n",
            encoding="utf-8",
        )
        readme_lines = [
            f"# Report Assets ({self.report_date})",
            "",
            "이 폴더는 중간보고서 본문에 붙일 표/그림/보조 설명 파일을 장별로 정리한 결과물이다.",
            "",
            "## 구성",
            "",
            "- `chapter2/` 도메인 스코프 자료",
            "- `chapter3/` 시스템 구조와 실행 환경 자료",
            "- `chapter4/` 수집 파이프라인 근거 자료",
            "- `chapter5/` ETL/라벨링/피처 정책 근거 자료",
            "- `chapter6/` 학습 비교와 feature importance 근거 자료",
            "- `appendix/` 용어 정리와 부록 표",
            "- `references/` 참고문헌 초안",
            "- `manifest.json` 파일별 메타데이터",
            "- `captions.md` 그림/표 캡션 초안",
            "",
            "## 생성 원칙",
            "",
            "- 표는 `csv`와 `md`를 함께 저장한다.",
            "- 그림은 `png`로 저장한다.",
            "- 본문에는 설명용 이름을 쓰고, 실제 경로와 생성 정보는 `manifest.json`으로 분리한다.",
        ]
        (self.base_dir / "README.md").write_text("\n".join(readme_lines) + "\n", encoding="utf-8")


def generate_chapter2(builder: AssetBuilder) -> None:
    rows = [
        {
            "scope_group": "model_prediction_priority",
            "examples": "rare_equipment, jewel, unique_equipment, skill_gem",
            "criterion": "옵션/상태/레벨/롤 값에 따라 가격 편차가 큼",
            "report_use": "현재 모델 범위 정당화",
        },
        {
            "scope_group": "external_price_priority",
            "examples": "currency, fragment, scarab, essence, fossil, resonator, oil, divination_card, maps",
            "criterion": "외부 시세 소스로 평균가 추종이 쉬움",
            "report_use": "왜 모든 아이템을 모델로 예측하지 않는지 설명",
        },
        {
            "scope_group": "excluded_or_phase2",
            "examples": "timeless_jewel, very_rare_niche_items, korean_clipboard_support",
            "criterion": "가격 규칙이 매우 특수하거나 현재 범위 밖",
            "report_use": "현 단계 구현 범위와 한계 명시",
        },
    ]
    builder.add_table(
        "chapter2",
        "table_item_scope_summary",
        ["scope_group", "examples", "criterion", "report_use"],
        rows,
        "아이템 스코프 요약",
        "모델 대상, 외부 시세 우선 대상, 현재 범위 제외 대상을 한 표에 정리한다.",
        ["docs/MODEL_SCOPE.md", "docs/poe1_report_draft_ch2_to_ch6.md"],
        ["왜 모든 아이템을 다 예측하지 않는지 설명", "현재 모델 범위 정당화"],
    )

    figure_path = builder.add_figure(
        "chapter2",
        "figure_domain_scope_overview",
        "도메인 스코프 개요",
        "외부 시세 우선, 모델 예측 우선, 현재 범위 제외의 세 분류를 도식화한다.",
        ["docs/MODEL_SCOPE.md"],
        ["현재 모델 범위를 도메인적으로 정당화"],
    )
    figure, axis = plt.subplots(figsize=(12, 4.8))
    axis.axis("off")
    draw_box(axis, 0.03, 0.2, 0.28, 0.55, "External-price priority\ncurrency / fragment /\nscarab / maps / cards", "#0ea5e9")
    draw_box(axis, 0.36, 0.2, 0.28, 0.55, "Model-prediction priority\nrare_equipment /\njewel / unique_equipment /\nskill_gem", "#22c55e")
    draw_box(axis, 0.69, 0.2, 0.28, 0.55, "Out of current scope\nTimeless Jewel /\nrare niche item /\nKorean clipboard", "#f59e0b")
    axis.set_title("Current Domain Scope")
    save_figure(figure, figure_path)


def generate_chapter3(builder: AssetBuilder) -> None:
    node_version = run_command(["node", "-v"])
    python_version = run_command(["python3", "--version"])
    psql_version = run_command(["psql", "--version"])
    docker_version = run_command(["docker", "--version"])
    pg_version_result = run_psql_csv(builder.database_url, "SHOW server_version;")
    pg_version = pg_version_result.rows[0]["server_version"] if pg_version_result.rows else ""
    catboost_version = run_command(
        [
            str(ROOT_DIR / "ml" / ".venv" / "bin" / "python"),
            "-c",
            "import catboost; print(catboost.__version__)",
        ]
    )
    env_rows = [
        {"component": "OS", "value": platform.platform(), "notes": "local workstation"},
        {"component": "Node.js", "value": node_version, "notes": "collector / ETL / maintenance"},
        {"component": "Python", "value": python_version, "notes": "training / report assets"},
        {"component": "CatBoost", "value": catboost_version, "notes": "tabular regression baseline"},
        {"component": "PostgreSQL server", "value": pg_version, "notes": "primary data store"},
        {"component": "psql client", "value": psql_version, "notes": "SQL-based asset generation"},
        {"component": "Docker", "value": docker_version or "not detected", "notes": "optional local PostgreSQL runtime"},
    ]
    builder.add_table(
        "chapter3",
        "table_execution_environment",
        ["component", "value", "notes"],
        env_rows,
        "실행 환경 요약",
        "보고서 작성 시점의 로컬 실행 환경과 주요 런타임 버전을 기록한다.",
        ["package.json", "ml/requirements.txt", "docs/poe1_report_draft_ch2_to_ch6.md"],
        ["로컬 MacBook 기반 실험 환경 설명"],
    )

    role_rows = [
        {"component": "collector", "role": "OAuth 인증, Public Stash tailing, league filtering, normalized 적재, state 갱신", "chapter_use": "수집 계층 설명"},
        {"component": "maintenance", "role": "raw cleanup, stale normalized cleanup, labeled backup 등 저장소 관리", "chapter_use": "운영 정책 설명"},
        {"component": "training_etl", "role": "normalized -> raw -> clean -> labeled 변환", "chapter_use": "학습 데이터 계층 설명"},
        {"component": "staging", "role": "최근 7일 labeled snapshot을 train/valid/test split CSV로 고정", "chapter_use": "재현 가능한 실험 설명"},
        {"component": "training_comparison", "role": "global vs segment CatBoost 비교와 기준선 도출", "chapter_use": "모델 실험 설명"},
        {"component": "clipboard_parser", "role": "영문 Ctrl+C 텍스트 파싱과 affix dictionary V1 기반 추론 입력 준비", "chapter_use": "향후 앱 입력 경로 설명"},
    ]
    builder.add_table(
        "chapter3",
        "table_component_roles",
        ["component", "role", "chapter_use"],
        role_rows,
        "구성 요소별 역할 표",
        "collector부터 clipboard parser까지 현재 저장소의 핵심 구성요소 역할을 정리한다.",
        ["README.md", "docs/TRAINING_ETL_OVERVIEW.md", "docs/CLIPBOARD_COMPATIBILITY_AUDIT.md"],
        ["전체 시스템 계층 설명"],
    )

    system_figure = builder.add_figure(
        "chapter3",
        "figure_system_architecture",
        "시스템 아키텍처 개요",
        "수집, 저장, ETL, staging, 학습, clipboard 입력 준비를 한 장에 배치한다.",
        ["docs/MIDTERM_REPORT_WRITING_GUIDE_2026-04-22.md"],
        ["전체 시스템 구조 설명"],
    )
    figure, axis = plt.subplots(figsize=(14, 6))
    axis.axis("off")
    draw_box(axis, 0.03, 0.55, 0.18, 0.22, "Collector\nOAuth / Public Stash\nLeague filter", "#0ea5e9")
    draw_box(axis, 0.27, 0.55, 0.18, 0.22, "Storage\nraw / normalized /\nstate / exchange", "#14b8a6")
    draw_box(axis, 0.51, 0.55, 0.18, 0.22, "Training ETL\nraw -> clean -> labeled", "#22c55e")
    draw_box(axis, 0.75, 0.55, 0.18, 0.22, "Staging\nsplit CSV / manifest", "#84cc16")
    draw_box(axis, 0.27, 0.15, 0.18, 0.22, "CatBoost\ntrain / compare", "#f59e0b")
    draw_box(axis, 0.75, 0.15, 0.18, 0.22, "Clipboard Prep\nparser / affix dictionary", "#8b5cf6")
    draw_arrow(axis, (0.21, 0.66), (0.27, 0.66))
    draw_arrow(axis, (0.45, 0.66), (0.51, 0.66))
    draw_arrow(axis, (0.69, 0.66), (0.75, 0.66))
    draw_arrow(axis, (0.60, 0.55), (0.40, 0.37))
    draw_arrow(axis, (0.84, 0.55), (0.84, 0.37))
    axis.set_title("PoE1 Local Item Value Prediction System Architecture")
    save_figure(figure, system_figure)

    flow_figure = builder.add_figure(
        "chapter3",
        "figure_data_flow_pipeline",
        "데이터 흐름 파이프라인",
        "public-stash-tabs부터 staged dataset과 학습 비교까지의 순차 흐름을 도식화한다.",
        ["docs/MIDTERM_REPORT_WRITING_GUIDE_2026-04-22.md"],
        ["데이터 흐름 설명"],
    )
    figure, axis = plt.subplots(figsize=(16, 3.8))
    axis.axis("off")
    labels = [
        "public-stash-tabs",
        "raw_api_responses",
        "normalized_priced_items",
        "training_features_raw",
        "training_features_clean",
        "training_features_labeled",
        "staged dataset",
        "train / compare",
    ]
    colors = ["#0ea5e9", "#38bdf8", "#14b8a6", "#22c55e", "#84cc16", "#eab308", "#f59e0b", "#8b5cf6"]
    x_positions = [0.01, 0.14, 0.29, 0.45, 0.60, 0.75, 0.89, 1.03]
    for idx, label in enumerate(labels):
        draw_box(axis, x_positions[idx], 0.32, 0.11, 0.28, label, colors[idx])
        if idx < len(labels) - 1:
            draw_arrow(axis, (x_positions[idx] + 0.11, 0.46), (x_positions[idx + 1], 0.46))
    axis.set_xlim(0, 1.15)
    axis.set_ylim(0, 1)
    axis.set_title("End-to-End Data Flow")
    save_figure(figure, flow_figure)

    clipboard_figure = builder.add_figure(
        "chapter3",
        "figure_clipboard_to_model_flow",
        "클립보드 입력에서 모델 추론까지의 준비 경로",
        "향후 로컬 앱 입력 경로 설명용 보조 도식이다.",
        ["docs/CLIPBOARD_COMPATIBILITY_AUDIT.md", "docs/AFFIX_SOURCE_STRATEGY.md"],
        ["향후 앱 입력 흐름 설명"],
    )
    figure, axis = plt.subplots(figsize=(12, 3.5))
    axis.axis("off")
    draw_box(axis, 0.03, 0.28, 0.18, 0.32, "PoE Ctrl+C\nclipboard text", "#0ea5e9")
    draw_box(axis, 0.28, 0.28, 0.18, 0.32, "Clipboard parser", "#14b8a6")
    draw_box(axis, 0.53, 0.28, 0.18, 0.32, "Affix dictionary V1\ncontext heuristics", "#8b5cf6")
    draw_box(axis, 0.78, 0.28, 0.18, 0.32, "Model-ready features\nand segment routing", "#22c55e")
    draw_arrow(axis, (0.21, 0.44), (0.28, 0.44))
    draw_arrow(axis, (0.46, 0.44), (0.53, 0.44))
    draw_arrow(axis, (0.71, 0.44), (0.78, 0.44))
    axis.set_title("Clipboard Input Preparation Flow")
    save_figure(figure, clipboard_figure)


def query_summary_counts(database_url: str, bucket_granularity: str, horizon: str, target_league: str) -> list[dict[str, object]]:
    query = f"""
WITH buckets AS (
  SELECT
    bucket_start,
    MAX(CASE WHEN summary_source = 'raw_response' THEN event_count END) AS raw_response_count,
    MAX(CASE WHEN summary_source = 'normalized_listing' THEN event_count END) AS normalized_listing_count,
    MAX(CASE WHEN summary_source = 'exchange_rate_snapshot' THEN event_count END) AS exchange_snapshot_count
  FROM ingestion_activity_summaries
  WHERE bucket_granularity = '{bucket_granularity}'
    AND target_league = '{target_league}'
    AND bucket_start >= NOW() - INTERVAL '{horizon}'
  GROUP BY 1
)
SELECT
  bucket_start::text,
  COALESCE(raw_response_count, 0)::text AS raw_response_count,
  COALESCE(normalized_listing_count, 0)::text AS normalized_listing_count,
  COALESCE(exchange_snapshot_count, 0)::text AS exchange_snapshot_count
FROM buckets
ORDER BY bucket_start;
""".strip()
    result = run_psql_csv(database_url, query)
    return [
        {
            "bucket_start": row["bucket_start"],
            "raw_response_count": as_int(row["raw_response_count"]),
            "normalized_listing_count": as_int(row["normalized_listing_count"]),
            "exchange_snapshot_count": as_int(row["exchange_snapshot_count"]),
        }
        for row in result.rows
    ]


def generate_chapter4(builder: AssetBuilder, target_league: str) -> None:
    collector_rows = [
        {"setting": "target_league", "value": target_league, "notes": "exact match filtering"},
        {"setting": "poe_realm", "value": builder.env_values.get("POE_REALM", "pc"), "notes": "default runtime realm"},
        {"setting": "resume_strategy", "value": "collector_state + next_change_id", "notes": "restart-safe tailing"},
        {"setting": "poll_interval_ms", "value": builder.env_values.get("POLL_INTERVAL_MS", "10000"), "notes": "collector loop interval"},
        {"setting": "exchange_rate_interval_ms", "value": builder.env_values.get("COLLECTOR_EXCHANGE_RATE_INTERVAL_MS", "900000"), "notes": "collector-side snapshot tick"},
        {"setting": "raw_retention_hours", "value": builder.env_values.get("RAW_RETENTION_HOURS", "24"), "notes": "short-lived raw retention"},
        {"setting": "normalized_retention_hours", "value": builder.env_values.get("NORMALIZED_RETENTION_HOURS", "168"), "notes": "stale listing cleanup window"},
    ]
    builder.add_table(
        "chapter4",
        "table_collector_configuration",
        ["setting", "value", "notes"],
        collector_rows,
        "Collector 설정 요약",
        "리그 필터, resume 방식, retention 관련 설정을 한 표로 정리한다.",
        ["README.md", "src/config/env.ts"],
        ["수집 파이프라인 설정 근거"],
    )

    sequence_figure = builder.add_figure(
        "chapter4",
        "figure_collector_sequence",
        "Collector 수집 순서도",
        "OAuth부터 state 갱신까지 collector 한 사이클의 순서를 시각화한다.",
        ["README.md"],
        ["수집 파이프라인 동작 설명"],
    )
    figure, axis = plt.subplots(figsize=(15, 3.8))
    axis.axis("off")
    labels = [
        "OAuth token",
        "Public Stash request",
        "League filtering",
        "raw subset save",
        "normalized save",
        "state update",
    ]
    colors = ["#0ea5e9", "#38bdf8", "#14b8a6", "#22c55e", "#84cc16", "#f59e0b"]
    x_positions = [0.02, 0.19, 0.36, 0.53, 0.70, 0.87]
    for idx, label in enumerate(labels):
        draw_box(axis, x_positions[idx], 0.32, 0.10, 0.26, label, colors[idx])
        if idx < len(labels) - 1:
            draw_arrow(axis, (x_positions[idx] + 0.10, 0.45), (x_positions[idx + 1], 0.45))
    axis.set_xlim(0, 1.0)
    axis.set_ylim(0, 1)
    axis.set_title("Collector Sequence")
    save_figure(figure, sequence_figure)

    daily_rows = query_summary_counts(builder.database_url, "day", f"{DEFAULT_DAILY_DAYS} days", target_league)
    daily_table_rows = [
        {
            "date_utc": parse_utc(row["bucket_start"]).strftime("%Y-%m-%d"),
            "raw_response_count": row["raw_response_count"],
            "normalized_listing_count": row["normalized_listing_count"],
            "exchange_snapshot_count": row["exchange_snapshot_count"],
        }
        for row in daily_rows
    ]
    builder.add_table(
        "chapter4",
        "table_ingestion_counts_daily",
        ["date_utc", "raw_response_count", "normalized_listing_count", "exchange_snapshot_count"],
        daily_table_rows,
        "일별 수집량 표",
        "ingestion_activity_summaries 기준 일자별 raw/normalized/exchange snapshot 수를 기록한다.",
        ["ingestion_activity_summaries"],
        ["지정 기간 동안 연속 수집이 진행되었음을 보여 주는 근거"],
    )

    hourly_rows = query_summary_counts(builder.database_url, "hour", f"{DEFAULT_HOURLY_HOURS} hours", target_league)
    hourly_table_rows = [
        {
            "hour_utc": parse_utc(row["bucket_start"]).strftime("%Y-%m-%d %H:%M"),
            "raw_response_count": row["raw_response_count"],
            "normalized_listing_count": row["normalized_listing_count"],
            "exchange_snapshot_count": row["exchange_snapshot_count"],
        }
        for row in hourly_rows
    ]
    builder.add_table(
        "chapter4",
        "table_ingestion_counts_hourly",
        ["hour_utc", "raw_response_count", "normalized_listing_count", "exchange_snapshot_count"],
        hourly_table_rows,
        "시간대별 수집량 표",
        "최근 72시간 시간대별 raw/normalized/exchange snapshot 수를 기록한다.",
        ["ingestion_activity_summaries"],
        ["collector 지속 동작 근거"],
    )

    daily_figure = builder.add_figure(
        "chapter4",
        "figure_ingestion_trend_daily",
        "일별 수집 추이",
        "raw, normalized, exchange snapshot 일별 수집량을 3개 축으로 나누어 표시한다.",
        ["report_assets daily summary tables"],
        ["연속 수집 근거 시각화"],
    )
    figure, axes = plt.subplots(3, 1, figsize=(12, 9), sharex=True)
    x_values = [parse_utc(row["bucket_start"]) for row in daily_rows]
    series = [
        ("raw response", [row["raw_response_count"] for row in daily_rows], "#0ea5e9"),
        ("normalized listing", [row["normalized_listing_count"] for row in daily_rows], "#22c55e"),
        ("exchange snapshot", [row["exchange_snapshot_count"] for row in daily_rows], "#f59e0b"),
    ]
    for axis, (label, y_values, color) in zip(axes, series):
        axis.bar(x_values, y_values, color=color, alpha=0.85)
        axis.set_ylabel(label)
        axis.grid(axis="y", alpha=0.25)
    axes[-1].xaxis.set_major_formatter(mdates.DateFormatter("%m-%d"))
    axes[0].set_title("Daily Ingestion Trend")
    save_figure(figure, daily_figure)

    hourly_figure = builder.add_figure(
        "chapter4",
        "figure_ingestion_trend_hourly",
        "시간대별 수집 추이",
        "최근 72시간 raw, normalized, exchange snapshot 시간대별 수집량을 3개 축으로 나누어 표시한다.",
        ["report_assets hourly summary tables"],
        ["collector 지속 동작 근거 시각화"],
    )
    figure, axes = plt.subplots(3, 1, figsize=(12, 9), sharex=True)
    x_values = [parse_utc(row["bucket_start"]) for row in hourly_rows]
    series = [
        ("raw response", [row["raw_response_count"] for row in hourly_rows], "#0ea5e9"),
        ("normalized listing", [row["normalized_listing_count"] for row in hourly_rows], "#22c55e"),
        ("exchange snapshot", [row["exchange_snapshot_count"] for row in hourly_rows], "#f59e0b"),
    ]
    for axis, (label, y_values, color) in zip(axes, series):
        axis.plot(x_values, y_values, color=color, linewidth=1.8)
        axis.fill_between(x_values, y_values, color=color, alpha=0.12)
        axis.set_ylabel(label)
        axis.grid(alpha=0.25)
    axes[-1].xaxis.set_major_formatter(mdates.DateFormatter("%m-%d\n%H:%M"))
    axes[0].set_title("Hourly Ingestion Trend (last 72h)")
    save_figure(figure, hourly_figure)

    league_rows = [
        {"league_name": target_league, "stored_in_db": "yes", "reason": "current target league exact match"},
        {"league_name": f"Hardcore {target_league}", "stored_in_db": "no", "reason": "different economy, excluded by exact match"},
        {"league_name": f"SSF {target_league}", "stored_in_db": "no", "reason": "different economy, excluded by exact match"},
        {"league_name": f"Ruthless {target_league}", "stored_in_db": "no", "reason": "different economy, excluded by exact match"},
        {"league_name": "private leagues", "stored_in_db": "no", "reason": "distribution mismatch with target economy"},
        {"league_name": "Standard / Hardcore", "stored_in_db": "no", "reason": "not part of current season target scope"},
    ]
    builder.add_table(
        "chapter4",
        "table_league_filtering_summary",
        ["league_name", "stored_in_db", "reason"],
        league_rows,
        "리그 필터링 요약",
        "collector의 exact match league filter 정책을 설명하기 위한 보조 표다.",
        ["docs/MODEL_SCOPE.md", "README.md"],
        ["Mirage softcore 경제권만 수집 대상으로 삼는 이유 설명"],
    )


def generate_chapter5(builder: AssetBuilder) -> None:
    counts_result = run_psql_csv(
        builder.database_url,
        """
SELECT 'normalized_priced_items' AS stage, COUNT(*)::text AS row_count FROM normalized_priced_items
UNION ALL
SELECT 'training_features_raw' AS stage, COUNT(*)::text AS row_count FROM training_features_raw
UNION ALL
SELECT 'training_features_clean' AS stage, COUNT(*)::text AS row_count FROM training_features_clean
UNION ALL
SELECT 'training_features_labeled' AS stage, COUNT(*)::text AS row_count FROM training_features_labeled
ORDER BY stage;
""".strip(),
    )
    order = ["normalized_priced_items", "training_features_raw", "training_features_clean", "training_features_labeled"]
    order_index = {name: idx for idx, name in enumerate(order)}
    count_rows = [
        {"stage": row["stage"], "row_count": as_int(row["row_count"])}
        for row in counts_result.rows
    ]
    count_rows.sort(key=lambda row: order_index[row["stage"]])
    builder.add_table(
        "chapter5",
        "table_etl_row_counts",
        ["stage", "row_count"],
        count_rows,
        "ETL 단계별 row 수",
        "normalized부터 labeled까지 현재 누적 row 수를 비교한다.",
        ["normalized_priced_items", "training_features_raw", "training_features_clean", "training_features_labeled"],
        ["정제 단계별 데이터량 변화 설명"],
    )

    funnel_figure = builder.add_figure(
        "chapter5",
        "figure_etl_funnel",
        "ETL 단계별 row 수 비교",
        "단계별 row 수 차이를 로그 스케일 막대로 표시한다.",
        ["table_etl_row_counts"],
        ["정제 단계별 row 감소 시각화"],
    )
    figure, axis = plt.subplots(figsize=(10, 5.5))
    labels = [row["stage"] for row in count_rows]
    values = [row["row_count"] for row in count_rows]
    bars = axis.bar(labels, values, color=["#14b8a6", "#22c55e", "#84cc16", "#f59e0b"])
    axis.set_yscale("log")
    axis.set_ylabel("row count (log scale)")
    axis.set_title("ETL Row Count Funnel")
    axis.grid(axis="y", alpha=0.25)
    for bar, value in zip(bars, values):
        axis.text(bar.get_x() + bar.get_width() / 2, value * 1.05, f"{value:,}", ha="center", va="bottom", fontsize=8)
    save_figure(figure, funnel_figure)

    clean_reason_result = run_psql_csv(
        builder.database_url,
        """
WITH raw_with_clean AS (
  SELECT
    r.*,
    c.clean_reason
  FROM training_features_raw r
  LEFT JOIN training_features_clean c
    ON c.listing_key = r.listing_key
),
decisions AS (
  SELECT
    CASE
      WHEN clean_reason IS NOT NULL THEN clean_reason
      WHEN price_amount IS NULL OR price_amount <= 0 THEN 'invalid_price_amount'
      WHEN price_currency IS NULL OR price_currency NOT IN ('chaos', 'divine') THEN 'unsupported_price_currency'
      WHEN item_class = 'map' THEN 'external_price_map'
      WHEN item_class = 'skill_gem' THEN 'skill_gem_candidate'
      WHEN item_class = 'jewel' AND jewel_type = 'timeless' THEN 'timeless_jewel_phase2'
      WHEN item_class = 'jewel' AND identified IS NOT TRUE THEN 'unidentified_jewel'
      WHEN item_class = 'jewel' THEN 'jewel_candidate'
      WHEN item_class = 'equipment' AND rarity = 'Rare' AND identified IS NOT TRUE THEN 'unidentified_rare_equipment'
      WHEN item_class = 'equipment' AND rarity = 'Rare' THEN 'rare_equipment_candidate'
      WHEN item_class = 'equipment' AND rarity = 'Unique' AND identified IS NOT TRUE THEN 'unidentified_unique_equipment'
      WHEN item_class = 'equipment' AND rarity = 'Unique' THEN 'unique_not_in_neversink_allowlist'
      WHEN item_class = 'equipment' THEN 'unsupported_equipment_rarity'
      ELSE 'unsupported_item_class'
    END AS reason
  FROM raw_with_clean
)
SELECT reason, COUNT(*)::text AS row_count
FROM decisions
GROUP BY 1
ORDER BY COUNT(*) DESC, reason ASC
LIMIT 20;
""".strip(),
    )
    clean_reason_rows = [
        {"reason": row["reason"], "row_count": as_int(row["row_count"])}
        for row in clean_reason_result.rows
    ]
    builder.add_table(
        "chapter5",
        "table_clean_filter_reasons",
        ["reason", "row_count"],
        clean_reason_rows,
        "clean 단계 주요 판정 이유",
        "training_features_raw 기준 현재 clean 판정 결과를 reason 단위로 집계한다.",
        ["training_features_raw", "training_features_clean", "src/services/training-feature-cleaner.service.ts"],
        ["clean 단계 대상/비대상 분리 근거"],
    )

    label_coverage_result = run_psql_csv(
        builder.database_url,
        """
WITH coverage AS (
  SELECT
    COUNT(*) AS clean_total,
    COUNT(l.listing_key) AS labeled_total
  FROM training_features_clean c
  LEFT JOIN training_features_labeled l
    ON l.listing_key = c.listing_key
)
SELECT
  clean_total::text,
  labeled_total::text,
  (clean_total - labeled_total)::text AS unlabeled_total,
  ROUND((labeled_total::numeric / NULLIF(clean_total, 0)) * 100, 4)::text AS labeled_ratio_percent
FROM coverage;
""".strip(),
    )
    coverage_row = label_coverage_result.rows[0] if label_coverage_result.rows else {}
    coverage_rows = [
        {
            "metric": "clean_total",
            "value": as_int(coverage_row.get("clean_total")),
            "notes": "label stage input row count",
        },
        {
            "metric": "labeled_total",
            "value": as_int(coverage_row.get("labeled_total")),
            "notes": "rows materialized in training_features_labeled",
        },
        {
            "metric": "unlabeled_total",
            "value": as_int(coverage_row.get("unlabeled_total")),
            "notes": "currently not materialized in labeled table",
        },
        {
            "metric": "labeled_ratio_percent",
            "value": coverage_row.get("labeled_ratio_percent", ""),
            "notes": "clean to labeled coverage",
        },
    ]
    builder.add_table(
        "chapter5",
        "table_label_coverage",
        ["metric", "value", "notes"],
        coverage_rows,
        "label coverage 요약",
        "clean 대비 labeled 테이블 materialization 비율을 요약한다.",
        ["training_features_clean", "training_features_labeled"],
        ["라벨 생성 범위와 누락 규모 설명"],
    )

    feature_policy = load_json(ROOT_DIR / "src" / "config" / "clipboard-safe-feature-policy.json")
    summary_rows = [
        {"category": "active", "feature_count": len(feature_policy["activeFeatureColumns"]), "notes": "direct training input"},
        {"category": "derived", "feature_count": len(feature_policy["derivedFeatureColumns"]), "notes": "staging-derived training input"},
        {"category": "conditional", "feature_count": len(feature_policy["conditionalFeatureColumns"]), "notes": "not active in v1"},
        {"category": "excluded", "feature_count": len(feature_policy["excludedFeatureColumns"]), "notes": "not used in current training"},
    ]
    builder.add_table(
        "chapter5",
        "table_feature_policy_summary",
        ["category", "feature_count", "notes"],
        summary_rows,
        "feature policy 요약",
        "clipboard_safe_v1 정책의 active/derived/conditional/excluded 개수를 요약한다.",
        ["src/config/clipboard-safe-feature-policy.json"],
        ["문서상 모델 입력과 실제 코드상 입력 일치 확인"],
    )

    current_feature_rows: list[dict[str, object]] = []
    categorical = set(feature_policy["categoricalColumns"])
    boolean = set(feature_policy["booleanColumns"])
    for feature in feature_policy["activeFeatureColumns"] + feature_policy["derivedFeatureColumns"]:
        if feature in categorical:
            data_type = "categorical"
        elif feature in boolean:
            data_type = "boolean"
        else:
            data_type = "numeric"
        current_feature_rows.append(
            {
                "feature_name": feature,
                "source_group": "derived" if feature in feature_policy["derivedFeatureColumns"] else "active",
                "data_type": data_type,
                "used_in_current_training": "yes",
            }
        )
    builder.add_table(
        "chapter5",
        "table_current_training_features",
        ["feature_name", "source_group", "data_type", "used_in_current_training"],
        current_feature_rows,
        "현재 실제 학습 입력 피처 목록",
        "현재 CatBoost 학습에 실제로 사용되는 피처만 기계적으로 덤프한다.",
        ["artifacts/training-staging/post_report_all_segments/manifest.json", "src/config/clipboard-safe-feature-policy.json"],
        ["문서상 모델 입력과 실제 코드상 모델 입력 일치 확인"],
    )

    policy_rows: list[dict[str, object]] = []
    for group_name, key in [
        ("active", "activeFeatureColumns"),
        ("derived", "derivedFeatureColumns"),
        ("conditional", "conditionalFeatureColumns"),
        ("excluded", "excludedFeatureColumns"),
    ]:
        for feature in feature_policy[key]:
            policy_rows.append({"feature_name": feature, "policy_group": group_name})
    builder.add_table(
        "chapter5",
        "table_clipboard_safe_feature_policy",
        ["feature_name", "policy_group"],
        policy_rows,
        "clipboard_safe_v1 세부 정책 표",
        "active, derived, conditional, excluded 구분을 행 단위로 기록한다.",
        ["src/config/clipboard-safe-feature-policy.json"],
        ["피처 정책 세부 근거 제공"],
    )

    exchange_status_result = run_psql_csv(
        builder.database_url,
        """
WITH latest AS (
  SELECT MAX(sample_time_utc) AS latest_sample_time_utc
  FROM exchange_rate_snapshots
),
divine_recent AS (
  SELECT COUNT(*) AS recent_divine_rows
  FROM exchange_rate_snapshots
  WHERE normalized_currency_code = 'divine'
    AND sample_time_utc >= NOW() - INTERVAL '72 hours'
)
SELECT
  (SELECT COUNT(*) FROM exchange_rate_snapshots)::text AS total_snapshot_rows,
  COALESCE((SELECT latest_sample_time_utc::text FROM latest), '') AS latest_sample_time_utc,
  (SELECT recent_divine_rows::text FROM divine_recent) AS recent_divine_rows_72h;
""".strip(),
    )
    status = exchange_status_result.rows[0] if exchange_status_result.rows else {}
    latest_sample = status.get("latest_sample_time_utc", "")
    age_hours = ""
    if latest_sample:
        age_hours = round((datetime.now(timezone.utc) - parse_utc(latest_sample)).total_seconds() / 3600, 2)
    status_rows = [
        {"metric": "total_snapshot_rows", "value": as_int(status.get("total_snapshot_rows")), "notes": "current table size"},
        {"metric": "latest_sample_time_utc", "value": latest_sample, "notes": "most recent stored snapshot"},
        {"metric": "latest_sample_age_hours", "value": age_hours, "notes": "freshness indicator"},
        {"metric": "recent_divine_rows_72h", "value": as_int(status.get("recent_divine_rows_72h")), "notes": "recent divine observations in DB"},
    ]
    builder.add_table(
        "chapter5",
        "table_exchange_snapshot_status",
        ["metric", "value", "notes"],
        status_rows,
        "exchange snapshot 상태 표",
        "환율 스냅샷 테이블의 최근 관측 시각과 최근 divine snapshot 유입 규모를 요약한다.",
        ["exchange_rate_snapshots"],
        ["환율 참조 구조의 현재 상태 설명"],
    )

    segment_dist_result = run_psql_csv(
        builder.database_url,
        """
SELECT model_segment, COUNT(*)::text AS row_count
FROM training_features_labeled
GROUP BY 1
ORDER BY COUNT(*) DESC;
""".strip(),
    )
    segment_rows = [
        {"model_segment": row["model_segment"], "row_count": as_int(row["row_count"])}
        for row in segment_dist_result.rows
    ]
    builder.add_table(
        "chapter5",
        "table_segment_distribution",
        ["model_segment", "row_count"],
        segment_rows,
        "labeled 세그먼트 분포",
        "현재 labeled 데이터의 segment별 row 수를 요약한다.",
        ["training_features_labeled"],
        ["현재 학습 데이터 범위 설명"],
    )

    segment_figure = builder.add_figure(
        "chapter5",
        "figure_segment_distribution",
        "labeled 세그먼트 분포",
        "rare_equipment, jewel, unique_equipment, skill_gem의 row 수를 막대로 비교한다.",
        ["table_segment_distribution"],
        ["현재 모델 범위의 데이터 분포 설명"],
    )
    figure, axis = plt.subplots(figsize=(9, 5))
    labels = [row["model_segment"] for row in segment_rows]
    values = [row["row_count"] for row in segment_rows]
    bars = axis.bar(labels, values, color="#22c55e")
    axis.set_title("Labeled Segment Distribution")
    axis.set_ylabel("row count")
    axis.grid(axis="y", alpha=0.25)
    for bar, value in zip(bars, values):
        axis.text(bar.get_x() + bar.get_width() / 2, value + max(values) * 0.01, f"{value:,}", ha="center", va="bottom", fontsize=8)
    save_figure(figure, segment_figure)

    raw_price_sample = run_psql_csv(
        builder.database_url,
        f"""
SELECT target_price_currency, target_price_amount::double precision AS price_amount
FROM training_features_clean TABLESAMPLE SYSTEM ({DEFAULT_SAMPLE_PERCENT})
WHERE target_price_amount > 0
LIMIT 200000;
""".strip(),
    )
    raw_price_rows = [
        (row["target_price_currency"], as_float(row["price_amount"]))
        for row in raw_price_sample.rows
        if as_float(row["price_amount"]) > 0
    ]
    raw_figure = builder.add_figure(
        "chapter5",
        "figure_price_distribution_raw",
        "정제 단계 raw quoted price 분포",
        "training_features_clean의 target_price_amount 분포를 quoted currency별로 나누어 표시한다.",
        ["training_features_clean"],
        ["가격 분포의 긴 꼬리와 chaos/divine 혼재 설명"],
    )
    figure, axes = plt.subplots(1, 2, figsize=(12, 4.8), sharey=True)
    for axis, currency in zip(axes, ["chaos", "divine"]):
        values = [value for current_currency, value in raw_price_rows if current_currency == currency]
        if values:
            axis.hist(values, bins=40, color="#0ea5e9" if currency == "chaos" else "#8b5cf6", alpha=0.85)
            axis.set_xscale("log")
        axis.set_title(currency)
        axis.set_xlabel("quoted amount (log scale)")
        axis.grid(alpha=0.2)
    axes[0].set_ylabel("sample row count")
    figure.suptitle("Raw Quoted Price Distribution")
    save_figure(figure, raw_figure)

    labeled_price_sample = run_psql_csv(
        builder.database_url,
        f"""
SELECT target_price_chaos::double precision AS target_price_chaos,
       target_price_log1p::double precision AS target_price_log1p
FROM training_features_labeled TABLESAMPLE SYSTEM ({DEFAULT_SAMPLE_PERCENT})
WHERE target_price_chaos > 0
LIMIT 200000;
""".strip(),
    )
    chaos_values = [as_float(row["target_price_chaos"]) for row in labeled_price_sample.rows if as_float(row["target_price_chaos"]) > 0]
    log_values = [as_float(row["target_price_log1p"]) for row in labeled_price_sample.rows]
    labeled_figure = builder.add_figure(
        "chapter5",
        "figure_price_distribution_labeled",
        "labeled 가격 분포",
        "target_price_chaos와 target_price_log1p 분포를 나란히 표시한다.",
        ["training_features_labeled"],
        ["log1p 타깃 사용 배경 설명"],
    )
    figure, axes = plt.subplots(1, 2, figsize=(12, 4.8))
    if chaos_values:
        axes[0].hist(chaos_values, bins=40, color="#f59e0b", alpha=0.85)
        axes[0].set_xscale("log")
    axes[0].set_title("target_price_chaos")
    axes[0].set_xlabel("chaos equivalent (log scale)")
    axes[0].set_ylabel("sample row count")
    axes[0].grid(alpha=0.2)
    if log_values:
        axes[1].hist(log_values, bins=40, color="#22c55e", alpha=0.85)
    axes[1].set_title("target_price_log1p")
    axes[1].set_xlabel("log1p(target_price_chaos)")
    axes[1].grid(alpha=0.2)
    figure.suptitle("Labeled Price Distribution")
    save_figure(figure, labeled_figure)


def generate_chapter6(builder: AssetBuilder) -> None:
    comparison_dir = ROOT_DIR / "ml" / "runs" / "comparison_post_report_300iter_d8_log1p_winner"
    comparison_summary = load_json(comparison_dir / "comparison_summary.json")
    staged_manifest = load_json(ROOT_DIR / "artifacts" / "training-staging" / "post_report_all_segments" / "manifest.json")
    followup_metrics = load_json(ROOT_DIR / "ml" / "runs" / "skill_gem_post_report_500iter_d6" / "metrics.json")

    global_stats = staged_manifest["global"]["stats"]
    global_rows = [
        {"split": split, "row_count": global_stats[split]["rowCount"], "min_updated_at": global_stats[split]["minUpdatedAt"], "max_updated_at": global_stats[split]["maxUpdatedAt"]}
        for split in ["train", "valid", "test"]
    ]
    builder.add_table(
        "chapter6",
        "table_split_sizes_global",
        ["split", "row_count", "min_updated_at", "max_updated_at"],
        global_rows,
        "글로벌 split 크기",
        "최근 7일 staged snapshot의 global train/valid/test row 수를 기록한다.",
        ["artifacts/training-staging/post_report_all_segments/manifest.json"],
        ["학습 데이터 규모 설명"],
    )

    segment_rows: list[dict[str, object]] = []
    for segment in ["rare_equipment", "jewel", "unique_equipment", "skill_gem"]:
        stats = staged_manifest["segments"][segment]["stats"]
        for split in ["train", "valid", "test"]:
            segment_rows.append(
                {
                    "model_segment": segment,
                    "split": split,
                    "row_count": stats[split]["rowCount"],
                    "min_updated_at": stats[split]["minUpdatedAt"],
                    "max_updated_at": stats[split]["maxUpdatedAt"],
                }
            )
    builder.add_table(
        "chapter6",
        "table_split_sizes_by_segment",
        ["model_segment", "split", "row_count", "min_updated_at", "max_updated_at"],
        segment_rows,
        "세그먼트별 split 크기",
        "각 model_segment의 train/valid/test row 수를 split spec 기준으로 기록한다.",
        ["artifacts/training-staging/post_report_all_segments/manifest.json"],
        ["세그먼트별 데이터 규모 설명"],
    )

    comparison_rows = []
    for row in comparison_summary["comparison_rows"]:
        comparison_rows.append(
            {
                "segment": row["segment"],
                "global_log1p_rmse": round(float(row["global_target_rmse"]), 6),
                "segment_log1p_rmse": round(float(row["segment_target_rmse"]), 6),
                "global_log1p_mae": round(float(row["global_target_mae"]), 6),
                "segment_log1p_mae": round(float(row["segment_target_mae"]), 6),
                "global_chaos_rmse": round(float(row["global_chaos_rmse"]), 6),
                "segment_chaos_rmse": round(float(row["segment_chaos_rmse"]), 6),
                "winner": row["winner"],
                "status": row["status"],
            }
        )
    builder.add_table(
        "chapter6",
        "table_model_comparison_summary",
        [
            "segment",
            "global_log1p_rmse",
            "segment_log1p_rmse",
            "global_log1p_mae",
            "segment_log1p_mae",
            "global_chaos_rmse",
            "segment_chaos_rmse",
            "winner",
            "status",
        ],
        comparison_rows,
        "글로벌 vs 세그먼트 비교 요약",
        "winner 규칙 보정 후 기준 실험의 주요 비교 지표를 정리한다.",
        ["ml/runs/comparison_post_report_300iter_d8_log1p_winner/comparison_summary.json"],
        ["현 단계 혼합 기준선의 핵심 근거"],
    )

    rmse_figure = builder.add_figure(
        "chapter6",
        "figure_model_comparison_rmse",
        "세그먼트별 global vs segment log1p RMSE",
        "각 세그먼트에서 global 모델과 segment 모델의 test log1p RMSE를 비교한다.",
        ["table_model_comparison_summary"],
        ["어느 세그먼트가 분리 모델에 유리한지 시각화"],
    )
    figure, axis = plt.subplots(figsize=(10, 5.5))
    segments = [row["segment"] for row in comparison_rows]
    x_positions = list(range(len(segments)))
    global_values = [row["global_log1p_rmse"] for row in comparison_rows]
    segment_values = [row["segment_log1p_rmse"] for row in comparison_rows]
    width = 0.35
    axis.bar([x - width / 2 for x in x_positions], global_values, width=width, label="global", color="#0ea5e9")
    axis.bar([x + width / 2 for x in x_positions], segment_values, width=width, label="segment", color="#22c55e")
    axis.set_xticks(x_positions)
    axis.set_xticklabels(segments, rotation=15)
    axis.set_ylabel("target_price_log1p_rmse")
    axis.set_title("Global vs Segment RMSE")
    axis.grid(axis="y", alpha=0.25)
    axis.legend()
    save_figure(figure, rmse_figure)

    mae_figure = builder.add_figure(
        "chapter6",
        "figure_model_comparison_mae",
        "세그먼트별 global vs segment log1p MAE",
        "각 세그먼트에서 global 모델과 segment 모델의 test log1p MAE를 비교한다.",
        ["table_model_comparison_summary"],
        ["RMSE 외 보조 오차 지표 시각화"],
    )
    figure, axis = plt.subplots(figsize=(10, 5.5))
    global_values = [row["global_log1p_mae"] for row in comparison_rows]
    segment_values = [row["segment_log1p_mae"] for row in comparison_rows]
    axis.bar([x - width / 2 for x in x_positions], global_values, width=width, label="global", color="#38bdf8")
    axis.bar([x + width / 2 for x in x_positions], segment_values, width=width, label="segment", color="#84cc16")
    axis.set_xticks(x_positions)
    axis.set_xticklabels(segments, rotation=15)
    axis.set_ylabel("target_price_log1p_mae")
    axis.set_title("Global vs Segment MAE")
    axis.grid(axis="y", alpha=0.25)
    axis.legend()
    save_figure(figure, mae_figure)

    skill_gem_base = comparison_summary["segments"]["skill_gem"]
    skill_rows = [
        {
            "experiment": "global_on_skill_gem",
            "target_price_log1p_rmse": round(skill_gem_base["global_test"]["metrics"]["target_price_log1p_rmse"], 6),
            "target_price_log1p_mae": round(skill_gem_base["global_test"]["metrics"]["target_price_log1p_mae"], 6),
            "target_price_chaos_rmse": round(skill_gem_base["global_test"]["metrics"]["target_price_chaos_rmse"], 6),
            "notes": "global model evaluated on skill_gem test split",
        },
        {
            "experiment": "segment_skill_gem_300iter_d8",
            "target_price_log1p_rmse": round(skill_gem_base["segment_model"]["metrics"]["test"]["target_price_log1p_rmse"], 6),
            "target_price_log1p_mae": round(skill_gem_base["segment_model"]["metrics"]["test"]["target_price_log1p_mae"], 6),
            "target_price_chaos_rmse": round(skill_gem_base["segment_model"]["metrics"]["test"]["target_price_chaos_rmse"], 6),
            "notes": "winner-rule comparison run segment model",
        },
        {
            "experiment": "segment_skill_gem_500iter_d6",
            "target_price_log1p_rmse": round(followup_metrics["test"]["target_price_log1p_rmse"], 6),
            "target_price_log1p_mae": round(followup_metrics["test"]["target_price_log1p_mae"], 6),
            "target_price_chaos_rmse": round(followup_metrics["test"]["target_price_chaos_rmse"], 6),
            "notes": "follow-up tuning run",
        },
    ]
    builder.add_table(
        "chapter6",
        "table_skill_gem_followup",
        ["experiment", "target_price_log1p_rmse", "target_price_log1p_mae", "target_price_chaos_rmse", "notes"],
        skill_rows,
        "skill_gem 추가 점검 결과",
        "global 기준선, 기존 segment 모델, 후속 tuning segment 모델을 비교한다.",
        ["ml/runs/comparison_post_report_300iter_d8_log1p_winner/comparison_summary.json", "ml/runs/skill_gem_post_report_500iter_d6/metrics.json"],
        ["skill_gem을 글로벌 fallback으로 유지한 근거"],
    )

    artifact_rows = [
        {
            "display_name": "recent_7d_staged_snapshot",
            "actual_path": "artifacts/training-staging/post_report_all_segments/manifest.json",
            "generated_at": staged_manifest["generatedAt"],
            "hyperparameters": "days=7, feature_policy=clipboard_safe_v1",
            "used_in_report": "yes",
        },
        {
            "display_name": "winner_rule_adjusted_comparison_run",
            "actual_path": "ml/runs/comparison_post_report_300iter_d8_log1p_winner/comparison_summary.json",
            "generated_at": comparison_summary["generated_at"],
            "hyperparameters": "iterations=300, depth=8, learning_rate=0.05, target=target_price_log1p",
            "used_in_report": "yes",
        },
        {
            "display_name": "skill_gem_followup_run",
            "actual_path": "ml/runs/skill_gem_post_report_500iter_d6/metrics.json",
            "generated_at": "2026-04-22 follow-up run",
            "hyperparameters": "iterations=500, depth=6, learning_rate=0.05, segment=skill_gem",
            "used_in_report": "yes",
        },
    ]
    builder.add_table(
        "chapter6",
        "table_experiment_artifact_manifest",
        ["display_name", "actual_path", "generated_at", "hyperparameters", "used_in_report"],
        artifact_rows,
        "실험 산출물 manifest",
        "보고서 본문에서는 설명용 이름만 쓰고, 실제 경로는 별도 표로 분리한다.",
        ["comparison run outputs", "staged manifest", "follow-up run outputs"],
        ["본문과 실제 산출물 경로 연결"],
    )

    feature_rows: list[dict[str, object]] = []
    feature_sources = {
        "global": comparison_dir / "global" / "feature_importance.csv",
        "rare_equipment": comparison_dir / "segments" / "rare_equipment" / "feature_importance.csv",
        "jewel": comparison_dir / "segments" / "jewel" / "feature_importance.csv",
        "unique_equipment": comparison_dir / "segments" / "unique_equipment" / "feature_importance.csv",
        "skill_gem": comparison_dir / "segments" / "skill_gem" / "feature_importance.csv",
    }
    loaded_features = {name: load_feature_importance(path, top_n=8) for name, path in feature_sources.items()}
    for model_name, rows in loaded_features.items():
        for rank, row in enumerate(rows, start=1):
            feature_rows.append(
                {
                    "model_name": model_name,
                    "rank": rank,
                    "feature_name": row["feature"],
                    "importance": round(float(row["importance"]), 6),
                }
            )
    builder.add_table(
        "chapter6",
        "table_feature_importance_topn",
        ["model_name", "rank", "feature_name", "importance"],
        feature_rows,
        "feature importance 상위 피처 표",
        "global과 segment 모델별 상위 중요 피처를 본문 인용용으로 정리한다.",
        ["feature_importance.csv files under comparison_post_report_300iter_d8_log1p_winner"],
        ["모델이 어떤 피처에 반응하는지 설명"],
    )

    global_figure = builder.add_figure(
        "chapter6",
        "figure_feature_importance_global",
        "글로벌 모델 feature importance",
        "global 모델의 상위 중요 피처를 가로 막대로 표시한다.",
        ["ml/runs/comparison_post_report_300iter_d8_log1p_winner/global/feature_importance.csv"],
        ["global 모델 해석 보조"],
    )
    figure, axis = plt.subplots(figsize=(10, 6))
    rows = loaded_features["global"][:12]
    labels = [row["feature"] for row in rows][::-1]
    values = [row["importance"] for row in rows][::-1]
    axis.barh(labels, values, color="#0ea5e9")
    axis.set_title("Global Feature Importance (Top 12)")
    axis.set_xlabel("importance")
    axis.grid(axis="x", alpha=0.25)
    save_figure(figure, global_figure)

    segment_figure = builder.add_figure(
        "chapter6",
        "figure_feature_importance_by_segment",
        "세그먼트별 feature importance",
        "rare_equipment, jewel, unique_equipment, skill_gem의 상위 중요 피처를 2x2 서브플롯으로 비교한다.",
        ["feature_importance.csv files under comparison_post_report_300iter_d8_log1p_winner/segments"],
        ["세그먼트별 가격 형성 규칙 차이 설명"],
    )
    figure, axes = plt.subplots(2, 2, figsize=(14, 10))
    for axis, model_name, color in [
        (axes[0, 0], "rare_equipment", "#22c55e"),
        (axes[0, 1], "jewel", "#84cc16"),
        (axes[1, 0], "unique_equipment", "#f59e0b"),
        (axes[1, 1], "skill_gem", "#8b5cf6"),
    ]:
        rows = loaded_features[model_name][:8]
        labels = [row["feature"] for row in rows][::-1]
        values = [row["importance"] for row in rows][::-1]
        axis.barh(labels, values, color=color)
        axis.set_title(model_name)
        axis.grid(axis="x", alpha=0.25)
    figure.suptitle("Segment Feature Importance (Top 8)")
    save_figure(figure, segment_figure)


def generate_appendix(builder: AssetBuilder) -> None:
    glossary_rows = [
        {"term": "normalized listing", "definition": "priced item을 item 단위 row로 정규화한 중간 계층"},
        {"term": "staged dataset", "definition": "학습용 train/valid/test split CSV와 manifest를 함께 묶은 스냅샷"},
        {"term": "global fallback", "definition": "특정 세그먼트 전용 모델 대신 글로벌 모델을 사용하는 경로"},
        {"term": "model_segment", "definition": "rare_equipment, jewel, unique_equipment, skill_gem 구분값"},
        {"term": "clipboard_safe_v1", "definition": "현재 CatBoost 학습에 사용되는 Ctrl+C 재현 가능 피처 화이트리스트"},
        {"term": "target_price_log1p", "definition": "chaos equivalent 가격에 log1p를 적용한 현재 주 회귀 타깃"},
    ]
    builder.add_table(
        "appendix",
        "table_term_glossary",
        ["term", "definition"],
        glossary_rows,
        "용어 정리 표",
        "비전공 심사자를 위한 주요 구현 용어 정의다.",
        ["docs/REPORT_EVIDENCE_ASSET_INSTRUCTIONS_2026-04-24.md"],
        ["용어 혼란 완화"],
    )

    references_md = "\n".join(
        [
            "# Report References Draft",
            "",
            "1. Path of Exile Developer Docs - OAuth / Public Stash API",
            "2. CatBoost Documentation",
            "3. poe.ninja economy data reference",
            "4. RePoE project reference for affix dictionary source",
        ]
    )
    (builder.chapter_dirs["references"] / "report_references.md").write_text(references_md + "\n", encoding="utf-8")
    citation_rows = [
        {"chapter_section": "2.3 / 4.1 / 4.2", "reference": "PoE developer docs", "purpose": "OAuth, Public Stash API access 근거"},
        {"chapter_section": "5.3", "reference": "poe.ninja reference", "purpose": "chaos 환산 보조 데이터 설명"},
        {"chapter_section": "6.3", "reference": "CatBoost docs", "purpose": "모델 선정 및 mixed feature 처리 설명"},
        {"chapter_section": "3.2 / 6.2 / 7장 예정", "reference": "RePoE reference", "purpose": "affix dictionary source 설명"},
    ]
    builder.add_table(
        "references",
        "report_citation_map",
        ["chapter_section", "reference", "purpose"],
        citation_rows,
        "참고문헌 인용 매핑",
        "어느 장에서 어떤 참고문헌을 인용할지 초안 수준으로 정리한다.",
        ["docs/REPORT_EVIDENCE_ASSET_INSTRUCTIONS_2026-04-24.md"],
        ["최소 참고문헌 구조 마련"],
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate report evidence assets.")
    parser.add_argument("--report-date", default=DEFAULT_DATE)
    args = parser.parse_args()

    env_values = resolve_env()
    database_url = resolve_database_url(env_values)
    builder = AssetBuilder(args.report_date, env_values, database_url)

    target_league = env_values.get("TARGET_LEAGUE", "Mirage")
    generate_chapter2(builder)
    generate_chapter3(builder)
    generate_chapter4(builder, target_league)
    generate_chapter5(builder)
    generate_chapter6(builder)
    generate_appendix(builder)
    builder.finalize("reports_docs/generate_report_evidence_assets.py")

    print(f"report evidence assets generated: {builder.base_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
