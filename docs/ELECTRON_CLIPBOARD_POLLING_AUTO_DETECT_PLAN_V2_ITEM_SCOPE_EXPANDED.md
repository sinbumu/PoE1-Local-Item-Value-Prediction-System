# Electron Clipboard Polling Auto Detect Plan V2

## 1. 문서 목적

이 문서는 Electron 기반 Windows 로컬 유틸리티 앱에서 `Ctrl+C` 클립보드 자동 감지 기능을 구현하기 위한 코딩 에이전트용 지시서이다.

기존 `ELECTRON_CLIPBOARD_POLLING_AUTO_DETECT_PLAN.md`의 방향은 유지하되, 이번 버전에서는 **지원 아이템 범위 확장**을 명확히 한다.

핵심 변경점은 다음과 같다.

- 자동 감지는 **Polling 기반 clipboard watcher만 사용**한다.
- Global hotkey 방식은 이번 단계에서 제외한다.
- 앱은 `rare_equipment`, `unique_equipment`만 처리하는 데서 끝나지 않는다.
- 이전 학습/비교 단계에서 이미 다룬 `skill_gem`, `jewel` 등도 앱의 판단 대상에 포함한다.
- 모든 입력을 하나의 모델로 억지 예측하지 않고, **item routing layer**를 통해 모델 예측 / 외부 시세 대상 / 직접 검색 권장으로 분기한다.

---

## 2. 최종 앱 목표

최종 MVP 앱의 목표는 정확한 판매가를 보장하는 것이 아니다.

목표는 다음과 같다.

> 사용자가 PoE1 영문 클라이언트에서 아이템을 `Ctrl+C`로 복사하면, Electron 앱이 이를 자동 감지하고, 아이템 유형에 따라 모델 예측 또는 적절한 fallback 판단을 제공하여 사용자가 검색/판매 시도 가치가 있는지 빠르게 판단하도록 돕는다.

즉, 앱은 다음 판단을 제공해야 한다.

- 낮은 가치 가능성 높음
- 수동 확인 필요
- 검색/판매 시도 후보
- 고가 후보
- 외부 시세 조회 대상
- 직접 검색 권장
- 지원 불가 또는 파싱 실패

---

## 3. 중요한 범위 변경: skill gem / jewel도 판단 대상 포함

기존 테스트 앱에서는 `skill_gem`, `jewel`, `map`, `currency` 등이 `unsupported item type`으로 처리되는 경우가 있었다.

하지만 프로젝트의 이전 학습/비교 단계에서 `skill_gem`, `jewel`은 이미 모델 세그먼트로 다뤄졌고, 최종 앱에서도 이들을 무조건 unsupported로 보내면 앱의 실용성이 낮아진다.

따라서 이번 버전의 앱 범위는 다음처럼 확장한다.

## 3.1 모델 판단 우선 대상

가능하면 모델 예측 대상으로 처리한다.

- `rare_equipment`
- `unique_equipment`
- `jewel`
- `skill_gem`

단, 각 세그먼트별 모델 준비 상태에 따라 다음 정책을 적용한다.

| 아이템 유형 | 기본 처리 방향 |
| --- | --- |
| Rare equipment | V2 mod-aware classifier 우선 |
| Unique equipment | V2 model 또는 unique-aware fallback |
| Jewel | 기존 학습 세그먼트가 있으면 model route, 없으면 manual check |
| Skill gem | 기존 global/skill-gem 판단 경로가 있으면 model route, 없으면 gem-specific rule/fallback |

## 3.2 외부 시세 또는 직접 검색 대상

아래 품목은 개별 옵션보다 시장 평균가 또는 외부 시세가 더 적합할 수 있다.

- currency
- map
- scarab
- essence
- fragment
- divination card
- fossil / resonator / oil 등

이들은 `unsupported`라고 표시하지 말고 다음처럼 표현한다.

```text
외부 시세 조회 대상
이 아이템은 개별 옵션보다 시장 평균가가 중요하므로, 모델 예측보다 시세 조회 또는 거래소 검색이 더 적합합니다.
```

## 3.3 진짜 unsupported

아래 경우에만 `unsupported` 또는 `parse failed`로 본다.

- PoE 아이템 텍스트가 아닌 일반 클립보드 텍스트
- parser가 아이템 구조를 전혀 인식하지 못함
- 현재 앱에서 안전하게 분류할 수 없는 예외적 아이템
- 모델/feature schema와 입력 feature가 맞지 않아 추론이 실패함

---

## 4. Polling 기반 clipboard watcher

## 4.1 기본 원칙

이번 단계에서는 global hotkey를 사용하지 않는다.

자동 감지 방식은 polling만 사용한다.

```text
setInterval
→ clipboard.readText()
→ 이전 clipboard hash와 비교
→ PoE 아이템 텍스트 signature 검사
→ parseable item이면 분석 queue에 넣음
→ routing + prediction
→ result card 표시
```

## 4.2 Polling interval

권장값:

```text
500ms ~ 800ms
```

너무 짧으면 불필요한 read가 많아지고, 너무 길면 사용자 체감 반응이 느려진다.

초기 기본값은 다음을 권장한다.

```text
POLL_INTERVAL_MS = 700
```

## 4.3 Auto Watch ON/OFF

앱 UI에는 반드시 자동 감지 토글을 둔다.

- Auto Watch Clipboard: ON/OFF
- 기본값은 발표 시연에서는 ON
- 개발/디버깅 시에는 OFF 가능

Auto Watch가 OFF여도 기존 수동 기능은 유지한다.

- Read Clipboard
- Analyze Item
- Manual Paste
- Demo Sample

---

## 5. PoE item signature gate

클립보드에는 일반 텍스트도 들어올 수 있으므로, 모든 클립보드를 분석하면 안 된다.

분석 전 반드시 PoE item text signature를 확인한다.

## 5.1 영문 클라이언트 기준 signature 후보

아래 중 일부가 존재하면 PoE item text 후보로 본다.

- `Item Class:`
- `Rarity:`
- `Item Level:`
- `Quality:`
- `Sockets:`
- `Requirements:`
- `--------`

## 5.2 최소 signature 기준

초기 구현은 다음 정도가 적절하다.

```text
contains("Rarity:")
AND contains("--------")
AND (contains("Item Level:") OR contains("Item Class:") OR contains("Quality:"))
```

이 조건을 통과하지 못하면 조용히 무시한다.

## 5.3 조용한 무시 원칙

일반 텍스트를 복사할 때마다 오류 팝업이 뜨면 앱 사용성이 나빠진다.

따라서 signature gate에서 탈락한 텍스트는:

- 로그는 debug 수준에서만 기록
- UI 경고 표시 없음
- 기존 결과 유지

---

## 6. 중복 분석 방지

Polling watcher에는 반드시 중복 분석 방지 장치가 필요하다.

## 6.1 Clipboard hash 관리

- 마지막으로 분석한 clipboard text hash 저장
- 같은 hash면 재분석하지 않음
- hash는 text 전체를 직접 로그에 남기지 말고 내부 메모리에서만 사용

## 6.2 Debounce / cooldown

추천 정책:

```text
새 클립보드 감지 후 250ms debounce
동일 분석 완료 후 2초 cooldown
```

## 6.3 In-flight guard

분석 중에는 새 분석을 동시에 시작하지 않는다.

정책 후보:

1. 분석 중 새 텍스트가 들어오면 마지막 텍스트만 pending으로 저장
2. 현재 분석이 끝난 뒤 pending이 있으면 1회 더 분석
3. queue를 길게 쌓지 않음

MVP에서는 `latest pending only` 정책이 충분하다.

---

## 7. Item routing layer

자동 감지 이후 바로 모델에 넣지 말고, parser 결과를 기준으로 routing을 수행한다.

## 7.1 Routing 목적

- 지원 가능한 모델 세그먼트 선택
- 외부 시세 대상 분기
- 직접 검색 권장 fallback
- 진짜 unsupported 구분

## 7.2 권장 routing 결과

```text
model_prediction
external_price_lookup_recommended
manual_search_recommended
unsupported_or_parse_failed
```

## 7.3 Routing 예시

| Parsed item | Routing | 사용자 메시지 |
| --- | --- | --- |
| Rare boots | model_prediction | 모델 기반 가치 판단 |
| Unique armour | model_prediction | 모델 기반 가치 판단 |
| Rare jewel | model_prediction 또는 manual_search | 주얼 모델 또는 직접 확인 |
| Skill gem | model_prediction 또는 gem policy | 젬 전용 판단 또는 직접 확인 |
| Currency | external_price_lookup_recommended | 외부 시세 조회 대상 |
| Map | external_price_lookup_recommended | 외부 시세 조회 대상 |
| Unknown text | unsupported_or_parse_failed | PoE 아이템 텍스트 아님 |

## 7.4 unsupported 문구 개선

최종 앱에서는 `unsupported item type`을 남발하지 않는다.

대신 다음처럼 사용자 친화적으로 표현한다.

```text
직접 검색 권장
이 아이템은 현재 모델 예측보다 거래소 직접 검색이 더 적합한 유형입니다.
```

또는:

```text
외부 시세 조회 대상
이 품목은 개별 옵션보다 시장 평균가가 중요하므로, 모델 예측 대신 시세 조회를 권장합니다.
```

---

## 8. 결과 표시 정책

## 8.1 Decision labels

앱 결과는 가격 숫자보다 판단 라벨 중심으로 표시한다.

권장 라벨:

```text
low listed value
manual check
search-worthy
high-value candidate
external price lookup
direct search recommended
parse failed
```

## 8.2 추천 decision policy

기존 `search-worthy`가 너무 넓게 나오는 문제가 있었으므로, 최종 앱에서는 중간 구간을 둔다.

예시:

```text
score < 0.50
→ low listed value

0.50 <= score < 0.70
→ manual check

0.70 <= score < 0.88
→ search-worthy

score >= 0.88
→ high-value candidate
```

정확한 threshold는 현재 모델 score 분포를 보고 조정 가능하다.

## 8.3 결과 카드 내용

결과 카드에는 최소한 다음을 보여준다.

- 판단 라벨
- score 또는 confidence
- 권장 행동
- 아이템 요약
  - rarity
  - item name
  - base type
  - item class / segment
- 주의 문구
  - 공개 listing 기반 모델
  - 실제 체결가 보장 아님

## 8.4 라벨 문구 예시

```text
검색/판매 시도 후보
이 아이템은 공개 매물 데이터 기준으로 검색 또는 판매 시도 가치가 있을 가능성이 있습니다.
거래소 직접 검색으로 최종 가격을 확인하세요.
```

```text
수동 확인 필요
모델 점수가 중간 구간입니다. 특수 빌드용 아이템이거나 시장 상황에 따라 가치가 달라질 수 있으므로 직접 검색을 권장합니다.
```

```text
낮은 가치 가능성 높음
현재 모델 기준으로 검색 우선순위가 낮습니다. 단, 특수 옵션 조합은 오판 가능성이 있습니다.
```

---

## 9. UI 요구사항

## 9.1 Main window

Main window는 개발자 도구처럼 보이지 않게 정리한다.

우선 표시:

- Auto Watch ON/OFF
- 현재 상태
  - Watching clipboard
  - Last analyzed time
  - Last decision
- 결과 카드
- 최근 분석 기록
- Demo sample

Advanced 또는 Technical Details로 숨길 것:

- model path
- feature schema path
- raw prediction JSON
- extracted feature JSON
- affix lines
- threshold fine tuning

## 9.2 Floating result card

가능하면 별도 작은 floating window를 만든다.

특징:

- always-on-top
- 작고 읽기 쉬운 decision card
- 5~8초 후 자동 숨김
- 사용자가 pin 가능하면 좋음
- overlay가 불안정하면 일반 floating window로 fallback

## 9.3 Clipboard auto detect UX

자동 감지 성공 시:

```text
작은 toast/floating card 표시
main window에도 last result 업데이트
```

자동 감지 실패 시:

- 일반 텍스트면 조용히 무시
- PoE 아이템처럼 보이지만 parse 실패면 작은 warning 표시
- 모델 추론 실패면 main window에 오류 표시

---

## 10. 기존 수동 흐름 유지

자동 감지가 들어가도 기존 수동 흐름은 제거하지 않는다.

유지할 기능:

- Read Clipboard 버튼
- Analyze Item 버튼
- Manual paste textarea
- Demo Samples
- Run Check
- Technical Details

이유:

- 발표 중 live client / clipboard 동작이 흔들릴 수 있음
- demo sample fallback이 중요함
- 자동 감지 문제를 수동으로 우회할 수 있어야 함

---

## 11. 보안 / 개인정보 / 로그 원칙

클립보드에는 민감한 텍스트가 들어올 수 있으므로 다음 원칙을 지킨다.

- 일반 클립보드 텍스트는 저장하지 않음
- PoE item signature를 통과한 텍스트만 분석
- raw clipboard text를 장기 로그에 남기지 않음
- debug 로그에도 전체 텍스트 대신 hash, length, parse status만 남김
- demo sample과 사용자 live clipboard를 구분

---

## 12. 구현 우선순위

## Phase 1. Clipboard polling watcher

- polling timer 추가
- Auto Watch ON/OFF
- clipboard hash 비교
- PoE signature gate
- duplicate/debounce/in-flight guard

## Phase 2. Routing layer 확장

- rare equipment
- unique equipment
- jewel
- skill gem
- external price lookup 대상
- direct search recommended 대상

`unsupported`를 실패가 아니라 routing 결과로 재정의한다.

## Phase 3. Decision policy 정리

- low listed value
- manual check
- search-worthy
- high-value candidate
- external price lookup
- direct search recommended

## Phase 4. Floating result card

- always-on-top result window
- 자동 숨김
- main window와 결과 동기화

## Phase 5. 발표 안정화

- demo sample rare / unique / jewel / skill gem 준비
- external price lookup 대상 샘플 준비
- parse failure 샘플 준비
- Run Check 성공 확인

---

## 13. 완료 기준

이번 기능의 완료 기준은 다음과 같다.

1. 사용자가 PoE1 영문 클라이언트에서 아이템을 `Ctrl+C`로 복사하면 앱이 자동으로 감지한다.
2. 일반 클립보드 텍스트는 분석하지 않는다.
3. 같은 아이템 텍스트를 반복 분석하지 않는다.
4. rare / unique / jewel / skill gem에 대해 앱이 의미 있는 판단 또는 fallback을 제공한다.
5. currency / map 등 외부 시세 대상은 `unsupported`가 아니라 외부 시세 조회 대상으로 안내한다.
6. 결과는 main window와 floating result card 중 최소 하나에 명확히 표시된다.
7. 자동 감지가 실패해도 manual paste / demo sample / analyze button으로 시연 가능하다.

---

## 14. 코딩 에이전트 주의사항

- 이번 단계에서는 global hotkey를 구현하지 않는다.
- 앱이 게임에 `Ctrl+C`를 대신 보내지 않는다.
- 화면 OCR, 픽셀 감지, 자동 클릭, 자동 판매는 구현하지 않는다.
- 자동 감지는 clipboard polling만 사용한다.
- 모델 지원 범위 밖 아이템도 무조건 unsupported로 보내지 말고 routing 결과를 제공한다.
- `skill_gem`, `jewel`은 이전 모델 실험 대상이었으므로 가능한 한 앱 판단 대상에 포함한다.
- 정확한 가격 보장이 아니라 검색/판매 시도 우선순위 판단 도구로 표현한다.

---

## 15. 한 줄 결론

Electron 앱은 `Ctrl+C` 후 polling 기반으로 클립보드 변화를 감지하고, PoE 아이템 텍스트를 item routing layer에 통과시킨 뒤, rare/unique/jewel/skill gem 등 주요 대상에 대해 모델 예측 또는 적절한 검색 권장 결과를 floating decision card로 표시하는 방향으로 확장한다.
