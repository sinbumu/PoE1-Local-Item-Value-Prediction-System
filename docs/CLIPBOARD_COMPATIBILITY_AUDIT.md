# Clipboard Compatibility Audit

## 목적

최종 추론 입력은 Path of Exile 1 게임 클라이언트의 `Ctrl+C` 클립보드 텍스트다.

따라서 학습 시 사용하는 피처는 아래 3가지 중 하나여야 한다.

1. 클립보드 텍스트에서 직접 추출 가능
2. 클립보드 텍스트 + 현재 시각 같은 런타임 컨텍스트로 재현 가능
3. 동일한 규칙 엔진(`parser -> feature builder -> cleaner`)으로 안정적으로 재현 가능

반대로, stash API 전용 필드나 `item_json.extended` 의존 피처를 그대로 쓰면 학습/추론 간 피처 불일치가 발생한다.

## 현재 파이프라인 기준

현재 ETL은 다음 순서로 구성된다.

1. `normalized_priced_items -> training_features_raw`
2. `training_features_raw -> training_features_clean`
3. `training_features_clean -> training_features_labeled`

현재 `CatBoost` 학습 코드에서 실제 특징량으로 들어갈 수 있는 값은:

- labeled 테이블 컬럼 대부분
- `source_updated_at`에서 파생한 `observed_hour_utc`, `observed_weekday_utc`
- 현재 `IGNORED_FEATURE_COLUMNS`에 없는 범주형/수치형 컬럼

즉, 단순히 ETL만 맞추는 것이 아니라 `ml/train_catboost.py`에서 최종 사용되는 피처도 함께 감사해야 한다.

## 분류 기준

- `직접 호환`: 클립보드 텍스트에서 바로 추출 가능
- `간접 호환`: 클립보드 텍스트 + 공용 규칙/런타임 값으로 재현 가능
- `비호환/보류`: 현재 규칙/사전 없이 클립보드에서 안정 재현이 어려움
- `추론 비대상`: 학습 라벨/운영 메타데이터로, 모델 입력에 넣으면 안 됨

## 피처 감사 표

| 피처 | 현재 출처 | 판정 | 메모 |
| --- | --- | --- | --- |
| `item_class` | `baseType`, `typeLine`, `descrText`, `support` | 간접 호환 | 클립보드 parser에서 아이템 종류 판정 규칙을 다시 구현해야 함 |
| `base_type` | normalized row / item json | 직접 호환 | 클립보드 이름 블록에서 추출 가능 |
| `rarity` | normalized row | 직접 호환 | 클립보드 `Rarity:` 줄에서 추출 가능 |
| `frame_type` | stash API 숫자 | 간접 호환 | rarity/아이템 타입 매핑으로 재현 가능하지만 유지 우선순위는 낮음 |
| `ilvl` | `item.ilvl` | 직접 호환 | 클립보드 `Item Level` 줄에서 추출 가능 |
| `identified` | `item.identified` | 직접 호환 | 비식별 아이템은 mod 본문이 제한되므로 판정 가능 |
| `corrupted` | `item.corrupted` | 직접 호환 | 클립보드 `Corrupted` 줄로 판정 가능 |
| `fractured` | `item.fractured` | 직접 호환 | 상태 줄로 판정 가능 |
| `synthesised` | `item.synthesised` | 직접 호환 | 상태 줄로 판정 가능 |
| `duplicated` | `item.duplicated` | 비호환/보류 | 클립보드에서 현재 ETL 의미와 1:1 대응되는지 검증 필요 |
| `influence_*` | `item.influences` | 직접 호환 | influence 상태 줄 또는 eldritch 표기로 판정 가능 |
| `socket_count` | `item.sockets` | 직접 호환 | 소켓 줄 파싱으로 가능 |
| `link_count` | `item.sockets.group` | 직접 호환 | 소켓 그룹 파싱으로 가능 |
| `white_socket_count` | `item.sockets.sColour` | 직접 호환 | 흰 소켓 표기로 가능 |
| `prefix_count` | `item.extended.prefixes` | 간접 호환 | affix 사전 + mod 분류기로 prefix/suffix 판정 시 복원 가능 |
| `suffix_count` | `item.extended.suffixes` | 간접 호환 | 위와 동일 |
| `explicit_mod_count` | mod 배열 길이 | 직접 호환 | explicit 섹션 개수로 가능 |
| `implicit_mod_count` | mod 배열 길이 | 직접 호환 | implicit 섹션 개수로 가능 |
| `crafted_mod_count` | mod 배열 길이 | 직접 호환 | crafted 섹션 개수로 가능 |
| `fractured_mod_count` | mod 배열 길이 | 직접 호환 | fractured 섹션 개수로 가능 |
| `enchant_mod_count` | mod 배열 길이 | 직접 호환 | enchant 섹션 개수로 가능 |
| `quality` | property line | 직접 호환 | 가능 |
| `armour` | property line | 직접 호환 | 가능 |
| `evasion` | property line | 직접 호환 | 가능 |
| `energy_shield` | property line | 직접 호환 | 가능 |
| `ward` | property line | 직접 호환 | 가능 |
| `physical_dps` | property + 계산 | 직접 호환 | physical damage range + APS로 재계산 가능 |
| `elemental_dps` | property + 계산 | 직접 호환 | elemental damage range + APS로 재계산 가능 |
| `attack_speed` | property line | 직접 호환 | 가능 |
| `crit_chance` | property line | 직접 호환 | 가능 |
| `move_speed` | mod line 검색 | 직접 호환 | movement speed mod line으로 가능 |
| `life_roll_sum` | mod line 숫자 합 | 직접 호환 | 동일 규칙으로 재현 가능 |
| `resistance_roll_sum` | mod line 숫자 합 | 직접 호환 | 동일 규칙으로 재현 가능 |
| `attribute_roll_sum` | mod line 숫자 합 | 직접 호환 | 동일 규칙으로 재현 가능 |
| `jewel_type` | `baseType` 규칙 | 간접 호환 | base type 기반 규칙 재사용 필요 |
| `cluster_size` | `baseType` 규칙 | 간접 호환 | base type 기반 규칙 재사용 필요 |
| `cluster_passive_count` | enchant mod | 직접 호환 | 클러스터 주얼 enchant 줄 파싱 가능 |
| `notable_count` | explicit line 패턴 | 직접 호환 | `Added Passive Skill is ...` 줄 카운트 가능 |
| `damage_mod_count` | mod line 키워드 매칭 | 직접 호환 | 동일 키워드 규칙 적용 가능 |
| `defence_mod_count` | mod line 키워드 매칭 | 직접 호환 | 동일 규칙 적용 가능 |
| `utility_mod_count` | mod line 키워드 제외 규칙 | 직접 호환 | 동일 규칙 적용 가능 |
| `gem_level` | property line | 직접 호환 | 가능 |
| `gem_quality` | property line | 직접 호환 | 가능 |
| `is_awakened` | base type prefix | 직접 호환 | base type이 `Awakened `로 시작하는지 판정 가능 |
| `is_vaal` | base type 포함 문자열 | 직접 호환 | base type의 `Vaal ` 여부로 가능 |
| `is_support_gem` | `item.support` | 간접 호환 | gem tag/property 파서에서 재현 가능하나 별도 구현 필요 |
| `gem_tags` | gem property 첫 줄 | 간접 호환 | 클립보드 gem 태그 줄 파싱으로 재현 가능 |
| `model_segment` | cleaner 규칙 | 간접 호환 | 클립보드 parser 뒤에 동일 cleaner를 적용하면 재현 가능 |
| `clean_reason` | cleaner + unique allowlist 규칙 | 간접 호환 | 현재는 모델 피처로도 쓰이므로 동일 규칙 엔진 공유 필요 |
| `target_price_amount` | listing price | 추론 비대상 | 정답 라벨 원천 |
| `target_price_currency` | listing price | 추론 비대상 | 정답 라벨 원천 |
| `exchange_rate_*` | poe.ninja join | 추론 비대상 | 라벨 생성용 메타데이터 |
| `target_price_chaos` | 계산 라벨 | 추론 비대상 | 모델 target |
| `target_price_log1p` | 계산 라벨 | 추론 비대상 | 모델 target |
| `label_reason` | 라벨링 메타데이터 | 추론 비대상 | 피처 아님 |
| `source_item_id` | stash API id | 추론 비대상 | 클립보드 입력에 없음 |
| `source_inserted_at` | stash 관측 메타데이터 | 추론 비대상 | 클립보드 입력에 없음 |
| `source_updated_at` | stash 관측 시각 | 간접 호환 | 추론 시에는 현재 시각으로 대체 가능하지만 item 고유 피처는 아님 |
| `observed_hour_utc` | `source_updated_at` 파생 | 간접 호환 | 현재 시각으로 계산 가능 |
| `observed_weekday_utc` | `source_updated_at` 파생 | 간접 호환 | 현재 시각으로 계산 가능 |

## 즉시 문제되는 항목

### 1. `prefix_count`, `suffix_count`

- 현재 `item_json.extended.prefixes/suffixes`를 그대로 사용
- 클립보드 텍스트에는 이 값이 직접 적혀 있지는 않다
- 다만 affix 사전(`mod -> prefix/suffix`)과 locale-aware mod 정규화가 있으면 복원 가능하다
- 즉 "비호환"이 아니라 "사전 기반 간접 호환"이 더 정확하다
- 단, 사전 품질 검증 전까지는 모델 whitelist에서는 보수적으로 다루는 편이 안전하다

### 2. `duplicated`

- 현재 stash API boolean에 의존
- 클립보드 텍스트와 정확히 어떤 상태가 대응되는지 실측 검증이 필요하다
- v1에서는 제외 후보

### 3. `is_support_gem`, `gem_tags`

- 현재는 stash API 구조(`item.support`, gem property 구조)에 기대고 있음
- 클립보드에서도 재현 가능할 가능성은 높지만, parser 구현과 테스트가 먼저 필요하다

### 5. 다국어 클립보드

- 영문판/한글판 모두 지원 대상으로 잡는 것이 맞다
- PoE 클립보드는 locale에 따라 section header, property name, 상태 줄, mod line이 번역된다
- 따라서 parser는 `영문 전용 문자열 매칭`이 아니라 `locale dictionary + canonical key` 구조로 가야 한다
- 특히 `prefix_count/suffix_count` 복원은 locale별 mod 원문을 공통 affix key로 매핑할 수 있어야 한다

### 4. `clean_reason`

- 현재 `ml/train_catboost.py`에서 범주형 피처로 사용된다
- 하지만 이것은 아이템 원문이 아니라 `cleaner/allowlist`가 만들어낸 파생 코드다
- 추론 시에도 동일 규칙 엔진을 반드시 공유해야 하므로, parser 이전에 피처만 떼어 쓰면 안 된다

## 현재 학습 코드 기준 추가 주의사항

`ml/train_catboost.py`는 아래 특징이 있다.

1. `source_updated_at` 자체는 무시하지만, 여기서 `observed_hour_utc`, `observed_weekday_utc`를 생성한다
2. `clean_reason`를 categorical feature로 사용한다
3. `gem_tags`도 categorical feature로 사용한다

즉, 현재 모델 입력은 단순 raw item 피처가 아니라:

- item intrinsic feature
- cleaner rule output
- 관측 시각 파생 피처

가 섞여 있다.

## 권장 V1 클립보드 호환 피처 세트

### 유지 권장

- `base_type`, `rarity`, `ilvl`
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
- 필요 시 `observed_hour_utc`, `observed_weekday_utc`

### 조건부 유지 권장

- `prefix_count`, `suffix_count`
  - 조건: locale-aware affix dictionary와 샘플 기반 parity 테스트가 준비된 이후
- `is_support_gem`, `gem_tags`
  - 조건: 영문/한글 gem property line parser가 안정화된 이후

### 보류 또는 제거 권장

- `duplicated`
- `frame_type`
- `clean_reason`

## 권장 구조 변경

현재 구조는 `stash API item_json -> extractor`에 치우쳐 있다.

최종적으로는 아래 구조로 바꾸는 것이 안전하다.

1. `Ctrl+C clipboard text -> ClipboardParsedItem`
2. `stash API item_json -> ParsedItem` 변환기
3. 공용 `feature builder`가 `ParsedItem`만 입력받아 raw feature 생성
4. 공용 `cleaner`가 raw feature를 받아 `model_segment`, `keep/drop`, `clean_reason` 생성
5. 학습과 추론이 같은 `feature builder + cleaner`를 공유
6. locale dictionary / affix dictionary는 parser와 feature builder가 함께 사용

핵심은:

- 학습용 ETL과 추론용 parser가 같은 중간 표현을 공유해야 한다
- 클립보드에서 재현이 어려운 피처는 v1에서 빼되, `prefix_count/suffix_count`처럼 사전 기반 복원이 가능한 항목은 별도 단계로 복구할 수 있다
- 모델 입력 컬럼 목록을 명시적으로 화이트리스트 관리해야 한다

## 바로 다음 작업 권장

1. 영문/한글 `Ctrl+C` 샘플 수집 포맷 고정
2. `clipboard-safe` feature whitelist 정의
3. `train_catboost.py`에서 whitelist 기반 feature selection으로 전환
4. locale-aware `Ctrl+C` parser 초안 구현
5. 실클립보드 예제 10~20개로 parser/ETL parity 테스트 추가
