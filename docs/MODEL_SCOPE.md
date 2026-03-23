# MODEL_SCOPE.md

## 문서 목적

이 문서는 PoE1 로컬 가격 예측 프로젝트에서 **무엇을 모델로 예측할지**, 그리고 **무엇은 외부 시세 소스로 해결할지**를 정리하기 위한 1차 스코프 문서입니다.

현재 기준:

- 수집 리그: `Mirage` 소프트코어
- 모델 목표: 복잡한 옵션 의존 아이템의 가격 예측
- 단순 시장가 품목: 외부 시세 소스 우선 활용

## 핵심 원칙

1. 가격이 시장 평균으로 거의 결정되는 품목은 모델 예측 대상에서 제외한다.
2. 접두/접미, 롤 값, 타락 여부, 소켓 상태 등 개별 옵션이 가격에 큰 영향을 주는 아이템만 모델 대상에 포함한다.
3. 초기 모델은 `CatBoost` 기반 탭уляр 데이터 모델을 전제로 한다.
4. 초기 목표는 "모든 아이템을 예측"이 아니라 "거래소 검색 없이는 시세 감이 어려운 아이템을 예측"하는 것이다.

## 예측 대상에서 제외할 것

다음 품목은 기본적으로 **외부 시세 API 추종 대상**으로 본다.

- Currency
- Fragment
- Scarab
- Essence
- Fossil
- Resonator
- Oil
- Divination Card
- 일반 Maps
- 옵션이 사실상 고정된 유니크 일부

판정 기준:

- `poe.ninja`나 공식 API의 환율/시세 계층으로 안정적으로 커버 가능한 품목

이유:

- 개별 옵션 차이가 작거나 없음
- 시장 평균가가 곧 실거래가에 가까움
- poe.ninja 같은 외부 데이터 소스로 즉시 응답하는 편이 합리적임

## 모델 1차 대상

다음 품목은 **모델 예측의 1차 핵심 대상**으로 본다.

- Rare 장비
- Rare Jewel
- Abyss Jewel
- Cluster Jewel
- 옵션 roll 차이가 큰 Unique 장비
- Skill Gem

Unique 포함 기준:

- 초기 allowlist는 NeverSink `4-VERY-STRICT` 필터에서 의미 있게 취급되는 유니크 목록을 기준으로 잡는다.
- 그 안에서도 roll range가 실제 가격 차이에 영향을 주는 유니크를 우선 포함한다.

이유:

- 거래소 검색 없이 시세 판단이 어려움
- 옵션 구조가 가격에 직접적인 영향을 줌
- 외부 평균가만으로는 개별 매물 평가가 어려움

## 모델 2차 대상

다음 품목은 중요하지만 난도가 높으므로 2차로 본다.

- Timeless Jewel
- Watcher류와 같이 옵션 조합 난도가 높은 아이템
- 매우 희귀한 특수 아이템
- 가격 형성이 극단적으로 불안정한 niche 아이템

## Skill Gem 예외 처리

Skill Gem은 장비류와 달리 affix 기반 해석보다 다음 요소가 더 중요하다.

- gem level
- quality
- corrupted 여부
- awakened 여부
- special enchant / vaal / alternate 계열 여부

즉 Skill Gem은 모델 대상이되, 장비처럼 접두/접미 파싱에 집중할 필요는 없다.

## 장비/주얼에서 절대 버리면 안 되는 정보

다음 정보는 학습 의미를 유지하려면 반드시 보존해야 한다.

- explicit mods
- implicit mods
- crafted mods
- fractured mods
- enchant mods
- influence 정보
- sockets / links / colors
- corrupted / fractured / synthesised / mirrored 등 상태 플래그
- prefixes / suffixes 개수
- 숫자형 roll 값

## 현재 프로젝트에서의 실질적 의미

이 문서 기준으로 보면 현재 collector는 너무 넓은 범위를 저장하고 있다.

다음 단계에서는:

1. 저장 대상 자체를 모델 후보군 중심으로 줄이거나
2. 저장은 하되 장기 보관은 모델 후보군 중심으로 압축해야 한다.

## 초기 합의안

현재 1차 합의안은 다음과 같다.

- 외부 시세 API 추종:
  - `poe.ninja`/공식 환율성 데이터로 커버 가능한 품목 전체
- 모델 예측:
  - Rare 장비
  - Rare Jewel / Abyss Jewel / Cluster Jewel
  - NeverSink strict unique allowlist 기반 Unique 장비
  - Skill Gem

이 합의안은 이후 `docs/ITEM_ROUTING.md`, `docs/TRAINING_FEATURES.md`, `docs/STORAGE_POLICY.md`의 기준이 된다.
