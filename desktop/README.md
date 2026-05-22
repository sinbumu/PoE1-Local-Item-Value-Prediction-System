# PoE1 Desktop Local Item Value App

Electron MVP for the final demo. This app is a local utility that reads English PoE1 `Ctrl+C` item text and routes the item to the local classifier, local regressor, or a direct-search fallback.

## Current MVP Flow

The app demonstrates the final local utility flow:

1. Read English PoE1 `Ctrl+C` item text from clipboard, manual paste, or a demo sample.
2. Run the TypeScript clipboard parser and desktop feature builder.
3. Route by item type through `desktop/models/v2_mvp/model_manifest.json`.
4. Run the local Python CatBoost classifier/regressor subprocess when a model is available.
5. Show a user-facing decision card and keep technical JSON details in a collapsible section.

## Run

From the repository root, install the main Node dependencies first:

```bash
npm install
```

Then install and run the Electron app:

```bash
cd desktop
npm install
npm start
```

The app calls the repository tools from the project root:

1. `npm run desktop:clipboard-features`
2. `ml/predict_desktop_item_value.py`

Default paths are prefilled:

```text
desktop/models/v2_mvp/model_manifest.json
desktop/models/v2_mvp/model.cbm
desktop/models/v2_mvp/feature_schema.json
classifier search threshold = 0.70
```

The current Git-tracked MVP model files are expected at:

```text
desktop/models/v2_mvp/model_manifest.json
desktop/models/v2_mvp/model.cbm
desktop/models/v2_mvp/feature_schema.json
desktop/models/v2_mvp/run_info.json
```

The checked-in bundle keeps the existing rare/unique classifier available. After running `npm run prepare:desktop-models`, the desktop bundle can also include:

```text
desktop/models/v2_mvp/rare_unique_classifier/
desktop/models/v2_mvp/jewel_regressor/
desktop/models/v2_mvp/skill_gem_regressor/
```

If a routed model file is missing, the app returns `direct search recommended` instead of making an unsupported prediction.

## Prepare Desktop Models

After ETL has been refreshed, run this from the repository root to stage, train, and copy the app model bundle:

```bash
npm run prepare:desktop-models -- --days=7
```

This command stages V2 rare/unique data, stages V1 jewel/skill_gem data, trains the CatBoost models, copies artifacts into `desktop/models/v2_mvp/`, and writes a fresh `model_manifest.json`.

## Windows Test Checklist

On the Windows desktop machine:

1. Pull the repository.
2. Install Node.js 20+.
3. Install Python and create/install the project ML environment if it is not already available.
4. Run the setup script from the repository root.
5. Start the app and click `Run Check`.
6. Confirm every environment check is `OK`.
7. Test `Demo Samples` first, then test live PoE1 English `Ctrl+C` text with `Read Clipboard` and `Analyze Item`.

The app still uses the Python CatBoost predictor subprocess, so Python dependencies such as `catboost` and `pandas` must be available on the Windows machine.

Recommended PowerShell setup from the repository root:

```powershell
.\desktop\scripts\setup-windows.ps1
cd desktop
npm start
```

The setup script checks model files, installs root and desktop npm dependencies, creates `ml\.venv`, installs Python ML dependencies, and verifies a sample prediction.

If PowerShell blocks local scripts, run:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\desktop\scripts\setup-windows.ps1
```

If you do not use `ml\.venv`, make sure `python` is available on `PATH`, or set `POE_VALUE_APP_PYTHON` to the Python executable path before starting the app.

Manual equivalent:

```powershell
npm install
py -3 -m venv ml\.venv
.\ml\.venv\Scripts\python.exe -m pip install -r ml\requirements.txt
cd desktop
npm install
npm start
```

## Environment Check

The app has a `Run Check` button. Use it before `Analyze Item`, especially on Windows.

It verifies:

- `desktop/models/v2_mvp/model_manifest.json`
- `desktop/models/v2_mvp/model.cbm`
- `desktop/models/v2_mvp/feature_schema.json`
- `npm`
- Python executable
- Python `catboost` / `pandas`
- TypeScript desktop feature builder

## Demo Samples

The `Demo Samples` selector loads stored English samples from:

```text
samples/clipboard/en/
```

This is the fallback demo path when PoE, Windows clipboard behavior, or the live client environment is unstable.

## Scope

- English PoE1 Ctrl+C item text
- Clipboard read button and manual paste
- Stored demo sample loading
- Local parser, desktop feature builder, and CatBoost classifier/regressor subprocess
- Primary classifier scope: rare equipment and unique equipment
- Regression routing scope: jewel and skill gem when model artifacts are available
- Fallback scope: direct search or external price lookup recommendations for unsupported model classes
- No overlay, auto-clicking, automation, or game control

## Routing And Decision Policy

- `rare_equipment`, `unique_equipment`: V2 mod-aware classifier.
- `jewel`, `skill_gem`: V1 summary regressor when the corresponding model exists.
- Currency, maps, fragments, cards, and similar commodity items: external price lookup recommendation.
- Missing model artifacts: direct trade search recommendation.

Classifier decisions use conservative thresholds: `<0.50 low listed value`, `0.50-0.70 manual check`, `0.70-0.88 search-worthy`, `>=0.88 high-value candidate`.

Regressor decisions use chaos estimates: `<5 low listed value`, `5-30 manual check`, `30-300 search-worthy`, `>=300 high-value candidate`.

## End-To-End CLI Checks

Run these from the repository root:

```bash
npm run typecheck
npm run --silent desktop:clipboard-features -- --input samples/clipboard/en/rare-equipment-001.txt
npm run --silent desktop:clipboard-features -- --input samples/clipboard/en/skill-gem-001.txt
npm run --silent desktop:clipboard-features -- --input samples/clipboard/en/rare-equipment-001.txt | node scripts/run-python.js ml/predict_desktop_item_value.py --manifest desktop/models/v2_mvp/model_manifest.json --classifier-search-threshold 0.70
npm run --silent desktop:clipboard-features -- --input samples/clipboard/en/skill-gem-001.txt | node scripts/run-python.js ml/predict_desktop_item_value.py --manifest desktop/models/v2_mvp/model_manifest.json --classifier-search-threshold 0.70
```

## Out of Scope

- Korean client support
- OCR or screen reading
- Game input automation
- Installer or auto-update
- Guaranteed sale price prediction

## Worker Decision

The app currently keeps the simple subprocess path. The TypeScript feature generation step measured at roughly `0.4s` for a sample rare item on the development machine. The UI also displays feature and prediction latency after each run.

Only add a persistent Python worker if full end-to-end prediction repeatedly exceeds the demo target of about `2-3s` per item.
