#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import os
import subprocess
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable


REPORTS_DIR = Path(__file__).resolve().parent
ROOT_DIR = REPORTS_DIR.parent
os.environ.setdefault("MPLCONFIGDIR", str(REPORTS_DIR / ".mplconfig"))
os.environ.setdefault("XDG_CACHE_HOME", str(REPORTS_DIR / ".cache"))
Path(os.environ["MPLCONFIGDIR"]).mkdir(parents=True, exist_ok=True)
Path(os.environ["XDG_CACHE_HOME"]).mkdir(parents=True, exist_ok=True)

try:
    import matplotlib.dates as mdates
    import matplotlib.pyplot as plt
except ModuleNotFoundError:
    print(
        "matplotlib가 설치되어 있지 않습니다. "
        "예: python3 -m pip install matplotlib",
        file=sys.stderr,
    )
    raise


DEFAULT_HOURS = 72
DEFAULT_SAMPLE_PERCENT = 0.2


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


def resolve_database_url() -> str:
    database_url = os.environ.get("DATABASE_URL")
    if database_url:
        return database_url

    env_path = ROOT_DIR / ".env"
    env_values = load_env_file(env_path)
    database_url = env_values.get("DATABASE_URL")
    if database_url:
        return database_url

    raise RuntimeError("DATABASE_URL을 찾을 수 없습니다. .env 또는 환경 변수로 설정해 주세요.")


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


def parse_utc(value: str) -> datetime:
    normalized = value.replace(" ", "T")
    if normalized.endswith("+00"):
        normalized += ":00"
    return datetime.fromisoformat(normalized).astimezone(timezone.utc)


def save_figure(figure, output_path: Path) -> Path:
    figure.tight_layout()
    figure.savefig(output_path, dpi=180)
    plt.close(figure)
    return output_path


def humanize_gb(total_bytes: int) -> str:
    return f"{total_bytes / (1024 ** 3):.2f} GB"


def plot_raw_volume(database_url: str, hours: int, prefix: str) -> Path:
    result = run_psql_csv(
        database_url,
        f"""
SELECT date_trunc('hour', fetched_at) AS hour_utc, COUNT(*) AS raw_count
FROM raw_api_responses
WHERE fetched_at >= NOW() - INTERVAL '{hours} hours'
GROUP BY 1
ORDER BY 1;
""".strip(),
    )

    x_values = [parse_utc(row["hour_utc"]) for row in result.rows]
    y_values = [int(row["raw_count"]) for row in result.rows]

    figure, axis = plt.subplots(figsize=(12, 6))
    axis.bar(x_values, y_values, width=0.03, color="#3b82f6", edgecolor="#1d4ed8")
    axis.set_title(f"Raw API Responses per Hour (last {hours}h)")
    axis.set_xlabel("UTC time")
    axis.set_ylabel("raw response count")
    axis.grid(axis="y", alpha=0.25)
    axis.xaxis.set_major_formatter(mdates.DateFormatter("%m-%d\n%H:%M"))
    figure.autofmt_xdate()

    output_path = REPORTS_DIR / f"{prefix}_raw_collection_last_{hours}h.png"
    return save_figure(figure, output_path)


def plot_divine_exchange(database_url: str, hours: int, prefix: str) -> Path:
    result = run_psql_csv(
        database_url,
        f"""
SELECT sample_time_utc, chaos_equivalent
FROM exchange_rate_snapshots
WHERE normalized_currency_code = 'divine'
  AND sample_time_utc >= NOW() - INTERVAL '{hours} hours'
ORDER BY sample_time_utc;
""".strip(),
    )

    x_values = [parse_utc(row["sample_time_utc"]) for row in result.rows]
    y_values = [float(row["chaos_equivalent"]) for row in result.rows]

    figure, axis = plt.subplots(figsize=(12, 6))
    axis.plot(x_values, y_values, color="#ef4444", linewidth=2.2)
    axis.fill_between(x_values, y_values, alpha=0.12, color="#ef4444")
    axis.set_title(f"Divine Orb Chaos Equivalent (last {hours}h)")
    axis.set_xlabel("UTC time")
    axis.set_ylabel("chaos equivalent")
    axis.grid(alpha=0.25)
    axis.xaxis.set_major_formatter(mdates.DateFormatter("%m-%d\n%H:%M"))
    figure.autofmt_xdate()

    output_path = REPORTS_DIR / f"{prefix}_divine_exchange_last_{hours}h.png"
    return save_figure(figure, output_path)


def plot_table_sizes(database_url: str, prefix: str) -> Path:
    result = run_psql_csv(
        database_url,
        """
SELECT relname, pg_total_relation_size(relid) AS total_bytes
FROM pg_catalog.pg_statio_user_tables
WHERE relname IN ('raw_api_responses', 'normalized_priced_items', 'exchange_rate_snapshots')
ORDER BY total_bytes DESC;
""".strip(),
    )

    labels = [row["relname"] for row in result.rows]
    values = [int(row["total_bytes"]) / (1024 ** 3) for row in result.rows]

    figure, axis = plt.subplots(figsize=(11, 5.5))
    bars = axis.barh(labels, values, color=["#8b5cf6", "#14b8a6", "#f59e0b"])
    axis.invert_yaxis()
    axis.set_title("PostgreSQL Table Sizes")
    axis.set_xlabel("size (GB)")
    axis.grid(axis="x", alpha=0.25)

    for bar, row in zip(bars, result.rows):
        total_bytes = int(row["total_bytes"])
        axis.text(
            bar.get_width() + max(values) * 0.01,
            bar.get_y() + bar.get_height() / 2,
            humanize_gb(total_bytes),
            va="center",
            fontsize=9,
        )

    output_path = REPORTS_DIR / f"{prefix}_table_sizes.png"
    return save_figure(figure, output_path)


def plot_currency_share_sample(database_url: str, prefix: str, sample_percent: float) -> Path:
    result = run_psql_csv(
        database_url,
        f"""
SET statement_timeout='20s';
SELECT COALESCE(price_currency, '(null)') AS price_currency, COUNT(*) AS listing_count
FROM normalized_priced_items TABLESAMPLE SYSTEM ({sample_percent})
GROUP BY 1
ORDER BY listing_count DESC
LIMIT 10;
""".strip(),
    )

    labels = [row["price_currency"] for row in result.rows]
    values = [int(row["listing_count"]) for row in result.rows]

    figure, axis = plt.subplots(figsize=(10, 5.5))
    bars = axis.bar(labels, values, color="#0ea5e9", edgecolor="#0369a1")
    axis.set_title(f"Listing Currency Share (sample-based, {sample_percent:.1f}% table sample)")
    axis.set_xlabel("price currency")
    axis.set_ylabel("sample listing count")
    axis.grid(axis="y", alpha=0.25)
    axis.tick_params(axis="x", rotation=25)

    for bar, value in zip(bars, values):
        axis.text(
            bar.get_x() + bar.get_width() / 2,
            bar.get_height() + max(values) * 0.01,
            str(value),
            ha="center",
            va="bottom",
            fontsize=8,
        )

    output_path = REPORTS_DIR / f"{prefix}_currency_share_sample.png"
    return save_figure(figure, output_path)


def plot_top_type_lines_sample(database_url: str, prefix: str, sample_percent: float) -> Path:
    result = run_psql_csv(
        database_url,
        f"""
SET statement_timeout='20s';
SELECT type_line, COUNT(*) AS listing_count
FROM normalized_priced_items TABLESAMPLE SYSTEM ({sample_percent})
WHERE type_line IS NOT NULL AND type_line <> ''
GROUP BY type_line
ORDER BY listing_count DESC
LIMIT 15;
""".strip(),
    )

    labels = [row["type_line"] for row in result.rows]
    values = [int(row["listing_count"]) for row in result.rows]

    figure, axis = plt.subplots(figsize=(12, 7))
    bars = axis.barh(labels, values, color="#22c55e", edgecolor="#15803d")
    axis.invert_yaxis()
    axis.set_title(f"Top Item Types by Listing Volume (sample-based, {sample_percent:.1f}% table sample)")
    axis.set_xlabel("sample listing count")
    axis.grid(axis="x", alpha=0.25)

    for bar, value in zip(bars, values):
        axis.text(
            bar.get_width() + max(values) * 0.01,
            bar.get_y() + bar.get_height() / 2,
            str(value),
            va="center",
            fontsize=8,
        )

    output_path = REPORTS_DIR / f"{prefix}_top_item_types_sample.png"
    return save_figure(figure, output_path)


def plot_rarity_share_sample(database_url: str, prefix: str, sample_percent: float) -> Path:
    result = run_psql_csv(
        database_url,
        f"""
SET statement_timeout='20s';
SELECT COALESCE(rarity, '(null)') AS rarity, COUNT(*) AS listing_count
FROM normalized_priced_items TABLESAMPLE SYSTEM ({sample_percent})
GROUP BY 1
ORDER BY listing_count DESC;
""".strip(),
    )

    labels = [row["rarity"] for row in result.rows]
    values = [int(row["listing_count"]) for row in result.rows]

    figure, axis = plt.subplots(figsize=(8.5, 5.5))
    colors = ["#f97316", "#a855f7", "#94a3b8", "#eab308", "#38bdf8"]
    axis.pie(
        values,
        labels=labels,
        autopct="%1.1f%%",
        startangle=90,
        colors=colors[: len(values)],
        textprops={"fontsize": 9},
    )
    axis.set_title(f"Rarity Composition (sample-based, {sample_percent:.1f}% table sample)")

    output_path = REPORTS_DIR / f"{prefix}_rarity_share_sample.png"
    return save_figure(figure, output_path)


def plot_chaos_price_hist_sample(database_url: str, prefix: str, sample_percent: float) -> Path:
    result = run_psql_csv(
        database_url,
        f"""
SET statement_timeout='20s';
SELECT width_bucket(price_amount::numeric, 0, 100, 20) AS bucket,
       COUNT(*) AS listing_count
FROM normalized_priced_items TABLESAMPLE SYSTEM ({sample_percent})
WHERE price_currency = 'chaos'
  AND price_amount IS NOT NULL
  AND price_amount > 0
  AND price_amount <= 100
GROUP BY bucket
ORDER BY bucket;
""".strip(),
    )

    labels: list[str] = []
    values: list[int] = []
    for row in result.rows:
        bucket = int(row["bucket"])
        count = int(row["listing_count"])
        if bucket == 21:
            labels.append(">100")
        else:
            start = (bucket - 1) * 5
            end = bucket * 5
            labels.append(f"{start}-{end}")
        values.append(count)

    figure, axis = plt.subplots(figsize=(12, 6))
    axis.bar(labels, values, color="#f59e0b", edgecolor="#b45309")
    axis.set_title(f"Chaos Price Distribution (sample-based, {sample_percent:.1f}% table sample)")
    axis.set_xlabel("price range (chaos)")
    axis.set_ylabel("sample listing count")
    axis.grid(axis="y", alpha=0.25)
    axis.tick_params(axis="x", rotation=45)

    output_path = REPORTS_DIR / f"{prefix}_chaos_price_hist_sample.png"
    return save_figure(figure, output_path)


def plot_listing_lifetime_sample(database_url: str, prefix: str, sample_percent: float) -> Path:
    result = run_psql_csv(
        database_url,
        f"""
SET statement_timeout='20s';
SELECT width_bucket(EXTRACT(EPOCH FROM (updated_at - inserted_at))/3600.0, 0, 168, 14) AS bucket,
       COUNT(*) AS listing_count
FROM normalized_priced_items TABLESAMPLE SYSTEM ({sample_percent})
WHERE updated_at >= inserted_at
GROUP BY bucket
ORDER BY bucket;
""".strip(),
    )

    labels: list[str] = []
    values: list[int] = []
    for row in result.rows:
        bucket = int(row["bucket"])
        count = int(row["listing_count"])
        if bucket <= 0:
            labels.append("<0")
        elif bucket >= 15:
            labels.append(">168h")
        else:
            start = (bucket - 1) * 12
            end = bucket * 12
            labels.append(f"{start}-{end}h")
        values.append(count)

    figure, axis = plt.subplots(figsize=(12, 6))
    axis.bar(labels, values, color="#8b5cf6", edgecolor="#6d28d9")
    axis.set_title(f"Listing Lifetime Distribution (sample-based, {sample_percent:.1f}% table sample)")
    axis.set_xlabel("updated_at - inserted_at")
    axis.set_ylabel("sample listing count")
    axis.grid(axis="y", alpha=0.25)
    axis.tick_params(axis="x", rotation=35)

    output_path = REPORTS_DIR / f"{prefix}_listing_lifetime_sample.png"
    return save_figure(figure, output_path)


def write_visual_report(prefix: str, hours: int, sample_percent: float, created_paths: list[Path]) -> Path:
    image_names = {path.name for path in created_paths}
    report_path = REPORTS_DIR / f"{prefix}_visual_report.md"

    def image_block(name: str, title: str, summary: str) -> str:
        return "\n".join(
            [
                f"## {title}",
                "",
                summary,
                "",
                f"![{title}](./{name})",
                "",
            ]
        )

    sections = [
        f"# {prefix} 시각화 리포트",
        "",
        "이 문서는 같은 폴더에 생성된 PNG 차트를 한 번에 스크롤하며 볼 수 있도록 만든 발표용 뷰어 문서입니다.",
        "",
        "## 주의",
        "",
        f"- `last {hours}h` 차트는 최근 시간 구간의 실제 집계입니다.",
        f"- `sample-based` 차트는 `normalized_priced_items TABLESAMPLE SYSTEM ({sample_percent:.1f})` 기반 탐색용 시각화입니다.",
        "- 즉, 운영 상태 차트는 비교적 직접적인 수치이고, 샘플 차트는 시장 구조와 패턴을 설명하는 용도로 보는 것이 적절합니다.",
        "",
    ]

    ordered_blocks = [
        (
            f"{prefix}_raw_collection_last_{hours}h.png",
            "시간대별 Raw 수집량",
            "수집기가 실제로 연속 동작 중이며 시간대별로 raw 응답이 꾸준히 들어오고 있음을 보여줍니다.",
        ),
        (
            f"{prefix}_divine_exchange_last_{hours}h.png",
            "Divine Orb 환율 추이",
            "향후 `target_price_chaos` 라벨링을 위한 환율 스냅샷이 이미 누적되고 있다는 점을 보여줍니다.",
        ),
        (
            f"{prefix}_table_sizes.png",
            "PostgreSQL 테이블 규모",
            "raw와 normalized의 저장 비용 차이, 그리고 왜 retention/archive 정책이 필요한지 설명하기 좋습니다.",
        ),
        (
            f"{prefix}_currency_share_sample.png",
            "가격 통화 분포",
            "실제 매물 가격이 주로 `chaos`와 `divine`에 몰려 있음을 보여주며, 환율 정규화 필요성을 설명하는 데 유용합니다.",
        ),
        (
            f"{prefix}_top_item_types_sample.png",
            "상위 아이템 타입 분포",
            "현재 시장에 많이 올라오는 아이템 타입을 보여주며, 어떤 도메인 구간이 데이터셋에서 두드러지는지 설명할 수 있습니다.",
        ),
        (
            f"{prefix}_rarity_share_sample.png",
            "희귀도 구성",
            "Rare와 Unique가 큰 비중을 차지하고 있어 향후 모델 후보군과 실제 수집 데이터가 어느 정도 맞물리는지 설명할 수 있습니다.",
        ),
        (
            f"{prefix}_chaos_price_hist_sample.png",
            "Chaos 가격 분포",
            "저가 매물이 매우 많고 고가 매물은 상대적으로 적은 롱테일 구조를 시각적으로 보여줍니다.",
        ),
        (
            f"{prefix}_listing_lifetime_sample.png",
            "매물 생존 시간 분포",
            "매물이 등록 직후 바로 사라지는 것만은 아니며, 일정 시간 이상 유지되는 매물이 많다는 점을 보여줍니다.",
        ),
    ]

    for name, title, summary in ordered_blocks:
        if name in image_names:
            sections.append(image_block(name, title, summary))

    report_path.write_text("\n".join(sections).strip() + "\n", encoding="utf-8")
    return report_path


def print_created(paths: Iterable[Path]) -> None:
    print("생성된 파일:")
    for path in paths:
        print(f"- {path.relative_to(ROOT_DIR)}")


def main() -> int:
    parser = argparse.ArgumentParser(description="발표용 PNG 차트 생성")
    parser.add_argument(
        "--hours",
        type=int,
        default=DEFAULT_HOURS,
        help=f"최근 몇 시간 데이터를 차트에 반영할지 지정합니다. 기본값: {DEFAULT_HOURS}",
    )
    parser.add_argument(
        "--prefix",
        default=datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        help="출력 파일명 prefix. 예: 2026-03-28",
    )
    parser.add_argument(
        "--sample-percent",
        type=float,
        default=DEFAULT_SAMPLE_PERCENT,
        help=f"sample-based 차트에 사용할 TABLESAMPLE 비율(퍼센트). 기본값: {DEFAULT_SAMPLE_PERCENT}",
    )
    args = parser.parse_args()

    database_url = resolve_database_url()
    plt.style.use("default")

    created_paths = [
        plot_raw_volume(database_url, args.hours, args.prefix),
        plot_divine_exchange(database_url, args.hours, args.prefix),
        plot_table_sizes(database_url, args.prefix),
        plot_currency_share_sample(database_url, args.prefix, args.sample_percent),
        plot_top_type_lines_sample(database_url, args.prefix, args.sample_percent),
        plot_rarity_share_sample(database_url, args.prefix, args.sample_percent),
        plot_chaos_price_hist_sample(database_url, args.prefix, args.sample_percent),
        plot_listing_lifetime_sample(database_url, args.prefix, args.sample_percent),
    ]
    created_paths.append(
        write_visual_report(args.prefix, args.hours, args.sample_percent, created_paths)
    )

    print_created(created_paths)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
