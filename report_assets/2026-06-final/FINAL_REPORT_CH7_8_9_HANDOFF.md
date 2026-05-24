# Final Report Chapter 7-9 Handoff

## 제7장 핵심 문장 초안

- 본 프로젝트의 desktop 앱은 Path of Exile 1 영문 클라이언트에서 사용자가 `Ctrl+C`로 복사한 아이템 텍스트를 로컬에서 분석하는 보조 유틸리티로 구현되었다.
- 앱은 모든 아이템을 단일 모델에 입력하지 않고, `model_manifest.json` 기반 item routing layer를 통해 rare/unique equipment, jewel, skill gem, external price 대상, parse failure를 구분한다.
- Rare 및 unique equipment는 V2 mod-aware classifier를 사용하고, jewel 및 skill gem은 V1 summary regressor를 사용한다.
- Clipboard Auto Watch는 polling, signature gate, hash dedupe, debounce/cooldown, in-flight guard로 구성되어 일반 텍스트를 모델에 넣지 않도록 설계되었다.
- Floating Result Card와 tray 동작을 추가해 실제 게임 중 빠르게 결과를 확인하고 앱을 유틸리티처럼 운용할 수 있도록 했다.
- Windows installer는 Electron 앱, compiled feature builder, model bundle, Python predictor, embedded Python runtime을 포함하는 구조로 준비되었다.

## 제8장 핵심 문장 초안

- 통합 실행 결과, 개발모드와 설치판 모두에서 desktop 앱 실행이 확인되었고, demo sample을 통해 주요 routing 경로가 검증되었다.
- Rare equipment, jewel, skill gem은 각각 classifier 또는 regressor 경로로 처리되며, currency/map/divination card는 external price lookup recommendation으로 처리된다.
- Malformed input은 parse failed fallback으로 처리되어 일반 텍스트나 불완전한 입력에 대한 안전장치를 제공한다.
- Windows 테스트 과정에서 floating card 위치, tray 복원, 한글 encoding, packaged model path mismatch 등의 이슈가 발견되었고 각각 대응되었다.
- 단, 모델 출력은 공개 listing price 기반의 우선순위 판단이며 실제 판매가 또는 체결가 보장을 의미하지 않는다.

## 제9장 핵심 문장 초안

- 본 프로젝트는 데이터 수집/ETL/학습 파이프라인에서 시작해 실제 로컬 desktop utility 형태의 최종 산출물까지 연결했다는 점에서 의의가 있다.
- 최종 desktop 앱은 모델 예측뿐 아니라 fallback routing, 사용자 상호작용, Windows 배포까지 고려한 end-to-end 시스템이다.
- 향후 과제로는 실제 거래소 URL 연동, 더 정교한 jewel/skill gem feature 재현, latency 계측 자동화, 장시간 Windows 실사용 안정성 검증이 있다.

## 안전하게 주장 가능한 문장

- Desktop 앱은 item type별 routing layer를 구현했다.
- Rare/unique equipment, jewel, skill gem, external lookup 대상, parse failure 입력을 구분한다.
- Windows installer 구조가 구현되었고 설치판 실행이 사용자 테스트에서 확인되었다.
- Floating card, tray restore, app icon, Auto Watch 등 utility app UX가 구현되었다.
- 출력은 listed price 기반 검색/판매 시도 우선순위 판단이다.

## 아직 주장하면 안 되는 문장

- 실제 판매가를 정확히 예측한다.
- 모든 PoE1 아이템 타입을 완전 지원한다.
- 장시간 실게임 환경에서 완전 무오류로 동작한다.
- external price lookup API와 직접 연동되어 있다.
- installer size나 release artifact 정보가 확정되었다. 해당 값은 Windows release 파일 확인 후 기입해야 한다.

## 반드시 명시해야 할 한계

- 모델은 공개 listing price 기반이며 실제 체결가가 아니다.
- 일부 품목은 모델 예측보다 외부 시세 조회가 적합하다.
- Korean client, OCR, game automation, automatic selling은 scope 밖이다.
- Windows fullscreen mode에서 floating card always-on-top 동작은 환경에 따라 달라질 수 있다.
- Embedded Python과 CatBoost 포함으로 installer 크기가 커질 수 있다.

## 상태 구분

### 검증 완료

- 주요 routing path CLI 검증
- demo sample fallback path 검증
- Windows dev mode 기본 동작 사용자 확인
- installer 설치판 실행 사용자 확인
- installer 설치판 모델 예측 정상 동작 사용자 확인

### 부분 검증

- 실제 PoE1 `Ctrl+C` auto watch: 기본 동작은 확인, 장시간 안정성 추가 확인 권장
- floating card fullscreen behavior: window mode 중심 확인 권장

### 미검증

- 최종 installer filename/size/release tag
- latency 정량 표
- 장시간 실사용 endurance test

### 발표용 demo fallback

- demo samples를 사용하면 live client/clipboard 불안정 상황에서도 rare, jewel, skill gem, external lookup, parse failed 경로를 시연할 수 있다.
