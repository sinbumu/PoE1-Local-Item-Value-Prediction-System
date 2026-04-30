# PoE1 V2 Local Item Value App

Electron MVP for the V2 final demo.

## Run

```bash
cd desktop
npm install
npm start
```

The app calls the repository tools from the project root:

1. `npm run v2:clipboard-features`
2. `ml/predict_item_value.py`

Provide paths to the trained `model.cbm` and matching `feature_schema.json` in the app UI.

## Scope

- English PoE1 Ctrl+C item text
- Clipboard read button and manual paste
- Local parser, V2 feature builder, and CatBoost classifier subprocess
- No overlay, auto-clicking, automation, or game control
