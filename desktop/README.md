# PoE1 Desktop Local Item Value App

Electron MVP for the final demo. This app is a local utility that reads English PoE1 `Ctrl+C` item text and routes the item to the local classifier, local regressor, or a direct-search fallback.

## Current MVP Flow

The app demonstrates the final local utility flow:

1. Read English PoE1 `Ctrl+C` item text from clipboard, manual paste, or a demo sample.
2. Run the TypeScript clipboard parser and desktop feature builder.
3. Route by item type through `desktop/models/v2_mvp/model_manifest.json`.
4. Run the local Python CatBoost classifier/regressor subprocess when a model is available.
5. Show a user-facing decision card and keep technical JSON details in a collapsible section.

`Auto Watch Clipboard` is enabled by default. It polls the clipboard every `250ms`, ignores ordinary text through a PoE item signature gate, and avoids duplicate analysis with clipboard hashing, debounce, cooldown, and an in-flight guard. The manual paste, `Read Clipboard`, and `Analyze Item` flow remains available as the demo fallback.

When an analysis completes, the app also shows a small always-on-top floating result card. It summarizes the decision, score or predicted chaos value, item name, and recommendation, then hides automatically after a few seconds.

The floating card can be configured from the main window or from the card itself:

- `Auto hide`: show only when a result is ready, then hide after a few seconds.
- `Keep visible`: keep the card visible while the app is open.
- `Opacity`: adjust the card transparency with the slider.
- Drag the card's top bar to move it; the app remembers the position for the next show/restart.

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

## Windows Development Test

For development-mode testing on the Windows desktop machine:

1. Pull the repository.
2. Install Node.js 20+.
3. Install Python and create/install the project ML environment if it is not already available.
4. Run the setup script from the repository root.
5. Start the app and click `Run Check`.
6. Confirm every environment check is `OK`.
7. Test `Demo Samples` first.
8. Test live PoE1 English `Ctrl+C` text with `Read Clipboard`, `Analyze Item`, and `Auto Watch Clipboard`.
9. Confirm the floating result card appears above the game and can be moved/hidden.

In development mode, the app still uses the Python CatBoost predictor subprocess from the repository, so Python dependencies such as `catboost` and `pandas` must be available on the Windows machine.

Recommended PowerShell setup from the repository root:

```powershell
.\desktop\scripts\setup-windows.ps1
cd desktop
npm start
```

## Windows Installer Build

The final submission target is a Windows installer that includes the Electron app, prepared desktop model bundle, compiled feature builder, prediction script, demo samples, and an embedded Python runtime.

The current intended workflow is:

1. Train and prepare the desktop model bundle on the Mac development machine.
2. Commit or copy the completed `desktop/models/v2_mvp/` bundle to the Windows build machine.
3. Build the installer on Windows without retraining models.

### 1. Prepare Models On Mac

Run this from the repository root on the Mac development machine after ETL is up to date:

```bash
npm install
npm run prepare:desktop-models -- --days=7
npm run build
```

Confirm the prepared desktop bundle exists:

```text
desktop/models/v2_mvp/model_manifest.json
desktop/models/v2_mvp/rare_unique_classifier/model.cbm
desktop/models/v2_mvp/jewel_regressor/model.cbm
desktop/models/v2_mvp/skill_gem_regressor/model.cbm
```

Then make sure the Windows build machine receives the same `desktop/models/v2_mvp/` directory. This can be done by committing the model bundle if size is acceptable, or by copying the folder manually before running the installer build.

### 2. Build Installer On Windows

On the Windows build machine, do not run `prepare:desktop-models` unless you intentionally want to retrain there. The expected Windows flow uses the already prepared model files.

```powershell
npm install
cd desktop
npm install
cd ..
npm run build
powershell -ExecutionPolicy Bypass -File .\desktop\scripts\prepare-embedded-python.ps1
cd desktop
npm run verify:package-prereqs
npm run dist:win
```

Outputs are written under:

```text
desktop/release/
```

Packaging notes:

- `desktop/vendor/python-win/` is generated locally and ignored by Git.
- The installer bundles `desktop/vendor/python-win/` as `resources/python/`.
- The installer bundles the already prepared `desktop/models/v2_mvp/` as `resources/models/v2_mvp/`.
- The installer bundles root `dist/` so the app can build clipboard features without `npm` or `tsx`.
- In packaged mode, `Run Check` treats `npm` as not required and validates embedded resources instead.

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

Development-mode Windows smoke test checklist:

- `Run Check` passes.
- `rare-equipment-001` returns a classifier decision.
- `normal-jewel-001` returns a jewel regressor decision.
- `skill-gem-001` returns a skill gem regressor decision.
- `currency-001`, `map-001`, and `divination-card-001` return external price lookup guidance.
- `parse-failure-001` returns parse failed.
- Auto Watch detects a copied sample from Notepad.
- Auto Watch detects a copied item from the live PoE1 client.
- Floating card remains above the game window, can be moved, and remembers opacity/visibility settings.

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

In packaged installer mode, `npm` is not required at runtime. The app validates bundled resources under Electron `resources/` instead.

## Demo Samples

The `Demo Samples` selector loads stored English samples from:

```text
samples/clipboard/en/
```

This is the fallback demo path when PoE, Windows clipboard behavior, or the live client environment is unstable.

Recommended presentation samples:

- `rare-equipment-001`: rare equipment classifier route.
- `unique-equipment-001`: unique equipment classifier route.
- `normal-jewel-001`: jewel regressor route.
- `skill-gem-001`: skill gem regressor route.
- `currency-001`: external price lookup route.
- `map-001`: external price lookup route.
- `divination-card-001`: external price lookup route.
- `parse-failure-001`: parse failed fallback route.

## Scope

- English PoE1 Ctrl+C item text
- Polling-based clipboard auto watch with ON/OFF toggle
- Always-on-top floating result card
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
npm run --silent desktop:clipboard-features -- --input samples/clipboard/en/currency-001.txt | node scripts/run-python.js ml/predict_desktop_item_value.py --manifest desktop/models/v2_mvp/model_manifest.json --classifier-search-threshold 0.70
npm run --silent desktop:clipboard-features -- --input samples/clipboard/en/map-001.txt | node scripts/run-python.js ml/predict_desktop_item_value.py --manifest desktop/models/v2_mvp/model_manifest.json --classifier-search-threshold 0.70
npm run --silent desktop:clipboard-features -- --input samples/clipboard/en/parse-failure-001.txt | node scripts/run-python.js ml/predict_desktop_item_value.py --manifest desktop/models/v2_mvp/model_manifest.json --classifier-search-threshold 0.70
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
