# PoE1 V2 Local Item Value App

Electron MVP for the V2 final demo.

## Current MVP Flow

The app demonstrates the final local utility flow:

1. Read English PoE1 `Ctrl+C` item text from clipboard, manual paste, or a demo sample.
2. Run the TypeScript clipboard parser and V2 mod-aware feature builder.
3. Run the local Python CatBoost classifier subprocess.
4. Show a user-facing decision card and keep technical JSON details in a collapsible section.

## Run

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
ml/runs/v2_classifier_latest/v2_mod_aware/global/model.cbm
ml/runs/v2_classifier_latest/v2_mod_aware/global/feature_schema.json
threshold = 0.40
```

If these files are missing, the app shows a warning and you can enter another trained run path manually.

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

## Worker Decision

The app currently keeps the simple subprocess path. The TypeScript feature generation step measured at roughly `0.4s` for a sample rare item on the development machine. The UI also displays feature and prediction latency after each run.

Only add a persistent Python worker if full end-to-end prediction repeatedly exceeds the demo target of about `2-3s` per item.
