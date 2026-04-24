# REPORT_WRITER_DOCUMENT_MAP_2026-04-23.md

## 문서 목적

이 문서는 "이 저장소 안에서 리포트 작성 담당자가 어떤 문서를 먼저 봐야 하는지"를 정리한 문서다.

보고서 본문 초안은 여기서 쓰지 않고, 어떤 자료를 어느 용도로 참고하면 되는지만 정리한다.

## 가장 먼저 볼 문서

아래 5개가 현재 기준 핵심 세트다.

1. `README.md`
   - 프로젝트 전체 개요와 현재 실행 흐름
2. `docs/README.md`
   - `docs/` 인덱스와 문서 우선순위
3. `docs/MIDTERM_REPORT_WRITING_GUIDE_2026-04-22.md`
   - 중간 보고서 관점에서 현재 구현 범위, 기준선, 설명 포인트 정리
4. `docs/TRAINING_BASELINE_REPORT_2026-04-19.md`
   - 최근 7일 `300 iter` 비교 결과와 혼합 기준선 해석
5. `docs/TRAINING_FEATURE_IMPORTANCE_SUMMARY_2026-04-23.md`
   - feature importance와 `skill_gem` 해석 보조 문서

함께 전달할 핵심 산출물 경로:

- `ml/runs/comparison_post_report_300iter_d8_log1p_winner/`
- `ml/runs/skill_gem_post_report_500iter_d6/`
- `artifacts/training-staging/post_report_all_segments/`

## 시스템 구조 설명용 문서

아래 문서들은 "이 프로젝트가 어떻게 구성되어 있는가"를 설명할 때 핵심이다.

- `README.md`
- `docs/TRAINING_ETL_OVERVIEW.md`
- `docs/TRAINING_FEATURES.md`
- `docs/STORAGE_POLICY.md`
- `docs/REPORT_HANDOFF.md`

권장 용도:

- 수집기 / ETL / 저장 구조 설명
- 최근 7일 fast-lane와 retention 정책 설명
- `training_features_raw -> clean -> labeled` 흐름 설명

## ML 실험 결과 설명용 문서

아래 문서들은 CatBoost 실험과 현재 기준선을 설명할 때 본다.

- `ml/README.md`
- `docs/TRAINING_BASELINE_REPORT_2026-04-19.md`
- `docs/TRAINING_FEATURE_IMPORTANCE_SUMMARY_2026-04-23.md`
- `docs/MIDTERM_REPORT_WRITING_GUIDE_2026-04-22.md`

권장 용도:

- 왜 `target_price_log1p`를 주 타깃으로 두는지
- 글로벌 vs 세그먼트 비교 결과
- 현재 혼합 기준선
- `skill_gem`이 글로벌 fallback으로 남은 이유
- feature importance 해석

## 클립보드 / 추론 준비 상태 설명용 문서

아래 문서들은 "이 프로젝트가 나중에 로컬 앱 입력과 어떻게 연결될 것인가"를 설명할 때 쓴다.

- `docs/CLIPBOARD_COMPATIBILITY_AUDIT.md`
- `docs/AFFIX_SOURCE_STRATEGY.md`
- `docs/AFFIX_DICTIONARY_REQUIREMENTS.md`

권장 용도:

- 영어 clipboard parser V1 범위 설명
- RePoE 기반 affix dictionary 전략 설명
- 왜 한국어 지원이 현재 범위 밖인지 설명

## 현재 주간/중간 경과 참고 자료

저장소 안에는 별도 보고성 문서와 산출물도 있다.

- `reports_docs/`
  - 주차별 리포트와 차트
- `ml/runs/`
  - 실제 학습/비교 산출물 (`metrics.json`, `feature_importance.csv`, `comparison_summary.*`)
- `artifacts/training-staging/`
  - staged dataset snapshot과 split spec

리포트 작성 시 의미:

- `docs/`는 서술 근거
- `ml/runs/`는 수치 근거
- `reports_docs/`는 기존 주간 보고 형식 참고

## 목차/장별 연결 시 추천 문서

### 서론 / 문제정의

- `README.md`
- `docs/MIDTERM_REPORT_WRITING_GUIDE_2026-04-22.md`

### 시스템 구조 / 수집 파이프라인

- `docs/TRAINING_ETL_OVERVIEW.md`
- `docs/STORAGE_POLICY.md`
- `docs/REPORT_HANDOFF.md`

### 데이터 정제 / 학습 데이터 구성

- `docs/TRAINING_FEATURES.md`
- `ml/README.md`
- `docs/TRAINING_ETL_OVERVIEW.md`

### 모델 실험 / 결과 분석

- `docs/TRAINING_BASELINE_REPORT_2026-04-19.md`
- `docs/TRAINING_FEATURE_IMPORTANCE_SUMMARY_2026-04-23.md`
- `docs/MIDTERM_REPORT_WRITING_GUIDE_2026-04-22.md`

### 로컬 앱 연계 / 향후 과제

- `docs/CLIPBOARD_COMPATIBILITY_AUDIT.md`
- `docs/AFFIX_SOURCE_STRATEGY.md`
- `docs/AFFIX_DICTIONARY_REQUIREMENTS.md`

## 꼭 전달할 현재 기준 요약

리포트 작성 담당자에게 문서와 함께 아래 문장을 전달하면 된다.

1. 최근 7일 ETL -> staging -> CatBoost 비교까지 실제로 연결되었다.
2. 현재 기준선은 단일 글로벌 모델이 아니라 세그먼트 모델 + 글로벌 fallback의 혼합 구조다.
3. `rare_equipment`, `jewel`, `unique_equipment`는 세그먼트 모델 우세, `skill_gem`은 글로벌 우세다.
4. feature importance는 세그먼트별 가격 결정 규칙 차이를 설명하는 근거로 쓸 수 있다.
5. 영어 clipboard parser와 affix dictionary V1은 준비되었지만, 한국어 지원과 full parity는 후속 과제다.

## legacy로만 참고할 문서

아래 문서들은 배경 맥락 추적용으로만 본다.

- `docs/PLAN.md`
- `docs/IMPLEMENTATION_NOTES.md`

현재 기준 서술은 이 문서들보다 최신 기준 문서를 우선한다.
