# TRAINING_FEATURES.md

## 문서 목적

이 문서는 현재 프로젝트에서 실제로 사용 중인 `training_features_*` 계층의 의미와, 학습 입력으로 어떤 피처를 볼 것인지 정리한다.

예전의 "초안" 문서가 아니라, 현재 ETL 구조 기준의 운영 문서로 본다.

## 현재 계층 구조

현재 학습용 데이터는 3단계 테이블로 관리된다.

1. `training_features_raw`
2. `training_features_clean`
3. `training_features_labeled`

상세 흐름은 `docs/TRAINING_ETL_OVERVIEW.md`를 기준 문서로 본다.

## 각 계층의 의미

### `training_features_raw`

역할:

- `normalized_priced_items`에서 추출한 1차 구조화 피처

성격:

- 아직 모델 입력으로 바로 쓰는 최종본은 아님
- stash API 기반 정보와 요약 피처가 혼재
- 이후 cleaner 단계에서 범위 제한 필요

주요 컬럼 예:

- `item_class`, `base_type`, `rarity`, `ilvl`
- `identified`, `corrupted`, `fractured`, `synthesised`
- `influence_*`
- `socket_count`, `link_count`, `white_socket_count`
- `explicit_mod_count`, `implicit_mod_count`, `crafted_mod_count`
- `quality`, `armour`, `evasion`, `energy_shield`
- `physical_dps`, `elemental_dps`, `attack_speed`, `crit_chance`
- `life_roll_sum`, `resistance_roll_sum`, `attribute_roll_sum`
- `jewel_type`, `cluster_size`, `cluster_passive_count`, `notable_count`
- `gem_level`, `gem_quality`, `is_awakened`, `is_vaal`

### `training_features_clean`

역할:

- 현재 모델 범위에 맞는 row만 선별
- `model_segment`와 `clean_reason`를 부여

현재 주요 세그먼트:

- `rare_equipment`
- `jewel`
- `skill_gem`
- `unique_equipment`

현재 clean 단계의 핵심은 "모든 row를 모델에 넣지 않고, 현재 범위 안의 학습 후보만 정리하는 것"이다.

### `training_features_labeled`

역할:

- clean row에 환율 스냅샷을 붙여 최종 학습 라벨을 생성

주요 라벨 컬럼:

- `target_price_chaos`
- `target_price_log1p`
- `exchange_rate_chaos_equivalent`
- `label_reason`

현재 `CatBoost` 학습 전 최종 입력 원본은 이 테이블이다.

## 현재 타깃 정의

현재 모델 타깃은 **관측 시점 listing price**다.

구체적으로는:

1. `target_price_amount` + `target_price_currency`
2. 환율 스냅샷 결합
3. `target_price_chaos`
4. `target_price_log1p`

현재 주의점:

- `updated_at` / `source_updated_at`는 판매 시각이 아니다
- 현재 라벨은 판매 완료 가격이 아니다
- `sold_at`, `removed_at`, `time_to_sale` 계열 라벨은 아직 없다

즉, 지금은 "거래 성사 예측"이 아니라 "관측 시점 가격 회귀" 문제다.

## 현재 학습 입력 정책

현재 `ml/train_catboost.py`는 labeled CSV의 컬럼을 임의로 넓게 쓰지 않는다.

대신:

- `src/config/clipboard-safe-feature-policy.json`

에 정의된 `clipboard_safe_v1` 화이트리스트만 사용한다.

즉, 현재 모델 입력은 "이미 클립보드 호환으로 승인한 컬럼"만 사용한다.

## 현재 유지 중인 주요 피처

현재 v1 기준으로 유지하는 대표 피처:

- `item_class`, `base_type`, `rarity`, `ilvl`
- `identified`, `corrupted`, `fractured`, `synthesised`
- `influence_*`
- `socket_count`, `link_count`, `white_socket_count`
- `explicit_mod_count`, `implicit_mod_count`, `crafted_mod_count`, `fractured_mod_count`, `enchant_mod_count`
- `quality`, `armour`, `evasion`, `energy_shield`, `ward`
- `physical_dps`, `elemental_dps`, `attack_speed`, `crit_chance`
- `move_speed`, `life_roll_sum`, `resistance_roll_sum`, `attribute_roll_sum`
- `jewel_type`, `cluster_size`, `cluster_passive_count`, `notable_count`
- `damage_mod_count`, `defence_mod_count`, `utility_mod_count`
- `gem_level`, `gem_quality`, `is_awakened`, `is_vaal`
- `model_segment`
- `observed_hour_utc`, `observed_weekday_utc`

## 현재 보수적으로 제외한 피처

현재 v1 학습 입력에서는 아래를 보수적으로 제외한다.

- `duplicated`
- `frame_type`
- `clean_reason`
- `prefix_count`
- `suffix_count`
- `is_support_gem`
- `gem_tags`

이유:

- stash API 전용 의미가 섞여 있거나
- clipboard parity가 아직 부족하거나
- parser / dictionary / rule engine 공유가 먼저 필요한 항목이기 때문이다

## affix 관련 현재 상태

`prefix_count`, `suffix_count`는 완전히 폐기된 것이 아니라, 현재는 조건부 보류 상태다.

즉:

- 장기적으로는 다시 도입 가능
- 단, affix dictionary source와 counting rule이 먼저 정리돼야 함

관련 문서:

- `docs/CLIPBOARD_COMPATIBILITY_AUDIT.md`
- `docs/AFFIX_DICTIONARY_REQUIREMENTS.md`

## 현재 미구현 또는 향후 확장 후보

향후 확장 가능 항목:

- affix dictionary 기반 `prefix_count`, `suffix_count`
- locale-aware mod canonicalization
- `is_support_gem`, `gem_tags`
- mod key 기반 sparse feature
- segment별 별도 모델

## 정리

현재 `training_features` 계층은 더 이상 단순 설계 초안이 아니다.

현재 기준으로 보면:

- ETL 3단계 구조는 이미 구현됨
- labeled 테이블까지 실제 누적 중
- 학습 입력은 clipboard-safe whitelist로 제한됨
- affix 관련 피처는 v2 이슈로 분리됨

즉, 지금 문맥에서 `training_features_*`는 "미래 구상"이 아니라 실제 운영 중인 학습 준비 파이프라인이다.
