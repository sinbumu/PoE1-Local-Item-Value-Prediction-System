# REPORT_HANDOFF.md

## 문서 목적

이 문서는 대학원 캡스톤 최종보고서 작성 또는 보고서 전담 AI에게 프로젝트 맥락을 한 번에 전달하기 위한 요약 문서이다.

이 문서 하나만 읽어도 다음 내용을 파악할 수 있도록 구성한다.

- 프로젝트 주제와 목적
- 현재까지의 구현 범위
- 초기 계획 대비 변경된 점
- 현재 수집/저장/ETL 상태
- 최종보고서 목차 초안

## 프로젝트 한 줄 요약

Path of Exile 1의 `public-stash-tabs` 데이터를 로컬에서 지속 수집하고, `Mirage` 소프트코어 경제 데이터를 정제하여 이후 `CatBoost` 기반 가격 예측 모델 학습으로 연결하는 프로젝트이다.

## 프로젝트 배경

Path of Exile의 거래 시장은 시즌제 경제 구조를 가지며, 아이템 종류와 옵션 조합이 매우 다양하다.  
특히 일부 아이템은 외부 시세 사이트만으로 즉시 적정가를 판단하기 어렵고, 옵션 조합과 roll 값에 따라 가격 차이가 크게 발생한다.

따라서 본 프로젝트는 다음 문제를 다룬다.

1. 공개 거래 매물 데이터를 지속적으로 수집할 수 있는가
2. 로컬 환경에서도 장기 수집과 저장이 가능한가
3. 수집 데이터를 실제 모델 학습용 구조로 정제할 수 있는가
4. 최종적으로 옵션 의존성이 큰 아이템 가격 예측 모델로 확장할 수 있는가

## 초기 목표

초기 목표는 다음과 같았다.

- PoE OAuth 앱을 이용해 public stash API 접근
- public stash 데이터를 연속 수집
- raw 응답과 normalized 데이터를 분리 저장
- `next_change_id` 기반 재시작/이어받기
- 수집 데이터가 이후 학습용으로 의미가 있는지 검증

초기에는 모델 학습보다 수집 PoC 검증이 우선 범위였다.

## 현재까지의 방향 수정

실제 수집과 분석을 진행하면서 프로젝트 방향은 다음처럼 구체화되었다.

### 1. 수집 리그 범위 축소

처음에는 Public Stash 전체를 폭넓게 보려 했지만, 현재는 `Mirage` 소프트코어 시장만 대상으로 수집한다.

제외 대상:

- `Hardcore Mirage`
- `SSF Mirage`
- `Ruthless Mirage`
- private league

이유:

- 경제권이 서로 다름
- 가격 분포를 한 모델로 함께 다루기 어렵다
- 특정 시장 하나에 고정하는 편이 해석과 학습 안정성이 높다

### 2. 모든 아이템 예측이 아니라 “예측 가치가 큰 아이템” 중심

현재는 모든 아이템을 동일하게 다루지 않는다.

외부 시세 우선 대상:

- Currency
- Fragment
- Scarab
- Essence
- Fossil
- Oil
- Divination Card
- 일반 Map
- 옵션 차이가 거의 없는 유니크 일부

모델 예측 우선 대상:

- Rare 장비
- Rare Jewel / Abyss Jewel / Cluster Jewel
- 옵션 roll 차이가 큰 Unique 장비
- Skill Gem

즉 프로젝트의 모델 목표는 “모든 아이템 가격 예측”이 아니라, “검색만으로 적정가 판단이 어려운 아이템 가격 예측”이다.

### 3. 보관 전략 수정

raw 전체 장기 보관은 디스크 사용량이 너무 커서 현실적이지 않았다.  
따라서 현재는 다음 전략으로 변경했다.

- `raw_api_responses`: 짧게 보관 후 정리
- `normalized_priced_items`: 7일 기준 stale listing만 유지
- 오래된 normalized는 압축 후 Google Drive 업로드
- 장기적으로는 `training_features` 계층만 핵심 장기 보관 대상으로 수렴

## 현재 시스템 구조

현재 구조는 크게 세 부분으로 나뉜다.

### 1. Collector

역할:

- OAuth 토큰 발급
- Public Stash API 호출
- `TARGET_LEAGUE=Mirage` 기준 필터링
- filtered raw 저장
- priced item normalized 저장
- `next_change_id` 저장 및 이어받기

### 2. Maintenance

역할:

- raw retention cleanup
- normalized archive / purge
- exchange rate snapshot 수집

### 3. ETL / 학습 준비

현재 준비된 흐름:

- `normalized_priced_items`
- `training_features_raw`
- `training_features_clean`
- `training_features_labeled`

아직 본격 실행 단계는 아니며, 다음 주부터 실제 ETL과 학습 시도를 진행할 예정이다.

## 현재 데이터/구현 상태 요약

2026-04-04 기준 요약:

- 수집 파이프라인: 구현 완료
- retention / archive: 구현 완료
- 환율 스냅샷 수집: 구현 완료
- ingestion activity summary: 구현 완료
- `training_features_raw`: 구현 완료
- `training_features_clean`: 구현 완료
- `training_features_labeled`: 구현 완료
- 본격 ETL 실행: 아직 전
- CatBoost 학습: 아직 전

현재 학습 타깃은 **관측 시점의 listing price**를 환율로 chaos 기준으로 변환한 가격이다.

중요:

- 현재 라벨은 판매 완료 가격이 아니다
- `updated_at` / `source_updated_at`는 판매 시각이 아니라 마지막 관측 시각이다
- `sold_at`, `removed_at`, `time_to_sale` 라벨은 아직 만들지 않는다

## 현재까지 확인된 핵심 결과

1. public stash 데이터는 최신 live cursor 기준으로 실제 시즌 리그 데이터가 충분히 들어온다.
2. `Mirage` 소프트코어만 대상으로 좁히는 것이 프로젝트 목적에 적합하다.
3. 로컬 MacBook + PostgreSQL + Node.js 구조로도 장시간 수집 운영이 가능하다.
4. raw/normalized/환율 스냅샷/summary까지 포함한 운영 구조가 정리되었다.
5. 수집 데이터 규모는 이미 다음 단계인 ETL 및 학습 실험을 시작하기에 충분한 수준이다.

## 이번 주와 다음 주의 구분

### 이번 주까지

- 수집기 안정화
- 저장 구조 정리
- retention / archive 구현
- 환율 스냅샷 누적
- 일별/시간별 수집 추세 summary 도입

### 다음 주부터

- `training_features_raw` 생성
- `training_features_clean` 생성
- `training_features_labeled` 생성
- `CatBoost` 1차 학습 시도
- 초기 모델 성능 및 데이터 품질 점검

## 최종보고서에서 강조하면 좋은 포인트

1. 단순 API 호출이 아니라 장시간 운영 가능한 수집 파이프라인을 직접 구축했다.
2. 게임 도메인 특성에 맞춰 리그, 아이템 범위, 외부 시세 대상과 모델 대상의 경계를 정리했다.
3. 실제 수집 과정에서 발생한 저장소 문제와 데이터 품질 문제를 정책과 구조로 해결했다.
4. 프로젝트가 “수집 PoC” 단계에서 “실제 학습 데이터 생성 및 모델 실험” 단계로 넘어가기 직전 상태까지 왔다.

## 최종보고서 목차 초안

### 1. 서론

- 연구 배경
- 문제 정의
- 프로젝트 목표
- 기대 효과

### 2. 관련 배경 및 도메인 이해

- Path of Exile 거래 생태계와 시즌제 경제 구조
- public stash API 개요
- 외부 시세 소스와 모델 예측의 역할 분담

### 3. 시스템 요구사항 및 초기 설계

- 초기 목표와 범위
- 사용 기술 스택
- 로컬 개발 및 실행 환경
- 데이터 저장 구조 초안

### 4. 수집 파이프라인 설계 및 구현

- OAuth 인증 구조
- public stash 수집 흐름
- `next_change_id` 기반 이어받기
- league 필터링 전략
- raw / normalized 저장 구조

### 5. 데이터 저장 정책 및 운영 구조

- raw retention 정책
- normalized archive / purge 정책
- Google Drive 업로드 전략
- collector / maintenance 분리 구조
- 일별/시간별 summary 누적 구조

### 6. 데이터 분석 및 모델링 범위 정의

- 수집 데이터의 특징
- 외부 시세 우선 품목과 모델 예측 대상 구분
- `Mirage` softcore 중심 스코프 확정
- 데이터 라벨 정의와 한계

### 7. 학습용 데이터 파이프라인 설계

- `training_features_raw`
- `training_features_clean`
- `training_features_labeled`
- 환율 스냅샷과 chaos equivalent 라벨
- CatBoost용 feature 구조

### 8. 실험 계획

- 1차 ETL 실행 계획
- CatBoost 1차 학습 계획
- 이상치 처리 및 데이터 정제 계획
- 성능 평가 기준 초안

### 9. 진행 결과 및 중간 성과

- 현재까지 구현 완료 항목
- 데이터 수집 규모
- 운영 과정에서 해결한 문제
- 초기 계획 대비 변경된 점

### 10. 한계와 향후 과제

- 판매 완료 가격 미관측 문제
- inferred removal 미도입 이유
- mod 정규화 미완성 영역
- 향후 모델 개선 방향

### 11. 결론

- 프로젝트 요약
- 현재 단계의 의의
- 최종 목표까지의 다음 단계

## 보고서 담당 AI에 함께 전달하면 좋은 문서

현재 기준으로는 다음 문서들이 보조 참고 자료로 유용하다.

- `docs/PLAN.md`
- `docs/IMPLEMENTATION_NOTES.md`
- `docs/MODEL_SCOPE.md`
- `docs/ITEM_ROUTING.md`
- `docs/TRAINING_FEATURES.md`
- `docs/STORAGE_POLICY.md`
- `reports_docs/2026-04-04/2026-04-04_mid_report.md`

하지만 보고서 작성 AI에는 우선 **이 문서 하나를 먼저 전달**하고, 세부 기술 정보가 필요할 때 위 문서를 추가로 참조하게 하는 방식이 가장 효율적이다.
