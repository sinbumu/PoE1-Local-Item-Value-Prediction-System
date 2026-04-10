# STORAGE_POLICY.md

## 문서 목적

이 문서는 현재 프로젝트의 실제 저장/정리/백업 정책을 최신 상태로 정리한다.

예전 정책 중 일부는 이미 폐기되었기 때문에, 이 문서를 현재 운영 기준으로 본다.

## 현재 기본 원칙

1. raw는 디버깅/재처리 보조 계층이지 장기 보관 본체가 아니다.
2. `normalized_priced_items`는 feature extraction용 중간 계층이지 장기 canonical dataset이 아니다.
3. 장기 보관의 핵심은 `training_features_labeled`와 그 export다.
4. 저장 정책은 `collector`와 분리된 `maintenance`가 관리한다.

## 현재 저장 계층

### Layer 1: `raw_api_responses`

용도:

- 디버깅
- 파서/정규화 재검증
- 실제 API payload 확인

현재 정책:

- 로컬 DB에 짧게 유지
- retention cleanup 대상

권장 해석:

- raw는 "항상 남겨야 하는 자산"이 아니라 "운영 안전장치"에 가깝다

### Layer 2: `normalized_priced_items`

용도:

- collector의 직접 중간 산출물
- SQL 점검
- ETL 입력 원본

현재 정책:

- 로컬 DB에서만 유지
- `updated_at` 기준 7일 stale row는 cleanup 대상
- 더 이상 normalized snapshot 자체를 canonical archive로 보지 않음

중요:

- 예전의 "normalized를 Google Drive에 계속 archive" 정책은 현재 기준으로 폐기됨

### Layer 3: `exchange_rate_snapshots`

용도:

- `target_price_chaos`
- `target_price_log1p`

생성용 환율 참조 테이블

현재 정책:

- maintenance가 주기적으로 누적
- labeled 생성에 직접 사용

### Layer 4: `training_features_raw`

용도:

- `normalized_priced_items`에서 추출한 1차 구조화 피처

현재 정책:

- ETL 백필/증분 처리 대상
- 장기 보관 가능하나 canonical 최종본은 아님

### Layer 5: `training_features_clean`

용도:

- 현재 모델 범위에 맞는 후보만 선별한 중간 계층

현재 정책:

- ETL 중간 결과
- 장기적으로는 유지 가능하지만 최종 보관 기준은 아님

### Layer 6: `training_features_labeled`

용도:

- 현재 `CatBoost` 학습 직전의 최종 labeled dataset
- canonical dataset 후보

현재 정책:

- Google Drive backup 대상
- 장기 보관의 중심 계층

## 현재 보관 기간 / 정리 정책

| 계층 | 현재 정책 | 비고 |
| --- | --- | --- |
| `raw_api_responses` | 짧게 로컬 보관 후 cleanup | 디버깅용 |
| `normalized_priced_items` | `updated_at` 기준 7일 stale cleanup | 중간 계층 |
| `exchange_rate_snapshots` | 누적 유지 | 라벨 생성용 |
| `training_features_raw` | 로컬 유지 | ETL 중간 계층 |
| `training_features_clean` | 로컬 유지 | ETL 중간 계층 |
| `training_features_labeled` | 로컬 유지 + Google Drive backup | canonical dataset 후보 |

## maintenance가 현재 담당하는 것

현재 `maintenance`는 아래 작업을 담당한다.

1. raw retention cleanup
2. normalized stale cleanup
3. exchange rate snapshot 수집
4. `training_features_labeled` backup

즉, 예전처럼 normalized archive 업로드가 아니라:

- normalized는 로컬 cleanup
- labeled는 장기 backup

구조로 바뀌었다.

## 왜 이렇게 바뀌었는가

이전 방식의 문제:

- `normalized_priced_items` 자체가 너무 큼
- 장기 archive 대상으로 보기엔 비용이 큼
- 학습 관점에서 그대로 쓰기엔 중간 산출물 성격이 강함

현재 방식의 장점:

- 로컬 DB 크기 관리가 쉬움
- 장기 backup의 밀도를 높일 수 있음
- 학습용 canonical dataset이 더 명확해짐

## 현재 해석

현재 저장 전략의 핵심은 아래 한 줄로 요약할 수 있다.

> `normalized_priced_items`는 지나가는 중간 계층이고, `training_features_labeled`가 장기 보관할 canonical dataset이다.

## 관련 문서

- `docs/TRAINING_ETL_OVERVIEW.md`
- `docs/TRAINING_FEATURES.md`
- `docs/MODEL_SCOPE.md`
- `ml/README.md`
