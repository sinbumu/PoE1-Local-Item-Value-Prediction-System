# Rare/Unique Classifier Report Handoff

## 제6장-제7장 연결 요약 문단 초안

제6장의 회귀 실험은 아이템의 `target_price_log1p` 또는 chaos 환산 가격을 예측하는 기준선으로, 수집/ETL된 listed price 데이터가 CatBoost 모델 학습에 사용 가능한 형태인지 검증하는 역할을 했다. 그러나 desktop 앱의 즉시 사용 목적은 정확한 판매가 산출이 아니라, 게임 중 복사한 아이템이 거래소에서 검색하거나 판매 시도할 가치가 있는지를 빠르게 분류하는 것이다. 따라서 제7장 앱 적용 단계에서는 rare/unique equipment에 대해 회귀값을 직접 노출하는 대신, `target_price_chaos >= 30`을 `is_search_worthy`로 정의한 V2 mod-aware CatBoostClassifier를 별도로 학습해 search-worthy decision label 생성에 사용했다.

이 classifier는 최근 7일(`2026-05-15 15:20:42+00`~`2026-05-22 15:20:42+00`)의 `rare_equipment`, `unique_equipment` 3,406,217 row를 대상으로 학습되었고, train/valid/test는 시간 순서 기반 80/10/10으로 분할되었다. Test split 기준 accuracy는 0.7386, precision은 0.7875, recall은 0.8091, F1-score는 0.7982였다. 이 모델은 `desktop/models/v2_mvp/model_manifest.json`에서 `rare_equipment`와 `unique_equipment` route에 연결되어 Electron desktop 앱의 V2 mod-aware search-worthy 판단 모델로 사용된다.

## 보고서용 표 제안

본문에는 `table_rare_unique_classifier_metrics.md`의 test split 행을 중심으로 넣고, confusion matrix 전체는 부록 또는 보조 표로 이동하는 것이 적절하다.

| 항목 | 값 |
| --- | --- |
| model id | `rare_unique_classifier` |
| purpose | rare/unique equipment search-worthy classification |
| target label | `is_search_worthy = target_price_chaos >= 30` |
| feature set | `v2_mod_aware` |
| training rows | `2,724,973` |
| validation rows | `340,621` |
| test rows | `340,623` |
| test accuracy | `0.738603` |
| test precision | `0.787523` |
| test recall | `0.809143` |
| test F1-score | `0.798187` |
| desktop route | `rare_equipment`, `unique_equipment` -> `rare_unique_classifier` |

## 주의 문장

- 이 classifier는 판매가 회귀 모델이 아니라 `search-worthy` 여부를 판단하는 앱 연동 모델이다.
- `30 chaos` label 기준은 fixed threshold이며 quantile 기반 상대 라벨이 아니다.
- Desktop app의 최종 decision label은 classifier score를 다시 banding한 UX 정책이다. 학습 label과 앱 표시 label을 혼동하지 않아야 한다.
