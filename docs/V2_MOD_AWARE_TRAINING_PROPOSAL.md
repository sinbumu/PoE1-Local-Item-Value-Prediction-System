# V2 Mod-aware Training Proposal

## 문서 목적

이 문서는 **PoE1 Local Item Value Prediction System**의 2차 학습 방향을 코딩 에이전트가 검토하고 구현 계획으로 전환할 수 있도록 정리한 제안서이다.

현재 V1 학습은 `collector -> ETL -> CatBoost`까지 실제로 연결되는지를 검증한 기준선으로 의미가 있다. 그러나 최종 프로젝트 목표는 “아이템의 완벽한 시장 가격을 예언하는 것”이 아니라, 실제 플레이 중 아이템이 다음 중 어디에 가까운지 빠르게 판단하는 것이다.

- **가치 없음 / 버려도 됨**
- **판매 시도 또는 직접 검색할 가치 있음**
- **고가 후보 / 반드시 확인 필요**

따라서 V2 학습은 exact price regression보다 **search-worthy / high-value candidate 판별**을 우선 목표로 재정의한다.

---

## 1. 현재 V1 모델의 위치

현재 프로젝트의 V1 기준선은 다음을 달성했다.

- PoE1 Public Stash API 기반 공개 listing 수집
- Mirage softcore 리그 필터링
- `normalized_priced_items -> training_features_raw -> training_features_clean -> training_features_labeled` ETL 계층 구축
- 최근 7일 데이터 기반 CatBoost 1차 학습
- global model과 segment model 비교
- 현재 기준선: `rare_equipment`, `jewel`, `unique_equipment`는 segment model 우세, `skill_gem`은 global model 우세

현재 학습 입력은 `clipboard_safe_v1` 화이트리스트 기반이다. 즉, 클립보드 입력에서도 재현 가능하다고 판단된 요약 피처만 사용한다. 대표적으로 `base_type`, `rarity`, `ilvl`, `quality`, mod count, life/resistance/attribute roll summary, gem level/quality 등이 포함된다.

이 구조는 데이터 수집과 학습 파이프라인의 연결성을 검증하기에는 충분하지만, rare item의 실제 옵션 조합 가치를 충분히 표현하기에는 부족하다.

---

## 2. 문제 인식: rare/unique item에는 mod identity가 필요하다

Rare equipment와 일부 unique equipment의 가격은 단순한 mod 개수나 합산 수치만으로 결정되지 않는다.

예를 들어 다음 두 아이템은 모두 explicit mod 6개, life/resistance roll이 있을 수 있지만 실제 가치는 크게 다를 수 있다.

1. 무작위 잡옵이 섞인 6옵 rare item
2. 특정 빌드에서 요구하는 핵심 affix 조합을 가진 rare item

따라서 V2에서는 아래 정보를 모델 입력에 반영해야 한다.

- 어떤 affix family가 붙었는가
- 해당 affix가 prefix인지 suffix인지
- roll 수치가 해당 mod/tier 기준으로 어느 정도 좋은가
- crafted / fractured / influenced / corrupted 여부
- base type과 옵션 조합이 특정 item class에서 의미 있는가
- unique item의 경우 “무슨 unique인가”와 “핵심 roll이 얼마나 좋은가”

즉, V2의 핵심은 CatBoost 모델 자체를 바꾸는 것이 아니라 **feature representation을 mod-aware하게 바꾸는 것**이다.

---

## 3. V2 목표 재정의

### 3.1 잘못된 목표

다음 목표는 현재 프로젝트 범위에서 과도하다.

> 임의의 rare item에 대해 실제 판매 완료 가격을 정확히 예측한다.

이유:

- 현재 라벨은 실제 체결가가 아니라 공개 listing price다.
- listing price에는 시세 착오, 과대 가격, 장기 미판매 매물, 조작성 가격이 섞일 수 있다.
- rare item의 옵션 조합 공간은 매우 크다.
- 빌드 메타 수요와 실제 판매 성공 여부를 직접 관측하지 못한다.

### 3.2 현실적인 목표

V2의 현실적인 목표는 다음이다.

> 아이템이 버릴 잡템인지, 검색/판매 시도 가치가 있는지, 고가 후보인지 분류한다.

따라서 모델 목적은 아래 순서로 둔다.

1. **Primary:** 가치 구간 분류 / search-worthy classification
2. **Secondary:** log price regression
3. **Optional:** high-value candidate ranking

최종 로컬 앱에서는 exact price 하나를 강하게 보여주기보다, 아래와 같은 출력을 우선한다.

```text
예측 결과: 검색 권장
가격 구간: 중가~고가 후보
신뢰도: 보통
주의: 공개 listing 기반 추정치이므로 직접 거래소 확인 필요
```

---

## 4. V2 학습 전략 요약

V2에서는 다음 구조를 권장한다.

```text
Public Stash item_json / Ctrl+C clipboard text
    -> ParsedItem
    -> ModObservation
    -> Mod-aware FeatureBuilder
    -> training_features_v2
    -> band classifier + log-price regressor
```

핵심 원칙:

1. Stash API 경로와 clipboard 경로가 같은 중간 표현을 공유해야 한다.
2. 외부 API 전용 필드를 모델에 직접 넣지 않는다.
3. English client 기준으로 먼저 구현한다.
4. RePoE 기반 affix dictionary를 사용한다.
5. `prefix_count` / `suffix_count`보다 canonical mod / mod family / roll quality를 우선한다.
6. exact price보다 search-worthy 판단을 우선한다.

---

## 5. 데이터 사용 가능성 점검

V2 구현 전 반드시 확인할 사항:

### 5.1 기존 수집 데이터에 mod line이 보존되어 있는가?

확인 대상:

- `normalized_priced_items.item_json`
- archived normalized backup
- raw subset / raw archive

필수 확인 필드:

- `explicitMods`
- `implicitMods`
- `craftedMods`
- `fracturedMods`
- `enchantMods`
- `properties`
- `requirements`
- `sockets`
- `name`, `typeLine`, `baseType`, `rarity`, `ilvl`

판단:

- 위 정보가 보존되어 있으면, 기존 수집분도 V2 feature로 재처리 가능하다.
- mod line이 없는 요약 피처만 남아 있다면, 해당 기간 데이터는 V2 학습에 제한적이다.
- 이 경우 앞으로 수집되는 데이터부터 V2 feature를 생성해야 한다.

### 5.2 clipboard parity 가능성

최종 앱 입력은 `Ctrl+C` 클립보드이므로, V2 feature는 clipboard에서도 재현 가능해야 한다.

따라서 stash API item_json과 clipboard parser는 아래 구조를 공유해야 한다.

```text
stash API item_json -> ParsedItem
clipboard text -> ParsedItem
ParsedItem -> FeatureBuilder -> model features
```

---

## 6. 신규 중간 계층 제안

## 6.1 `item_mod_observations`

아이템 단위 요약 피처만으로는 한계가 있으므로, mod line 단위 중간 계층을 추가한다.

목적:

- 각 mod line을 canonical affix dictionary와 연결
- match 성공/실패/ambiguous 케이스 추적
- mod family별 집계 피처를 나중에 유연하게 생성

예상 컬럼:

```text
listing_key
source_item_id
model_segment
item_class
base_type
rarity

section_type
  - explicit
  - implicit
  - crafted
  - fractured
  - enchant

raw_mod_line
normalized_mod_line

canonical_mod_id
source_mod_id
stat_ids_json
affix_type
  - prefix
  - suffix
  - unknown

mod_family
numeric_values_json
roll_norm_values_json

match_status
  - matched
  - ambiguous
  - unmatched

match_confidence
dictionary_version
created_at
```

주의:

- `canonical_mod_id`가 하나로 확정되지 않으면 억지로 채우지 않는다.
- ambiguous 후보는 별도 JSON으로 남긴다.
- unmatched line은 모델 feature 생성에는 제한적으로 사용하되, dictionary 보강 대상으로 축적한다.

---

## 6.2 `training_features_v2_mod_summary`

`item_mod_observations`를 item/listing 단위로 집계한 V2 feature 계층이다.

예상 공통 피처:

```text
matched_explicit_mod_count
unmatched_explicit_mod_count
ambiguous_explicit_mod_count
matched_implicit_mod_count
matched_crafted_mod_count
matched_fractured_mod_count

affix_count_confidence
prefix_count_v2
suffix_count_v2
open_prefix_estimate
open_suffix_estimate

life_mod_count
life_roll_sum
life_roll_max
life_roll_norm_max

resistance_total_sum
fire_resistance_sum
cold_resistance_sum
lightning_resistance_sum
chaos_resistance_sum
resistance_roll_norm_max

attribute_total_sum
strength_sum
dexterity_sum
intelligence_sum

damage_mod_count
attack_mod_count
spell_mod_count
crit_mod_count
speed_mod_count
defence_mod_count
utility_mod_count

high_roll_mod_count
top_tier_like_mod_count
crafted_high_value_family_count
fractured_high_value_family_count
```

V2에서 `prefix_count_v2` / `suffix_count_v2`는 모든 explicit line이 높은 신뢰도로 매칭될 때만 채운다. 하나라도 unmatched 또는 high-risk ambiguous라면 null로 둔다.

---

## 6.3 `training_value_bands`

최종 목표가 exact price가 아니라 가치 구분이므로, 회귀 라벨 외에 band label을 추가한다.

예시 band:

```text
0 = trash_or_vendor
1 = low_value
2 = search_worthy
3 = high_value_candidate
```

초기 기준 예시:

```text
trash_or_vendor:      target_price_chaos < 5
low_value:            5 <= target_price_chaos < 30
search_worthy:        30 <= target_price_chaos < 1 divine equivalent
high_value_candidate: target_price_chaos >= 1 divine equivalent
```

단, threshold는 리그 경제와 segment별 가격 분포에 따라 조정할 수 있다.

대안:

- fixed threshold: 실제 유저 의사결정에 직관적
- segment quantile band: 모델 학습 균형에 유리
- hybrid: fixed threshold를 기본으로 하고, segment별 quantile 분석을 보조 지표로 사용

권장:

- MVP UI에는 fixed threshold 기반 band가 더 이해하기 쉽다.
- 모델 실험에는 fixed band와 quantile band를 모두 비교한다.

---

## 7. Segment별 V2 feature 방향

## 7.1 rare_equipment

가장 중요한 V2 대상이다.

권장 feature:

```text
item_class
base_type
ilvl
quality
influence flags
fractured
synthesised
corrupted
socket_count
link_count

prefix_count_v2
suffix_count_v2
open_prefix_estimate
open_suffix_estimate

life_roll_norm_max
resistance_total_sum
chaos_resistance_sum
attribute_total_sum
suppression_like_mod_present
movement_speed_present
attack_speed_present
crit_like_mod_present
gem_level_like_mod_present

family_count_* 
family_roll_norm_max_*
family_roll_sum_*
```

권장 범위 축소:

처음부터 모든 rare equipment를 한 모델로 V2 처리하지 않는다. 우선 다음 중 1~2개 item class로 시작한다.

- boots
- gloves
- helmet
- body armour
- ring / amulet / belt

평가 목표:

- rare_equipment_v1 vs rare_equipment_v2 비교
- search-worthy recall
- high-value precision
- log1p RMSE / MAE 보조 확인

---

## 7.2 unique_equipment

Unique equipment는 rare item과 다른 구조다.

핵심:

```text
무슨 unique인가 + roll이 얼마나 좋은가
```

V2에서 반드시 추가해야 할 피처:

```text
unique_name
base_type
quality
corrupted
socket_count
link_count
canonical_unique_mod_ids
unique_roll_norm_avg
unique_roll_norm_max
important_unique_roll_norms
```

주의:

- unique는 `base_type`만으로 부족하다.
- `name` 또는 canonical unique id가 핵심 피처여야 한다.
- 일부 unique는 roll 차이보다 corruption/enchant/link 상태가 중요할 수 있다.

---

## 7.3 jewel

Jewel은 장비류와 가격 형성 구조가 다르다.

권장 feature:

```text
jewel_type
cluster_size
cluster_passive_count
notable_count
notable_names
fractured
corrupted
implicit_mod_count
explicit_mod_count

life_present
crit_multi_present
dot_multi_present
reservation_present
minion_present
cluster_notable_signature
family_count_*
```

Cluster jewel의 경우 `notable_count`보다 **notable identity 조합**이 더 중요할 수 있다.

---

## 7.4 skill_gem

현재 실험에서는 `skill_gem`이 segment model보다 global model에서 더 좋은 결과를 보였다. 따라서 V2 핵심 대상은 아니다.

유지할 feature:

```text
gem_name
gem_level
gem_quality
is_awakened
is_vaal
is_support
corrupted
```

권장:

- V2 초반에는 skill_gem 모델을 크게 변경하지 않는다.
- 기존 global fallback 기준선을 유지한다.

---

## 8. 모델 설계 제안

## 8.1 Two-head approach

V2에서는 회귀 모델 하나만 두지 말고 두 목표를 분리한다.

### Model A. Value Band Classifier

목표:

```text
trash_or_vendor / low_value / search_worthy / high_value_candidate
```

평가:

- macro F1
- weighted F1
- high-value precision
- search-worthy recall
- confusion matrix

중요:

- “버려도 된다”라고 판단했는데 실제 고가인 경우가 가장 위험하다.
- 따라서 `search_worthy` 이상에 대한 recall을 높이는 것이 중요하다.

### Model B. Log Price Regressor

목표:

```text
target_price_log1p
```

용도:

- band 내부 ranking
- feature importance 해석
- 기존 V1 기준선과 비교

평가:

- log1p RMSE
- log1p MAE
- segment별 error
- high-value subset error

---

## 8.2 모델 후보

V2에서도 CatBoost를 유지한다.

이유:

- 범주형 피처가 많다.
- dense numeric summary와 category feature를 함께 처리하기 좋다.
- V1 baseline과 비교가 쉽다.

추가 후보:

- CatBoostClassifier for value band
- CatBoostRegressor for log price
- Optional: binary classifier for `is_search_worthy`

---

## 9. 라벨 품질 개선 제안

V2에서는 피처뿐 아니라 라벨도 정리해야 한다.

### 9.1 listing_key 단위 중복 관리

동일 listing이 train/test에 동시에 들어가면 성능이 과대평가될 수 있다.

권장:

- 동일 `listing_key`는 같은 split에만 배정
- 또는 학습 전 listing 단위 collapse
- 최소한 split leakage audit report 생성

### 9.2 outlier filtering

권장 규칙:

- segment + item_class + base_type 단위 log price outlier 제거
- 비정상적으로 높은 listing price 제거
- 너무 희귀한 currency 제거
- price note 파싱 신뢰도가 낮은 row 제외

### 9.3 stale listing caution

오래 남아 있는 매물은 실제 판매 가능 가격보다 높을 수 있다.

가능하면 추후:

- listing persistence duration
- repeated observation count
- disappearance signal

을 별도 라벨 보조 신호로 검토한다.

단, V2 첫 단계에서는 sold/removal label까지 무리하게 만들지 않는다.

---

## 10. 실험 설계

## 10.1 첫 실험 범위

첫 V2 실험은 다음으로 제한한다.

```text
segment = rare_equipment
item_class = boots 또는 gloves 등 1~2개
language = English dictionary only
label = value band + target_price_log1p
```

이유:

- rare_equipment가 V1 피처 한계가 가장 큰 구간이다.
- item_class별로 가격 형성 규칙이 다르므로 좁히는 편이 해석이 쉽다.
- 영어 dictionary V1이 이미 준비되어 있다.

## 10.2 비교군

반드시 같은 snapshot / 같은 split으로 비교한다.

```text
V1 rare_equipment baseline
V2 rare_equipment mod-summary model
V2 rare_equipment band classifier
```

## 10.3 평가 지표

회귀:

- `target_price_log1p_rmse`
- `target_price_log1p_mae`
- segment/item_class별 RMSE

분류:

- macro F1
- weighted F1
- search-worthy recall
- high-value precision
- confusion matrix
- Precision@K for high-value candidates

MVP 관점 핵심 지표:

```text
valuable item을 trash로 잘못 분류하지 않는가?
검색할 가치 있는 후보를 상위에 잘 올리는가?
```

---

## 11. 구현 단계 제안

### Phase 0. 데이터 보존 여부 확인

작업:

- `normalized_priced_items.item_json`에 mod line들이 보존되어 있는지 확인
- 기존 7일 snapshot에서 V2 feature 생성 가능성 확인
- mod line 누락률 report 생성

산출물:

- `reports_docs/v2_mod_feature_data_audit.md`

---

### Phase 1. ModObservation 생성기

작업:

- stash API item_json을 `ParsedItem`으로 변환
- explicit/implicit/crafted/fractured/enchant line 추출
- RePoE English affix dictionary로 canonical candidate 매칭
- `item_mod_observations` 테이블 또는 artifact 생성

산출물:

- `item_mod_observations`
- unmatched / ambiguous examples report

---

### Phase 2. V2 FeatureBuilder

작업:

- `item_mod_observations`를 listing 단위로 집계
- mod family aggregate feature 생성
- roll normalized feature 생성
- prefix/suffix 후보 count 생성

산출물:

- `training_features_v2_mod_summary`
- `training_features_v2_labeled`

---

### Phase 3. Value band labeler

작업:

- fixed threshold band 생성
- segment quantile band 생성
- band 분포 report 생성

산출물:

- `training_value_bands`
- `table_value_band_distribution.csv`
- `figure_value_band_distribution.png`

---

### Phase 4. Rare equipment V2 experiment

작업:

- same snapshot / same split으로 V1 vs V2 비교
- CatBoostRegressor + CatBoostClassifier 실행
- feature importance 생성

산출물:

- `ml/runs/v2_rare_equipment_*`
- `comparison_v1_vs_v2_rare_equipment.csv`
- `v2_rare_equipment_report.md`

---

### Phase 5. 확장 여부 결정

rare_equipment V2에서 개선이 확인되면 다음 순서로 확장한다.

1. unique_equipment
2. jewel
3. broader rare_equipment item classes
4. clipboard inference integration

---

## 12. 성공 기준

V2는 다음 중 일부라도 만족하면 의미가 있다.

1. rare_equipment에서 V1 대비 value band classifier 성능 개선
2. high-value candidate precision 개선
3. search-worthy recall 개선
4. feature importance가 도메인적으로 해석 가능
5. clipboard parser와 stash ETL feature parity가 개선
6. 앱에서 “버릴지 / 검색할지” 판단에 쓸 수 있는 output 생성

회귀 RMSE가 크게 개선되지 않아도, **고가 후보 선별 성능이 개선되면 MVP 관점에서는 성공**으로 본다.

---

## 13. 실패 가능성과 fallback

### 13.1 가능성 있는 실패

- dictionary match ambiguous 비율이 너무 높음
- listing price noise 때문에 V2 피처 개선이 성능으로 이어지지 않음
- rare item 조합 공간이 너무 커서 일반화가 어려움
- 기존 저장 데이터에 mod line이 충분히 보존되지 않음

### 13.2 fallback

실패 시 아래 방향으로 축소한다.

1. rare_equipment 전체가 아니라 item_class별 모델로 축소
2. exact regression 대신 binary `is_search_worthy` classifier만 유지
3. canonical mod one-hot 대신 family aggregate만 사용
4. high confidence matched items만 학습
5. unique_equipment 또는 jewel처럼 구조가 더 제한적인 세그먼트로 먼저 검증

---

## 14. 코딩 에이전트용 작업 지시 요약

```text
V2 학습의 목표는 exact price prediction이 아니라 value triage다.
현재 V1은 clipboard_safe_v1 요약 피처 기반이라 rare item의 실제 옵션 조합 가치를 충분히 표현하지 못한다.
RePoE 기반 English affix dictionary를 사용해 mod-aware feature layer를 추가하고, 먼저 rare_equipment에 한정해 V1 vs V2 비교를 진행한다.

필수 작업:
1. 기존 normalized/item_json에 mod line이 보존되어 있는지 audit한다.
2. item_mod_observations 계층을 만든다.
3. explicit/crafted/fractured/implicit mod line을 canonical candidate로 매칭한다.
4. mod family aggregate와 roll normalized summary feature를 만든다.
5. prefix_count_v2/suffix_count_v2는 high-confidence일 때만 채운다.
6. target_price_chaos 기반 value band label을 만든다.
7. CatBoostClassifier로 value band / search-worthy 분류 모델을 학습한다.
8. CatBoostRegressor는 보조 기준선으로 유지한다.
9. rare_equipment_v1 vs rare_equipment_v2를 같은 snapshot, 같은 split으로 비교한다.
10. high-value precision, search-worthy recall, confusion matrix를 반드시 보고한다.

하지 말 것:
- 임의의 rare item exact price prediction을 성공 기준으로 삼지 말 것
- dictionary ambiguous line을 억지로 단일 canonical mod로 확정하지 말 것
- 한국어 dictionary를 V2 필수 범위로 넣지 말 것
- canonical mod 전체 one-hot을 처음부터 무제한 투입하지 말 것
```

---

## 15. 한 줄 결론

V2의 핵심은 “가격을 더 정확히 맞히는 모델”이 아니라, **affix dictionary 기반으로 아이템 옵션 구조를 이해하고, 아이템을 버릴 것 / 검색할 것 / 고가 후보로 분류하는 모델**을 만드는 것이다.

이 방향이 최종 로컬 유틸리티 앱의 실제 사용 목적과 가장 잘 맞는다.
