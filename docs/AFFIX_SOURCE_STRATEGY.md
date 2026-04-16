# AFFIX_SOURCE_STRATEGY.md

## 1. 목적

이 문서는 Path of Exile 1 아이템 가격 예측 프로젝트에서 필요한 `affix dictionary`를 어떤 원천 데이터로 구축하고, 어떤 정책으로 운영할지 고정하기 위한 개발 지침서이다.

이 문서의 목표는 다음과 같다.

- `Ctrl+C` 클립보드 기반 파서와 학습 데이터 생성 파이프라인에서 사용할 **canonical affix dictionary 전략**을 확정한다.
- 코딩 에이전트가 **source 선택을 다시 조사하는 데 시간을 쓰지 않고**, 정해진 전략에 따라 구현할 수 있게 한다.
- 영어 우선 / 한국어 선택적 지원이라는 현재 캡스톤 범위를 명확히 한다.

---

## 2. 이번 프로젝트에서 고정하는 결정사항

### 2.1 지원 언어 범위
- **V1 필수 범위:** 영문 dictionary + 영문 PoE 클라이언트 기준 parser / validation / 시연
- **V2 선택 범위:** 한국어 overlay dictionary
- 현재 캡스톤 과제 기간과 우선순위를 고려할 때, **이번 학기 범위에서는 한국어 지원을 구현 대상에서 제외**한다.
- 즉, 한국어는 "가능하면"이 아니라 **명시적으로 후순위 / 범위 밖**으로 두고, 영문판 대응 완성도를 우선한다.

즉, 현재 구현 우선순위는 **영문 affix dictionary 안정화 > 한국어 지원 검토**이며, 현재 학기 목표에서는 사실상 영문만 다룬다.

### 2.2 source of truth
- **1차 canonical source:** RePoE / repoe-fork snapshot
- **2차 supplement source:** PoEDB (영문/한국어)
- **검색용 보조 source:** `api/trade/data/stats`
- **검증/참고 source:** Craft of Exile, 프로젝트 내 clipboard samples

### 2.3 구현 원칙
- 외부 사이트를 runtime dependency로 사용하지 않는다.
- 외부 source는 모두 **snapshot/vendor** 또는 **offline export** 방식으로 고정한다.
- parser와 dictionary 생성 로직을 분리한다.
- dictionary는 사람이 직접 대량 수작업으로 작성하지 않는다.
- V1에서는 **정확하고 보수적인 영문 affix 판별**을 우선하고, 불확실한 경우는 `null / unmatched`로 둔다.

---

## 3. 왜 별도 affix dictionary가 필요한가

현재 프로젝트에는 다음 두 경로가 있다.

1. Public Stash 기반 학습 데이터 ETL 경로
2. `Ctrl+C` 클립보드 기반 로컬 추론 경로

이 두 경로에서 공통적으로 필요한 것은 단순 문자열 파싱이 아니라, 다음과 같은 구조 복원이다.

- 같은 mod를 하나의 canonical key로 묶기
- 각 explicit line이 prefix인지 suffix인지 판별하기
- hybrid mod를 한 개의 affix로 볼지 정하기
- crafted / fractured / implicit / enchant / flavour를 명확히 분리하기
- 나중에 ETL 경로와 clipboard 경로 사이 parity를 검증하기

즉, 샘플 클립보드만으로는 충분하지 않고, 별도의 canonical dictionary와 counting policy가 필요하다.

---

## 4. source 선택 전략

## 4.1 1차 canonical source: RePoE / repoe-fork snapshot

### 선택 이유
- 정적 JSON export 형태라서 기계적으로 처리하기 쉽다.
- mod / stat / translation / base item 관련 데이터가 구조적으로 분리되어 있다.
- 버전별 snapshot을 고정할 수 있어 재현성이 높다.
- dictionary 생성용 source로 가장 적합하다.

### 이번 프로젝트에서 vendor할 후보 파일
최소한 아래 파일들은 검토 및 vendor 대상이다.

- `mods.json`
- `mods_by_base.json`
- `stats.json`
- `stat_translations.json`
- `base_items.json`
- `item_classes.json`
- `crafting_bench_options.json`
- `mod_types.json`
- `tags.json`

필요 시 추가 검토:
- `essences.json`
- `fossils.json`
- `gems.json`
- `gem_tags.json`

### 역할
RePoE snapshot은 다음 정보를 생성하는 **canonical build source**로 사용한다.

- canonical mod id
- stat id 연결
- generation type 후보
- 적용 가능한 base/tag
- 영문 text template
- (가능하면) locale overlay의 기준점

---

## 4.2 2차 supplement source: PoEDB

### 사용 목적
PoEDB는 canonical source가 아니라 **보강용 source**로만 사용한다.

### 허용 용도
- 영문 mod 문구 sanity check
- Prefix / Suffix 정보 보강
- 한국어 문구 supplement
- 특수 mod / generation type 예외 케이스 확인
- 사람이 읽는 확인용 비교 자료

### 금지 용도
- PoEDB HTML을 runtime에서 직접 조회하여 파싱하는 구조
- PoEDB를 1차 source of truth로 간주하는 것
- PoEDB에만 존재하는 구조를 프로젝트 core schema로 고정하는 것

### 운영 원칙
필요하다면 offline scrape 또는 수동 export를 통해 보조 테이블을 만들되, 최종적으로는 내부 generated artifact로 흡수한다.

---

## 4.3 `api/trade/data/stats`의 위치

이 endpoint는 **canonical affix dictionary source로 사용하지 않는다**.

### 이유
- searchable stat surface이지 mod canonical identity source가 아니다.
- mod와 stat hash가 직접 연결되지 않는다.
- 검색 가능한 stat만 보이는 구조라 coverage가 완전하지 않다.

### 허용 용도
- trade search overlay
- searchable stat hash 보조 매핑
- UI 검색 연동 준비용 메타데이터

### 금지 용도
- prefix / suffix attribution source
- canonical mod identity source
- locale canonical mapping source

---

## 4.4 Craft of Exile의 위치

Craft of Exile은 **검증/참고용**으로만 사용한다.

### 허용 용도
- affix group / prefix-suffix 개념 sanity check
- hybrid 처리 감각 확인
- 사람이 결과를 비교하는 참고 도구

### 금지 용도
- 1차 dictionary source
- 자동 생성 파이프라인의 canonical source

---

## 4.5 프로젝트 내부 clipboard samples의 위치

`samples/clipboard/`는 매우 중요하지만 역할은 **검증용 fixture / regression set**이다.

### 역할
- 실제 클립보드 형식 검증
- locale별 파서 안정성 확인
- dictionary 매칭 성공률 측정
- parity 검증의 gold-ish sample set

### 비역할
- dictionary 본체를 만드는 원천 데이터
- 전체 mod 풀 정의

---

## 5. 지원 언어 정책

## 5.1 영문 dictionary (필수)
V1은 **반드시 영문 dictionary를 안정적으로 구축**해야 한다.

### 이유
- source 품질과 coverage가 가장 좋다.
- 클립보드 파싱 및 시연을 영문 클라이언트로 통일할 수 있다.
- 캡스톤 범위에서 가장 실현 가능성이 높다.

## 5.2 한국어 dictionary (선택)
한국어는 **overlay 방식**으로만 접근할 수 있지만, 현재 캡스톤 범위에서는 구현하지 않는다.

### 허용 조건
다음 조건을 만족할 때만 V2로 진행한다.

- 영문 dictionary가 이미 안정적으로 동작한다.
- locale overlay를 붙여도 schema 변경이 거의 없다.
- 한국어 지원을 위해 대량 수작업 매핑이 필요하지 않다.

### 원칙
한국어는 `canonical_mod_id`를 새로 만드는 것이 아니라, **영문 canonical mod에 locale layer를 덧씌우는 방식**이어야 한다.

### 현재 결정
- 이번 학기 구현 항목에는 포함하지 않는다.
- parser / dictionary / validation 파이프라인도 영문 기준으로 먼저 고정한다.
- 한국어 샘플은 참고 자료로는 보관할 수 있지만, 현재 성공 기준이나 blocker로 취급하지 않는다.

---

## 6. 생성할 내부 artifact 구조

외부 source를 그대로 소비하지 말고, 내부 generated artifact를 만든다.

## 6.1 권장 artifact

### A. `canonical_mods.generated.json`
canonical mod 단위의 핵심 메타정보

예상 필드:
- `canonical_mod_id`
- `source_mod_id`
- `generation_type`
- `domain`
- `group`
- `stat_ids`
- `source_version`
- `is_hybrid`
- `is_crafted_candidate`
- `is_fractured_candidate`
- `is_explicit_candidate`
- `allowed_item_classes`
- `allowed_tags`

### B. `affix_dictionary_en.generated.json`
영문 line matching용 dictionary

예상 필드:
- `canonical_mod_id`
- `text_template_en`
- `normalized_text_template_en`
- `match_tokens_en`
- `prefix_or_suffix`
- `matching_confidence`

### C. `affix_dictionary_ko.generated.json` (선택)
한국어 overlay dictionary

예상 필드:
- `canonical_mod_id`
- `text_template_ko`
- `normalized_text_template_ko`
- `match_tokens_ko`
- `mapping_source`
- `mapping_confidence`

### D. `counting_policy.generated.json`
counting rule을 코드 밖에서 관리하기 위한 정책 파일

예상 필드:
- `count_hybrid_as_single_affix`
- `include_crafted_in_prefix_suffix_count`
- `include_fractured_in_prefix_suffix_count`
- `exclude_sections`
- `null_on_unmatched_explicit`

---

## 7. dictionary 생성 파이프라인

## 7.1 입력
- vendored RePoE snapshot
- supplement PoEDB export (선택)
- 내부 수동 override file (아주 소량)

## 7.2 출력
- canonical mod artifact
- locale dictionary artifact
- counting policy artifact

## 7.3 권장 build 단계

### Step 1. RePoE snapshot vendor
현재 프로젝트에서 맞출 버전의 snapshot을 `vendor/poe-static/<version>/` 아래에 고정한다.

### Step 2. canonical mod extraction
RePoE `mods.json` / `stats.json` / `stat_translations.json`를 기반으로 mod 단위 canonical record를 생성한다.

### Step 3. english dictionary generation
영문 text template를 정규화하여 matching dictionary를 생성한다.

### Step 4. optional korean overlay
필요 시 RePoE locale subtree 또는 PoEDB supplement로 한국어 overlay를 생성한다.

### Step 5. manual overrides
완전 자동으로 처리하기 어려운 극소수 케이스만 override file로 보정한다.

### Step 6. validation against clipboard samples
생성된 dictionary를 실제 `samples/clipboard/`에 대해 검증한다.

---

## 8. matching 전략

## 8.1 기본 원칙
- dictionary는 **explicit affix line**을 canonical mod key로 정규화하기 위해 사용한다.
- parser는 먼저 section / header / block을 안정적으로 분리해야 한다.
- dictionary는 parser가 분리한 **mod lines**만 입력으로 받는다.

## 8.2 권장 matching 흐름

1. clipboard line 원문 확보
2. 숫자/범위/퍼센트 등의 가변 값을 placeholder화
3. 공백/구두점/locale 특이 표현 normalize
4. section gating 수행
5. dictionary exact / normalized match 시도
6. 실패 시 stat translation 기반 fallback
7. 여전히 실패하면 `unmatched_explicit`로 남김

## 8.3 중요한 원칙
- 애매한 match를 억지로 붙이지 않는다.
- 잘못된 affix count보다 `null`이 낫다.
- matching 실패 케이스는 누적 저장해서 dictionary를 보강한다.

---

## 9. counting policy (V1 권장안)

V1에서는 보수적인 counting policy를 적용한다.

## 9.1 counting 대상
- **explicit affix line** 중 dictionary 매칭이 성공한 line만 count 대상

## 9.2 제외 대상
다음은 prefix/suffix count 대상에서 제외한다.

- implicit
- enchant
- corrupted implicit
- flavour text
- requirements
- properties
- pseudo line
- parser가 explicit로 확정하지 못한 line

## 9.3 hybrid mod 처리
- **V1 기본값:** hybrid mod는 **1개의 affix**로 센다.
- 이유: game item에 붙는 실제 modifier unit을 기준으로 보는 것이 안정적이다.

## 9.4 crafted / fractured 처리
- **V1 기본값:** crafted / fractured는 separate flag로 저장하고, `prefix_count` / `suffix_count`에는 **기본적으로 포함하지 않는다**.
- 이유: counting parity를 성급히 맞추려 하기보다 안정적인 affix reconstruction이 우선이다.
- 단, 향후 parity 검증 결과가 충분히 확보되면 policy를 다시 열 수 있다.

## 9.5 unmatched explicit 처리
- explicit로 보이는 line 중 하나라도 canonical match에 실패하면:
  - `prefix_count = null`
  - `suffix_count = null`
  - `affix_count_confidence = partial` 또는 `low`

즉, V1에서는 잘못된 count를 넣지 않는 것을 우선한다.

---

## 10. 구현 범위 권장안

## 10.1 V1 (이번 캡스톤 기본 범위)
- 영문 dictionary 구축
- 영문 클립보드 파싱 지원
- explicit canonical mapping
- `prefix_count`, `suffix_count` 후보 산출
- parity test on English samples

## 10.2 V2 (캡스톤 범위 밖, 추후 선택)
- 한국어 overlay dictionary
- 한국어 클립보드 샘플 parity test
- locale mismatch fallback

## 10.3 이번 단계에서 하지 않을 것
- 모든 locale 동시 지원
- PoEDB full scrape를 runtime dependency로 붙이는 것
- trade stat hash를 canonical mod로 쓰는 것
- 수천 개 mod를 수작업으로 hand-maintain 하는 것
- V1부터 crafted/fractured까지 완벽 parity를 맞추는 것

---

## 11. 코딩 에이전트가 해야 할 구현 순서

### Phase 1. source vendor
- RePoE snapshot vendor 구조 추가
- 필요한 JSON 파일만 프로젝트에 고정

### Phase 2. schema 확정
- canonical mod artifact schema 정의
- locale overlay schema 정의
- counting policy schema 정의

### Phase 3. english dictionary build
- RePoE 기반 canonical mod extraction 구현
- 영문 dictionary generation 구현
- build script 추가

### Phase 4. parser integration
- clipboard parser output을 dictionary matcher에 연결
- explicit line canonicalization 구현
- `prefix_count`, `suffix_count` 후보 계산 구현

### Phase 5. validation
- `samples/clipboard/` 기반 검증 스크립트 구현
- unmatched rate, partial rate, confidence report 생성

### Phase 6. optional korean overlay
- 영문 V1이 안정화되었을 때만 진행

---

## 12. 생성해야 할 보고/검증 산출물

구현 후 최소한 아래 산출물은 있어야 한다.

### 필수
- dictionary build log
- generated artifact 파일들
- English clipboard sample validation report
- unmatched explicit examples list
- prefix/suffix parity report (가능 범위 내)

### 선택
- Korean overlay coverage report
- source별 mapping confidence report

---

## 13. 금지사항

다음 방식은 피한다.

1. `api/trade/data/stats`만 보고 dictionary를 만드는 것
2. PoEDB를 직접 runtime에서 긁어오는 것
3. 영문 dictionary 없이 한국어부터 붙이는 것
4. 매칭 실패를 억지 추론으로 채우는 것
5. `prefix_count` / `suffix_count`를 신뢰도 표기 없이 강제로 채우는 것

---

## 14. 이번 프로젝트의 권장 최종 방향

현재 캡스톤 범위에서 가장 현실적인 방향은 아래와 같다.

1. **영문 affix dictionary를 먼저 완성**한다.
2. **영문 클라이언트 기준으로 parser + dictionary + parity를 안정화**한다.
3. 그 결과를 이용해 `prefix_count`, `suffix_count`를 V2 또는 조건부 feature로 도입한다.
4. 한국어는 이번 학기 범위에서 제외하고, 추후 별도 여유가 있을 때만 overlay로 붙인다.

즉, 이번 단계의 성공 기준은

- "모든 locale 지원"이 아니라,
- **"영문 클립보드 기준으로 구조 복원이 가능한 dictionary를 만드는 것"**

이다.

---

## 15. 한 줄 결론

이 프로젝트의 affix dictionary는 **RePoE snapshot을 canonical source로 삼고, PoEDB를 supplement로만 사용하며, 이번 캡스톤 범위에서는 영문 dictionary만 구축하고 한국어는 추후 overlay로만 검토**하는 방향이 가장 안정적이다.
