# Final Report Follow-up Requests for Coding Agent

## Purpose

This document lists the remaining repository-side materials that would improve the final report after third-party review. The report text has already been revised for items that can be handled directly in the document. The items below require repository verification, screenshots, or generated assets.

## 1. Screenshots for Chapter 7/8

The report now describes the Electron desktop app, Auto Watch, Floating Result Card, model routing, tray behavior, and installer. To make the app implementation more convincing, please prepare actual screenshots.

Create or update the following files under:

```text
report_assets/2026-06-final/screenshots/
```

Recommended files:

```text
screenshot_main_window.png
screenshot_run_check_ok.png
screenshot_auto_watch_enabled.png
screenshot_floating_card_search_worthy.png
screenshot_floating_card_high_value_or_manual_check.png
screenshot_external_lookup_recommended.png
screenshot_parse_failed.png
screenshot_tray_menu.png
screenshot_installed_app_start.png
screenshot_release_page_or_installer_file.png
```

Requirements:

- Use the Windows installed app where possible.
- If actual PoE1 client capture is possible, include one screenshot or short note showing `Ctrl+C -> Auto Watch -> Floating Card`.
- Do not include secrets, `.env`, OAuth credentials, or private account information.
- If screenshots cannot be captured in time, update `screenshot_capture_checklist.md` with exact reasons and recommended fallback images.

## 2. Decision Policy Evidence

The report now explains how raw model outputs map to user-facing decision labels.

Please verify that the report text matches the current `desktop/models/v2_mvp/model_manifest.json` decision policy.

Expected current policy:

```text
Classifier route:
score < 0.50               -> low listed value
0.50 <= score < 0.70       -> manual check
0.70 <= score < 0.88       -> search-worthy
0.88 <= score              -> high-value candidate

Regressor route:
predicted chaos < 5        -> low listed value
5 <= predicted chaos < 30  -> manual check
30 <= predicted chaos < 300 -> search-worthy
300 <= predicted chaos     -> high-value candidate
```

Please generate or update:

```text
report_assets/2026-06-final/chapter7/table_decision_policy_mapping.md
report_assets/2026-06-final/chapter7/table_decision_policy_mapping.csv
```

Columns:

```text
route_type, input_value, condition, decision_label, user_meaning
```

Also update `captions.md` with a caption such as:

```text
표 7-x 모델 출력값과 앱 Decision Label 변환 정책
```

## 3. Release / Installer Manifest Refresh

The report currently uses the manually confirmed release information:

```text
Tag: desktop-v0.1.0
Installer: PoE1.Item.Value.Triage.Setup.0.1.0.exe
Installer size: 266 MB
Commit: 8a82b4c9cad68ec5173896d60bdbfdef409921ba
Release URI: https://github.com/sinbumu/PoE1-Local-Item-Value-Prediction-System/releases/tag/desktop-v0.1.0
```

Please update repository-side report assets so they no longer say `미지정` or `추가 확인 필요` for release fields.

Files to update:

```text
report_assets/2026-06-final/README.md
report_assets/2026-06-final/manifest.json
report_assets/2026-06-final/chapter8/table_release_installer_summary.md
report_assets/2026-06-final/chapter8/table_release_installer_summary.csv
report_assets/2026-06-final/appendix/table_release_artifact_manifest.md
report_assets/2026-06-final/appendix/table_release_artifact_manifest.csv
```

## 4. Latency Summary if Available

The report can still be submitted without this, but a small latency table would improve the app implementation section.

If feasible, run 3-5 sample predictions in the installed app or development app and summarize:

```text
sample_id, route, feature_ms, predict_ms, total_ms, environment
```

Output:

```text
report_assets/2026-06-final/chapter8/table_prediction_latency_summary.md
report_assets/2026-06-final/chapter8/table_prediction_latency_summary.csv
```

If latency cannot be measured reliably, keep `N/A` but state why.

## 5. Final Smoke Test Status Refresh

Please verify and update the final smoke test table with the latest status.

Items to confirm:

- Windows installed app launches without separate Node/Python installation
- rare sample prediction works
- unique sample prediction works
- jewel sample prediction works
- skill gem sample prediction works
- currency/map/divination card external lookup recommendation works
- malformed input parse failure works
- actual PoE1 English `Ctrl+C -> Auto Watch -> Floating Card` works at least in a short test
- Floating card can be moved/reset and does not break the demo
- Tray restore/quit works

Update:

```text
report_assets/2026-06-final/chapter8/table_windows_smoke_test.md
report_assets/2026-06-final/chapter8/table_windows_smoke_test.csv
```

Use status labels consistently:

```text
검증 완료
부분 검증
추가 확인 필요
미검증
```

## 6. Optional: PoE Domain Explanation Asset

The report text now explains that no official final trade execution price API is available, so public listing price is used as a noisy approximate label. If possible, add a small reference note or citation mapping for this limitation.

Possible file:

```text
report_assets/2026-06-final/references/domain_data_limitations.md
```

Include:

- Public Stash API provides public listing/stash data, not final sale execution logs.
- The model target is therefore public listing price, not actual sale price.
- The app output must be described as search/sell priority triage.

## 7. Do Not Change

Do not re-open broad model-scope changes at this point unless a critical bug is found.

Avoid:

- New model architecture experiments
- New item type expansion beyond current routing
- Korean client support
- OCR/screen reading
- automatic game input/click/selling
- trying to prove actual sale price prediction

The final report is already positioned as:

```text
Public listing data -> ETL -> CatBoost models -> item routing -> Electron desktop triage utility
```

The remaining work should focus on evidence, screenshots, and final verification.
