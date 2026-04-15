# TRAINING_ETL_OVERVIEW.md

## 문서 목적

이 문서는 현재 프로젝트의 학습용 데이터 파이프라인을 한 번에 설명하는 기준 문서다.

특히 아래 내용을 최신 상태로 정리한다.

- `normalized_priced_items` 이후의 ETL 구조
- 각 테이블의 역할
- 통합 ETL runner 동작 방식
- 장기 보관/백업 기준
- `CatBoost` 학습 직전까지의 현재 범위

## 현재 파이프라인 개요

현재 학습용 데이터 흐름은 아래와 같다.

1. `collector`
2. `normalized_priced_items`
3. `training_features_raw`
4. `training_features_clean`
5. `training_features_labeled`
6. dataset export
7. `ml/train_catboost.py`

즉, 현재 프로젝트는 이미 "수집 PoC"를 넘어서 학습용 테이블을 실제로 누적하는 단계에 들어와 있다.

## 단계별 역할

### 1. `normalized_priced_items`

역할:

- collector가 적재하는 중간 원본
- 가격 note가 파싱된 priced listing 저장소
- feature extraction의 직접 입력

특징:

- 로컬 DB에서는 최근 7일 stale 기준으로만 유지
- `updated_at` 기준 stale row는 purge 대상
- 장기 canonical dataset으로 보지 않음

### 2. `training_features_raw`

역할:

- `normalized_priced_items`에서 공통 구조/상태/요약 수치 피처를 추출한 1차 feature 계층

포함 예:

- `item_class`, `base_type`, `rarity`, `ilvl`
- `identified`, `corrupted`, `fractured`, `synthesised`
- `influence_*`
- `socket_count`, `link_count`
- `explicit_mod_count`, `crafted_mod_count`
- `life_roll_sum`, `resistance_roll_sum`
- `gem_level`, `gem_quality`

주의:

- 아직 이 단계는 "모델에 바로 넣는 최종 입력"이 아니다
- stash API 기반 필드와 parser 기반 복원 가능성 이슈가 섞여 있을 수 있다

### 3. `training_features_clean`

역할:

- 현재 모델 범위에 맞는 후보만 선별한 계층
- `model_segment`와 `clean_reason`를 부여

현재 포함 대상:

- `rare_equipment`
- `jewel`
- `skill_gem`
- NeverSink strict allowlist 기반 `unique_equipment`

현재 제외 대상 예:

- `map`
- `timeless jewel`
- allowlist 밖 unique
- 비정상 price / 미식별 일부 항목

### 4. `training_features_labeled`

역할:

- `training_features_clean`에 환율 스냅샷을 결합해 학습 타깃을 만든 최종 labeled 계층

추가 컬럼:

- `exchange_rate_source`
- `exchange_rate_sample_time_utc`
- `exchange_rate_chaos_equivalent`
- `target_price_chaos`
- `target_price_log1p`
- `label_reason`

현재 canonical dataset 관점에서 가장 중요한 계층은 이 테이블이다.

## 통합 ETL runner

현재 ETL은 3단계가 따로만 존재하는 것이 아니라, 통합 runner로도 실행 가능하다.

핵심 구조:

- `training_features_raw -> clean -> labeled`
- one-off 실행도 stage 단위 round-robin 진행
- cursor 기반 재개
- advisory lock 기반 동시 실행 방지
- one-off 백필 가능
- daemon 모드 가능

대표 실행 예:

```bash
npm run etl:training -- --limit=10000
```

상시 추종 예:

```bash
npm run etl:training -- --daemon --limit=10000
```

즉, 현재는 3단계를 사람이 수동으로 이어서 돌리는 구조가 아니라, 하나의 실행 흐름으로 관리되는 상태다.

### 실행 전 점검 규칙

운영 시 중요한 규칙:

- `etl:training`은 항상 **단일 프로세스만** 유지하는 것을 권장한다
- 새 ETL 시작 전에는 잔류 daemon / one-off 프로세스가 없는지 먼저 확인한다
- 잔류 프로세스가 있으면 먼저 종료한 뒤 재시작한다

이유:

- 잔류 ETL이 있으면 advisory lock 때문에 새 cycle이 계속 skip될 수 있다
- 또는 로그상으로는 여러 ETL이 섞여 보여 실제 진행 상태를 잘못 해석할 수 있다
- backlog가 큰 상황에서는 어떤 단계가 실제로 전진하는지 혼동하기 쉽다

확인 예:

```bash
ps -axo pid=,ppid=,etime=,state=,command= | rg "run-training-etl.ts|etl:training"
```

종료 예:

```bash
kill <PID>
```

권장 순서:

1. 잔류 ETL 프로세스 확인
2. 남아 있으면 모두 종료
3. 프로세스 목록이 비었는지 다시 확인
4. 그 다음 새 `etl:training` 실행

### 현재 runner 동작 메모

현재 one-off `etl:training`은 `raw`를 끝까지 먼저 다 밀고 나서 다음 단계로 넘어가는 구조가 아니라, 각 cycle마다 `raw -> clean -> labeled`를 순환하며 진행한다.

즉 backlog가 커도 `clean`, `labeled`가 장시간 굶지 않도록 설계되어 있다.

## 현재 학습 입력 정책

현재 `ml/train_catboost.py`는 labeled CSV에 있는 컬럼을 넓게 쓰지 않는다.

대신:

- `src/config/clipboard-safe-feature-policy.json`

에 정의된 `clipboard_safe_v1` 화이트리스트만 사용한다.

즉 현재 학습 입력은:

- 이미 클립보드 재현 가능성이 높다고 본 피처
- 혹은 현재 런타임 컨텍스트로 안정적으로 재현 가능한 피처

로 제한된다.

현재 보수적으로 제외한 예:

- `duplicated`
- `frame_type`
- `clean_reason`
- `prefix_count`
- `suffix_count`
- `is_support_gem`
- `gem_tags`

이 중 일부는 추후 dictionary / parser 고도화 후 재도입 가능하다.

## 현재 보관 전략

현재 장기 보관 전략은 예전과 달라졌다.

현재 기준:

- `raw_api_responses`: 짧게 로컬 보관 후 정리
- `normalized_priced_items`: 로컬 7일 stale cleanup, 장기 canonical 아님
- `training_features_labeled`: canonical dataset 후보, Google Drive backup 대상

즉, 장기 보관의 중심은 `normalized_priced_items`가 아니라 `training_features_labeled`로 이동했다.

## 현재 한계

현재 구조의 중요한 한계는 아래와 같다.

1. 라벨은 판매 완료 가격이 아니라 관측 시점 listing price다
2. `source_updated_at`는 판매 시각이 아니라 마지막 관측 시각이다
3. affix dictionary가 아직 없어서 `prefix_count`, `suffix_count` 복원은 미완료 상태다
4. clipboard parser는 골격까지 준비됐고, full parity는 아직 아니다

## 현재 기준 권장 작업 순서

1. ETL 백필 계속 진행
2. `training_features_labeled` export
3. `CatBoost` 1차 학습 실행
4. feature importance와 segment별 성능 점검
5. clipboard parity 이슈 재개
6. affix dictionary / prefix-suffix 복원 도입 검토

## 관련 문서

- `docs/CLIPBOARD_COMPATIBILITY_AUDIT.md`
- `docs/AFFIX_DICTIONARY_REQUIREMENTS.md`
- `docs/MODEL_SCOPE.md`
- `docs/TRAINING_FEATURES.md`
- `docs/STORAGE_POLICY.md`
- `ml/README.md`
