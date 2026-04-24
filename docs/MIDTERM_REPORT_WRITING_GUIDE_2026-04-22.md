# MIDTERM_REPORT_WRITING_GUIDE_2026-04-22.md

## 문서 목적

이 문서는 중간 보고서나 발표 자료를 작성할 때 바로 참고할 수 있도록, 현재 프로젝트의 진행 상태와 설명 포인트를 한 번에 정리한 문서다.

특히 아래 내용을 묶어 둔다.

- 현재 시스템이 실제로 어디까지 구현되었는지
- 최근 7일 데이터 기반 CatBoost 실험 결과를 어떻게 해석해야 하는지
- `feature importance`를 보고 어떤 설명을 붙이면 자연스러운지
- 왜 현재 기준선이 `단일 글로벌 모델`이 아니라 `혼합 운영 기준선`인지

## 프로젝트 한 줄 설명

이 프로젝트는 Path of Exile 1의 `public-stash-tabs` 데이터를 로컬 PostgreSQL에 수집하고, 최근 7일 priced listing을 학습용 피처로 가공한 뒤, CatBoost로 아이템의 상대적 거래 가치를 예측하기 위한 로컬 실험 시스템이다.

최종 목표는 "정확한 실제 판매가 예언"보다는, 로컬 유틸리티 앱에서 아이템이 **거래 등록할 가치가 있는지 / 잡템에 가까운지** 빠르게 판단할 수 있게 만드는 것이다.

## 현재 구현 범위

### 1. 데이터 수집

구현 완료:

- PoE OAuth `client_credentials` 기반 인증
- `public-stash-tabs` 연속 수집
- `Mirage` 리그 exact match 필터링
- priced item 중심 정규화
- `next_change_id` 기반 재시작/이어받기
- collector 내부의 `poe.ninja` 환율 스냅샷 주기 수집

현재 의미:

- 실시간 거래 시장의 "노출된 매물"을 지속 수집할 수 있다.
- 모델 라벨은 "판매 완료가"가 아니라 "관측 시점의 listing price"라는 점을 분명히 써야 한다.

### 2. 저장 및 ETL

구현 완료:

- `raw_api_responses`
- `normalized_priced_items`
- `training_features_raw`
- `training_features_clean`
- `training_features_labeled`
- cursor 기반 resume 가능한 통합 ETL 러너
- 최근 7일 fast-lane 처리 옵션
- `(timestamp, listing_key)` 복합 인덱스와 row comparison 기반 페이지네이션

현재 의미:

- 최근 데이터만 빠르게 학습용으로 따라잡는 운영이 가능하다.
- 과거 backlog 때문에 학습이 밀리던 병목을 줄였고, 실제로 최근 7일 범위를 기준으로 학습 실험까지 이어졌다.

### 3. ML 학습 파이프라인

구현 완료:

- `DB -> staged split CSV -> CatBoost file Pool` 경로
- 글로벌 1개 모델 학습
- `model_segment`별 분리 학습
- 글로벌 vs 세그먼트 비교 스크립트
- 공통 `split_spec.json` 기반 시계열 split 재현

현재 의미:

- 수천만 row 규모에서도 `pandas.read_csv()` 전체 적재를 피하면서 로컬 학습이 가능하다.
- 같은 스냅샷과 같은 split 경계로 글로벌/세그먼트 모델을 공정 비교할 수 있다.

### 4. 클립보드 추론 준비

구현 완료:

- 영어 클립보드 파서
- RePoE 기반 English affix dictionary V1
- explicit affix line candidate 추출
- 문맥 기반 ambiguity 축소

현재 의미:

- V1 범위에서는 영어 클라이언트 기준 clipboard 입력을 모델 추론 쪽으로 연결할 기반이 마련되었다.
- 한국어 지원은 capstone 기간 범위 밖으로 남겨 두는 것이 현재 전략이다.

## 전체 데이터 흐름

중간 보고서에는 아래 흐름을 한 장 그림으로 요약하는 것이 좋다.

1. `public-stash-tabs`
2. `raw_api_responses`
3. `normalized_priced_items`
4. `training_features_raw`
5. `training_features_clean`
6. `training_features_labeled`
7. `stage-training-dataset`
8. `train_catboost.py` / `run_training_comparison.py`
9. 세그먼트별 또는 글로벌 예측 모델

핵심 설명 포인트:

- collector는 "수집"
- ETL은 "학습 가능한 구조로 변환"
- staging은 "재현 가능한 split 파일 생성"
- CatBoost는 "실제 가격 대신 log-scaled target을 예측"

## 최근 7일 학습 기준선 요약

기준 실험:

- staged snapshot: `artifacts/training-staging/post_report_all_segments`
- 비교 런: `ml/runs/comparison_post_report_300iter_d8_log1p_winner`
- 타깃: `target_price_log1p`
- 설정: `iterations=300`, `depth=8`, `learning_rate=0.05`

전체 글로벌 split 규모:

| split | row 수 |
| --- | ---: |
| train | `10,662,539` |
| valid | `1,332,817` |
| test | `1,332,818` |

세그먼트별 test row 수:

| 세그먼트 | test row 수 |
| --- | ---: |
| `rare_equipment` | `641,286` |
| `jewel` | `482,680` |
| `unique_equipment` | `126,063` |
| `skill_gem` | `82,789` |

## 현재 혼합 기준선

현재 기준선은 "모든 세그먼트를 무조건 분리"가 아니라, 아래처럼 `model_segment`별로 다르게 가져가는 혼합 운영안이다.

| 세그먼트 | 글로벌 `log1p RMSE` | 세그먼트 `log1p RMSE` | 현재 권장 |
| --- | ---: | ---: | --- |
| `rare_equipment` | `1.6615` | `1.6346` | 세그먼트 모델 |
| `jewel` | `1.7409` | `1.6959` | 세그먼트 모델 |
| `unique_equipment` | `1.8573` | `1.7203` | 세그먼트 모델 |
| `skill_gem` | `1.5986` | `1.6145` | 글로벌 모델 |

이 표가 현재 중간 보고서의 핵심 결론이다.

정리 문장 예시:

> 최근 7일 스냅샷 기준 전체 비교에서 `rare_equipment`, `jewel`, `unique_equipment`는 세그먼트 분리 모델이 더 낮은 `target_price_log1p RMSE`를 보였고, `skill_gem`만 글로벌 모델이 더 우세했다. 따라서 현 단계의 운영 기준선은 단일 모델 일괄 적용보다 세그먼트별 분기와 일부 글로벌 fallback을 함께 사용하는 혼합 구조가 더 적절하다.

## `winner` 판정 기준 정리

기존 비교 산출물의 `winner`는 `target_price_chaos_rmse`만으로 판정되어 `jewel`처럼 해석 혼선이 생길 수 있었다.

이제 `ml/run_training_comparison.py`는 아래 순서로 `winner`를 판정한다.

1. `target_price_log1p_rmse`
2. 동률이면 `target_price_log1p_mae`
3. 그래도 동률이면 `target_price_chaos_rmse`

즉 앞으로는 프로젝트의 주 타깃과 자동 판정 기준이 일치한다.

현재 저장소에서 이 규칙이 반영된 정합성용 비교 산출물은 `ml/runs/comparison_post_report_300iter_d8_log1p_winner`다.

보고서에는 아래처럼 쓰면 된다.

> 비교 자동 판정 기준은 기존 `chaos RMSE` 우선 방식에서 `log1p RMSE` 우선 방식으로 조정하였다. 이는 현재 모델의 주 학습 타깃이 `target_price_log1p`이며, 고가 이상치의 영향보다 상대적 가격 구조 학습을 더 중요하게 보기 때문이다.

## Feature Importance 상위 피처 요약

아래 표는 최근 7일 전체 비교 런과 `skill_gem` 추가 점검 런에서 상위 중요도를 보인 피처를 요약한 것이다.

| 모델 | 상위 피처 |
| --- | --- |
| 글로벌 | `base_type`, `ilvl`, `quality`, `implicit_mod_count`, `crafted_mod_count`, `explicit_mod_count` |
| `rare_equipment` | `ilvl`, `base_type`, `crafted_mod_count`, `implicit_mod_count`, `quality`, `life_roll_sum` |
| `jewel` | `ilvl`, `explicit_mod_count`, `implicit_mod_count`, `rarity`, `fractured`, `life_roll_sum` |
| `unique_equipment` | `base_type`, `attribute_roll_sum`, `resistance_roll_sum`, `ilvl`, `corrupted`, `explicit_mod_count` |
| `skill_gem` | `gem_level`, `base_type`, `explicit_mod_count`, `corrupted`, `quality`, `gem_quality` |

해석 포인트:

- 글로벌 모델은 아이템 전반을 가르는 `base_type`, `ilvl` 같은 범용 구분자가 가장 크게 작동한다.
- `rare_equipment`에서는 `crafted_mod_count`, `implicit_mod_count`, `life_roll_sum`처럼 실제 옵션 품질과 제작 상태가 중요하게 작용한다.
- `jewel`에서는 mod 개수와 `jewel_type`, `fractured` 여부가 강하게 작동해, 장비류와 다른 가격 결정 구조를 보인다.
- `unique_equipment`에서는 고유 베이스 자체와 속성치/저항 합계가 큰 비중을 차지해, unique 고유 정체성과 옵션 패키지 가치가 중요함을 시사한다.
- `skill_gem`은 거의 일관되게 `gem_level`, `gem_quality`, `is_awakened`, `is_vaal` 같은 gem 전용 피처가 지배적이다.

중간 보고서에서 이 표를 쓰는 목적은 "모델이 아무 근거 없이 가격을 맞추는 것이 아니라, 도메인적으로도 납득 가능한 속성에 반응하고 있다"는 점을 보여 주는 것이다.

## `skill_gem` 추가 점검

`skill_gem`은 전체 비교에서 유일하게 글로벌 모델이 더 좋았기 때문에, 세그먼트 분리 기준을 그대로 유지할지 확인하기 위해 추가 단독 실험을 한 번 더 실행했다.

추가 실험:

- 실행 결과 경로: `ml/runs/skill_gem_post_report_500iter_d6`
- 설정: `iterations=500`, `depth=6`, `learning_rate=0.05`

비교:

| 모델 | `log1p RMSE` | `log1p MAE` | 해석 |
| --- | ---: | ---: | --- |
| 글로벌 모델의 `skill_gem` test 평가 | `1.5986` | `1.2186` | 기준선 |
| `skill_gem` 세그먼트 모델 (`300 iter`, `depth=8`) | `1.6145` | `1.2451` | 글로벌보다 나쁨 |
| `skill_gem` 세그먼트 모델 (`500 iter`, `depth=6`) | `1.6180` | `1.2470` | 추가 점검에서도 개선 실패 |

즉 현재 시점에서는 `skill_gem`을 별도 모델로 분리하는 근거가 충분하지 않다.

해석 문장 예시:

> `skill_gem` 세그먼트는 분리 학습을 한 번 더 점검했지만, `500 iter / depth 6` 추가 실험에서도 글로벌 모델보다 낮은 오차를 만들지 못했다. 따라서 현 단계에서는 gem 계열을 별도 세그먼트 모델로 운영하기보다 글로벌 모델 fallback으로 유지하는 편이 더 보수적이고 안정적이다.

## 왜 이 결과가 자연스러운가

보고서에서는 단순히 "성능이 이렇다"보다, 왜 이런 결과가 나왔는지 한 문단 정도 붙이는 편이 좋다.

추천 설명:

- `rare_equipment`, `jewel`, `unique_equipment`는 가격 형성 규칙이 서로 꽤 다르므로 세그먼트 분리 이점이 크다.
- 반대로 `skill_gem`은 현재 피처 공간에서 핵심 변수가 이미 몇 개로 압축되어 있고, row 수도 다른 세그먼트보다 적다.
- 따라서 `skill_gem`은 세그먼트 분리보다 글로벌 모델이 다른 데이터 분포를 함께 보며 regularization 효과를 받는 쪽이 더 유리할 수 있다.

## 중간 보고서 장별 연결 가이드

`docs/목차.md` 기준으로는 아래처럼 연결하면 자연스럽다.

### 제3장 시스템 요구사항 및 전체 구조

넣을 내용:

- collector / ETL / staging / CatBoost / clipboard parser를 포함한 전체 구성도
- 왜 로컬 앱용 판단 시스템으로 문제를 정의했는지
- 왜 최근 7일 기준과 세그먼트 모델 비교가 필요한지

주 참고 문서:

- `README.md`
- `docs/TRAINING_ETL_OVERVIEW.md`
- `docs/STORAGE_POLICY.md`

### 제4장 데이터 수집 파이프라인 설계 및 구현

넣을 내용:

- OAuth 인증
- `next_change_id` 이어받기
- `Mirage` 리그 필터
- raw / normalized 저장
- collector와 maintenance 역할 분리

주 참고 문서:

- `README.md`
- `docs/STORAGE_POLICY.md`
- `docs/REPORT_HANDOFF.md`

### 제5장 데이터 정제 및 학습 데이터 파이프라인

넣을 내용:

- `training_features_raw -> clean -> labeled`
- 환율 스냅샷과 chaos 환산
- 최근 7일 fast-lane
- 복합 인덱스와 row comparison 최적화
- staged split 생성과 `REPEATABLE READ` snapshot

주 참고 문서:

- `docs/TRAINING_ETL_OVERVIEW.md`
- `docs/TRAINING_FEATURES.md`
- `ml/README.md`

### 제6장 가격 예측 모델 설계 및 실험

넣을 내용:

- CatBoost 선택 이유
- `target_price_log1p`를 주 타깃으로 둔 이유
- 글로벌 vs 세그먼트 비교 설계
- 현재 혼합 기준선
- feature importance 해석

주 참고 문서:

- `docs/TRAINING_BASELINE_REPORT_2026-04-19.md`
- 이 문서
- `ml/README.md`

### 제7장 로컬 보조 애플리케이션 설계 및 구현

넣을 내용:

- 현재는 UI보다 입력 파이프라인 준비 단계
- 영어 clipboard parser와 affix dictionary V1
- 실제 앱 단계에서는 `Ctrl+C` 입력을 파싱해 동일 feature 정책으로 연결할 계획

주 참고 문서:

- `docs/CLIPBOARD_COMPATIBILITY_AUDIT.md`
- `docs/AFFIX_SOURCE_STRATEGY.md`
- `docs/AFFIX_DICTIONARY_REQUIREMENTS.md`

### 제8장 통합 실행 결과 및 고찰

넣을 내용:

- 최근 7일 기준 ETL과 ML이 실제로 연결되었다는 점
- 데이터 수집, ETL, 학습, 클립보드 입력 준비가 각자 따로가 아니라 하나의 파이프라인으로 이어진다는 점
- 아직 실제 거래 체결가가 아니라 listing price 기반이며, 한국어 지원과 UI는 후속 과제라는 점

## 현재 시점에서 강조하면 좋은 성과

중간 보고서에는 아래 네 가지를 강하게 드러내는 편이 좋다.

1. 수집기만 만든 수준이 아니라, 최근 7일 데이터로 실제 CatBoost 비교 실험까지 연결했다.
2. 대용량 학습 병목을 피하기 위해 staging 기반 입력 파이프라인으로 재설계했다.
3. 모든 아이템을 한 모델로 보는 대신 세그먼트별 분리와 글로벌 fallback을 비교해 더 현실적인 기준선을 만들었다.
4. 추론 입력을 위한 영어 clipboard parser와 affix dictionary V1까지 준비해, 향후 로컬 앱 연결 경로를 확보했다.

## 아직 남은 한계

정직하게 적으면 좋은 항목:

- 라벨은 실제 거래 체결가가 아니라 관측 시점 listing price다.
- `skill_gem`은 아직 세그먼트 분리 이점이 명확하지 않다.
- 한국어 clipboard 지원은 현재 범위 밖이다.
- UI/로컬 앱 완성본은 아직 구현 전이다.
- 더 긴 기간 실험과 하이퍼파라미터 탐색은 아직 충분하지 않다.

## 한 문단 요약 초안

아래 문단은 중간 보고서 요약 초안으로 바로 다듬어 쓸 수 있다.

> 본 프로젝트는 Path of Exile 1의 공개 거래 데이터를 로컬 환경에서 수집하고, 이를 정규화 및 다단계 ETL을 통해 학습 가능한 형태로 가공한 뒤, CatBoost 기반 가격 예측 실험으로 연결하는 것을 목표로 한다. 최근 7일 데이터 약 1,333만 row를 대상으로 글로벌 모델과 세그먼트별 모델을 비교한 결과, `rare_equipment`, `jewel`, `unique_equipment`에서는 세그먼트 모델이 더 낮은 오차를 보였고, `skill_gem`은 글로벌 모델이 더 안정적인 성능을 보였다. 이에 따라 현 단계의 기준선은 단일 모델 일괄 적용이 아니라 세그먼트별 분기와 글로벌 fallback을 함께 사용하는 혼합 구조로 정리하였다. 또한 향후 로컬 유틸리티 앱 입력을 위해 영어 클립보드 파서와 RePoE 기반 affix dictionary V1을 구축하여 추론 파이프라인 연결 기반도 마련하였다.
