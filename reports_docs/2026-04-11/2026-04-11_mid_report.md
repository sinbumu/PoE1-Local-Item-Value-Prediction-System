# PoE1 Local Item Value Prediction System

## 2026-04-11 중간보고

## 프로젝트 개요

본 프로젝트는 Path of Exile 1의 `public-stash-tabs` 데이터를 로컬에서 지속 수집하고, 이를 `CatBoost` 기반 가격 예측 실험으로 연결할 수 있는 구조화 데이터로 변환하는 것을 목표로 하는 프로젝트입니다.

현재는 `Mirage` 소프트코어 시장을 대상으로 `collector`, `maintenance`, `training ETL`을 동시에 운영하며, 수집 안정화 단계를 넘어 실제 학습용 테이블 백필 단계로 들어와 있습니다.

## 현재 운영 상태

- `collector`: 연속 실행 중
- `maintenance`: 연속 실행 중
- `ETL`: `npm run etl:training -- --limit=10000`로 백필 진행 중
- `학습`: 아직 미실행

현재 기준 최신 적재 시각:

- `raw_api_responses`: `2026-04-10 17:26 UTC`
- `normalized_priced_items`: `2026-04-10 17:26 UTC`
- `exchange_rate_snapshots`: `2026-04-10 16:54 UTC`
- `training_features_raw`: `2026-04-03 18:06 UTC`
- `training_features_clean`: `2026-04-03 12:51 UTC`
- `training_features_labeled`: `2026-04-03 12:51 UTC`

즉, 수집 파이프라인은 현재 시점의 시장 데이터를 계속 받고 있고, ETL은 과거 backlog를 따라가며 학습용 테이블을 확장 중입니다.

## 데이터 현황

| 항목 | 현재 수치 |
| --- | --- |
| `raw_api_responses` | `11,484` rows |
| `normalized_priced_items` | 약 `27,041,952` rows (추정치) |
| `exchange_rate_snapshots` | `60,245` rows |
| `ingestion_activity_summaries` | `1,181` rows |
| `training_features_raw` | `611,000` rows |
| `training_features_clean` | `26,848` rows |
| `training_features_labeled` | `26,848` rows |

현재 저장소 규모:

| 항목 | 현재 크기 |
| --- | --- |
| `normalized_priced_items` | 약 `97.3 GB` |
| `raw_api_responses` | 약 `28.5 GB` |
| `training_features_raw` | 약 `332 MB` |
| `exchange_rate_snapshots` | 약 `28.8 MB` |
| `training_features_labeled` | 약 `16.3 MB` |
| `training_features_clean` | 약 `14.2 MB` |
| `ingestion_activity_summaries` | 약 `0.64 MB` |

최근 Divine Orb chaos 환산값:

- `302.4 chaos`
- `302.1 chaos`
- `300.4 chaos`
- `300.4 chaos`
- `300.4 chaos`

## 이번 주 진행 내용

이번 주에는 단순 수집량 확대보다, 학습 파이프라인을 실제로 굴릴 수 있는 구조를 정리하는 작업이 중심이었습니다.

핵심 진행 사항:

- `normalized_priced_items`는 로컬 DB에서 `updated_at` 기준 7일 stale cleanup만 수행하도록 정책 정리
- canonical dataset을 `training_features_labeled` 중심으로 재정의
- `training_features_raw -> clean -> labeled`를 묶는 통합 ETL runner 구현
- ETL 대용량 upsert 에러 수정 후 `limit=10000` 배치로 안정화
- 클립보드 호환 피처 감사 문서 정리
- 영문/한글 `Ctrl+C` 샘플 정리 및 parser 골격 추가
- `clipboard_safe_v1` feature policy를 학습 스크립트에 반영

즉, 프로젝트 중심축이 "수집 인프라 정리"에서 "실제 학습용 데이터 파이프라인 구축"으로 이동했습니다.

## 최근 수집 추세

최근 일별 summary 기준:

| 날짜(UTC) | raw response 수 | raw stash 합 | normalized listing 수 |
| --- | ---: | ---: | ---: |
| `2026-04-10` | `7,174` | `746,431` | `19,358,847` |
| `2026-04-09` | `9,084` | `1,000,250` | `23,676,657` |
| `2026-04-08` | `5,081` | `522,766` | `13,890,505` |
| `2026-04-07` | `13,077` | `1,379,198` | `35,699,122` |
| `2026-04-06` | `8,791` | `1,007,623` | `22,130,435` |
| `2026-04-05` | `3,556` | `390,472` | `9,515,789` |

최근 시간별 summary 기준으로도 raw response는 시간당 수백 건, normalized listing은 시간당 수십만 건 규모로 계속 들어오고 있었습니다.

즉, 시장 데이터 유입은 현재도 충분히 활발하며, ETL 백필과 병행 운영이 가능한 상태입니다.

## ETL 진행 현황

현재 ETL은 `training_features_raw -> training_features_clean -> training_features_labeled`의 3단계 구조로 운영됩니다.

현재까지의 누적 결과:

- `training_features_raw`: `611,000` rows
- `training_features_clean`: `26,848` rows
- `training_features_labeled`: `26,848` rows

현재 `training_features_clean` 세그먼트 분포:

| 세그먼트 | row 수 |
| --- | ---: |
| `rare_equipment` | `11,452` |
| `jewel` | `8,004` |
| `skill_gem` | `3,943` |
| `unique_equipment` | `3,449` |

상위 clean reason:

- `rare_equipment_candidate`
- `jewel_candidate`
- `skill_gem_candidate`
- `strict_unique_tiered_bases`
- `strict_unique_ex_synth_rings`

즉, raw backlog는 크게 쌓여 있지만 clean/labeled 단계는 아직 초기 구간을 따라가는 중이며, 현재는 ETL 속도와 피처 정책 검증이 더 중요한 단계입니다.

## 현재 해석

1. `collector + maintenance + ETL` 3축 운영이 실제로 동시에 동작하는 상태까지 왔습니다.
2. `normalized_priced_items`는 여전히 매우 크지만, `training_features_*` 계층은 상대적으로 매우 작은 크기로 유지되고 있습니다.
3. 따라서 장기적으로 보관/백업의 중심은 `training_features_labeled`와 그 export로 이동하는 것이 맞습니다.
4. 학습 스크립트는 이미 `clipboard_safe_v1` 화이트리스트 기반으로 고정되었고, 모델 입력 범위도 예전보다 명확해졌습니다.
5. 다만 `prefix_count`, `suffix_count` 같은 affix 구조 피처는 아직 dictionary/source 정책이 정해지지 않아 v1 학습 입력에서는 보수적으로 제외된 상태입니다.

## 다음 주 계획

예정 작업:

1. ETL 백필 계속 진행
2. `training_features_labeled` export 후 첫 `CatBoost` 학습 실행
3. 학습 결과와 feature importance 점검
4. `clipboard-safe` 정책 기준으로 학습 입력 안정성 검증
5. affix dictionary / prefix-suffix 복원 이슈는 별도 조사 결과 반영 후 재개

즉, 다음 단계의 중심은 **ETL 완료율을 높이고, 실제 `CatBoost` 1차 학습을 실행해 보는 것**입니다.

## 정리

현재 프로젝트는 다음 상태에 도달했습니다.

- 수집 파이프라인: 운영 중
- maintenance: 운영 중
- 통합 ETL runner: 운영 중
- 학습용 raw/clean/labeled 테이블: 실제 누적 시작
- 클립보드 샘플/파서 골격: 준비됨
- 학습 피처 정책: `clipboard_safe_v1`로 고정

이번 보고 시점의 핵심 메시지는, **이 프로젝트가 더 이상 "수집 PoC"에 머무르지 않고, 실제 학습 데이터 생성과 첫 모델 실험 직전 단계까지 넘어왔다**는 점입니다.
