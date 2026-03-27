# 2026-03-28 중간보고 초안

## 프로젝트 한 줄 요약

Path of Exile 1의 `public-stash-tabs`를 로컬에서 지속 수집하고, `Mirage` 소프트코어 거래 데이터를 PostgreSQL에 적재해 이후 가격 예측용 데이터셋으로 연결하는 PoC입니다.

## 현재 운영 상태

- `collector`: 계속 실행 중
- `maintenance`: 계속 실행 중
- `ETL`: 아직 미실행

현재 단계의 핵심은 **학습 자체보다 수집 파이프라인 안정화와 데이터 유효성 검증**입니다.

## 데이터 스냅샷

기준 시각:

- DB/로그 확인 기준: `2026-03-27 16:08 UTC` 전후

### 주요 수치

| 항목 | 현재 수치 | 비고 |
| --- | --- | --- |
| `raw_api_responses` | `32,337` rows | exact count |
| 최근 24시간 raw | `17,346` rows | raw cleanup 동작 중 |
| `normalized_priced_items` | 약 `28,100,631` rows | `pg_stat_user_tables` 기준 추정치 |
| `exchange_rate_snapshots` | `15,490` rows | exact count |
| `raw_api_responses` 크기 | 약 `60 GB` | PostgreSQL total size |
| `normalized_priced_items` 크기 | 약 `59 GB` | PostgreSQL total size |
| `exchange_rate_snapshots` 크기 | 약 `6.5 MB` | PostgreSQL total size |
| 최근 raw 적재 시각 | `2026-03-27 16:08:32 UTC` | collector 생존 확인 |

### 최근 환율 스냅샷 예시

`Mirage` 리그 기준 Divine Orb chaos 환산값:

| sample_time_utc | divine chaos equivalent |
| --- | ---: |
| `2026-03-27 15:41:07 UTC` | `259.6` |
| `2026-03-27 15:23:43 UTC` | `259.8` |
| `2026-03-27 15:04:03 UTC` | `259.6` |
| `2026-03-27 14:22:46 UTC` | `258.0` |
| `2026-03-27 13:54:52 UTC` | `257.6` |

## 현재까지 확인한 해석

1. 수집 자체는 안정적으로 진행 중입니다.  
`next_change_id`를 저장하며 이어서 수집하고 있고, collector 로그에서도 매 사이클마다 정상적으로 stash와 normalized item 수가 증가하고 있습니다.

2. 데이터 규모는 이미 발표용으로 충분히 의미 있는 수준입니다.  
특히 `normalized_priced_items`가 수천만 행 규모로 커졌기 때문에, 단순한 API 테스트 단계를 넘어서 실제 시장 데이터를 계속 적재하는 파이프라인으로 설명할 수 있습니다.

3. raw 장기 보관은 비효율적이라는 점이 다시 확인되었습니다.  
raw 응답은 디버깅과 재처리에 유용하지만, 용량 증가 속도가 커서 단기 보관 후 정리하는 현재 방향이 타당합니다.

4. 환율 스냅샷 수집은 이후 라벨링 단계의 기반 데이터 역할을 합니다.  
아이템 가격표가 `chaos`, `divine` 등 서로 다른 통화로 올라오므로, 시점 기준 환율을 별도로 저장해 두는 것이 중요합니다.

## 초기 계획 대비 수정된 부분

### 1. 수집 범위가 더 좁고 현실적으로 바뀜

초기에는 Public Stash 전체를 폭넓게 다루는 방향이었지만, 실제 관측 결과 현재 프로젝트 목적에는 `Mirage` 소프트코어만 고정해서 보는 편이 더 적합했습니다.

제외 대상:

- `Hardcore Mirage`
- `SSF Mirage`
- `Ruthless Mirage`
- private league

이유:

- 경제권이 서로 다름
- 가격 분포를 한 모델에서 같이 다루기 어려움
- 발표와 이후 학습 모두에서 해석이 단순해짐

### 2. “모든 아이템 예측”이 아니라 “예측 가치가 큰 아이템 위주”로 스코프가 정리됨

외부 시세로 충분히 커버 가능한 품목은 모델 대상에서 빼는 방향으로 조정했습니다.

외부 시세 우선:

- Currency
- Fragment
- Scarab
- Essence
- Fossil
- Oil
- Divination Card
- 일반 Map
- 옵션 차이가 거의 없는 유니크 일부

모델 예측 우선:

- Rare 장비
- Rare Jewel / Abyss Jewel / Cluster Jewel
- 옵션 roll 차이가 큰 Unique 장비
- Skill Gem

즉 프로젝트의 모델 목적은 **모든 아이템 가격 맞히기**가 아니라, **거래소 검색만으로 즉시 판단하기 어려운 매물을 예측하기**로 더 선명해졌습니다.

### 3. 운영 구조가 “collector 단독”에서 “collector + maintenance”로 확장됨

현재는 단순 수집기 하나가 아니라 다음 역할이 분리되어 있습니다.

- `collector`: 실시간 stash 수집
- `maintenance`: raw 정리, normalized archive sweep, 환율 스냅샷 수집

이 구조 덕분에 장시간 수집 운영과 이후 데이터 관리가 더 현실적이 되었습니다.

## 다음 단계

- 약 1주일 단위로 데이터가 더 쌓인 뒤 `training_features_raw -> clean -> labeled` ETL 실행
- ETL 결과를 바탕으로 실제 CatBoost 학습용 테이블 품질 확인
- 발표 이후에는 샘플 차트와 함께 “수집 규모 + 환율 추세 + 대상 아이템 분류 전략”을 묶어 설명하는 것이 가장 자연스러움

## 주의 사항

- `normalized_priced_items` 전체 row 수는 현재 테이블 규모 때문에 exact count 대신 PostgreSQL 통계값을 사용했습니다.
- 발표용 슬라이드에는 “약 2,810만 행”처럼 **추정치**라고 표기하는 것이 안전합니다.
