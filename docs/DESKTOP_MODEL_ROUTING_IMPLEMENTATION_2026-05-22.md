# Desktop Model Routing Implementation

## Summary

The Electron MVP now uses a desktop model routing bundle instead of assuming one V2 classifier for every parsed item.

Routing baseline:

- `rare_equipment`, `unique_equipment`: V2 mod-aware classifier.
- `jewel`, `skill_gem`: V1 summary regressor when bundled model artifacts exist.
- Commodity-like classes such as currency, maps, fragments, and cards: external price lookup recommendation.
- Missing model artifacts: direct trade search recommendation.
- Unparseable text or non-English text: parse failure / unsupported fallback.

## Model Bundle

The app reads:

```text
desktop/models/v2_mvp/model_manifest.json
```

The checked-in manifest keeps the existing rare/unique classifier working:

```text
desktop/models/v2_mvp/model.cbm
desktop/models/v2_mvp/feature_schema.json
desktop/models/v2_mvp/run_info.json
```

After running the desktop preparation command, the intended routed bundle layout is:

```text
desktop/models/v2_mvp/rare_unique_classifier/model.cbm
desktop/models/v2_mvp/rare_unique_classifier/feature_schema.json
desktop/models/v2_mvp/rare_unique_classifier/run_info.json
desktop/models/v2_mvp/jewel_regressor/model.cbm
desktop/models/v2_mvp/jewel_regressor/feature_schema.json
desktop/models/v2_mvp/jewel_regressor/run_info.json
desktop/models/v2_mvp/skill_gem_regressor/model.cbm
desktop/models/v2_mvp/skill_gem_regressor/feature_schema.json
desktop/models/v2_mvp/skill_gem_regressor/run_info.json
```

## Automation

Run this after ETL is up to date:

```bash
npm run prepare:desktop-models -- --days=7
```

The command performs:

1. V2 staging for `rare_equipment,unique_equipment`.
2. V2 classifier training.
3. V1 staging for `jewel,skill_gem`.
4. V1 CatBoost regression training per segment.
5. Copying artifacts into `desktop/models/v2_mvp/`.
6. Writing `model_manifest.json`.

## Decision Policy

Classifier:

```text
score < 0.50          -> low listed value
0.50 <= score < 0.70  -> manual check
0.70 <= score < 0.88  -> search-worthy
score >= 0.88         -> high-value candidate
```

Regressor:

```text
predicted chaos < 5   -> low listed value
5 <= chaos < 30       -> manual check
30 <= chaos < 300     -> search-worthy
>= 300                -> high-value candidate
```

## Verification

Basic checks:

```bash
npm run typecheck
npm run --silent desktop:clipboard-features -- --input samples/clipboard/en/rare-equipment-001.txt
npm run --silent desktop:clipboard-features -- --input samples/clipboard/en/skill-gem-001.txt
```

End-to-end routed checks:

```bash
npm run --silent desktop:clipboard-features -- --input samples/clipboard/en/rare-equipment-001.txt | node scripts/run-python.js ml/predict_desktop_item_value.py --manifest desktop/models/v2_mvp/model_manifest.json --classifier-search-threshold 0.70
npm run --silent desktop:clipboard-features -- --input samples/clipboard/en/skill-gem-001.txt | node scripts/run-python.js ml/predict_desktop_item_value.py --manifest desktop/models/v2_mvp/model_manifest.json --classifier-search-threshold 0.70
npm run --silent desktop:clipboard-features -- --input samples/clipboard/en/currency-001.txt | node scripts/run-python.js ml/predict_desktop_item_value.py --manifest desktop/models/v2_mvp/model_manifest.json --classifier-search-threshold 0.70
npm run --silent desktop:clipboard-features -- --input samples/clipboard/en/map-001.txt | node scripts/run-python.js ml/predict_desktop_item_value.py --manifest desktop/models/v2_mvp/model_manifest.json --classifier-search-threshold 0.70
npm run --silent desktop:clipboard-features -- --input samples/clipboard/en/parse-failure-001.txt | node scripts/run-python.js ml/predict_desktop_item_value.py --manifest desktop/models/v2_mvp/model_manifest.json --classifier-search-threshold 0.70
```

Expected presentation sample behavior:

- `rare-equipment-001`: classifier route.
- `normal-jewel-001`: jewel regressor route when prepared desktop models are present.
- `skill-gem-001`: skill gem regressor route when prepared desktop models are present.
- `currency-001`, `map-001`, `divination-card-001`: `external price lookup recommended`.
- `parse-failure-001`: `parse failed`.

With only the legacy checked-in bundle, jewel/skill gem samples may return `direct search recommended` until the corresponding regressor artifacts are generated and copied by `prepare:desktop-models`.
