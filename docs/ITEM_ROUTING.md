# ITEM_ROUTING.md

## 문서 목적

이 문서는 수집된 `Mirage` 소프트코어 아이템을 **어떤 경로로 처리할지** 정리하는 분류표입니다.

핵심 분류:

- `external_price_candidate`
- `model_candidate`
- `ignore`

## 라우팅 테이블

| 분류 | 예시 | 기본 처리 | 이유 |
| --- | --- | --- | --- |
| `external_price_candidate` | Currency, Fragment, Scarab, Essence, Fossil, Resonator, Oil, Divination Card | 외부 시세 API 우선 | `poe.ninja`/공식 환율 계층으로 커버 가능 |
| `external_price_candidate` | 일반 Map | 외부 시세 API 우선 | 개별 옵션 변동성이 상대적으로 작음 |
| `external_price_candidate` | 옵션이 사실상 고정된 유니크 일부 | 외부 시세 API 우선 | 아이템 개체별 차이가 작음 |
| `model_candidate` | Rare 장비 | 모델 예측 | 접두/접미와 roll 값 영향이 큼 |
| `model_candidate` | Rare Jewel | 모델 예측 | 조합과 수치가 핵심 |
| `model_candidate` | Abyss Jewel | 모델 예측 | affix 조합 의존 |
| `model_candidate` | Cluster Jewel | 모델 예측 | notable/패시브 구조 의존 |
| `model_candidate` | 옵션 roll 차이가 큰 Unique 장비 | 모델 예측 | 같은 고유템이라도 roll 편차 큼 |
| `model_candidate` | Skill Gem | 모델 예측 | level/quality/corruption/awakened 영향 |
| `ignore` | Hardcore Mirage | 저장/학습 제외 | 다른 경제권 |
| `ignore` | SSF Mirage | 저장/학습 제외 | 거래 생태계 다름 |
| `ignore` | Ruthless Mirage | 저장/학습 제외 | 밸런스/시장 구조 다름 |
| `ignore` | private league | 저장/학습 제외 | 일반 Mirage 시장과 분리 |
| `ignore` | 가격 note 비정상 항목 | 후처리 전 제외 또는 별도 큐 | 라벨 품질 낮음 |

## 모델 후보군 세부 규칙

### Rare 장비

포함:

- 무기
- 갑옷
- 장신구

핵심 이유:

- 같은 base라도 affix 구성에 따라 가격이 크게 달라짐

### Jewel 계열

포함:

- Rare Jewel
- Abyss Jewel
- Cluster Jewel

핵심 이유:

- 시장가가 옵션 조합과 roll에 매우 민감함

### Skill Gem

포함:

- 일반 gem
- awakened gem
- corrupted gem
- quality가 중요한 gem

핵심 피처:

- gem level
- quality
- corrupted
- awakened
- variant성 정보

### Unique 장비

전부를 바로 모델에 넣지는 않는다.

1차 기준:

- NeverSink `4-VERY-STRICT` 필터의 유니크 목록을 초기 allowlist 소스로 사용
- roll range가 가격에 직접 영향 주는 유니크만 모델 후보
- roll 차이가 거의 없는 고정형 유니크는 외부 시세 추종

## 1차 구현용 단순 판정안

초기 구현에서는 복잡한 완전체 분류보다 아래처럼 단순하게 가는 것이 현실적이다.

### external_price_candidate

- `frameType = 5` 계열
- Maps
- Divination Card
- Fragment성 카테고리
- Essence / Fossil / Oil / Scarab 류
- `poe.ninja`나 공식 환율성 데이터로 직접 커버 가능한 품목

### model_candidate

- `rarity = Rare`
- Jewel / Abyss Jewel / Cluster Jewel
- Skill Gem
- Unique 장비 중 별도 allowlist에 들어간 것

### ignore

- target league 불일치
- private league
- 극단적으로 비정상적인 note

## 향후 refine 포인트

1. NeverSink 기반 Unique allowlist를 실제 코드/테이블로 분리
2. Maps 중에서도 특별한 roll 변수가 큰 항목을 별도 분기할지 검토
3. `external_price_candidate`를 poe.ninja type과 직접 매핑
4. `model_candidate`를 타입별 feature extractor와 연결
