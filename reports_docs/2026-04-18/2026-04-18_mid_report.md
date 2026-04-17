# PoE1 Local Item Value Prediction System

## 2026-04-18 중간보고

## 프로젝트 개요

본 프로젝트는 Path of Exile 1의 `public-stash-tabs` 데이터를 로컬에서 지속 수집하고, 이를 `CatBoost` 기반 가격 예측 실험으로 연결할 수 있는 구조화 데이터로 변환하는 것을 목표로 하는 프로젝트입니다.

이번 주에는 단순 ETL 누적 단계를 넘어, **최근 7일 전체 데이터로 실제 학습/비교를 끝까지 실행하고 기준선 모델을 결정**하는 단계까지 진행했습니다.

## 현재 운영 상태

- `collector`: 연속 실행 중
- `maintenance`: 연속 실행 중
- `ETL`: 이번 학습 검증 시점에는 상시 데몬 미운영, 최근 7일 범위는 이미 백필 완료
- `학습`: 최근 7일 전체 `staged dataset` 기준 글로벌/세그먼트 비교 실행 완료

현재 기준 최신 적재 시각:

- `raw_api_responses`: `2026-04-17 18:10 UTC`
- `normalized_priced_items`: `2026-04-17 18:10 UTC`
- `exchange_rate_snapshots`: `2026-04-17 17:41 UTC`
- `training_features_raw`: `2026-04-17 14:29 UTC`
- `training_features_clean`: `2026-04-17 14:29 UTC`
- `training_features_labeled`: `2026-04-17 14:29 UTC`

즉, 수집 파이프라인은 최신 시장 데이터를 계속 받고 있고, 최근 7일 학습 스냅샷도 이미 만들어 실제 모델 실험까지 수행한 상태입니다.

## 데이터 현황

| 항목 | 현재 수치 |
| --- | --- |
| `raw_api_responses` | `15,260` rows |
| `normalized_priced_items` | `21,546,170` rows |
| `exchange_rate_snapshots` | `84,921` rows |
| `ingestion_activity_summaries` | `1,693` rows |
| `training_features_raw` | `23,830,317` rows |
| `training_features_clean` | `15,862,949` rows |
| `training_features_labeled` | `15,862,949` rows |

현재 저장소 규모:

| 항목 | 현재 크기 |
| --- | --- |
| `normalized_priced_items` | 약 `84.72 GB` |
| `raw_api_responses` | 약 `25.51 GB` |
| `training_features_raw` | 약 `17.22 GB` |
| `training_features_labeled` | 약 `12.49 GB` |
| `training_features_clean` | 약 `10.95 GB` |
| `exchange_rate_snapshots` | 약 `39 MB` |
| `ingestion_activity_summaries` | 약 `0.86 MB` |

최근 Divine Orb chaos 환산값:

- `308.3 chaos`
- `308.3 chaos`
- `308.5 chaos`
- `308.7 chaos`
- `308.6 chaos`

## 이번 주 진행 내용

이번 주의 핵심은 **학습용 입력 경로를 대용량 대응 구조로 바꾸고, 실제 7일 전체 학습/비교를 끝까지 돌려 본 것**입니다.

핵심 진행 사항:

- `DB -> staged split CSV -> CatBoost file Pool` 경로 구현
- `split_spec.json` 기반 공통 시계열 split 고정
- 글로벌 모델 학습기와 `model_segment`별 학습기 분리
- 글로벌 vs 세그먼트 비교 리포트 자동 생성
- 실제 7일 전체 snapshot 스테이징 성공
- 실제 7일 전체 `CatBoost` 학습/비교 실행 성공
- 비교 결과를 바탕으로 **세그먼트 모델 묶음**을 현재 기준선으로 결정

즉, 프로젝트 중심축이 "ETL을 끝까지 따라잡는 것"에서 "실제 추론 구조에 가까운 기준선 모델을 확보하는 것"으로 이동했습니다.

## 최근 수집 추세

최근 일별 summary 기준:

| 날짜(UTC) | raw response 수 | raw stash 합 | normalized listing 수 |
| --- | ---: | ---: | ---: |
| `2026-04-17` | `9,096` | `840,322` | `23,035,091` |
| `2026-04-16` | `5,607` | `577,351` | `14,585,823` |
| `2026-04-15` | `6,272` | `670,943` | `15,569,876` |
| `2026-04-14` | `811` | `89,549` | `1,879,217` |
| `2026-04-13` | `6,580` | `683,782` | `17,603,225` |
| `2026-04-12` | `6,762` | `718,006` | `17,765,440` |
| `2026-04-11` | `7,329` | `799,889` | `19,158,775` |

최근 24시간 hourly summary 기준으로도 raw response는 시간당 대략 `400~550`건, normalized listing은 시간당 약 `1.0M~1.4M`건 수준으로 계속 유입되고 있었습니다.

즉, 최근 1주일 데이터만 보더라도 시즌 후반부 시장 데이터가 여전히 충분한 양으로 누적되고 있습니다.

## ETL 및 학습 진행 현황

현재 `training_features_raw -> training_features_clean -> training_features_labeled` 3단계 ETL은 최근 7일 범위 기준으로 학습에 사용할 수 있는 규모까지 누적되었습니다.

최근 7일 `training_features_labeled` 세그먼트 분포:

| 세그먼트 | row 수 |
| --- | ---: |
| `rare_equipment` | `6,905,969` |
| `jewel` | `4,926,245` |
| `unique_equipment` | `1,459,370` |
| `skill_gem` | `1,171,052` |

이번 주에 실제로 만든 학습 스냅샷:

- staged snapshot: `artifacts/training-staging/last_7d_full_test_v2`
- snapshot row 수: `14,496,401`
- split:
  - train: `11,597,120`
  - valid: `1,449,640`
  - test: `1,449,641`

## 모델 비교 결과

현재 기준선 비교 런:

- 경로: `ml/runs/comparison_last_7d_full_baseline_100iter_d8`
- 설정: `target_price_log1p`, `iterations=100`, `depth=8`, `learning_rate=0.05`

글로벌 모델 전체 test 성능:

- `target_price_log1p_rmse`: `1.8808`
- `target_price_log1p_mae`: `1.5126`

세그먼트별 test `target_price_log1p_rmse` 비교:

| 세그먼트 | 글로벌 모델 | 세그먼트 모델 | 우세 |
| --- | ---: | ---: | --- |
| `jewel` | `1.9318` | `1.8346` | `segment` |
| `rare_equipment` | `1.8014` | `1.7666` | `segment` |
| `skill_gem` | `1.7292` | `1.6902` | `segment` |
| `unique_equipment` | `2.1276` | `1.9380` | `segment` |

즉, 이번 실험에서는 **모든 세그먼트에서 세그먼트별 모델이 글로벌 모델보다 더 낮은 RMSE를 기록**했습니다.

## 현재 해석

1. 최근 7일 전체 데이터를 로컬 장비에서 실제로 학습/비교 가능한 파이프라인을 확보했습니다.
2. 대용량 데이터에서도 `CSV 전체 적재 -> pandas` 대신 staged file 기반 경로로 충분히 실험이 가능합니다.
3. 현재 1차 기준선은 `글로벌 1개 모델`보다 `model_segment` 라우팅 기반 `4개 세그먼트 모델`이 더 적절합니다.
4. 따라서 이후 로컬 앱 추론 경로도 "아이템 세그먼트 판별 -> 해당 모델 선택" 구조로 가는 것이 자연스럽습니다.
5. 이번 주부터는 "첫 학습 시도"가 아니라, 이미 **실제로 돌아가는 기준선 모델을 확보한 상태**로 볼 수 있습니다.

## 다음 주 계획

예정 작업:

1. 세그먼트 기준선 결과를 `README`와 `ml` 문서에 반영
2. `rare_equipment`, `jewel` 중심으로 iteration / depth 추가 튜닝
3. 추론 경로에서 사용할 세그먼트 라우팅 규칙 정리
4. 로컬 유틸리티 앱에서 사용할 입력/출력 포맷 정의
5. 필요 시 세그먼트별 fallback 전략과 글로벌 fallback 모델 검토

즉, 다음 단계의 중심은 **세그먼트 기준선 고도화와 실제 로컬 추론 워크플로우 연결**입니다.

## 정리

현재 프로젝트는 다음 상태에 도달했습니다.

- 수집 파이프라인: 운영 중
- ETL: 최근 7일 학습 가능 범위까지 누적 완료
- 7일 전체 staged snapshot: 생성 완료
- 글로벌 모델 학습: 실행 완료
- 세그먼트 모델 비교: 실행 완료
- 현재 기준선: `model_segment` 라우팅 기반 세그먼트 모델

이번 보고 시점의 핵심 메시지는, **이 프로젝트가 "첫 학습을 해보는 단계"를 지나, 실제로 사용할 수 있는 세그먼트 기준선 모델을 확보한 단계까지 왔다**는 점입니다.
