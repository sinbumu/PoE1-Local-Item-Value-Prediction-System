# REPORT_HANDOFF.md

## 문서 목적

이 문서는 보고서 작성자나 다른 AI/개발자에게 현재 프로젝트 상태를 짧게 넘겨주기 위한 최신 handoff 문서다.

이 문서 하나만 읽어도 아래를 파악할 수 있도록 구성한다.

- 프로젝트 목적
- 현재 운영 구조
- 현재 ETL / 학습 준비 상태
- clipboard 호환 피처 정책
- 아직 남은 핵심 과제

## 프로젝트 한 줄 요약

Path of Exile 1의 `public-stash-tabs` 데이터를 로컬에서 지속 수집하고, `Mirage` 소프트코어 시장의 priced listing을 `training_features_labeled`까지 변환한 뒤, 이후 `CatBoost` 가격 회귀 실험으로 연결하는 프로젝트다.

## 현재 프로젝트 단계

현재 프로젝트는 단순 수집 PoC를 넘어 아래 단계에 들어와 있다.

1. `collector` 운영 중
2. `maintenance` 운영 중
3. `training ETL` 백필 진행 중
4. `CatBoost` 학습은 아직 시작 전

즉, 현재의 중심은 "더 수집할 수 있느냐"보다 "쌓인 데이터를 학습용 labeled dataset으로 얼마나 안정적으로 밀어 넣느냐"에 있다.

## 현재 시스템 구조

### 1. Collector

역할:

- OAuth 토큰 발급
- Public Stash API 호출
- `Mirage` softcore 기준 exact match 필터링
- filtered raw 저장
- priced item normalized 저장
- `poe.ninja` 환율 스냅샷 주기 수집
- `next_change_id` 기반 재시작/이어받기

### 2. Maintenance

역할:

- raw retention cleanup
- normalized stale cleanup
- `training_features_labeled` Google Drive backup

중요:

- 예전의 normalized archive 중심 구조는 폐기됨
- 현재 canonical backup 대상은 `training_features_labeled`

### 3. Training ETL

현재 ETL 계층:

- `normalized_priced_items`
- `training_features_raw`
- `training_features_clean`
- `training_features_labeled`

현재는 통합 runner로 `raw -> clean -> labeled`를 한 번에 관리한다.

핵심 특징:

- cursor 기반 재개
- advisory lock 기반 동시 실행 방지
- one-off / daemon 모두 가능

## 현재 모델링 범위

현재 모델 목표는 "모든 아이템 가격 예측"이 아니다.

외부 시세 우선 대상:

- Currency
- Fragment
- Scarab
- Essence
- Fossil
- Oil
- Divination Card
- 일반 Map
- 옵션 차이가 거의 없는 유니크 일부

모델 예측 우선 대상:

- Rare 장비
- Rare Jewel / Abyss Jewel / Cluster Jewel
- NeverSink strict allowlist 기반 Unique 장비
- Skill Gem

즉, 검색만으로 적정가 판단이 어려운 아이템을 우선 모델 대상으로 본다.

## 현재 학습 타깃

현재 라벨은 **관측 시점 listing price**다.

구성:

- `target_price_amount`
- `target_price_currency`
- 환율 결합 후 `target_price_chaos`
- 최종 회귀 타깃 `target_price_log1p`

중요:

- 현재 라벨은 판매 완료 가격이 아니다
- `source_updated_at`는 판매 시각이 아니라 마지막 관측 시각이다
- `sold_at`, `removed_at`, `time_to_sale` 라벨은 아직 없다

## 현재 학습 입력 정책

현재 `ml/train_catboost.py`는 labeled CSV의 컬럼을 넓게 쓰지 않는다.

대신:

- `src/config/clipboard-safe-feature-policy.json`

의 `clipboard_safe_v1` 화이트리스트만 학습 입력으로 사용한다.

현재 유지 중인 입력의 성격:

- item intrinsic feature
- 구조/상태 요약 피처
- `model_segment`
- 관측 시각 파생 피처 (`observed_hour_utc`, `observed_weekday_utc`)

현재 보수적으로 제외 중인 항목:

- `duplicated`
- `frame_type`
- `clean_reason`
- `prefix_count`
- `suffix_count`
- `is_support_gem`
- `gem_tags`

## clipboard 관련 현재 상태

현재 프로젝트는 추론 입력을 장기적으로 `Ctrl+C` 클립보드 텍스트로 맞추려는 방향을 갖고 있다.

현재까지 준비된 것:

- `docs/CLIPBOARD_COMPATIBILITY_AUDIT.md`
- `samples/clipboard/`
- `src/services/clipboard-parser.service.ts`
- `src/scripts/validate-clipboard-samples.ts`
- `docs/AFFIX_DICTIONARY_REQUIREMENTS.md`

아직 비어 있는 핵심:

- affix dictionary source
- prefix / suffix counting policy
- clipboard vs ETL parity 검증

즉, parser 골격과 샘플은 준비됐지만, affix 구조 복원은 후속 이슈다.

## 현재 기준 핵심 의사결정

1. 장기 canonical dataset은 `normalized_priced_items`가 아니라 `training_features_labeled`
2. ETL은 3단계 통합 runner 기준으로 본다
3. 첫 학습은 `CatBoost` 탭уляр 회귀
4. 학습 입력은 `clipboard_safe_v1`로 보수적으로 제한
5. affix 계열 피처는 dictionary 이슈 해결 전까지 v2로 미룬다

## 현재 상태를 제3자가 이해할 때 중요한 포인트

1. 수집 인프라는 이미 장시간 운영 가능한 수준이다.
2. 현재 병목은 수집이 아니라 ETL 진도와 학습 실험이다.
3. labeled dataset 계층이 이미 실제로 누적되고 있다.
4. clipboard compatibility는 별도 축으로 병행 준비 중이다.
5. 다음 실제 milestone은 혼합 기준선 정리와 이를 반영한 보고 문서 정합성 확보다.

## 바로 다음 작업

1. 최근 7일 ETL 최신화 유지
2. staging / comparison 산출물과 문서 기준선 정합성 맞추기
3. feature importance / segment별 성능 해석 보강
4. `skill_gem` 글로벌 fallback 판단 근거 유지
5. affix dictionary 이슈는 별도 조사/정책 정리 후 재개

## 관련 기준 문서

- `docs/TRAINING_ETL_OVERVIEW.md`
- `docs/TRAINING_FEATURES.md`
- `docs/STORAGE_POLICY.md`
- `docs/MODEL_SCOPE.md`
- `docs/TRAINING_BASELINE_REPORT_2026-04-19.md`
- `docs/TRAINING_FEATURE_IMPORTANCE_SUMMARY_2026-04-23.md`
- `docs/REPORT_WRITER_DOCUMENT_MAP_2026-04-23.md`
- `docs/CLIPBOARD_COMPATIBILITY_AUDIT.md`
- `docs/AFFIX_DICTIONARY_REQUIREMENTS.md`
- `ml/README.md`
- 향후 모델 개선 방향

### 11. 결론

- 프로젝트 요약
- 현재 단계의 의의
- 최종 목표까지의 다음 단계

## 보고서 담당 AI에 함께 전달하면 좋은 문서

현재 기준으로는 다음 문서들이 보조 참고 자료로 유용하다.

- `docs/PLAN.md`
- `docs/IMPLEMENTATION_NOTES.md`
- `docs/MODEL_SCOPE.md`
- `docs/ITEM_ROUTING.md`
- `docs/TRAINING_FEATURES.md`
- `docs/STORAGE_POLICY.md`
- `reports_docs/2026-04-04/2026-04-04_mid_report.md`

하지만 보고서 작성 AI에는 우선 **이 문서 하나를 먼저 전달**하고, 세부 기술 정보가 필요할 때 위 문서를 추가로 참조하게 하는 방식이 가장 효율적이다.
