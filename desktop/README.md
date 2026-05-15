# PoE1 V2 Local Item Value App

Electron MVP for the V2 final demo. This app is a local utility that reads English PoE1 `Ctrl+C` item text and shows whether the item is likely worth searching or selling.

## Current MVP Flow

The app demonstrates the final local utility flow:

1. Read English PoE1 `Ctrl+C` item text from clipboard, manual paste, or a demo sample.
2. Run the TypeScript clipboard parser and V2 mod-aware feature builder.
3. Run the local Python CatBoost classifier subprocess.
4. Show a user-facing decision card and keep technical JSON details in a collapsible section.

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

1. `npm run v2:clipboard-features`
2. `ml/predict_item_value.py`

Default paths are prefilled:

```text
desktop/models/v2_mvp/model.cbm
desktop/models/v2_mvp/feature_schema.json
threshold = 0.40
```

The current Git-tracked MVP model files are expected at:

```text
desktop/models/v2_mvp/model.cbm
desktop/models/v2_mvp/feature_schema.json
desktop/models/v2_mvp/run_info.json
```

If these files are missing, the app shows a warning and you can enter another trained run path manually.

## Windows Test Checklist

On the Windows desktop machine:

1. Pull the repository.
2. Install Node.js 20+.
3. Install Python and create/install the project ML environment if it is not already available.
4. Run `npm install` from the repository root.
5. Install Python ML dependencies.
6. Run `cd desktop && npm install && npm start`.
7. Confirm the top status says the default model and schema are found.
8. Test `Demo Samples` first, then test live PoE1 English `Ctrl+C` text with `Read Clipboard` and `Analyze Item`.

The app still uses the Python CatBoost predictor subprocess, so Python dependencies such as `catboost` and `pandas` must be available on the Windows machine.

Example PowerShell setup from the repository root:

```powershell
npm install
py -3 -m venv ml\.venv
.\ml\.venv\Scripts\python.exe -m pip install -r ml\requirements.txt
cd desktop
npm install
npm start
```

If you do not use `ml\.venv`, make sure `python` is available on `PATH`, or set `POE_VALUE_APP_PYTHON` to the Python executable path before starting the app.

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
- Local parser, V2 feature builder, and CatBoost classifier subprocess
- Friendly unsupported item, parser failure, and inference failure messages
- Primary model scope: rare equipment and unique equipment
- No overlay, auto-clicking, automation, or game control

## Out of Scope

- Korean client support
- OCR or screen reading
- Game input automation
- Installer or auto-update
- Guaranteed sale price prediction

## Worker Decision

The app currently keeps the simple subprocess path. The TypeScript feature generation step measured at roughly `0.4s` for a sample rare item on the development machine. The UI also displays feature and prediction latency after each run.

Only add a persistent Python worker if full end-to-end prediction repeatedly exceeds the demo target of about `2-3s` per item.
