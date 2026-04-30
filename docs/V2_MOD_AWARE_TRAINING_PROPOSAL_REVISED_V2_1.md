# V2 Mod-aware Value Band Training Proposal (Revised v2.1)

## 0. 문서 목적

이 문서는 PoE1 Local Item Value Prediction System의 **2차 학습모델(V2) 방향**을 정리한 개발 제안서이다.

현재 V1은 수집, 정규화, 라벨 생성, CatBoost 학습까지 연결되는지 검증한 **운영 가능한 1차 기준선**이다. 그러나 V1은 `clipboard_safe_v1` 요약 피처 중심이므로, rare equipment처럼 옵션 조합과 roll 품질이 가격에 크게 영향을 주는 아이템의 가치를 충분히 표현하기 어렵다.

따라서 V2에서는 **RePoE 기반 English affix dictionary**와 mod line 분석을 이용해, 아이템의 옵션 조합을 더 잘 반영하는 mod-aware feature를 만든다.

단, V2의 목표는 **완벽한 가격 측정**이 아니다. PoE 아이템 가격은 본질적으로 유저 간 시장가이며, 현재 라벨도 실제 체결가가 아니라 관측 시점의 공개 listing price다. 따라서 V2의 최종 목표는 다음과 같다.

> 아이템이 낮은 가치 후보인지, 검색해볼 가치가 있는지, 고가 후보인지 판단하는 **value band / search-worthy classifier**를 만드는 것.

---

## 1. 현재 V1의 의미와 한계

### 1.1 V1의 의미

V1은 다음을 이미 검증했다.

- Public Stash 기반 데이터 수집
- Mirage softcore 중심 필터링
- `normalized_priced_items` 생성
- `training_features_raw -> clean -> labeled` ETL
- `target_price_chaos`, `target_price_log1p` 라벨 생성
- CatBoost 기반 global / segment baseline 비교
- English clipboard parser 및 affix dictionary V1 기반 준비

즉, V1은 단순 아이디어 단계가 아니라 실제 데이터와 모델이 연결된 기준선이다.

### 1.2 V1의 한계

V1은 학습 입력을 클립보드 호환성이 높은 요약 피처 중심으로 제한한다. 대표적으로 다음 피처를 사용한다.

- `base_type`
- `rarity`
- `ilvl`
- `quality`
- `explicit_mod_count`
- `implicit_mod_count`
- `crafted_mod_count`
- `life_roll_sum`
- `resistance_roll_sum`
- `attribute_roll_sum`
- `damage_mod_count`
- `defence_mod_count`
- `utility_mod_count`

이 피처들은 전체 파이프라인 검증에는 유용하지만, rare equipment의 실제 가치를 판단하기에는 부족하다.

예를 들어 동일하게 explicit 6개, life/resistance 합산값이 비슷한 아이템이라도 다음 차이에 따라 가격이 크게 달라질 수 있다.

- 어떤 affix family가 붙었는가
- 해당 affix가 prefix인지 suffix인지
- roll 값이 해당 mod 범위에서 얼마나 좋은가
- crafted / fractured / influenced 여부
- 같은 slot 안에서 수요가 있는 조합인가
- 특정 메타 빌드에서 필요한 옵션인가

따라서 V2에서는 단순 count와 합산값을 넘어 **mod identity, mod family, roll quality, equipment slot**을 반영해야 한다.

---

## 2. 최종 목표 재정의

### 2.1 목표가 아닌 것

V2는 다음을 목표로 하지 않는다.

- 모든 아이템의 실제 판매가를 정확히 맞히는 모델
- 실제 체결가 예측 모델
- 완전한 시세 산정기
- 모든 rare item 조합을 일반화하는 만능 가격 모델

### 2.2 목표로 하는 것

V2는 다음을 목표로 한다.

- 낮은 가치 후보 판별
- 검색할 가치가 있는 아이템 판별
- 고가 후보 판별
- 최종 로컬 앱에서 사용자가 직접 거래소 검색을 할지 말지 결정하는 보조 신호 제공

따라서 UI/서비스 관점의 출력은 다음이 더 적합하다.

```text
낮은 가치 후보
검색 우선순위 낮음
검색 가치 있음
고가 후보
```

아래 표현은 피한다.

```text
무조건 버려도 됨
절대 가치 없음
정확 판매가
```

---

## 3. 중요한 라벨 이슈: true trash는 현재 데이터만으로 어렵다

### 3.1 현재 데이터 분포

현재 수집 데이터는 기본적으로 **priced listing 중심**이다. 즉, 누군가가 공개 stash에 가격을 붙여 올린 아이템이 학습 데이터의 중심이다.

하지만 실제 플레이어가 말하는 “잡템”은 상당수가 애초에 가격을 붙여 등록되지 않는다. 따라서 priced listing만으로는 진짜 잡템 분포를 직접 학습할 수 없다.

### 3.2 금지할 라벨 정의

다음 정의는 피한다.

```text
target_price_chaos < 5 => trash_or_vendor
```

이 방식은 “낮은 가격에 등록된 매물”을 학습할 뿐, “아예 등록되지 않는 진짜 잡템”을 대표하지 못한다.

### 3.3 V2에서 사용할 용어

V2 priced listing 기반 학습에서는 다음 용어를 사용한다.

```text
low_listed_value
sellable_low
search_worthy
high_value_candidate
```

즉, V2는 **listed item value band classifier**이며, true trash detector는 아니다.

### 3.4 true trash detector는 별도 단계

진짜 “버릴 잡템” 분류까지 하려면 별도 negative sample source가 필요하다.

가능한 후속 source:

1. 플레이어가 직접 주운 뒤 버리거나 NPC 판매한 Ctrl+C 샘플
2. unpriced public stash item
3. synthetic negative sample
4. item filter 기반 negative proxy

이 단계는 `V2.5` 또는 `V3`로 분리한다.

---

## 4. V2의 최우선 작업: Phase 0 Audit

V2는 바로 모델 학습을 구현하지 않는다. 첫 목표는 **기존 수집 데이터에서 mod-aware feature가 안정적으로 생성 가능한지 증명**하는 것이다.

Phase 0은 아래처럼 세분화한다.

---

## 4.1 Phase 0-a: item_json / mod line 보존 audit

### 목적

기존 `normalized_priced_items.item_json` 또는 관련 raw/normalized 데이터에 V2 feature 생성에 필요한 mod line이 보존되어 있는지 확인한다.

### 확인 항목

- `explicitMods` 보존 여부
- `implicitMods` 보존 여부
- `craftedMods` 보존 여부
- `fracturedMods` 보존 여부
- `enchantMods` 또는 유사 필드 보존 여부
- `properties`, `requirements` 보존 여부
- `name`, `typeLine`, `baseType`, `rarity`, `ilvl` 보존 여부

### 산출물

```text
artifacts/v2_mod_audit/<date>/mod_line_coverage_summary.csv
artifacts/v2_mod_audit/<date>/item_json_field_coverage_summary.csv
artifacts/v2_mod_audit/<date>/phase0a_item_json_audit.md
```

### 판정

- mod line이 충분히 보존되어 있으면 기존 7일 데이터 재처리 가능
- mod line이 보존되어 있지 않으면 앞으로 수집되는 데이터부터 V2용 저장 정책을 보강해야 함

---

## 4.2 Phase 0-b: 임시 equipment slot mapping 생성

### 목적

Phase 0에서 slot별 row 수를 보려면 최소한 임시 `base_type -> equipment_slot` 매핑이 필요하다.

따라서 slot coverage audit보다 먼저 mapping을 만든다.

### 권장 source

- RePoE `base_items.json`
- RePoE `item_classes.json`
- 필요 시 내부 fallback mapping

### 생성할 필드

```text
equipment_slot
```

예상 값:

```text
helmet
body_armour
gloves
boots
belt
ring
amulet
weapon
shield
quiver
jewel
unknown
```

### 산출물

```text
artifacts/v2_mod_audit/<date>/equipment_slot_mapping.generated.json
artifacts/v2_mod_audit/<date>/equipment_slot_mapping_coverage.csv
```

### 주의

처음부터 완벽한 slot mapping을 만들 필요는 없다. Phase 0에서는 audit 목적의 임시 mapping으로 충분하다.

---

## 4.3 Phase 0-c: segment / slot coverage audit

### 목적

V2 첫 실험을 수행할 slot을 정한다.

기본 후보는 다음이다.

```text
rare_equipment + boots
```

대안 후보:

```text
rare_equipment + gloves
```

### 확인 항목

- slot별 labeled row 수
- slot별 explicit mod line coverage
- slot별 target price 분포
- slot별 fixed / quantile band 분포
- slot별 match 가능성 예비 분석

### 산출물

```text
artifacts/v2_mod_audit/<date>/segment_slot_coverage_summary.csv
artifacts/v2_mod_audit/<date>/rare_equipment_slot_counts.csv
artifacts/v2_mod_audit/<date>/slot_price_distribution_summary.csv
```

### 초기 fallback 기준

아래 값은 1차 임시 기준이며, 첫 audit 후 조정한다.

기본 slot인 `boots`에서 다음 조건 중 하나라도 발생하면 `gloves`로 전환을 검토한다.

```text
boots labeled row < 50,000
explicit mod line coverage < 80%
English affix matched explicit line rate < 70%
ambiguous + unmatched explicit line rate > 40%
fixed band 또는 quantile band 중 하나가 극단적으로 한 class에 몰림
```

위 기준은 최종 성공 기준이 아니라 **실험 대상을 고르기 위한 gate**다.

---

## 4.4 Phase 0-d: affix dictionary match audit

### 목적

RePoE 기반 English affix dictionary로 explicit mod line을 어느 정도 안정적으로 매칭할 수 있는지 확인한다.

### 확인 항목

- explicit line 수
- matched line 수
- ambiguous line 수
- unmatched line 수
- high-confidence single match 비율
- family-level only match 비율
- section별 match 품질

### 산출물

```text
artifacts/v2_mod_audit/<date>/affix_match_coverage_summary.csv
artifacts/v2_mod_audit/<date>/affix_match_examples.jsonl
artifacts/v2_mod_audit/<date>/unmatched_examples.jsonl
artifacts/v2_mod_audit/<date>/ambiguous_examples.jsonl
artifacts/v2_mod_audit/<date>/phase0d_affix_match_report.md
```

---

## 5. Roll Normalization 정책

V2에서 roll quality를 반영하려면 단순 숫자 추출만으로는 부족하다. 각 mod의 min/max 범위와 관측값을 연결해야 한다.

### 5.1 기본 아이디어

```text
roll_norm = (observed_value - min_value) / (max_value - min_value)
```

단, 이 값은 canonical mod와 stat range가 안정적으로 확정된 경우에만 계산한다.

### 5.2 정책

roll normalization은 아래 정책을 따른다.

#### Case 1. 단일 high-confidence match

조건:

- explicit line이 단일 canonical mod로 확정됨
- stat id와 min/max range를 연결 가능
- observed numeric value가 안정적으로 추출됨

처리:

```text
roll_norm_values 생성
roll_norm_max / roll_norm_avg / family별 roll_norm 생성 가능
```

#### Case 2. 같은 family로만 좁혀짐

조건:

- canonical mod id는 확정되지 않음
- 하지만 life/resistance/speed/crit 등 family는 안정적으로 판정 가능

처리:

```text
family-level aggregate만 생성
roll_norm_values는 null
```

예:

```text
life_mod_count += 1
life_roll_sum += observed_value
life_roll_norm_max = null
```

#### Case 3. high-risk ambiguous 또는 unmatched

조건:

- 복수 후보가 의미 있게 다름
- family도 불확실함
- unmatched explicit line

처리:

```text
roll_norm 제외
unmatched/ambiguous 카운트만 증가
```

### 5.3 원칙

- 잘못된 roll_norm을 넣는 것보다 null이 낫다.
- V2 첫 실험에서는 high-confidence roll_norm만 사용한다.
- ambiguous line은 모델에 억지로 numeric signal로 넣지 않는다.

---

## 6. ModObservation Artifact

### 6.1 목적

각 item의 mod line을 item 단위 summary로 바로 합치지 않고, 먼저 line-level observation으로 저장한다.

DB 테이블은 나중에 확정하고, 첫 단계에서는 JSONL artifact로 검증한다.

### 6.2 권장 경로

```text
artifacts/v2_mod_audit/<date>/mod_observations.jsonl
```

### 6.3 권장 필드

```text
listing_key
source_item_id
model_segment
equipment_slot
item_class
base_type
rarity
ilvl

section_type
raw_mod_line
normalized_mod_line

matched_canonical_mod_id
candidate_canonical_mod_ids
candidate_count

source_mod_id
stat_ids
generation_type
affix_type
mod_family

numeric_values
roll_norm_values

match_status
match_confidence
dictionary_version
```

### 6.4 원칙

- 애매한 match를 강제로 단일 canonical mod로 확정하지 않는다.
- ambiguous는 ambiguous로 남긴다.
- unmatched explicit line은 반드시 별도 목록으로 남긴다.
- V2 모델에는 match confidence가 낮은 값을 무리하게 넣지 않는다.

---

## 7. V2 Feature 설계

### 7.1 첫 번째 목표

첫 번째 V2 feature는 high-cardinality mod one-hot이 아니다.

먼저 아래를 만든다.

```text
dense summary + mod family aggregate + high-confidence roll_norm summary
```

### 7.2 권장 V2 feature

```text
matched_explicit_mod_count
unmatched_explicit_mod_count
ambiguous_explicit_mod_count

prefix_count_v2
suffix_count_v2
affix_count_confidence

life_mod_count
life_roll_sum
life_roll_max
life_roll_norm_max

resistance_total_sum
fire_resistance_sum
cold_resistance_sum
lightning_resistance_sum
chaos_resistance_sum

attribute_total_sum
strength_sum
dexterity_sum
intelligence_sum

damage_mod_count_v2
attack_mod_count_v2
spell_mod_count_v2
crit_mod_count_v2
speed_mod_count_v2
defence_mod_count_v2
utility_mod_count_v2

crafted_prefix_count
crafted_suffix_count
fractured_prefix_count
fractured_suffix_count

high_roll_mod_count
top_tier_like_mod_count
```

### 7.3 prefix/suffix count 정책

`prefix_count_v2`, `suffix_count_v2`는 다음 조건에서만 채운다.

- explicit line이 dictionary로 충분히 매칭됨
- affix type이 prefix/suffix로 확인됨
- unmatched explicit line이 없거나 허용 threshold 이하
- ambiguous line이 count에 영향을 주지 않음

그 외에는 `null` 또는 confidence flag를 낮게 둔다.

### 7.4 Sparse feature는 후순위

아래는 바로 도입하지 않는다.

```text
canonical_mod_id 전체 one-hot
전체 stat_id multi-hot
고차원 mod combination feature
```

대신 audit 후 아래 단계로 확장한다.

- top-K frequent canonical mod만 multi-hot
- top-K valuable mod family만 flag화
- slot별 중요 mod만 제한적으로 추가

---

## 8. Value Band Label 정의

### 8.1 Fixed band

UI와 설명에는 fixed threshold가 가장 직관적이다.

초안:

```text
low_listed_value:       0c <= price < 5c
sellable_low:           5c <= price < 30c
search_worthy:          30c <= price < 1 divine equivalent
high_value_candidate:   price >= 1 divine equivalent
```

### 8.2 1 divine equivalent 처리

`1 divine` 기준은 listing 관측 시점의 환율을 사용한다.

기본 정책:

```text
source_updated_at 이전 최신 divine chaos rate 사용
```

### 8.3 환율 공백 정책

현재 환율 snapshot이 일부 시점에서 비어 있을 수 있으므로, 첫 audit에서는 fallback을 쓰지 않는다.

첫 audit 정책:

```text
source_updated_at 이전 divine chaos rate가 없는 row는 fixed-divine band 생성에서 제외
missing_divine_rate_count와 missing_divine_rate_ratio를 별도 보고
```

산출물:

```text
value_band_distribution_fixed.csv
value_band_missing_exchange_summary.csv
```

후속 실험에서만 fallback을 검토한다.

가능한 fallback 후보:

- snapshot 생성 시점 divine rate
- 최근 N시간 내 closest previous/next rate
- 고정 chaos threshold
- quantile label만 사용

### 8.4 Quantile band

데이터 불균형을 완화하기 위해 quantile band도 함께 만든다.

예:

```text
q_low
q_mid
q_high
q_top
```

기준:

```text
model_segment + equipment_slot
```

데이터가 부족하면:

```text
model_segment
```

### 8.5 Binary target도 함께 생성

첫 모델 실험에서는 multi-class보다 binary classifier가 더 해석하기 쉽다.

따라서 V2 첫 실험은 아래 binary target도 함께 만든다.

```text
is_search_worthy = target_price_chaos >= 30c
is_high_value_candidate = target_price_chaos >= 1 divine equivalent
```

권장 우선순위:

1. `is_search_worthy` binary classifier
2. `value_band_fixed` multi-class classifier
3. `value_band_quantile` multi-class classifier
4. `target_price_log1p` regressor는 보조 기준선

---

## 9. 학습 전략

### 9.1 첫 학습 목표

처음부터 전체 세그먼트 V2를 만들지 않는다.

첫 목표:

```text
rare_equipment + boots
```

또는 audit 결과에 따라:

```text
rare_equipment + gloves
```

### 9.2 비교 방식

동일 snapshot, 동일 split으로 비교한다.

```text
V1 rare_equipment_slot_baseline
vs
V2 rare_equipment_slot_mod_aware
```

### 9.3 모델

권장 모델:

```text
CatBoostClassifier
```

주 타깃:

```text
is_search_worthy
```

보조 타깃:

```text
value_band_fixed
value_band_quantile
```

보조 기준선:

```text
CatBoostRegressor(target_price_log1p)
```

---

## 10. 평가 지표

정확 가격보다 의사결정 품질을 평가한다.

### 10.1 Binary classifier 지표

```text
search_worthy_precision
search_worthy_recall
search_worthy_f1
search_worthy_miss_rate
valuable_as_low_rate
confusion_matrix
```

정의:

```text
search_worthy_miss_rate
= 실제 search-worthy 이상인데 low로 예측한 비율

valuable_as_low_rate
= 실제 sellable/search-worthy/high-value인데 low_listed_value로 예측한 비율
```

### 10.2 High value 지표

```text
high_value_precision
high_value_recall
high_value_f1
high_value_miss_rate
top_k_high_candidate_precision
```

정의:

```text
high_value_miss_rate
= 실제 high_value_candidate인데 high-value 또는 search-worthy로 잡지 못한 비율
```

### 10.3 Multi-class 지표

```text
macro_f1
weighted_f1
class별 precision / recall / f1
confusion matrix
```

### 10.4 MVP 관점에서 중요한 순서

1. 가치 있는 아이템을 낮은 가치로 잘못 분류하지 않는가
2. 검색할 가치 있는 아이템을 충분히 잡아내는가
3. 고가 후보로 표시한 아이템이 실제로 의미 있는가
4. 검색할 가치 없는 아이템을 너무 많이 추천하지 않는가

기존 `low_value false negative rate` 표현은 모호하므로 사용하지 않는다.

---

## 11. True Trash Detector는 별도 단계로 분리

### 11.1 왜 분리해야 하는가

priced listing만으로는 “등록되지 않는 잡템”을 배울 수 없다.

따라서 V2 classifier의 `low_listed_value`는 true trash가 아니다.

### 11.2 별도 단계 제안

`V2.5` 또는 `V3`에서 다음을 수행한다.

1. 플레이어 직접 discarded item clipboard sample 수집
2. unpriced item sample 수집
3. negative sample source별 신뢰도 부여
4. `worth_listing_binary` classifier 학습

예상 라벨:

```text
worth_listing = true
worth_listing = false
negative_source = player_discarded | unpriced_public | synthetic_rule
```

---

## 12. Unique / Jewel Fallback Strategy

### 12.1 Rare first

기본 우선순위는 rare equipment다.

이유:

- 최종 앱에서 가장 가치 판단이 어려운 영역
- V1 한계가 가장 크게 드러나는 영역
- affix dictionary의 효과를 검증하기 좋음

### 12.2 실패 시 fallback

만약 rare equipment audit에서 다음 문제가 생기면 fallback을 검토한다.

- mod match coverage가 낮음
- slot별 row 수가 부족함
- ambiguous rate가 너무 높음
- value band 분포가 무너짐

fallback 순서:

1. `unique_equipment`
2. `jewel`

### 12.3 unique_equipment V2

Unique는 `base_type`만으로 부족하다.

추가 피처:

```text
unique_name
unique_canonical_id
unique_roll_norm_max
unique_roll_norm_avg
unique_important_roll_flags
```

### 12.4 jewel V2

Jewel은 mod identity와 notable identity가 중요하다.

추가 피처:

```text
jewel_type
canonical_mod_family_counts
notable_names
cluster_notable_signature
life_present
crit_multi_present
dot_multi_present
reservation_present
```

---

## 13. 권장 구현 순서

### Phase 0-a. item_json / mod line 보존 audit

```text
기존 normalized_priced_items.item_json에서 mod line 보존 여부 확인
```

### Phase 0-b. 임시 equipment slot mapping

```text
RePoE base_items.json 기반 base_type -> equipment_slot mapping 생성
```

### Phase 0-c. segment / slot coverage audit

```text
boots/gloves row 수 및 price 분포 확인
```

### Phase 0-d. affix match coverage audit

```text
English affix dictionary 기반 matched / ambiguous / unmatched 비율 확인
```

### Phase 1. Value band audit

```text
fixed band, quantile band, binary target 분포 확인
환율 공백 row 제외 및 missing ratio 보고
```

### Phase 2. ModObservation artifact

```text
mod line 단위 JSONL 생성
dictionary match 수행
roll_norm 가능 여부 기록
```

### Phase 3. V2 dense feature artifact

```text
rare_equipment + selected slot에 대해 V2 dense summary feature 생성
```

### Phase 4. Small model comparison

```text
same snapshot, same split 기준 V1 vs V2 비교
먼저 is_search_worthy binary classifier 실행
이후 value_band_fixed / quantile multi-class 실행
```

### Phase 5. 확대 여부 결정

결과가 좋으면:

```text
boots -> gloves -> helmet/body_armour/ring 등으로 확장
```

불안정하면:

```text
unique_equipment 또는 jewel V2로 fallback
```

---

## 14. 코딩 에이전트 작업 지시 요약

```text
1. V2 전체 학습 구현 전에 Phase 0 audit을 먼저 구현한다.
2. Phase 0-a에서 item_json mod line 보존 여부를 확인한다.
3. Phase 0-b에서 RePoE base_items.json 기반 임시 equipment_slot mapping을 만든다.
4. Phase 0-c에서 rare_equipment slot별 row 수와 price 분포를 확인한다.
5. boots를 기본 후보로 보되, row < 50k 또는 match coverage가 낮으면 gloves로 전환한다.
6. Phase 0-d에서 English affix dictionary match coverage를 측정한다.
7. DB schema를 바로 만들지 말고 artifacts/v2_mod_audit/<date>/ 아래 JSONL/CSV로 먼저 산출한다.
8. roll_norm은 high-confidence single match에서만 생성한다.
9. family-level match만 가능한 경우 family aggregate만 만들고 roll_norm은 null로 둔다.
10. unmatched/high-risk ambiguous line은 roll_norm에서 제외한다.
11. fixed band의 1 divine equivalent는 source_updated_at 이전 divine chaos rate를 사용한다.
12. divine rate가 없는 row는 첫 audit에서 제외하고 missing ratio를 보고한다.
13. multi-class value band 외에 is_search_worthy binary target도 함께 만든다.
14. 첫 모델은 rare_equipment + selected slot + is_search_worthy classifier로 시작한다.
15. 성능 평가는 RMSE보다 search_worthy_recall, search_worthy_miss_rate, high_value_precision, confusion matrix를 우선한다.
16. true trash 라벨은 priced listing만으로 만들지 않는다. low_listed_value로 명명한다.
17. rare_equipment V2가 불안정하면 unique_name/roll feature 기반 unique_equipment V2를 fallback으로 검토한다.
```

---

## 15. 현재 결론

V2 방향은 채택한다.

다만 바로 전체 V2 모델 구현으로 들어가지 않는다.

현재 가장 안전한 결론은 다음이다.

> V2의 첫 목표는 모델 학습이 아니라, 기존 수집 데이터에서 mod-aware feature를 안정적으로 생성할 수 있는지 검증하는 것이다.

따라서 다음 우선순위는 다음이다.

1. item_json / mod line 보존 audit
2. 임시 equipment slot mapping
3. boots/gloves coverage audit
4. affix match coverage audit
5. value band / binary target 분포 확인
6. V1 vs V2 소규모 binary classifier 비교

---

## 16. 최종 한 줄 요약

V2는 “정확한 가격 예측기”가 아니라 **영문 affix dictionary 기반으로 옵션 조합을 이해하고, 아이템이 낮은 가치인지 / 검색할 가치가 있는지 / 고가 후보인지 분류하는 value band classifier**로 설계한다. 단, 현재 데이터는 priced listing 중심이므로 true trash detector는 별도 negative sample 확보 이후의 후속 단계로 분리한다.
