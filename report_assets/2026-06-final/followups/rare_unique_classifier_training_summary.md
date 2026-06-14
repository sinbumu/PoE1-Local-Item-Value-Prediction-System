# Rare/Unique Classifier Training Summary

## 확인 결과

`rare_unique_classifier`는 실제로 학습되어 desktop model bundle에 포함된 CatBoostClassifier다. 확인된 산출물은 다음과 같다.

| 항목 | 값 |
| --- | --- |
| desktop model dir | `desktop/models/v2_mvp/rare_unique_classifier/` |
| model file | `desktop/models/v2_mvp/rare_unique_classifier/model.cbm` |
| feature schema | `desktop/models/v2_mvp/rare_unique_classifier/feature_schema.json` |
| run info | `desktop/models/v2_mvp/rare_unique_classifier/run_info.json` |
| feature importance | `desktop/models/v2_mvp/rare_unique_classifier/feature_importance.csv` |
| copied from training run | `/Users/blockoxyz/Documents/GitHub/PoE1-Local-Item-Value-Prediction-System/ml/runs/desktop_v2_classifier_latest/v2_mod_aware/global/model.cbm` |
| generated at | `2026-05-22T15:51:50.154698+00:00` |

## 학습 스크립트와 실행 명령

학습에 사용된 경로는 `ml/run_v2_classifier_comparison.py`와 `ml/v2_classifier_pipeline.py`다. desktop model bundle 자동화에서는 `ml/prepare_desktop_models.py`가 다음 흐름을 실행한다.

```bash
npm run prepare:desktop-models -- --days=7
```

내부적으로는 다음 형태의 Python 명령이 실행된다.

```bash
python ml/run_v2_classifier_comparison.py \
  --staged-manifest artifacts/v2-mod-aware-staging/desktop_latest/manifest.json \
  --iterations 1000 \
  --depth 8 \
  --learning-rate 0.05 \
  --thread-count -1 \
  --output-dir ml/runs/desktop_v2_classifier_latest
```

이후 `ml/prepare_desktop_models.py`가 `ml/runs/desktop_v2_classifier_latest/v2_mod_aware/global/`의 산출물을 `desktop/models/v2_mvp/rare_unique_classifier/`로 복사한다.

## 학습 데이터 범위와 row 수

| 항목 | 값 |
| --- | --- |
| source table | `training_features_labeled + normalized_priced_items.item_json` |
| source window days | `7` |
| lower bound | `2026-05-15 15:20:42.52425+00` |
| snapshot now | `2026-05-22 15:20:42.52425+00` |
| total rows | `3406217` |
| target segments | `rare_equipment, unique_equipment` |
| train rows | `2724973` |
| valid rows | `340621` |
| test rows | `340623` |

Segment breakdown:

| segment | train | valid | test |
| --- | ---: | ---: | ---: |
| rare_equipment | 2259914 | 279149 | 273714 |
| unique_equipment | 465059 | 61472 | 66909 |

## Target label 정의

Target column은 `is_search_worthy`다. 이는 정확한 판매가를 예측하는 regression target이 아니라, desktop app에서 검색/판매 시도 우선순위를 판단하기 위한 binary label이다.

| label | 정의 |
| --- | --- |
| `is_search_worthy = 1` | `target_price_chaos >= 30` |
| `is_search_worthy = 0` | `target_price_chaos < 30` |
| high value auxiliary | `target_price_chaos >= 311.7` |

`30 chaos` 기준은 fixed threshold이며 quantile threshold가 아니다. 학습 후 classifier score를 binary metric으로 평가할 때 사용한 score threshold는 `0.5`다. Desktop app 표시 정책은 별도의 score band를 사용해 `low listed value`, `manual check`, `search-worthy`, `high-value candidate`로 세분화한다.

## Train/Valid/Test split 방식

`artifacts/v2-mod-aware-staging/desktop_latest/split_spec.json` 기준 split은 시계열 순서 기반 80/10/10 분할이다.

| split | ratio | row boundary / count | time range |
| --- | ---: | ---: | --- |
| train | 0.8 | 2724973 rows | 2026-05-15 15:29:51.661008+00 ~ 2026-05-22 08:40:37.649962+00 |
| valid | 0.1 | 340621 rows | 2026-05-22 08:40:37.650877+00 ~ 2026-05-22 13:26:58.891104+00 |
| test | 0.09999999999999995 | 340623 rows | 2026-05-22 13:26:58.89332+00 ~ 2026-05-22 14:41:49.64028+00 |

## 주요 feature set

Feature set은 `v2_mod_aware`이며, 총 42개 feature와 7개 categorical feature를 사용한다.

주요 feature 묶음:

- identity/categorical: item_class, base_type, rarity, model_segment, equipment_slot, unique_name, unique_base_type
- explicit mod matching: matched/unmatched/ambiguous explicit mod counts, affix_match_confidence
- roll quality indicators: high_roll_mod_count, top_tier_like_mod_count
- prefix/suffix and special mods: prefix_count_candidate, suffix_count_candidate, crafted/fractured matched mod counts
- mod family aggregates: life/resistance/attribute/movement_speed/damage/critical/defence/charge count, roll_sum, roll_max


상위 feature importance 예시:

base_type (26.796); unique_name (13.878); unmatched_explicit_mod_count (4.661); ambiguous_explicit_mod_count (4.505); crafted_matched_mod_count (4.356); mod_family_life_roll_max (4.224); mod_family_damage_roll_max (3.676); mod_family_attribute_roll_max (3.310); equipment_slot (3.148); mod_family_resistance_roll_sum (2.948)

## CatBoostClassifier 설정

| parameter | value |
| --- | --- |
| loss_function | Logloss |
| eval_metric | F1 |
| random_seed | 42 |
| iterations | 1000 |
| learning_rate | 0.05 |
| depth | 8 |
| thread_count | -1 |
| early_stopping_rounds | 100 |
| class_weights | None |
| evaluation score threshold | 0.5 |

## 평가 결과

전체 train/valid/test metric은 `table_rare_unique_classifier_metrics.md`, confusion matrix는 `table_rare_unique_classifier_confusion_matrix.md`에 정리했다.

Test split 핵심 결과:

| metric | value |
| --- | ---: |
| accuracy | 0.738603 |
| precision (`is_search_worthy=1`) | 0.787523 |
| recall (`is_search_worthy=1`) | 0.809143 |
| F1-score (`is_search_worthy=1`) | 0.798187 |
| class 0 precision | 0.645150 |
| class 0 recall | 0.613819 |
| class 0 F1-score | 0.629095 |
| search-worthy miss rate | 0.190857 |
| high-value miss rate | 0.134574 |

## Desktop app route 확인

`desktop/models/v2_mvp/model_manifest.json`에서 `rare_equipment`와 `unique_equipment`는 모두 `rare_unique_classifier`로 routing된다.

| route | model id | model type | feature set | artifact path |
| --- | --- | --- | --- | --- |
| rare_equipment | rare_unique_classifier | classifier | v2_mod_aware | rare_unique_classifier/model.cbm |
| unique_equipment | rare_unique_classifier | classifier | v2_mod_aware | rare_unique_classifier/model.cbm |

Route verification: `True`
