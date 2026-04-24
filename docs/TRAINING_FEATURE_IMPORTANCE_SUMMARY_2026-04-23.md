# TRAINING_FEATURE_IMPORTANCE_SUMMARY_2026-04-23.md

## 문서 목적

이 문서는 최근 7일 CatBoost 기준선 실험에서 확인된 `feature_importance.csv`를 빠르게 해석할 수 있도록 정리한 요약 문서다.

리포트 본문을 여기서 직접 쓰지는 않고, 아래 내용을 보고서/발표 자료에 옮겨 적을 수 있게 만드는 것이 목적이다.

## 기준 실험

주 기준 실험:

- 비교 런: `ml/runs/comparison_post_report_300iter_d8_log1p_winner`
- 스테이징 스냅샷: `artifacts/training-staging/post_report_all_segments`
- 타깃: `target_price_log1p`
- 설정: `iterations=300`, `depth=8`, `learning_rate=0.05`

추가 확인 실험:

- `skill_gem` 단독 점검: `ml/runs/skill_gem_post_report_500iter_d6`

## 상위 피처 요약표

| 모델 | 상위 중요 피처 |
| --- | --- |
| 글로벌 | `base_type`, `ilvl`, `quality`, `implicit_mod_count`, `crafted_mod_count`, `explicit_mod_count`, `rarity`, `model_segment` |
| `rare_equipment` | `ilvl`, `base_type`, `crafted_mod_count`, `implicit_mod_count`, `quality`, `life_roll_sum`, `explicit_mod_count`, `fractured_mod_count` |
| `jewel` | `ilvl`, `explicit_mod_count`, `implicit_mod_count`, `rarity`, `fractured`, `life_roll_sum`, `utility_mod_count`, `jewel_type` |
| `unique_equipment` | `base_type`, `attribute_roll_sum`, `resistance_roll_sum`, `ilvl`, `corrupted`, `explicit_mod_count`, `life_roll_sum`, `quality` |
| `skill_gem` | `gem_level`, `base_type`, `explicit_mod_count`, `corrupted`, `quality`, `gem_quality`, `is_awakened`, `is_vaal` |

## 모델별 해석

### 글로벌 모델

글로벌 모델은 전체 아이템군을 한 번에 보기 때문에, 가장 먼저 큰 축을 가르는 범용 feature가 상위에 올라온다.

- `base_type`
- `ilvl`
- `quality`
- `implicit_mod_count`
- `crafted_mod_count`

즉 글로벌 모델은 "어떤 물건인가"와 "기본 완성도/제작 상태가 어떤가"를 우선적으로 본다고 해석할 수 있다.

### `rare_equipment`

`rare_equipment`는 아래 피처 비중이 특히 높다.

- `ilvl`
- `base_type`
- `crafted_mod_count`
- `implicit_mod_count`
- `quality`
- `life_roll_sum`

해석:

- 베이스와 아이템 레벨이 먼저 가격대를 나누고
- crafted/implicit/life 계열이 실제 usable quality를 추가로 가른다

즉 희귀 장비는 "베이스 + 제작 상태 + 핵심 옵션 품질" 조합이 중요하다는 도메인 직관과 잘 맞는다.

### `jewel`

`jewel`에서는 장비류와 조금 다른 패턴이 나타난다.

- `explicit_mod_count`
- `implicit_mod_count`
- `fractured`
- `utility_mod_count`
- `jewel_type`
- `notable_count`

해석:

- 단순 방어 수치보다 mod 구성과 jewel subtype이 더 중요하다
- cluster/jewel 계열은 옵션 조합 그 자체가 가격 형성의 중심이라는 점을 잘 보여 준다

### `unique_equipment`

`unique_equipment`는 고유 베이스의 영향이 특히 크다.

- `base_type`
- `attribute_roll_sum`
- `resistance_roll_sum`
- `ilvl`
- `corrupted`

해석:

- unique는 "무슨 고유 아이템인가"가 가장 중요하고
- 그 위에 속성/저항/품질/오염 여부 같은 상태 차이가 얹힌다

즉 희귀 장비처럼 미세 옵션 조합보다는, 고유 베이스 정체성과 상태 차이가 가격을 크게 좌우한다.

### `skill_gem`

`skill_gem`은 다른 세그먼트보다 훨씬 명확하게 gem 전용 feature가 지배적이다.

- `gem_level`
- `gem_quality`
- `is_awakened`
- `is_vaal`
- `base_type`
- `corrupted`

추가 점검 런인 `ml/runs/skill_gem_post_report_500iter_d6`에서도 상위 구조는 거의 같았다.

해석:

- gem은 방어/무기/주얼 계열 feature보다 레벨과 품질이 거의 모든 것을 설명한다
- 따라서 현재 feature 공간에서는 세그먼트를 더 잘게 분리하는 것보다, 글로벌 모델이 다른 데이터까지 함께 보며 안정적으로 regularization을 받는 편이 더 유리할 가능성이 있다

## 보고서/발표에서 쓸 때의 핵심 메시지

이 문서에서 보고서 쪽으로 가져갈 포인트는 아래 정도면 충분하다.

1. 모델은 임의의 노이즈가 아니라 도메인적으로 납득 가능한 feature에 반응하고 있다.
2. 세그먼트별로 중요한 피처 구성이 다르기 때문에, 단일 글로벌 모델과 세그먼트 모델을 함께 비교할 이유가 있다.
3. `skill_gem`은 feature 구조가 이미 압축되어 있어 세그먼트 분리 이점이 작게 나타났을 수 있다.

## 한 줄 정리

현재 feature importance 결과는 "희귀 장비/주얼/고유 장비/젬이 서로 다른 가격 형성 규칙을 가진다"는 점을 뒷받침하며, 동시에 `skill_gem`만은 별도 세그먼트 분리보다 글로벌 fallback이 더 자연스러울 수 있다는 현재 혼합 기준선과도 잘 맞는다.
