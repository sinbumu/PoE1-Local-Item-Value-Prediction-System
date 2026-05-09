# PoE1 Local Item Value Prediction System

## 2026-05-09 주간 리포트

이번 주차 보고서는 데이터 수집량이나 시각화 자료를 생략하고, **Electron 기반 MVP 앱 개발 진행 상황**만 간략히 정리한다.

## 이번 주 진행 내용

이번 주의 중심은 기존 V2 모델 실험 결과를 실제 최종 산출물인 로컬 유틸리티 앱으로 연결하는 작업이었다. 지난 주까지는 V2 mod-aware classifier, threshold 평가, 추론 CLI가 준비된 상태였고, 이번 주에는 이 흐름을 Electron 앱 안에서 발표 가능한 형태로 다듬는 데 집중했다.

주요 진행 사항:

| 구분 | 진행 내용 |
| --- | --- |
| 앱 기본 설정 | 기본 모델 경로, `feature_schema.json` 경로, threshold `0.40` 자동 입력 구조 추가 |
| 파일 검증 | 모델/스키마 파일이 없을 때 앱 상단에서 `model missing`, `schema missing` 상태 표시 |
| 입력 방식 | 기존 clipboard/manual paste 외에 `samples/clipboard/en/` 기반 demo sample 로드 기능 추가 |
| 결과 UI | raw JSON 중심 화면을 decision card, score, threshold, recommendation 중심으로 개편 |
| 상세 정보 | item summary, parser warning, raw prediction JSON, feature JSON, affix line을 분리 표시 |
| fallback | unsupported item, parser/inference failure를 사용자 친화적 메시지로 표시 |
| latency | feature builder와 prediction subprocess 실행 시간을 앱에서 표시하도록 구성 |
| 문서 | `desktop/README.md`, `docs/V2_ELECTRON_MVP_DEMO_GUIDE_2026-05-01.md`에 실행/시연 절차 반영 |

## 현재 앱 흐름

현재 Electron MVP 앱은 다음 흐름을 목표로 한다.

```text
PoE1 영문 Ctrl+C 텍스트
-> Electron 앱 입력
-> TypeScript clipboard parser
-> V2 mod-aware feature builder
-> Python CatBoost predictor
-> low listed value / search-worthy / high-value candidate 표시
```

실제 PoE 클라이언트나 Windows clipboard 환경이 불안정한 경우를 대비해, 저장소에 정리된 영문 샘플을 앱에서 바로 불러오는 demo sample 모드도 추가했다.

## 현재 구현 상태

현재 MVP는 상용 앱 수준의 overlay나 installer를 목표로 하지 않는다. 대신 최종 발표에서 보여줘야 하는 핵심 흐름, 즉 **아이템 텍스트 입력 -> 모델 기반 판단 -> 앱 화면 표시**를 우선 구현한 상태다.

현재 지원 범위:

- 영문 PoE1 `Ctrl+C` 아이템 텍스트
- rare equipment와 unique equipment 중심 판단
- V2 global classifier 기본 threshold `0.40`
- demo sample 기반 fallback 시연
- unsupported item에 대한 직접 검색 권장 메시지

현재 제외 범위:

- 게임 자동 조작
- 자동 클릭/자동 판매
- OCR 기반 실시간 분석
- 한국어 클라이언트 완전 지원
- 모든 아이템 타입 지원
- 정확한 체결가 예측 UI

## 확인된 판단

이번 주 개발 과정에서 persistent Python worker는 바로 도입하지 않기로 했다. 현재 구조는 아이템 분석마다 TypeScript feature builder와 Python predictor를 subprocess로 실행한다. 구조적으로는 worker 방식보다 느릴 수 있지만, MVP 단계에서는 단순하고 안정적인 편이 더 중요하다.

개발 환경에서 `rare-equipment-001` 샘플 기준 feature 생성 단계는 약 `0.4초` 수준으로 확인됐다. 전체 prediction이 실제 모델 파일 기준으로 반복적으로 `2~3초`를 넘으면 그때 persistent worker를 추가 검토하는 방향이 적절하다.

## 차주 진행 예정

차주에는 앱 기능을 더 넓히기보다, 실제 시연 안정성을 확인하는 쪽이 우선이다.

예정 작업:

1. 학습 완료된 V2 모델 경로를 앱 기본 경로와 맞추거나, 시연용 run 경로를 확정한다.
2. `rare_equipment`, `unique_equipment`, `unsupported` 샘플 각각으로 end-to-end 실행을 점검한다.
3. Windows 환경에서 `cd desktop && npm install && npm start` 실행 여부를 확인한다.
4. 실제 PoE1 영문 클라이언트에서 `Ctrl+C -> Read Clipboard -> Analyze Item` 흐름을 테스트한다.
5. 결과 문구를 발표용 표현으로 정리하고, 필요하면 데모 샘플 3~5개를 고정한다.

## 정리

이번 주 기준 프로젝트는 모델 실험 결과를 Electron 앱 MVP에 연결하는 단계로 넘어갔다. 아직 앱은 완성형 제품이 아니라 발표용 MVP에 가깝지만, 핵심 시연 흐름은 명확해졌다.

다음 주의 핵심은 새로운 기능을 많이 추가하는 것이 아니라, **실제 모델 파일과 Windows 실행 환경에서 데모가 안정적으로 동작하는지 검증하는 것**이다.
