# STORAGE_POLICY.md

## 문서 목적

이 문서는 로컬 MacBook 환경에서 수집/정규화/학습용 데이터를 **500GB 내에서 관리 가능하게 만들기 위한 저장 정책 초안**입니다.

실측 결과:

- 약 13시간 수집에서 `raw_api_responses` 약 `18GB`
- `normalized_priced_items` 약 `23GB`

따라서 현재 방식 그대로는 장기 수집이 어렵습니다.

## 기본 원칙

1. raw는 디버깅/재처리 용도이지 장기 보관 본체가 아니다.
2. normalized도 "무조건 오래 보관"하지 않는다.
3. 장기 보관의 핵심은 압축된 학습용 산출물과 그에 준하는 compact snapshot이다.
4. 저장 주기는 collector와 분리해서 배치 정리한다.

## 저장 계층

### Layer 1: Raw responses

용도:

- 디버깅
- 파서 수정 시 재검증
- 필드 구조 확인

권장 정책:

- 최근 `24시간`만 유지
- 기간 초과 시 삭제

추가 고려:

- 현재는 target league subset raw만 저장하지만, 그래도 빠르게 커짐
- 필요 시 full raw가 아니라 sample raw만 남기는 방향 검토

### Layer 2: Normalized priced items

용도:

- 수집 중간 산출물
- SQL 점검
- feature 추출 원본

권장 정책:

- DB에는 최근에 다시 관측된 hot listing만 유지
- `updated_at` 기준 `72시간` 이상 미갱신된 stale listing은 압축 export 후 Google Drive 업로드
- 업로드 확인 후 DB에서 삭제

### Layer 3: Training features

용도:

- CatBoost 학습 입력
- 장기 보관 대상

권장 정책:

- 8주 이하 프로젝트 기간 동안 장기 보관 가능
- raw/normalized보다 훨씬 작은 구조로 유지
- 최종적으로는 이 계층만 전체 보관 대상이 되도록 수렴

## 권장 보관 기간 초안

| 계층 | 권장 기간 | 비고 |
| --- | --- | --- |
| `raw_api_responses` | 1일 | 디버깅용 |
| `normalized_priced_items` | 3일 | `updated_at` 기준 stale listing 정리 |
| `training_features` | 프로젝트 전체 기간 | 장기 보관 |

## 권장 삭제 정책

### Raw

- `fetched_at < now() - interval '1 day'` 삭제

### Normalized

- 압축 export 후 Google Drive 업로드
- 업로드 성공 확인 뒤 `updated_at < now() - interval '3 day'` 범위를 우선 정리
- 장기 보관은 DB가 아니라 외부 스토리지 쪽에 둔다

### Candidate routing 기준 삭제

- `external_price_candidate`: 저장 최소화 또는 짧은 보관
- `model_candidate`: feature 추출 후 중기 보관
- `ignore`: 가능하면 저장하지 않음

## 압축 전략

현재 normalized 테이블이 너무 크므로, 장기적으로는 다음을 권장한다.

1. `item_json` 전체 장기 보관 지양
2. feature 추출 뒤 `jsonb` 대신 구조화된 컬럼만 남긴다
3. 과도기에는 normalized snapshot을 `ndjson.gz`로 압축 업로드
4. 최종적으로는 `training_features` 계층만 전체 보관

## 운영 전략 초안

### 수집 중 실시간

- collector는 `Mirage` 대상만 수집
- raw subset 저장
- normalized 저장

### 주기 배치

예시 주기:

- 1시간마다 feature extraction 또는 normalized export 배치
- 1시간마다 normalized 압축 업로드
- 하루 1회 raw retention cleanup

## 500GB 내 운영 가능성

다음 조건이면 가능성이 있습니다.

1. raw를 1일 내외로 제한
2. normalized를 `updated_at` 기준 3일 내외 stale listing만 유지
3. 외부 시세 추종 대상은 장기 저장 최소화
4. 장기 보관은 압축된 학습용 산출물 중심

반대로 다음 조건이면 위험합니다.

- raw 장기 무제한 보관
- normalized 전체를 DB에 몇 주 이상 그대로 유지
- 학습 제외 대상까지 계속 누적

## 권장 후속 작업

1. retention job 설계
2. `training_features` 생성 파이프라인 정의
3. item routing 기준을 SQL/코드로 연결
4. 실제 하루 증가량 다시 측정 후 기간 조정
