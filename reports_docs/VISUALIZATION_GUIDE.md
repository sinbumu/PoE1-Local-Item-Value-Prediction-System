# 발표용 시각화 가이드

## 결론

발표용 시각화는 **Python + pandas + matplotlib** 조합이 가장 쉽습니다.

이유:

- SQL 결과를 바로 DataFrame으로 받기 쉬움
- 막대그래프, 선그래프, 파이차트 정도는 매우 빠르게 만들 수 있음
- 발표 직전 1회성 이미지(`png`) 생성용으로 Node.js보다 덜 번거로움

Node.js도 가능하지만, 발표 자료용 차트만 빠르게 뽑을 목적이라면 Python 쪽이 보통 더 편합니다.

## 추천 시각화 1순위

### 1. 시간대별 raw 수집량

형태:

- 막대그래프
- x축: 시간 또는 날짜
- y축: raw response 수

보여주는 의미:

- 수집기가 실제로 지속 동작하고 있음을 직관적으로 보여줌
- “PoC가 아니라 실제 연속 수집 중”이라는 메시지를 만들기 좋음

### 2. Divine Orb 환율 추이

형태:

- 선그래프
- x축: 시각
- y축: `chaos equivalent`

보여주는 의미:

- 외부 환율 수집도 함께 동작 중임을 보여줌
- 이후 `target_price_chaos` 라벨링 근거 데이터가 이미 쌓이고 있음을 설명하기 좋음

### 3. 현재 DB 적재 규모

형태:

- 가로 막대그래프
- 항목: `raw_api_responses`, `normalized_priced_items`, `exchange_rate_snapshots`
- 값: row 수 또는 테이블 크기

보여주는 의미:

- raw와 normalized의 역할 차이
- 실제 운영 시 저장소 부담이 어디서 커지는지

## 추천 시각화 2순위

### 4. 최근 가격 통화 분포

형태:

- 막대그래프
- x축: `chaos`, `divine` 등 가격 통화
- y축: listing 수

보여주는 의미:

- 왜 환율 스냅샷이 필요한지 설명 가능
- 여러 통화로 가격이 붙는 생태계를 시각적으로 보여줄 수 있음

주의:

- `normalized_priced_items` 전체를 바로 그룹핑하면 무거울 수 있으므로, 최근 24시간 또는 샘플링 기준으로 뽑는 것이 안전합니다.

### 5. 프로젝트 스코프 수정 전/후 비교 다이어그램

형태:

- 텍스트 박스 기반 다이어그램
- 또는 단순한 2열 비교 슬라이드

예시:

- 초기: 넓은 수집, 모든 아이템 예측 구상
- 현재: `Mirage` 소프트코어 고정, 외부 시세 대상과 모델 대상 분리

보여주는 의미:

- 도메인 이해를 통해 프로젝트가 더 현실적으로 정제되었다는 점을 강조할 수 있음

## 발표용으로 가장 무난한 조합

발표 슬라이드에 차트를 많이 넣기보다 아래 3개만 넣는 것이 가장 깔끔합니다.

1. 시간대별 raw 수집량
2. Divine Orb 환율 추이
3. 현재 DB 테이블 규모

이 3개면:

- 수집
- 운영
- 후속 라벨링 준비

를 한 번에 설명할 수 있습니다.

## SQL 예시

### 시간대별 raw 수집량

```sql
SELECT date_trunc('hour', fetched_at) AS hour_utc, COUNT(*) AS raw_count
FROM raw_api_responses
WHERE fetched_at >= NOW() - INTERVAL '72 hours'
GROUP BY 1
ORDER BY 1;
```

### Divine Orb 환율 추이

```sql
SELECT sample_time_utc, chaos_equivalent
FROM exchange_rate_snapshots
WHERE normalized_currency_code = 'divine'
  AND sample_time_utc >= NOW() - INTERVAL '72 hours'
ORDER BY sample_time_utc;
```

### 테이블 크기 비교

```sql
SELECT relname, pg_total_relation_size(relid) AS total_bytes
FROM pg_catalog.pg_statio_user_tables
WHERE relname IN ('raw_api_responses', 'normalized_priced_items', 'exchange_rate_snapshots')
ORDER BY total_bytes DESC;
```

## Python 추천 흐름

1. PostgreSQL에서 집계 SQL 실행
2. 결과를 `pandas` DataFrame으로 받기
3. `matplotlib`로 `png` 생성
4. 생성된 이미지를 발표 슬라이드에 삽입

추천 라이브러리:

- `pandas`
- `matplotlib`
- `sqlalchemy`
- `psycopg`

## Node.js로도 가능한가

가능합니다.

후보:

- `chartjs-node-canvas`
- `vega-lite`
- `apache-echarts` 서버 렌더링

다만 현재 프로젝트 맥락에서는:

- Node는 서비스 코드와 섞이기 쉽고
- 일회성 발표 차트 생성은 Python이 더 빠르며
- 자료형 변환과 그래프 튜닝도 Python이 일반적으로 편합니다

그래서 발표 준비용만 보면 **Python 추천**입니다.

## 실제 권장 방식

지금 단계에서는 새 대시보드를 만들기보다:

1. `reports_docs`에 리포트 md 작성
2. SQL 2~3개로 집계
3. Python으로 차트 `png` 2~3장 생성
4. 발표 슬라이드에 삽입

이 흐름이 가장 가볍고 실용적입니다.

## 현재 추가된 스크립트

차트 PNG를 자동 생성하는 스크립트:

```bash
npm run report:charts
```

기본 동작:

- 최근 `72시간` raw 수집량 차트 생성
- 최근 `72시간` Divine 환율 추이 차트 생성
- 현재 PostgreSQL 주요 테이블 크기 차트 생성

출력 위치:

- `reports_docs/YYYY-MM-DD_raw_collection_last_72h.png`
- `reports_docs/YYYY-MM-DD_divine_exchange_last_72h.png`
- `reports_docs/YYYY-MM-DD_table_sizes.png`

옵션 예시:

```bash
bash reports_docs/render_report_charts.sh --hours 96 --prefix 2026-03-28
```

의존성:

- `matplotlib`

실행 방식:

```bash
npm run report:charts
```

참고:

- macOS의 관리형 Python 환경에서는 전역 `pip install`이 막힐 수 있습니다.
- 그래서 현재 스크립트는 `/tmp/poe1-report-venv` 임시 가상환경을 자동으로 만들고 `matplotlib`를 설치한 뒤 차트를 생성합니다.

원하면 다음 단계로 바로:

- 발표용 차트 생성용 Python 스크립트
- SQL 결과를 자동으로 뽑아 `png`까지 만드는 도구

를 추가할 수 있습니다.
