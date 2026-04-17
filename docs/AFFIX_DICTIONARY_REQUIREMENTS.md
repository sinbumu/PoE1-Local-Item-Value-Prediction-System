# Affix Dictionary Requirements

## 목적

이 문서는 Path of Exile 1 `Ctrl+C` 클립보드 기반 추론에서 `prefix_count`, `suffix_count` 같은 affix 구조 피처를 복원하려 할 때, 왜 별도 affix dictionary가 필요한지와 구현 전에 어떤 요소가 준비되어야 하는지를 정리한다.

대상 독자는:

- 이 프로젝트를 처음 넘겨받는 개발자
- parser 구현 담당자
- 학습 피처 정책을 결정하는 사람

즉, "왜 이 이슈가 따로 존재하는가?"와 "무엇이 있어야 구현할 수 있는가?"를 빠르게 이해시키는 문서다.

## 문제 요약

현재 학습/ETL에는 `prefix_count`, `suffix_count`가 존재한다.

현재 프로젝트 범위 결정:

- 이번 캡스톤 과제 기간에는 **영문 PoE 클라이언트 대응만 V1 구현 범위로 본다.**
- 한국어 지원은 유용하지만, 현재 학기 목표의 필수 완료 조건에는 포함하지 않는다.
- 따라서 affix dictionary 관련 의사결정도 **영문 dictionary를 먼저 안정화하는 방향**으로 내려야 한다.

하지만 게임 클라이언트의 `Ctrl+C` 원문에는:

- 이 줄이 prefix인지 suffix인지
- 같은 의미의 mod가 영문/한글에서 어떻게 번역되는지
- hybrid mod를 몇 개의 affix로 셀지
- fractured / crafted / implicit / enchant를 어떻게 분리할지

가 직접 적혀 있지 않다.

즉, 클립보드 텍스트만 보고도 복원은 "가능할 수" 있지만, 그 복원 규칙은 단순 문자열 파싱이 아니라 별도의 affix dictionary와 규칙 엔진에 의존한다.

## 왜 샘플만으로는 부족한가

현재 `samples/clipboard/` 아래의 샘플은 매우 중요하지만, 역할은 주로 아래에 가깝다.

- 실제 인게임 클립보드 형식 검증
- 영문/한글 헤더/섹션 구조 검증
- parser가 현실 데이터에서 깨지지 않는지 확인
- 예외 케이스 수집

반면 affix dictionary는 아래를 다뤄야 한다.

- 전체 mod 풀에 대한 canonical key
- 각 mod의 prefix / suffix 구분
- 영문 / 한글 표현 매핑
- crafted / fractured / enchant / implicit / explicit 구분
- hybrid mod, special mod, influenced mod 처리 규칙

따라서 샘플은 dictionary를 "만드는 원천 데이터"라기보다, dictionary와 parser가 "실제 입력에서 잘 동작하는지 검증하는 테스트셋"에 더 가깝다.

## 이슈를 구성하는 핵심 요소

### 1. Canonical Mod Identity

동일한 의미의 mod를 하나의 공통 key로 묶을 수 있어야 한다.

예:

- 영문 라인
- 한글 라인
- 수치가 다른 같은 계열 라인
- 티어만 다른 같은 mod

이 모두가 같은 canonical mod key로 연결되어야 affix 판정과 집계가 가능하다.

### 2. Prefix / Suffix Attribution

각 explicit mod가 prefix인지 suffix인지 판별할 수 있어야 한다.

이 정보가 있어야:

- `prefix_count`
- `suffix_count`
- 남은 접두/접미 자리 수

같은 구조 피처를 복원할 수 있다.

### 3. Locale Mapping

영문/한글 클라이언트 모두 지원하려면 locale별 문자열이 같은 canonical mod로 연결되어야 한다.

다만 현재 범위에서는 아래처럼 우선순위를 둔다.

- **V1 필수:** 영문 locale mapping
- **V2 선택:** 한국어 overlay mapping

필수 대응 범위:

- 헤더
- property 이름
- 상태 줄
- mod 본문
- gem 태그/설명

특히 affix dictionary는 mod 본문 locale mapping이 핵심이다.

### 4. Section Semantics

클립보드에는 여러 종류의 줄이 섞여 있다.

- implicit
- explicit
- crafted
- fractured
- enchant
- flavour / 설명문
- requirement / property

affix dictionary는 "explicit affix로 세야 하는 줄"만 정확히 대상으로 삼아야 한다.

### 5. Counting Rules

실제 `prefix_count`, `suffix_count`를 복원할 때는 단순 매칭 외에 count 규칙이 필요하다.

결정해야 할 것:

- hybrid mod를 1개 affix로 셀지
- fractured mod를 prefix/suffix 카운트에 포함할지
- crafted mod를 포함할지
- eldritch implicit 같은 비-explicit 줄은 어떻게 제외할지
- local mod / global mod의 차이가 count에 영향을 주는지

이 규칙이 명확하지 않으면 학습/추론 parity가 깨진다.

## 구현 전에 준비되어야 하는 것

### 필수 준비물

1. 공통 중간 표현

- `Ctrl+C` parser가 출력하는 구조
- 나중에 stash API extractor와도 연결 가능한 구조
- 최소한 section, mod lines, locale, base type, rarity를 포함

2. 피처 정책

- 현재 어떤 피처가 `clipboard-safe`인지
- 어떤 피처가 조건부인지
- 어떤 피처는 아직 모델 입력에서 제외해야 하는지

3. 샘플 검증 체계

- 영문/한글 샘플
- 카테고리별 샘플
- parser regression 검증 스크립트

4. Affix Dictionary Source Strategy

- dictionary를 어디서 가져올지
- 직접 작성할지, 외부 데이터 기반으로 정규화할지
- 자동 생성과 수동 보정의 경계를 어디에 둘지

5. Counting Spec

- prefix/suffix 복원 규칙 문서
- ambiguous case 처리 방침
- 예외 케이스 fallback 방침

### 있으면 좋은 준비물

- base type별 affix 제약 정보
- mod group 정보
- influence / fractured / crafted 관련 분류 테이블
- locale별 stat translation 매핑
- parser/ETL parity 비교용 fixture

## 구현 범위를 나누면 어떻게 되나

### 단계 1. Parser 안정화

목표:

- 영문 `Ctrl+C` 원문을 안정적으로 block / section / header 단위로 파싱
- 기본 헤더 정보, 상태 정보, mod lines 추출

완료 조건:

- 현재 영문 샘플셋에서 locale / rarity / itemName / baseType 추출이 안정적

### 단계 2. Clipboard-safe Feature V1

목표:

- dictionary 없이도 안전한 피처만 모델 입력으로 사용

예:

- `base_type`
- `rarity`
- `ilvl`
- `identified`
- `corrupted`
- `fractured`
- `synthesised`
- `influence_*`
- `socket_count`, `link_count`, `white_socket_count`
- mod count 일부
- 방어도/회피/에쉴/딜 관련 property

완료 조건:

- 학습 스크립트가 whitelist 기반으로만 학습

### 단계 3. Affix Dictionary 도입

목표:

- explicit mod line을 canonical mod key로 정규화
- prefix / suffix attribution 가능하게 만들기

완료 조건:

- 샘플 기반으로 `prefix_count`, `suffix_count` 후보값 산출 가능

### 단계 4. Parity Verification

목표:

- 같은 아이템을 ETL 경로와 clipboard 경로로 처리했을 때 구조 피처가 최대한 일치하는지 검증

완료 조건:

- 영문 샘플 fixture 기준 parity report 생성 가능

## 결정이 필요한 정책 질문

아래는 구현 전에 명확히 해야 하는 질문들이다.

1. `prefix_count`, `suffix_count`를 v1 모델에 바로 넣을 것인가, 아니면 v2로 미룰 것인가?
2. crafted / fractured mod를 prefix/suffix count에 포함할 것인가?
3. hybrid mod는 1개 affix로 셀 것인가?
4. locale mapping이 불완전한 mod는 어떻게 처리할 것인가?
5. dictionary 매칭 실패 시 `null`로 둘 것인가, 보수적으로 제외할 것인가?
6. 모델 입력 안정성을 위해 `clean_reason`처럼 rule-engine 파생값을 계속 포함할 것인가?

## 현재 프로젝트에서 이미 준비된 것

현재 저장소에는 이미 아래가 준비되어 있다.

- `docs/CLIPBOARD_COMPATIBILITY_AUDIT.md`
  - 어떤 피처가 직접/간접 호환인지 정리
- `samples/clipboard/`
  - 영문/한글 샘플 정리본
- `src/services/clipboard-parser.service.ts`
  - locale-aware parser + `itemClass` / `explicitAffixLines` 출력
- `src/services/clipboard-affix-analyzer.service.ts`
  - explicit affix candidate 추출과 RePoE 기반 후보 축소
- `src/scripts/vendor-repoe-snapshot.ts`
  - RePoE snapshot vendor 스크립트
- `src/scripts/build-affix-dictionary.ts`
  - canonical mod / English dictionary / counting policy 생성 스크립트
- `src/scripts/validate-affix-dictionary.ts`
  - English clipboard sample 기준 dictionary validation 스크립트
- `src/scripts/validate-clipboard-samples.ts`
  - 샘플 검증 스크립트
- `src/config/clipboard-safe-feature-policy.json`
  - 현재 학습용 clipboard-safe feature whitelist
- `src/config/clipboard-affix-dictionary.ts`
  - generated English affix dictionary runtime 로더
- `src/generated/affix-dictionary/`
  - generated artifact 기준선
- `vendor/poe-static/repoe-fork-poe1-2026-04-16/`
  - 현재 canonical source snapshot

즉, parser 골격만 있는 단계는 이미 지났고, **English V1 dictionary build / runtime wiring / sample validation까지는 구현된 상태**다.

2026-04-16 기준 English V1 validation:

- scope sample: `rare_equipment`, `normal_jewel`, `crafted_fractured_influenced_item`
- candidate line: `81`
- matched: `81`
- unmatched: `0`
- ambiguous: `25`

## 아직 없는 것

아직 비어 있거나 미정인 것은 아래다.

- 한국어 overlay dictionary
- `prefix_count` / `suffix_count` 실제 산출 구현
- clipboard vs ETL parity 테스트
- ambiguity를 더 줄이기 위한 family disambiguation 정책
- dictionary 생성/업데이트 운영 절차의 상세 문서화

## 제3자가 바로 이해해야 할 결론

이 이슈의 핵심은:

- `prefix_count`, `suffix_count`는 클립보드에서 "직접 보이는 값"이 아니다
- 하지만 적절한 dictionary와 규칙이 있으면 "복원 가능한 값"이다
- 샘플은 dictionary를 대체하지 못하지만, parser/dictionary 검증에는 필수다
- 구현의 병목은 parser가 아니라 dictionary source와 counting policy다

즉, 다음 실질 작업은 "파서를 더 많이 짜는 것"보다:

- 남은 ambiguity를 어떤 기준으로 줄일지 정하고
- 어떤 규칙으로 count할지 문서화하고
- clipboard와 ETL parity를 검증하는 흐름

을 고정하는 것이다.

## 다음 권장 작업

1. ambiguous family 처리 기준 확정
2. prefix/suffix counting spec 초안 작성
3. clipboard vs ETL parity 체크 포맷 설계
4. `prefix_count`, `suffix_count` 복원 구현
5. 필요 시 한국어 overlay 범위 재검토
