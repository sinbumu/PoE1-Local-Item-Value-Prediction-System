# V2 One-Semester MVP Locked Plan

## 1. 목적

이 문서는 PoE1 Local Item Value Prediction System의 남은 한 학기 범위에서 실행 가능한 V2 방향을 고정하기 위한 최종 검토안이다.

핵심 전제는 다음과 같다.

1. V2 이후 V3/V4 식으로 무한히 확장하지 않는다.
2. 이번 학기 최종 발표에서는 모델 실험만이 아니라 실제 응용 가능한 MVP 유틸리티 앱 시연이 필요하다.
3. 상업적 수준의 완성형 UI나 완벽한 가격 측정은 목표가 아니다.
4. 그러나 사용자가 아이템을 판단하는 흐름을 실제로 보여줄 수 있는 최소 응용 프로그램은 반드시 포함한다.

따라서 V2의 목표는 단순 연구 확장이 아니라, **mod-aware value classifier를 실제 로컬 유틸리티 앱 MVP와 연결하는 것**이다.

---

## 2. V2의 고정 목표

### 2.1 최종 목표

V2의 최종 목표는 다음과 같이 고정한다.

> 공개 priced listing 데이터를 기반으로, rare/unique 아이템이 “검색하거나 판매 시도할 가치가 있는가”를 판단하는 mod-aware classifier를 만들고, 이를 Windows 로컬 유틸리티 앱 MVP에서 시연한다.

즉 V2는 다음 두 결과물을 함께 포함해야 한다.

1. **학습 결과물**
   - V1 summary feature baseline과 V2 mod-aware feature 모델 비교
   - `is_search_worthy` binary classifier 중심
   - precision / recall / confusion matrix 보고

2. **응용 결과물**
   - Windows 로컬 유틸리티 앱 MVP
   - PoE1 영문 클라이언트 기준 `Ctrl+C` 클립보드 입력 또는 수동 paste 입력
   - parser / feature builder / trained model prediction 연결
   - 결과를 `low listed value`, `search-worthy`, `high-value candidate` 같은 판단 형태로 표시

---

## 3. 이번 학기 MVP 필수 범위

아래 항목은 이번 학기 최종 발표까지 반드시 완료해야 하는 필수 범위로 본다.

### 3.1 데이터/모델 필수 범위

- Phase 0 audit
  - 기존 `item_json`에 mod line이 보존되어 있는지 확인
  - rare/unique 대상 coverage 확인
  - affix dictionary match / ambiguous / unmatched 비율 확인
- 전체 `rare_equipment` 대상 V2 feature 생성
- 필터링된 `unique_equipment` 대상 V2 feature 생성
- `is_search_worthy` binary label 생성
- V1 summary feature baseline과 V2 mod-aware feature 모델 비교
- confusion matrix / precision / recall / F1 보고
- 최소 1개 최종 선택 모델 저장

### 3.2 앱 필수 범위

- Windows에서 실행 가능한 간단한 로컬 앱
- 영문 PoE1 클라이언트 기준 시연
- 입력 방식:
  - 1순위: 클립보드에서 직접 읽기
  - fallback: 사용자가 아이템 텍스트를 textarea에 paste
- 앱 처리 흐름:
  1. 아이템 텍스트 입력
  2. clipboard parser 실행
  3. feature builder 실행
  4. 모델 추론 실행
  5. 결과 표시
- 결과 표시:
  - 판단 등급: `low listed value`, `search-worthy`, `high-value candidate`
  - 가능하면 confidence 또는 score
  - 주요 판단 근거 일부 표시
- 자동 클릭/자동 판매/게임 조작 자동화는 제외

---

## 4. 이번 학기 선택 범위

아래 항목은 시간이 허용되면 수행하되, 필수 성공 기준으로 두지 않는다.

- `value_band_fixed` multi-class classifier
- `value_band_quantile` classifier
- log price regressor 재비교
- unique roll normalization 고도화
- slot별 상세 성능 분석
- 앱 UI 개선
- 모델 결과 설명 문구 고도화

---

## 5. 이번 학기 범위 밖

아래 항목은 이번 학기 MVP 목표에서 제외한다.

- true trash detector 완성
  - 이유: 현재 데이터는 priced listing 중심이며, 아예 listing되지 않는 진짜 잡템 분포를 대표하지 못함
  - 해당 기능은 별도 negative sample 확보 이후의 후속 과제로 둔다
- 한국어 affix dictionary
- 모든 canonical mod one-hot
- 전체 PoE 아이템 범용 가격 예측
- 실시간 overlay / 자동화형 in-game UI
- 자동 클릭 / 자동 판매 / 매크로성 기능
- 실제 체결가 예측
- 상업적 수준의 완성형 앱 UI

---

## 6. 모델 대상 범위

### 6.1 V2 필수 대상

V2 MVP는 최종적으로 다음 대상을 포함해야 한다.

- 전체 `rare_equipment`
- 필터링된 `unique_equipment`

`boots/gloves` 같은 단일 slot 제한은 최종 MVP 범위로 사용하지 않는다.

### 6.2 slot mapping의 역할

`base_type -> equipment_slot` 매핑은 여전히 필요하지만, 이는 범위를 줄이기 위한 목적이 아니다.

slot mapping의 역할은 다음과 같다.

- slot별 coverage 분석
- slot별 성능 분석
- feature 생성 보조
- 특정 slot의 품질 문제 탐지
- fallback 판단 기준 제공

즉 최종 모델은 전체 rare/unique를 대상으로 하되, 분석과 디버깅은 slot 단위로 수행한다.

---

## 7. 라벨 정의

### 7.1 핵심 binary target

V2의 1차 target은 다음으로 둔다.

```text
is_search_worthy = target_price_chaos >= SEARCH_WORTHY_THRESHOLD_CHAOS
```

초기 기준값 후보:

```text
SEARCH_WORTHY_THRESHOLD_CHAOS = 30
```

이 기준은 MVP에서 “검색하거나 판매를 시도할 가치가 있는가”를 판단하기 위한 실용적 기준이다.

### 7.2 high-value 보조 target

고가 후보 판단은 다음과 같이 보조 지표로 둔다.

```text
is_high_value_candidate = target_price_chaos >= 1 divine equivalent
```

주의:

- `1 divine equivalent`는 관측 시점 또는 snapshot 기준 chaos 환산값으로 계산한다.
- source 시점 이전 divine 환율이 없는 row는 첫 audit에서는 fallback하지 않고 제외한다.
- 제외 row 수와 비율을 별도 보고한다.

### 7.3 true trash와 low listed value 구분

현재 데이터 기반으로는 진짜 trash를 직접 학습한다고 말하지 않는다.

구분:

- `low_listed_value`: 낮은 가격으로 등록된 priced listing
- `true trash`: 애초에 거래소에 올리지 않는 잡템

현재 V2 MVP는 `low_listed_value`와 `search-worthy`를 구분하는 모델이다.
`true trash detector`는 별도 negative sample 확보 이후의 후속 과제로 둔다.

---

## 8. V2 feature 방향

V2의 핵심은 CatBoost 자체를 바꾸는 것이 아니라, 아이템 옵션 조합을 더 잘 표현하는 feature representation을 만드는 것이다.

### 8.1 V1 feature 한계

V1은 다음과 같은 summary feature 중심이다.

- `base_type`
- `ilvl`
- `quality`
- `explicit_mod_count`
- `implicit_mod_count`
- `crafted_mod_count`
- `life_roll_sum`
- `resistance_roll_sum`
- `attribute_roll_sum`

이 피처들은 수집/ETL/학습 연결 검증에는 적합하지만, rare item의 실제 가치 판단에는 부족하다.

### 8.2 V2 mod-aware feature 후보

V2에서는 affix dictionary를 활용해 다음을 생성한다.

- matched explicit mod count
- unmatched explicit mod count
- ambiguous explicit mod count
- affix match confidence
- mod family별 count
- mod family별 roll sum / max
- high roll mod count
- top-tier-like mod count
- crafted/fractured mod family flags
- prefix/suffix count candidate
- unique item identity
- unique roll summary

### 8.3 roll normalization 정책

roll normalization은 보수적으로 수행한다.

- 단일 high-confidence match:
  - roll norm 생성
- 같은 family로만 좁혀지는 경우:
  - family-level aggregate만 생성
- high-risk ambiguous 또는 unmatched:
  - roll norm 제외

잘못된 roll norm을 넣는 것보다 null/제외가 낫다.

---

## 9. Phase 0 Audit

V2 구현은 바로 모델 학습으로 들어가지 않고, 먼저 Phase 0 audit을 수행한다.

### 9.1 Phase 0-a: item_json / mod line 보존 확인

확인 항목:

- `explicitMods`
- `implicitMods`
- `craftedMods`
- `fracturedMods`
- `enchantMods`
- unique name / item name
- base type
- rarity
- ilvl

목표:

- 기존 수집 데이터로 V2 feature 재처리가 가능한지 확인한다.

### 9.2 Phase 0-b: equipment slot mapping

RePoE `base_items.json` 등을 활용해 임시 `base_type -> equipment_slot` 매핑을 생성한다.

주의:

- slot mapping은 최종 범위 축소용이 아니라 coverage/분석용이다.

### 9.3 Phase 0-c: coverage audit

보고 항목:

- 전체 rare equipment row 수
- 전체 unique equipment row 수
- slot별 row 수
- slot별 priced row 수
- mod line 보존율
- unique name 보존율

### 9.4 Phase 0-d: affix dictionary match audit

보고 항목:

- explicit line 수
- matched line 수
- ambiguous line 수
- unmatched line 수
- matched rate
- ambiguous+unmatched rate
- segment별 / slot별 breakdown

### 9.5 Phase 0 통과 기준

초기 기준값은 다음처럼 둔다.

- rare equipment labeled row가 충분히 존재할 것
- unique equipment labeled row가 충분히 존재할 것
- explicit mod line 보존율이 분석 가능한 수준일 것
- affix match rate가 최소 실험 가능한 수준일 것

정확한 threshold는 첫 audit 결과를 보고 조정하되, 모델 구현 여부를 판단할 수 있는 수치 리포트를 반드시 생성한다.

---

## 10. 모델 실험 설계

### 10.1 V1 vs V2 비교

동일 snapshot, 동일 split으로 아래를 비교한다.

1. V1 summary feature baseline
2. V2 mod-aware feature classifier

비교 대상:

- `rare_equipment`
- `unique_equipment`
- 가능하면 rare+unique 통합 classifier

### 10.2 주 모델

```text
CatBoostClassifier
Target: is_search_worthy
```

### 10.3 보조 모델

시간이 허용되면 다음도 실험한다.

- `value_band_fixed` multi-class classifier
- `value_band_quantile` classifier
- log price regressor

### 10.4 평가 지표

MVP 관점에서 중요한 지표는 다음이다.

- precision
- recall
- F1
- confusion matrix
- search_worthy_miss_rate
- valuable_as_low_rate
- high_value_miss_rate

특히 다음을 중요하게 본다.

> 검색할 가치가 있는 아이템을 낮은 가치로 잘못 분류하지 않는가?

MVP 앱에서는 사용자가 비싼 아이템을 놓치지 않는 것이 중요하므로, `search-worthy` recall을 강하게 본다.

---

## 11. Windows 로컬 유틸리티 앱 MVP

### 11.1 앱 목표

최종 발표에서 시연 가능한 최소 앱을 만든다.

앱은 다음을 보여주면 충분하다.

1. 사용자가 아이템 텍스트를 입력한다.
2. parser가 아이템 정보를 추출한다.
3. feature builder가 모델 입력을 만든다.
4. 모델이 `is_search_worthy` 또는 value band를 예측한다.
5. 앱이 판단 결과를 표시한다.

### 11.2 앱 입력

우선순위:

1. 클립보드 읽기 버튼
2. 수동 paste textarea

수동 paste는 fallback이 아니라 데모 안정성을 위한 허용 입력 방식이다.

### 11.3 앱 출력

필수 출력:

- 판단 결과
  - `low listed value`
  - `search-worthy`
  - `high-value candidate`
- confidence 또는 score
- 모델 입력에 사용된 주요 추출 정보
- listing price 기반 모델이라는 주의 문구

선택 출력:

- top contributing features
- item segment
- match confidence
- parser warning

### 11.4 앱 비목표

- 게임 화면 overlay
- 자동 클릭
- 자동 판매
- 실시간 인벤토리 스캔
- 한국어 클라이언트 지원
- 상용 수준 UI

---

## 12. 일정 제안

남은 학기 일정은 V2 모델과 앱 MVP를 동시에 고려해 배치한다.

### Week 9

- Phase 0 audit 구현
- mod line 보존/coverage/match report 생성
- equipment slot mapping 생성

### Week 10

- V2 feature artifact 생성
- rare/unique 대상 `is_search_worthy` label 생성
- V1/V2 동일 split 비교 준비

### Week 11

- V2 binary classifier 학습
- V1 baseline과 비교
- confusion matrix / precision / recall 정리

### Week 12

- Windows 로컬 앱 MVP skeleton 구현
- clipboard/paste input
- parser + feature builder 연결

### Week 13

- 모델 추론 앱 연결
- 결과 표시 UI 구현
- 데모 아이템 샘플 준비

### Week 14

- 최종 발표 자료 작성
- 앱 데모 리허설
- 리포트 7~9장 보강

### Week 15

- 최종 보고서 제출 정리

---

## 13. 실패 시 fallback 원칙

구현 편의를 위해 목표를 과도하게 축소하지 않는다. 그러나 학기 내 발표 가능성을 위해 fallback은 정의한다.

### 13.1 모델 fallback

- V2 feature 품질이 낮으면 V1 모델을 앱에 연결한다.
- 단, V2 audit 결과와 한계를 보고서에 명확히 남긴다.
- 가능하면 rare/unique 중 더 안정적인 segment만 V2 모델로 사용하고 나머지는 V1로 fallback한다.

### 13.2 앱 fallback

- 클립보드 직접 읽기가 불안정하면 textarea paste 입력으로 시연한다.
- 그러나 앱 자체는 반드시 유지한다.
- CLI-only 결과물은 최종 MVP로 보지 않는다.

### 13.3 데모 fallback

- 실제 인게임 실시간 입력이 불안정하면, 저장된 영문 `Ctrl+C` 샘플을 앱에 paste해서 시연한다.
- 단, 시연 흐름은 실제 사용자 입력과 동일하게 구성한다.

---

## 14. 최종 성공 기준

이번 학기 V2 MVP의 성공 기준은 다음이다.

1. 기존 수집 데이터 또는 최신 수집 데이터에서 rare/unique V2 feature를 생성할 수 있다.
2. `is_search_worthy` binary classifier를 학습한다.
3. V1 summary baseline과 V2 mod-aware classifier를 같은 조건에서 비교한다.
4. precision / recall / confusion matrix를 보고한다.
5. Windows 로컬 유틸리티 앱에서 아이템 텍스트 입력 후 모델 예측 결과를 표시한다.
6. 최종 발표에서 실제 아이템 샘플을 이용해 판단 흐름을 시연한다.

즉, 성공 기준은 “완벽한 가격 측정”이 아니라 다음이다.

> priced listing 기반으로 search-worthy 아이템을 놓치지 않는 mod-aware classifier를 만들고, 이를 로컬 앱 MVP에 연결해 실제 사용자 판단 보조 흐름을 시연하는 것.

---

## 15. 결론

V2는 이번 학기 안에서 끝낼 수 있는 최종 확장 범위로 고정한다.

- 모델은 exact price regressor보다 `is_search_worthy` classifier를 우선한다.
- 대상은 전체 `rare_equipment`와 필터링된 `unique_equipment`로 둔다.
- slot mapping은 범위 축소가 아니라 분석과 feature 보조 목적으로 사용한다.
- true trash detector와 한국어 지원은 후속 과제로 둔다.
- Windows 로컬 유틸리티 앱 MVP는 필수 산출물로 둔다.

따라서 다음 작업은 다음 순서로 진행한다.

1. Phase 0 audit
2. V2 mod-aware feature 생성
3. `is_search_worthy` classifier 학습
4. V1 vs V2 비교
5. Windows 로컬 앱 MVP 연결
6. 최종 발표 데모 준비
