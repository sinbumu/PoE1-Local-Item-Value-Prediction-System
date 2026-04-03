# PoE1 Local Item Value Prediction System

## 2026-04-04 중간보고

## 프로젝트 개요

본 프로젝트는 Path of Exile 1의 `public-stash-tabs` 데이터를 로컬에서 지속 수집하고, 이후 가격 예측 모델 학습에 활용할 수 있는 형태로 정리하는 것을 목표로 하는 PoC입니다.

현재는 `Mirage` 소프트코어 거래 시장을 대상으로 수집 파이프라인을 운영하고 있으며, 이번 주까지는 수집과 보관 구조 안정화에 집중했습니다.

## 현재 운영 상태

- `collector`: 이번 점검 시점에는 수동 정지 상태
- `maintenance`: 이번 점검 시점에는 수동 정지 상태
- `ETL`: 본격 실행 전
- `학습`: 아직 미실행

현재 기준 최신 적재 시각:

- `raw_api_responses`: `2026-04-03 15:20 UTC`
- `normalized_priced_items`: `2026-04-03 15:20 UTC`
- `exchange_rate_snapshots`: `2026-04-03 14:46 UTC`

즉, 수집기와 maintenance를 정지하기 전까지는 정상적으로 수집이 이어지고 있었습니다.

## 데이터 현황

| 항목 | 현재 수치 |
| --- | --- |
| `raw_api_responses` | 약 `15,258` rows |
| `normalized_priced_items` | 약 `35,498,507` rows |
| `exchange_rate_snapshots` | 약 `40,613` rows |
| `ingestion_activity_summaries` | 약 `731` rows |
| `training_features_raw` | 약 `100` rows |
| `training_features_clean` | 약 `51` rows |
| `training_features_labeled` | `0` rows |

현재 저장소 규모:

| 항목 | 현재 크기 |
| --- | --- |
| `normalized_priced_items` | 약 `78 GB` |
| `raw_api_responses` | 약 `51 GB` |
| `exchange_rate_snapshots` | 약 `17 MB` |
| `ingestion_activity_summaries` | 약 `504 kB` |

최근 Divine Orb chaos 환산값:

- `289.5 chaos`
- `289.4 chaos`
- `287.6 ~ 287.8 chaos`

## 이번 주 진행 내용

이번 주에는 수집량 자체를 늘리는 것보다, 장기 운영과 이후 분석을 위한 기반을 정리하는 데 집중했습니다.

핵심 진행 사항:

- `collector + maintenance` 구조로 수집/정리/환율 수집 분리
- `raw_api_responses` 24시간 retention 유지
- `normalized_priced_items` 7일 stale 기준 archive/purge 유지
- `exchange_rate_snapshots` 지속 누적
- `ingestion_activity_summaries` 도입

특히 `ingestion_activity_summaries`를 추가해, raw 데이터가 24시간 후 삭제되더라도 일별/시간별 수집량 추세를 별도 테이블에 계속 남길 수 있도록 했습니다.

## 최근 수집 추세

최근 일별 summary 기준:

| 날짜(UTC) | raw response 수 | raw stash 합 | normalized listing 수 |
| --- | ---: | ---: | ---: |
| `2026-04-03` | `8,692` | `950,613` | `23,762,671` |
| `2026-04-02` | `14,675` | `1,607,981` | `40,011,458` |
| `2026-04-01` | `13,861` | `1,524,608` | `26,260,233` |
| `2026-03-31` | `7,211` | `807,790` | `7,042,623` |

최근 시간별 summary 기준으로도 raw response는 대체로 시간당 수백 건 수준으로 계속 들어오고 있었고, normalized listing도 시간당 수십만~백만 단위로 갱신되고 있었습니다.

즉, 시즌 후반부일 가능성은 있어도 현재까지는 시장 데이터 유입이 완전히 약해졌다고 보기는 어려운 상태입니다.

## 현재 해석

1. 수집 파이프라인은 단순 PoC 수준을 넘어 장시간 운영 가능한 구조로 정리되었습니다.
2. `normalized_priced_items`가 이미 수천만 행 규모까지 쌓였기 때문에, 다음 단계인 ETL과 학습 실험을 시작할 만큼의 기반 데이터는 충분히 확보되고 있습니다.
3. 다만 현재 라벨은 어디까지나 **관측 시점의 listing price**이며, 판매 완료 가격이나 판매 시점 라벨은 아직 없습니다.
4. 따라서 다음 단계의 핵심은 더 많은 수집이 아니라, **현재 쌓인 데이터를 실제 학습용 feature/label 테이블로 변환하는 것**입니다.

## 다음 주 계획

다음 주부터는 수집 자체보다 학습 파이프라인 실험에 집중할 예정입니다.

예정 작업:

1. `training_features_raw` 생성
2. `training_features_clean` 생성
3. `training_features_labeled` 생성
4. `CatBoost`로 1차 학습 시도

즉 이번 주까지는 **데이터 확보와 운영 안정화**, 다음 주부터는 **실제 학습용 데이터 생성과 모델 학습 시도** 단계로 넘어갑니다.

## 정리

현재 프로젝트는 다음 단계로 넘어가기 위한 준비가 거의 끝난 상태입니다.

- 수집 파이프라인: 안정화
- 보관/정리 정책: 구현 완료
- 환율 스냅샷: 누적 중
- 일별/시간별 추세 summary: 도입 완료
- ETL/학습: 다음 주 본격 시작 예정

이번 보고 시점의 핵심 메시지는, **데이터 수집 인프라는 충분히 확보되었고, 다음 단계는 실제 학습용 데이터셋 생성과 CatBoost 학습 검증**이라는 점입니다.
