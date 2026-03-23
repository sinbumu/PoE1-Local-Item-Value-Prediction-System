# TRAINING_FEATURES.md

## 문서 목적

이 문서는 `CatBoost` 학습용으로 최종 정제될 `training_features` 테이블 또는 파일 포맷의 1차 초안을 정의합니다.

목표:

- raw/normalized JSON을 그대로 학습에 쓰지 않기
- 장기 보관 가능한 압축된 feature row 만들기
- 아이템 타입별로 필요한 피처를 분리해서 관리하기

## 기본 원칙

1. 학습 타깃은 우선 `price_amount + price_currency`를 유지한다.
2. 추후 `chaos equivalent`로 변환 가능한 구조를 남긴다.
3. `account_name`, `stash_name` 같은 고카디널리티 식별성 필드는 기본적으로 학습 제외한다.
4. `type_line` 원문은 보조 정보로만 보고, 핵심은 `base_type`와 구조화된 mod 피처다.

## 공통 컬럼 초안

모든 모델 후보군에 공통으로 들어갈 수 있는 컬럼:

| 컬럼명 | 타입 예시 | 설명 |
| --- | --- | --- |
| `listing_key` | text | 매물 식별 키 |
| `observed_at` | timestamptz | 관측 시각 |
| `league` | text | 기본적으로 `Mirage` |
| `item_id` | text | PoE item id |
| `item_class` | text | 장비/주얼/젬 등 대분류 |
| `base_type` | text | 핵심 base |
| `rarity` | text | Normal/Magic/Rare/Unique |
| `frame_type` | int | PoE frame type |
| `ilvl` | int | item level |
| `identified` | bool | 식별 여부 |
| `corrupted` | bool | 타락 여부 |
| `fractured` | bool | 분열 여부 |
| `synthesised` | bool | 합성 여부 |
| `influence_shaper` | bool | influence |
| `influence_elder` | bool | influence |
| `influence_searing` | bool | influence |
| `influence_tangled` | bool | influence |
| `socket_count` | int | 총 소켓 수 |
| `link_count` | int | 최대 링크 수 |
| `white_socket_count` | int | 흰소켓 수 |
| `prefix_count` | int | prefix 개수 |
| `suffix_count` | int | suffix 개수 |
| `explicit_mod_count` | int | explicit mod 수 |
| `implicit_mod_count` | int | implicit mod 수 |
| `crafted_mod_count` | int | crafted mod 수 |
| `fractured_mod_count` | int | fractured mod 수 |
| `enchant_mod_count` | int | enchant mod 수 |
| `price_amount` | numeric | note 파싱 금액 |
| `price_currency` | text | chaos/divine 등 |
| `listing_mode` | text | `b/o`, `price` |

## 장비류 추가 피처

Rare/Unique 장비류에 특히 중요한 항목:

| 컬럼명 | 타입 예시 | 설명 |
| --- | --- | --- |
| `armour` | numeric | 방어 수치 |
| `evasion` | numeric | 회피 수치 |
| `energy_shield` | numeric | 에쉴 수치 |
| `ward` | numeric | PoE2면 제외, PoE1은 보통 null |
| `quality` | numeric | 품질 |
| `physical_dps` | numeric | 무기일 때 |
| `elemental_dps` | numeric | 무기일 때 |
| `attack_speed` | numeric | 무기일 때 |
| `crit_chance` | numeric | 무기일 때 |
| `move_speed` | numeric | 부츠 등 |
| `life_roll_sum` | numeric | 생명 관련 mod 합 |
| `resistance_roll_sum` | numeric | 저항 관련 mod 합 |
| `attribute_roll_sum` | numeric | 힘/민/지 합 |

## 주얼류 추가 피처

Jewel / Abyss Jewel / Cluster Jewel:

| 컬럼명 | 타입 예시 | 설명 |
| --- | --- | --- |
| `jewel_type` | text | normal/abyss/cluster/timeless |
| `cluster_size` | text | Large/Medium/Small |
| `cluster_passive_count` | int | cluster jewel용 |
| `notable_count` | int | notable 개수 |
| `socketed_variant_flag` | bool | abyss 등 |
| `damage_mod_count` | int | 공격 관련 mod 수 |
| `defence_mod_count` | int | 방어 관련 mod 수 |
| `utility_mod_count` | int | 유틸 mod 수 |

## 스킬젬 추가 피처

Skill Gem은 별도 피처 세트가 필요하다.

| 컬럼명 | 타입 예시 | 설명 |
| --- | --- | --- |
| `gem_level` | int | gem level |
| `gem_quality` | int | quality |
| `is_awakened` | bool | awakened 여부 |
| `is_vaal` | bool | vaal 여부 |
| `is_support_gem` | bool | support 여부 |
| `gem_tags` | text[] 또는 요약 컬럼 | spell/attack/minion 등 |

## mod 표현 방식

초기 CatBoost에서는 완전 자유 텍스트 mod를 그대로 넣는 것보다 아래 2층 구조를 추천한다.

### 1층: 요약 수치 피처

- explicit mod 수
- implicit mod 수
- crafted mod 수
- 저항 총합
- 생명 총합
- 속성 총합
- 이동속도
- 공격속도
- 치명타

### 2층: 정규화된 mod key

예시:

- `has_+max_life`
- `has_%fire_resistance`
- `has_+1_all_spell_skill_gems`
- `has_attack_speed`

그리고 가능하면:

- `roll_+max_life = 86`
- `roll_attack_speed = 14`

처럼 수치값도 함께 둔다.

## 초기 제외할 피처

초기 버전에서 제외 권장:

- `account_name`
- `stash_name`
- 원문 `type_line` 전체
- 원문 `note_raw` 텍스트 전체
- 지나치게 희소한 문자열 식별자

이유:

- 카디널리티가 너무 높음
- 일반화보다 과적합 유도가 쉬움

## 타깃 설계 초안

초기 타깃은 두 가지 후보가 있다.

### 후보 A: 원 통화 유지

- `price_amount`
- `price_currency`

장점:

- 정보 손실 적음

단점:

- chaos/divine 혼합 처리 필요

### 후보 B: chaos equivalent 회귀

- `target_price_chaos`

장점:

- 단일 회귀 문제로 단순화

단점:

- 외부 환율 테이블 필요

## 권장 1차안

처음에는 다음을 추천한다.

1. `price_currency in ('chaos', 'divine')`만 우선 사용
2. 외부 환율로 `chaos equivalent`를 계산
3. CatBoost 회귀 타깃은 `log1p(target_price_chaos)`

## 이후 구현 메모

다음 단계에서는 실제 SQL/ETL로:

1. `normalized_priced_items` -> `training_features_raw`
2. `training_features_raw` -> `training_features_clean`

2단계 파이프라인을 만드는 것이 좋다.
