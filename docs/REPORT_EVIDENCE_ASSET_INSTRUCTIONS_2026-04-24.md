# 중간보고서 보강용 근거 자료 준비 지시서

## 목적

이 문서는 현재 작성 중인 프로젝트 보고서(표지/목차/국문요약/제1장~제6장)의 설득력을 높이기 위해,
데이터 수집/가공/학습 저장소 쪽에서 **자동 또는 반자동으로 준비해야 할 표, 그림, 로그 요약, 실험 근거**를 정리한 지시서다.

핵심 원칙은 아래와 같다.

1. 보고서 본문은 설명 중심으로 유지한다.
2. 강한 주장(예: 더 적합하다, 안정적으로 동작한다, 개선되었다)은 반드시 표/그림/로그/실험 결과로 뒷받침한다.
3. 저장소 내부 경로명, 실행 런 이름, 구현용 내부 용어는 본문 노출을 최소화하고, 필요하면 부록 또는 별도 manifest로 분리한다.
4. 중간보고서이지만 학교 양식상 "프로젝트 결과보고서" 형식을 사용하므로, 표지 제목 자체는 바꾸지 않는다.
5. 다만 본문 문체는 "중간평가 시점"보다는 "현 단계 구현 결과", "현재 실험 범위", "본 장에서는 구축된 파이프라인을 기준으로" 같은 표현을 사용한다.

---

## 피드백 반영 방침

### 유지할 것
- 표지의 `프로젝트 결과보고서` 표기는 유지한다.
- 최종 보고서 형식의 차례/국문요약/본문 구조는 유지한다.
- 현재 구현 범위(수집, ETL, CatBoost 1차 실험, English clipboard affix dictionary V1)를 중심으로 서술한다.

### 수정 또는 보강할 것
- `현재 1차 운영 기준`, `중간평가 시점`, `훨씬 적합했다`, `안정적으로 운영되었다` 같은 문장은 표/그림/로그가 붙지 않으면 완곡하게 낮춘다.
- 모델 대상 아이템 범위는 문서 전반에서 일관되게 유지한다.
  - 현재 기준: `rare_equipment`, `jewel`, `unique_equipment`, `skill_gem`
- 저장소 내부 경로명은 본문에서 직접 반복하지 않는다.
  - 본문: 설명용 이름 사용
  - 부록/manifest: 실제 경로 기록
- 공식 문서, 외부 데이터 소스, CatBoost 선정 근거 등은 참고문헌 및 본문 인용을 최소 수준이라도 붙인다.

---

## 공통 산출물 원칙

보고서용 자료는 아래 구조로 준비한다.

```text
report_assets/
  2026-04-24/
    chapter3/
    chapter4/
    chapter5/
    chapter6/
    appendix/
    manifest.json
    README.md
```

### 공통 규칙
- 모든 표는 `csv`와 `md` 둘 다 생성
- 모든 그림은 `png`로 생성
- 모든 그림/표에는 제목과 간단한 설명을 별도 `captions.md` 또는 `README.md`에 기록
- 본문에 강한 주장을 넣는 경우, 해당 주장을 뒷받침하는 파일명을 `manifest.json`에 연결
- 재현 가능한 경우 생성 스크립트 경로와 실행 명령도 기록

### 공통 파일 권장
- `manifest.json`
  - 각 그림/표가 어느 장/절의 근거인지
  - 어떤 소스 테이블/실험 결과를 기준으로 만들었는지
  - 생성 일시와 생성 스크립트
- `README.md`
  - 이 폴더의 산출물 설명
- `captions.md`
  - 그림/표 캡션 초안

---

## 제2장 관련 배경 및 도메인 분석

제2장은 설명 비중이 높으므로 코드 저장소에서 억지로 많은 그림을 뽑을 필요는 없다.
다만 아래 2개 정도는 있으면 좋다.

### 준비 자료
1. `table_item_scope_summary.csv`
   - 모델 예측 대상
   - 외부 시세 우선 대상
   - 제외 대상
   - 각 분류 기준 설명

2. `figure_domain_scope_overview.png`
   - 아이템군을 3분류로 나눈 간단한 도식
   - 예: 외부 시세 우선 / 모델 예측 우선 / 현재 범위 제외

### 용도
- 왜 모든 아이템을 다 예측하지 않는지 설명
- 왜 `rare_equipment`, `jewel`, `unique_equipment`, `skill_gem`을 현재 모델 대상으로 삼는지 정당화

---

## 제3장 시스템 요구사항 및 전체 구조

이 장은 구조 설명이므로 **설계 다이어그램 + 실행 환경 표**가 핵심이다.

### 반드시 준비
1. `figure_system_architecture.png`
   - collector
   - normalized storage
   - training ETL
   - staged dataset
   - CatBoost training/comparison
   - clipboard parser / affix dictionary V1
   를 포함한 전체 구조도

2. `figure_data_flow_pipeline.png`
   - `public-stash-tabs`
   - `raw_api_responses`
   - `normalized_priced_items`
   - `training_features_raw`
   - `training_features_clean`
   - `training_features_labeled`
   - staged dataset
   - train / compare
   순서의 데이터 흐름도

3. `table_execution_environment.csv`
   - OS
   - Node.js
   - PostgreSQL
   - Python/CatBoost
   - 로컬 운영 방식
   - 주요 라이브러리

4. `table_component_roles.csv`
   - collector
   - maintenance
   - ETL
   - staging
   - training
   - clipboard parser
   각각의 역할 요약

### 있으면 좋은 것
- `figure_clipboard_to_model_flow.png`
  - 향후 앱 입력 경로 설명용

---

## 제4장 데이터 수집 파이프라인 설계 및 구현

이 장은 **실제로 수집이 돌아가고 있다는 근거**가 필요하다.

### 반드시 준비
1. `table_collector_configuration.csv`
   - target league
   - exact match policy
   - `next_change_id` resume 방식
   - raw retention 정책 요약
   - normalized retention 정책 요약

2. `figure_collector_sequence.png`
   - OAuth token 획득
   - public stash 호출
   - league filtering
   - raw subset 저장
   - normalized 저장
   - state 갱신

3. `table_ingestion_counts_daily.csv`
   - 일자별 raw response 수
   - normalized listing 수
   - exchange snapshot 수(있다면)

4. `table_ingestion_counts_hourly.csv`
   - 시간대별 수집량
   - collector가 실제로 지속 동작했음을 보여 주는 용도

5. `figure_ingestion_trend_daily.png`
   - 일자별 수집량 추이

6. `figure_ingestion_trend_hourly.png`
   - 시간대별 수집량 추이

7. `table_league_filtering_summary.csv`
   - 관측된 league 종류
   - 최종 저장 대상 여부
   - 제외 이유

### 선택 준비
8. `table_storage_incident_summary.csv`
   - Docker/Postgres 저장소 이슈 요약
   - 발생 시각
   - 원인
   - 조치
   - 이후 변경된 정책

### 서술상 주의
- `안정적으로 운영되었다` 대신, 위 표/차트를 바탕으로 `지정 기간 동안 연속 수집과 재시작이 가능함을 확인하였다`처럼 표현
- exchange rate snapshot이 현재 404 등 이슈가 남아 있다면 `현재 collector에 주기 수집 기능이 포함되어 있으며, 후속 점검이 필요한 상태` 정도로 서술

---

## 제5장 데이터 정제 및 학습 데이터 파이프라인

이 장은 **row 수 변화, 정제 단계, 탈락 이유, 라벨 생성 구조**를 보여줘야 한다.

### 반드시 준비
1. `table_etl_row_counts.csv`
   - `normalized_priced_items`
   - `training_features_raw`
   - `training_features_clean`
   - `training_features_labeled`
   단계별 row 수

2. `figure_etl_funnel.png`
   - 단계별 row 수 감소를 funnel 또는 bar chart로 시각화

3. `table_clean_filter_reasons.csv`
   - clean 단계에서 제외된 대표 이유와 row 수
   - 예: unsupported currency, unidentified item, excluded segment, missing exchange rate 등

4. `table_label_coverage.csv`
   - clean row 수 대비 labeled row 수
   - 누락 사유 분포

5. `figure_price_distribution_raw.png`
   - `target_price_amount` 또는 chaos 환산 전 가격 분포

6. `figure_price_distribution_labeled.png`
   - `target_price_chaos`
   - `target_price_log1p`
   분포

7. `figure_segment_distribution.png`
   - `rare_equipment`, `jewel`, `unique_equipment`, `skill_gem` row 수 비교

8. `table_feature_policy_summary.csv`
   - 현재 실제 학습 입력 포함 피처
   - 조건부 피처
   - 제외 피처

### 매우 중요
`6.2`와 `6.3` 서술을 위해, 실제 현재 학습 입력을 자동으로 덤프한 표가 필요하다.

권장 파일:
- `table_current_training_features.csv`
  - 실제 현재 학습에 사용된 피처 목록
- `table_clipboard_safe_feature_policy.csv`
  - `clipboard_safe_v1` 화이트리스트
  - conditional
  - excluded

이 표를 기준으로 **문서상 모델 입력**과 **실제 코드상 모델 입력**이 일치하도록 관리한다.

### exchange snapshot 관련 주의
- 현재 snapshot 수집 성공/실패 상태를 먼저 점검
- 만약 404 이슈가 남아 있다면 `table_exchange_snapshot_status.csv`로 현재 상태를 분리해서 설명
- 본문에는 `chaos 환산을 위한 보조 환율 데이터 참조 구조를 구현하였다` 수준으로 쓰고, 성공률/누락률은 표로 제시

---

## 제6장 가격 예측 모델 설계 및 실험

이 장은 **학습 데이터 규모, 비교 설계, 기준선, 결과표, feature importance**가 필수다.

### 반드시 준비
1. `table_split_sizes_global.csv`
   - global train / valid / test row 수

2. `table_split_sizes_by_segment.csv`
   - segment별 train / valid / test row 수

3. `table_model_comparison_summary.csv`
   - 글로벌 vs 세그먼트 비교
   - `target_price_log1p_rmse`
   - `target_price_log1p_mae`
   - `target_price_chaos_rmse`
   - 현재 winner

4. `figure_model_comparison_rmse.png`
   - 세그먼트별 global vs segment `log1p RMSE`

5. `figure_model_comparison_mae.png`
   - 세그먼트별 global vs segment `log1p MAE`

6. `table_skill_gem_followup.csv`
   - `skill_gem` 추가 점검 실험 결과
   - 기존 global
   - 기존 segment
   - 추가 tuning segment

7. `figure_feature_importance_global.png`
   - global top N

8. `figure_feature_importance_by_segment.png`
   - segment별 top N

9. `table_feature_importance_topn.csv`
   - 보고서 본문에 직접 인용 가능한 상위 피처 표

### 강력 추천
10. `figure_pred_vs_true_sample.png`
   - 실제값 vs 예측값 샘플 산점도 또는 구간별 평균 비교
   - 세그먼트 1~2개만이라도 좋음

11. `figure_residual_distribution.png`
   - 잔차 분포

### winner 기준 관련 필수 지시
- 현재 보고서 본문에서 참조하는 비교 기준 산출물은 아래 1개로 고정
  - `comparison_post_report_300iter_d8_log1p_winner`
- 이 기준을 별도 파일로 명시
  - `table_experiment_artifact_manifest.csv`
  - 컬럼: 설명용 이름, 실제 경로, 생성일, 하이퍼파라미터, 사용 여부

본문에는 내부 경로를 길게 반복하지 않고,
- `최근 7일 전체 비교 실험`
- `winner 규칙 보정 후 기준 실험`
처럼 설명용 이름으로 부르고,
실제 경로는 부록/manifest로 뺀다.

---

## 문체/표현 수정 지침

### 바꿔야 할 표현
- `훨씬 적합했다` → `더 실용적이었다고 판단하였다`
- `안정 운영 기준이 되었다` → `현 단계 기준선으로 채택하였다`
- `문제가 확인되었다` → `운영상 병목이 관찰되었다`
- `정상적으로 이루어지지 않았다` → `추가 점검이 필요한 상태로 남았다`

### 피해야 할 표현
- `중간평가 시점`
- `현재 1차 운영 기준`을 남발하는 표현
- 내부 작업 노트처럼 보이는 문장
  - `강하게 주장할 수 있는 것은`
  - `이 수준으로 기술한다`
  - `추가 점검이 필요한 상태`
  - `일단 이렇게 둔다`

### 권장 표현
- `본 장에서는 현재 구현된 파이프라인을 기준으로 기술한다`
- `현 단계 실험 결과에 따르면`
- `최근 7일 스냅샷 기준으로`
- `본 프로젝트의 현재 범위에서는`
- `후속 실험 과제로 남겨 두었다`

---

## 용어 정리 자료

비전공 심사자를 고려해 아래 파일을 별도로 준비하는 것이 좋다.

### 권장 파일
- `table_term_glossary.csv`
  - `normalized listing`
  - `staged dataset`
  - `global fallback`
  - `model_segment`
  - `clipboard_safe_v1`
  - `target_price_log1p`
  등의 용어 정의

### 사용 방식
- 본문에서는 처음 한 번만 영문 병기
- 이후에는 한국어 중심으로 통일
- 세부 구현 용어는 부록/용어표로 넘김

---

## 참고문헌/인용 준비 지시

보고서 본문에 최소한 아래 근거는 붙일 수 있게 정리한다.

### 준비할 참고문헌 목록
1. PoE 공식 개발자 문서
2. Public Stash API 문서
3. OAuth / Authorization 문서
4. CatBoost 공식 문서
5. poe.ninja 관련 참고 문서 또는 사용 근거
6. RePoE / affix dictionary source 관련 참고 문서

### 권장 추가 파일
- `references/report_references.md`
  - 보고서용 참고문헌 초안
- `references/report_citation_map.csv`
  - 어느 장/절에서 어느 참고문헌을 인용할지 매핑

---

## 지금 가장 먼저 생성해야 할 파일 우선순위

### 1순위 (반드시)
- `report_assets/2026-04-24/chapter4/table_ingestion_counts_daily.csv`
- `report_assets/2026-04-24/chapter4/figure_ingestion_trend_daily.png`
- `report_assets/2026-04-24/chapter5/table_etl_row_counts.csv`
- `report_assets/2026-04-24/chapter5/figure_etl_funnel.png`
- `report_assets/2026-04-24/chapter5/table_current_training_features.csv`
- `report_assets/2026-04-24/chapter6/table_model_comparison_summary.csv`
- `report_assets/2026-04-24/chapter6/figure_model_comparison_rmse.png`
- `report_assets/2026-04-24/chapter6/table_feature_importance_topn.csv`
- `report_assets/2026-04-24/chapter6/figure_feature_importance_global.png`
- `report_assets/2026-04-24/chapter6/figure_feature_importance_by_segment.png`

### 2순위 (강력 추천)
- `table_league_filtering_summary.csv`
- `table_clean_filter_reasons.csv`
- `table_label_coverage.csv`
- `figure_price_distribution_labeled.png`
- `table_skill_gem_followup.csv`
- `table_experiment_artifact_manifest.csv`
- `table_term_glossary.csv`

### 3순위 (있으면 좋음)
- `figure_pred_vs_true_sample.png`
- `figure_residual_distribution.png`
- `table_storage_incident_summary.csv`
- `references/report_references.md`
- `references/report_citation_map.csv`

---

## 최종 지시 요약

저장소 쪽에서는 보고서 본문을 직접 더 쓰기보다, 아래를 우선 준비하는 것이 합리적이다.

1. 본문 주장과 연결되는 **표/그림/로그 요약 파일 생성**
2. 실제 현재 학습 피처 목록과 비교 기준 산출물을 **기계적으로 덤프**
3. 저장소 내부 경로와 구현 용어를 정리한 **manifest / glossary 작성**
4. 수집/ETL/학습/feature importance 결과를 장별로 바로 붙일 수 있게 **chapter별 asset 폴더 구성**
5. 보고서 문체는 설명용 이름을 쓰고, 실제 경로/실행 정보는 부록 또는 manifest로 분리

이렇게 하면 본문 수정은 최소화하면서도, 보고서 설득력은 크게 높일 수 있다.
