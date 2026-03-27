#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
REPORTS_DIR="$ROOT_DIR/reports_docs"
VENV_DIR="/tmp/poe1-report-venv"

if [[ ! -x "$VENV_DIR/bin/python" ]]; then
  python3 -m venv "$VENV_DIR"
fi

if [[ ! -f "$VENV_DIR/.matplotlib-installed" ]]; then
  "$VENV_DIR/bin/pip" install matplotlib
  touch "$VENV_DIR/.matplotlib-installed"
fi

mkdir -p "$REPORTS_DIR/.mplconfig" "$REPORTS_DIR/.cache"

export MPLCONFIGDIR="$REPORTS_DIR/.mplconfig"
export XDG_CACHE_HOME="$REPORTS_DIR/.cache"

"$VENV_DIR/bin/python" "$REPORTS_DIR/generate_report_charts.py" "$@"
