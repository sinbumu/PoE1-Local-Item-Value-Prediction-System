# Docs Guide

이 문서는 `docs/` 폴더 안의 문서를 현재 기준선에 맞춰 구분하기 위한 인덱스다.

핵심 목적:

- 어떤 문서를 먼저 읽어야 하는지 빠르게 알 수 있게 하기
- 현재 기준 문서와 보조 문서를 분리하기
- 더 이상 기준 문서가 아닌 파일을 `legacy`로 명확히 표시하기

## 현재 기준 문서

아래 문서들은 현재 프로젝트 상태를 설명하는 **핵심 기준 문서**다.

- `TRAINING_ETL_OVERVIEW.md`
  - 현재 학습용 ETL 구조 전체 요약
- `TRAINING_FEATURES.md`
  - 현재 `training_features_*` 계층과 학습 입력 의미
- `STORAGE_POLICY.md`
  - 현재 저장/cleanup/backup 정책
- `MODEL_SCOPE.md`
  - 현재 모델 대상/비대상 범위
- `TRAINING_BASELINE_REPORT_2026-04-19.md`
  - 최근 7일 전체 `300 iter` 학습 비교 중간정리와 현재 기준선 해석
- `MIDTERM_REPORT_WRITING_GUIDE_2026-04-22.md`
  - 중간 보고서/발표 자료용 프로젝트 진행 상황과 설명 포인트 종합 정리
- `TRAINING_FEATURE_IMPORTANCE_SUMMARY_2026-04-23.md`
  - 세그먼트별 feature importance와 `skill_gem` 해석 요약
- `REPORT_WRITER_DOCUMENT_MAP_2026-04-23.md`
  - 리포트 작성 담당자에게 넘길 문서 세트와 용도 정리
- `REPORT_HANDOFF.md`
  - 다른 작성자/AI에게 넘길 최신 요약
- `V2_PHASE0_AUDIT_REPORT_2026-05-01.md`
  - V2 mod-aware feature 가능성 확인용 Phase 0 audit 실행/산출물 가이드
- `V2_MODEL_COMPARISON_REPORT_2026-05-01.md`
  - `is_search_worthy` classifier의 V1/V2 비교 학습 실행 기준
- `V2_ELECTRON_MVP_DEMO_GUIDE_2026-05-01.md`
  - 최종 발표용 Electron 로컬 앱 MVP 실행/시연 절차
- `ELECTRON_MVP_CURRENT_STATUS_2026-05-20.md`
  - 최근 Electron MVP 앱 개발 상태, 테스트 이슈, 발표 방향 논의용 현황 정리
- `DESKTOP_MODEL_ROUTING_IMPLEMENTATION_2026-05-22.md`
  - desktop 앱용 모델 라우팅, 자동 배치 명령, decision policy, 검증 명령 정리

## 현재 활성 설계 문서

아래 문서들은 특정 이슈나 설계 축을 설명하는 **활성 보조 문서**다.

- `ITEM_ROUTING.md`
  - 어떤 아이템을 모델 후보 / 외부 시세 후보로 볼지
- `CLIPBOARD_COMPATIBILITY_AUDIT.md`
  - 클립보드 기반 추론과 ETL 피처의 호환성 감사
- `AFFIX_SOURCE_STRATEGY.md`
  - RePoE 기반 affix dictionary source / build / validation 기준선
- `AFFIX_DICTIONARY_REQUIREMENTS.md`
  - affix dictionary 이슈와 준비사항 정리
- `MIDTERM_REPORT_WRITING_GUIDE_2026-04-22.md`
  - 보고서 장별 연결, 성과/한계, feature importance 해석용 보조 문서
- `TRAINING_FEATURE_IMPORTANCE_SUMMARY_2026-04-23.md`
  - 모델이 실제로 어떤 피처에 반응하는지 설명할 때 쓰는 보조 문서
- `REPORT_WRITER_DOCUMENT_MAP_2026-04-23.md`
  - 저장소 문서 중 무엇을 먼저 읽을지 정리한 인계용 문서
- `V2_PHASE0_AUDIT_REPORT_2026-05-01.md`
  - V2 audit 결과를 보고서에 연결할 때 쓰는 기준 문서
- `V2_MODEL_COMPARISON_REPORT_2026-05-01.md`
  - V2 classifier 학습/비교 결과를 해석할 때 쓰는 기준 문서
- `V2_ELECTRON_MVP_DEMO_GUIDE_2026-05-01.md`
  - 앱 MVP 시연 흐름과 fallback 설명용 문서
- `ELECTRON_MVP_CURRENT_STATUS_2026-05-20.md`
  - 최종 리포트/발표용 Electron 앱 현재 상태와 남은 의사결정 정리
- `DESKTOP_MODEL_ROUTING_IMPLEMENTATION_2026-05-22.md`
  - rare/unique classifier와 jewel/skill_gem regressor 라우팅 구현 기준

## Legacy 문서

아래 문서들은 삭제 대상은 아니지만, **현재 구현 상태의 기준 문서로 보지 않는다**.

- `PLAN.md`
  - 프로젝트 초기에 작성된 collector 중심 초기 계획 문서
- `IMPLEMENTATION_NOTES.md`
  - 초기 계획 이후 실측/변경사항을 쌓아둔 작업 메모

이 문서들은 다음 용도로는 유용하다.

- 초기 의사결정 배경 확인
- 왜 현재 구조로 바뀌었는지 추적
- 과거 계획과 현재 상태 차이 비교

하지만 현재 구조 설명은 우선 아래 문서를 본다.

- `TRAINING_ETL_OVERVIEW.md`
- `TRAINING_BASELINE_REPORT_2026-04-19.md`
- `MIDTERM_REPORT_WRITING_GUIDE_2026-04-22.md`
- `TRAINING_FEATURE_IMPORTANCE_SUMMARY_2026-04-23.md`
- `REPORT_WRITER_DOCUMENT_MAP_2026-04-23.md`
- `TRAINING_FEATURES.md`
- `STORAGE_POLICY.md`
- `REPORT_HANDOFF.md`

## 권장 읽기 순서

처음 프로젝트를 넘겨받는 경우:

1. `REPORT_HANDOFF.md`
2. `TRAINING_BASELINE_REPORT_2026-04-19.md`
3. `MIDTERM_REPORT_WRITING_GUIDE_2026-04-22.md`
4. `TRAINING_FEATURE_IMPORTANCE_SUMMARY_2026-04-23.md`
5. `REPORT_WRITER_DOCUMENT_MAP_2026-04-23.md`
6. `TRAINING_ETL_OVERVIEW.md`
7. `TRAINING_FEATURES.md`
8. `STORAGE_POLICY.md`
9. 필요 시 `MODEL_SCOPE.md`
10. V2 구현/발표 준비 시 `V2_PHASE0_AUDIT_REPORT_2026-05-01.md`
11. V2 구현/발표 준비 시 `V2_MODEL_COMPARISON_REPORT_2026-05-01.md`
12. V2 구현/발표 준비 시 `V2_ELECTRON_MVP_DEMO_GUIDE_2026-05-01.md`
13. Electron 앱 최종 발표 방향 논의 시 `ELECTRON_MVP_CURRENT_STATUS_2026-05-20.md`
14. desktop 모델 라우팅/배치 구조 확인 시 `DESKTOP_MODEL_ROUTING_IMPLEMENTATION_2026-05-22.md`

클립보드/추론 이슈를 볼 경우:

1. `CLIPBOARD_COMPATIBILITY_AUDIT.md`
2. `AFFIX_SOURCE_STRATEGY.md`
3. `AFFIX_DICTIONARY_REQUIREMENTS.md`
4. `V2_ELECTRON_MVP_DEMO_GUIDE_2026-05-01.md`
5. `ELECTRON_MVP_CURRENT_STATUS_2026-05-20.md`
6. `DESKTOP_MODEL_ROUTING_IMPLEMENTATION_2026-05-22.md`

과거 맥락이 필요할 경우:

1. `IMPLEMENTATION_NOTES.md`
2. `PLAN.md`

## 관리 원칙

앞으로 `docs/` 문서를 수정할 때는 아래 원칙을 따른다.

1. 현재 운영 기준을 설명하는 문서는 `현재 기준 문서`에 둔다
2. 특정 이슈를 깊게 파는 문서는 `활성 설계 문서`로 둔다
3. 더 이상 기준 문서가 아닌 파일은 삭제 대신 `legacy`로 명시한다
4. 새 기준 문서가 생기면 이 인덱스를 함께 갱신한다
