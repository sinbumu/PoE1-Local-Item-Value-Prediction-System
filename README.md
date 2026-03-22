# PoE1 Local Item Value Prediction System

Path of Exile 1 `public-stash-tabs` 데이터를 로컬에서 수집하고, 원본 응답과 정규화된 일부 데이터를 PostgreSQL에 저장하기 위한 PoC 프로젝트입니다.

현재 단계의 목적은 어디까지나 `수집`과 `검증`입니다. 모델 학습, UI, 배포는 아직 범위 밖입니다.

## 현재까지 확인된 전제

이 프로젝트는 공식 Path of Exile 개발자 문서를 기준으로 구현되어 있습니다.

- OAuth 토큰 발급: `POST https://www.pathofexile.com/oauth/token`
- Public Stash 접근 방식: `client_credentials` + `service:psapi`
- Public Stash 수집 엔드포인트: `GET https://api.pathofexile.com/public-stash-tabs`
- 페이지네이션: `id` 쿼리 파라미터와 응답의 `next_change_id`

추가로 실제 관측을 통해 다음을 확인했습니다.

- 오래된 backlog를 따라가면 `Standard`, `Hardcore`, `null`이 많이 보일 수 있음
- 최신 live cursor부터 tailing하면 일정 시간 뒤 `Mirage`, `Hardcore Mirage`, `SSF Mirage`, private league 등이 실제로 관측됨
- 따라서 시즌 데이터 수집은 `latest psapi change-id`부터 시작하는 전략이 유효함

## 요구 사항

- Node.js 20+
- Docker Desktop 또는 로컬 PostgreSQL

## 환경 변수

로컬 `.env` 파일을 만들어 사용합니다.

필수:

- `POE_CLIENT_ID`
- `POE_CLIENT_SECRET`
- `POE_USER_AGENT`
- `DATABASE_URL`

선택:

- `START_NEXT_CHANGE_ID`
- `TARGET_LEAGUE`
- `POE_REALM` (`pc`, `xbox`, `sony`)
- `POLL_INTERVAL_MS`

기본값:

- `TARGET_LEAGUE`를 지정하지 않으면 `Mirage`

호환 처리:

- `POE_API_CLIENT_ID`
- `POE_API_SECRET_KEY`
- `POE_API_SCRET_KEY` 오타 키도 임시 호환

`User-Agent`는 반드시 `OAuth `로 시작해야 합니다. 예시:

```text
OAuth mypoeapp/1.0.0 (contact: you@example.com)
```

## 로컬 PostgreSQL 실행

Docker Compose로 PostgreSQL을 띄웁니다.

```bash
docker compose up -d
```

초기 실행 시 `src/db/schema.sql`이 자동으로 적용되도록 연결되어 있습니다.

## 의존성 설치

```bash
npm install
```

## Collector 실행

일반 연속 실행:

```bash
npm run collector
```

최신 live cursor부터 시작:

```bash
npm run collector -- --start-latest
```

1회만 실행:

```bash
npm run collector:once
```

1회만 실행하되 최신 live cursor부터 시작:

```bash
npm run collector:once -- --start-latest
```

현재 collector 흐름:

1. OAuth 토큰 발급
2. Public Stash API 호출
3. `TARGET_LEAGUE`와 정확히 일치하는 stash/item만 필터링
4. 필터링된 raw subset 저장
5. priced item 일부 정규화
6. 최신 `next_change_id` 저장
7. 재시작 시 이전 state부터 재개

중요:

- 처음 시작할 때 `--start-latest`를 사용하면 최신 `psapi change-id`를 조회해서 시작합니다.
- 이미 저장된 collector state가 있으면 그 값을 우선 사용합니다.
- 현재 기본 target league는 `Mirage`입니다.
- exact match만 허용하므로 `Hardcore Mirage`, `SSF Mirage`, `Ruthless Mirage`, private league는 저장 대상에서 제외됩니다.

## 데이터 점검

간단한 집계 확인:

```bash
npm run inspect
```

출력 항목:

- raw response 수
- normalized item 수
- 상위 league
- 상위 currency

## league 관측 스크립트

10분 동안 league 값 관측:

```bash
npm run observe:leagues -- --minutes=10
```

최신 live cursor부터 10분 관측:

```bash
npm run observe:leagues -- --minutes=10 --start-latest
```

관측 스크립트는 다음을 보여줍니다.

- 새로 발견된 `stash.league`
- 새로 발견된 `item.league`
- 페이지별 상위 league 분포
- `Mirage` 관련 league가 감지되었는지 여부

## PostgreSQL 백업과 복원

가장 권장하는 방법은 Docker volume 자체를 복사하는 방식보다 `pg_dump`로 SQL 덤프를 뜨는 것입니다.

### SQL 덤프 백업

```bash
docker exec -t poe-stash-postgres pg_dump -U postgres -d poe_stash > backup.sql
```

압축해서 보관하고 싶다면:

```bash
docker exec -t poe-stash-postgres pg_dump -U postgres -d poe_stash | gzip > backup.sql.gz
```

### SQL 덤프 복원

새 PostgreSQL 컨테이너를 띄운 뒤:

```bash
psql "postgres://postgres:postgres@localhost:5432/poe_stash" < backup.sql
```

압축 파일이라면:

```bash
gunzip -c backup.sql.gz | psql "postgres://postgres:postgres@localhost:5432/poe_stash"
```

### Docker volume 백업

빠른 로컬 백업 용도로는 Docker volume 자체를 보관할 수도 있습니다.

다만 이 방식은 Postgres 버전과 실행 환경 영향을 더 많이 받으므로, 다른 머신으로 이전하거나 장기 보관할 때는 SQL 덤프를 우선 권장합니다.

## 현재 구현 메모

- raw 응답은 `raw_api_responses`
- collector state는 `collector_state`
- 정규화된 priced item은 `normalized_priced_items`
- 가격 파서는 현재 `~b/o`, `~price` 형태만 최소한으로 지원

주의:

- 실제 운영 단계에서는 raw subset만 저장하더라도 장기 보관 정책은 따로 정하는 편이 좋음
- MVP 학습용 데이터는 결국 `Mirage` 소프트코어 중심으로 더 좁혀야 할 가능성이 높음

## 현재 범위 밖

- ML 학습
- overlay/UI
- AWS 배포
- 모든 가격 메모 edge case 대응
- 고급 파이프라인/모니터링

## 관련 문서

- 계획 원문: `docs/PLAN.md`
- 변경사항 및 운영 메모: `docs/IMPLEMENTATION_NOTES.md`

## Third-party notice

This product isn't affiliated with or endorsed by Grinding Gear Games in any way.
