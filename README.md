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
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REFRESH_TOKEN`
- `GOOGLE_DRIVE_FOLDER_ID`
- `RAW_RETENTION_HOURS`
- `NORMALIZED_RETENTION_HOURS`
- `MAINTENANCE_POLL_INTERVAL_MS`
- `MAINTENANCE_RAW_CLEANUP_INTERVAL_MS`
- `MAINTENANCE_EXCHANGE_RATE_INTERVAL_MS`
- `NORMALIZED_CLEANUP_LIMIT`
- `MAINTENANCE_NORMALIZED_CLEANUP_INTERVAL_MS`
- `MAINTENANCE_NORMALIZED_CLEANUP_MAX_BATCHES`
- `LABELED_BACKUP_OUTPUT_DIR`
- `LABELED_BACKUP_LIMIT`
- `MAINTENANCE_LABELED_BACKUP_INTERVAL_MS`
- `MAINTENANCE_LABELED_BACKUP_MAX_BATCHES`

권장 예시는 `.env.example`를 참고하면 됩니다.

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

Google Drive 업로드를 쓰려면:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REFRESH_TOKEN`

을 최소한 설정해야 합니다.

선택적으로:

- `GOOGLE_DRIVE_FOLDER_ID`: 특정 Google Drive 폴더에 업로드
- `RAW_RETENTION_HOURS`: raw 보관 시간
- `NORMALIZED_RETENTION_HOURS`: normalized stale listing 판단 기준 시간 (`updated_at` 기준)
- `MAINTENANCE_POLL_INTERVAL_MS`: maintenance 루프 체크 주기
- `MAINTENANCE_RAW_CLEANUP_INTERVAL_MS`: raw cleanup 주기
- `MAINTENANCE_EXCHANGE_RATE_INTERVAL_MS`: 환율 스냅샷 수집 주기
- `NORMALIZED_CLEANUP_LIMIT`: 1회 stale normalized cleanup 최대 row 수
- `MAINTENANCE_NORMALIZED_CLEANUP_INTERVAL_MS`: stale normalized cleanup 주기
- `MAINTENANCE_NORMALIZED_CLEANUP_MAX_BATCHES`: 1회 maintenance stale cleanup 최대 배치 수
- `LABELED_BACKUP_OUTPUT_DIR`: labeled backup 파일 임시 저장 경로
- `LABELED_BACKUP_LIMIT`: 1회 labeled backup 최대 row 수
- `MAINTENANCE_LABELED_BACKUP_INTERVAL_MS`: labeled backup 주기
- `MAINTENANCE_LABELED_BACKUP_MAX_BATCHES`: 1회 maintenance labeled backup 최대 배치 수

주의:

- Google Drive는 "폴더 경로 문자열"이 아니라 `폴더 ID`로 업로드 대상을 지정합니다.
- 예를 들어 Drive URL이 `https://drive.google.com/drive/folders/abc123XYZ`라면, `.env`에는 `GOOGLE_DRIVE_FOLDER_ID=abc123XYZ`를 넣으면 됩니다.
- `GOOGLE_DRIVE_FOLDER_ID`를 비워두면 기본 내 Drive 위치로 업로드됩니다.

### 환경 변수 설명

#### PoE / DB

| 변수 | 필수 여부 | 설명 |
| --- | --- | --- |
| `POE_CLIENT_ID` | 필수 | PoE OAuth 클라이언트 ID |
| `POE_CLIENT_SECRET` | 필수 | PoE OAuth 클라이언트 시크릿 |
| `POE_USER_AGENT` | 필수 | `OAuth `로 시작하는 User-Agent |
| `DATABASE_URL` | 필수 | PostgreSQL 접속 문자열 |
| `START_NEXT_CHANGE_ID` | 선택 | 강제로 시작할 초기 change id |
| `TARGET_LEAGUE` | 선택 | 기본값 `Mirage` |
| `POE_REALM` | 선택 | `pc`, `xbox`, `sony` 중 하나 |
| `POLL_INTERVAL_MS` | 선택 | collector 반복 간격(ms) |

#### Google Drive / Backup

| 변수 | 필수 여부 | 설명 |
| --- | --- | --- |
| `GOOGLE_CLIENT_ID` | Drive 사용 시 필수 | Google OAuth 클라이언트 ID |
| `GOOGLE_CLIENT_SECRET` | Drive 사용 시 필수 | Google OAuth 클라이언트 시크릿 |
| `GOOGLE_REFRESH_TOKEN` | Drive 사용 시 필수 | 업로드용 refresh token |
| `GOOGLE_DRIVE_FOLDER_ID` | 선택 | 업로드 대상 Drive 폴더 ID |
| `RAW_RETENTION_HOURS` | 선택 | `raw_api_responses` 삭제 기준 시간 |
| `NORMALIZED_RETENTION_HOURS` | 선택 | `normalized_priced_items` stale listing 판단 기준 시간 (`updated_at` 기준, 기본 `168`) |
| `MAINTENANCE_POLL_INTERVAL_MS` | 선택 | maintenance 루프 체크 주기(ms) |
| `MAINTENANCE_RAW_CLEANUP_INTERVAL_MS` | 선택 | raw cleanup 주기(ms) |
| `MAINTENANCE_EXCHANGE_RATE_INTERVAL_MS` | 선택 | 환율 스냅샷 수집 주기(ms) |
| `NORMALIZED_CLEANUP_LIMIT` | 선택 | 1회 stale normalized cleanup 최대 row 수 |
| `MAINTENANCE_NORMALIZED_CLEANUP_INTERVAL_MS` | 선택 | stale normalized cleanup 주기(ms) |
| `MAINTENANCE_NORMALIZED_CLEANUP_MAX_BATCHES` | 선택 | 1회 maintenance stale cleanup 최대 배치 수 |
| `LABELED_BACKUP_OUTPUT_DIR` | 선택 | labeled backup 파일 임시 저장 경로 |
| `LABELED_BACKUP_LIMIT` | 선택 | 1회 labeled backup 최대 row 수 |
| `MAINTENANCE_LABELED_BACKUP_INTERVAL_MS` | 선택 | labeled backup 주기(ms) |
| `MAINTENANCE_LABELED_BACKUP_MAX_BATCHES` | 선택 | 1회 maintenance labeled backup 최대 배치 수 |

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

## Drive 업로드와 보관 배치

작은 테스트 파일 업로드:

```bash
npm run drive:test
```

`training_features_labeled`를 Google Drive로 증분 백업:

```bash
npm run backup:labeled
```

stale normalized cleanup:

```bash
npm run cleanup:normalized-stale
```

raw retention 정리:

```bash
npm run cleanup:retention
```

옵션 예시:

```bash
npm run backup:labeled -- --limit=100000 --max-batches=5
```

```bash
npm run cleanup:normalized-stale -- --older-than-hours=168 --limit=100000 --max-batches=10
```

```bash
npm run cleanup:normalized-drive-archives
```

```bash
npm run cleanup:retention -- --raw-hours=24
```

maintenance를 별도 프로세스로 계속 실행:

```bash
npm run maintenance
```

maintenance를 1회만 실행:

```bash
npm run maintenance -- --once
```

옵션 예시:

```bash
npm run maintenance -- --once --older-than-hours=168 --normalized-cleanup-limit=100000 --normalized-cleanup-max-batches=5
```

현재 maintenance 동작:

1. `raw_api_responses`에서 `RAW_RETENTION_HOURS`보다 오래된 row 삭제
2. `normalized_priced_items`에서 `updated_at` 기준 `NORMALIZED_RETENTION_HOURS`보다 오래된 stale listing을 batch delete
3. `training_features_labeled`를 Google Drive로 증분 백업
4. advisory lock으로 maintenance 작업끼리의 중복 실행 방지
5. `poe.ninja` currencyoverview 기준 환율 스냅샷 수집
6. collector / 환율 수집 시점에 `ingestion_activity_summaries`를 시간/일 단위로 누적 갱신

collector와 동시 실행:

- `raw` cleanup은 동시 실행해도 무방
- `maintenance`의 stale normalized cleanup도 collector와 함께 돌릴 수 있음
- `training_features_labeled` backup도 collector와 독립적으로 함께 돌릴 수 있음
- 환율 스냅샷 수집도 collector와 독립적으로 함께 돌릴 수 있음
- 단, 아주 큰 batch를 자주 돌리면 DB I/O는 증가하므로 `limit`과 주기를 조절하는 편이 좋음

### Exchange Rate Snapshots

현재 `chaos equivalent`용 환율 소스는 `poe.ninja`를 사용합니다.

이유:

1. `currencyoverview`가 `chaosEquivalent`를 직접 제공
2. `sample_time_utc`가 있어 시점 스냅샷 저장이 쉬움
3. 공식 `currency-exchange`는 공식성은 좋지만, 현재 시점 직접 환율값 대신 hourly aggregate history 성격이라 1차 구현용 라벨 소스로는 더 복잡함

수동 수집:

```bash
npm run collect:exchange-rates
```

다른 league를 명시할 수도 있습니다.

```bash
npm run collect:exchange-rates -- --league=Mirage
```

현재 저장 테이블:

- `exchange_rate_snapshots`
- 주요 컬럼: `league`, `details_id`, `normalized_currency_code`, `sample_time_utc`, `chaos_equivalent`

현재는 먼저 스냅샷을 수집하는 단계이며, 이후 `training_features_clean`에 관측 시점 기준 환율을 붙여 `target_price_chaos`를 생성할 수 있습니다.

### cron 예시

매시간 1회 maintenance 실행:

```cron
0 * * * * cd /ABSOLUTE/PATH/PoE1-Local-Item-Value-Prediction-System && /usr/bin/env npm run maintenance -- --once >> /tmp/poe1-maintenance.log 2>&1
```

### launchd 예시

예시 파일은 `ops/launchd/com.blockoxyz.poe1-maintenance.plist.example`에 들어 있습니다.

핵심 흐름:

1. 예시 파일을 복사
2. `/ABSOLUTE/PATH/...` 부분을 실제 프로젝트 경로로 수정
3. `~/Library/LaunchAgents/` 아래에 배치
4. `launchctl load ~/Library/LaunchAgents/com.blockoxyz.poe1-maintenance.plist`

## 실제 운영 가이드

로컬에서 지금 기준으로 가장 단순한 운영 방식은 `collector`와 `maintenance`를 각각 별도 터미널에서 계속 실행하는 것입니다.

### 권장 구성

터미널 1:

```bash
npm run collector
```

터미널 2:

```bash
npm run maintenance
```

역할 분리:

- `collector`: public stash 수집, `raw_api_responses`, `normalized_priced_items`, `collector_state` 갱신
- `maintenance`: raw 정리, stale normalized cleanup, labeled backup, 환율 스냅샷 수집
- `maintenance`: raw 정리, stale normalized cleanup, labeled backup, 환율 스냅샷 수집, 수집량 summary 누적

현재 구현 기준에서는 이 2개만 계속 켜두면 됩니다.

### 처음 시작할 때

1. PostgreSQL이 켜져 있는지 확인
2. 처음 수집이면 `collector`를 `--start-latest`로 시작
3. 이후 재시작부터는 저장된 `collector_state`를 사용하므로 보통 `npm run collector`만 실행

예시:

```bash
npm run collector -- --start-latest
```

```bash
npm run maintenance
```

### 평소 운영 중

- `collector`는 계속 실행
- `maintenance`도 계속 실행
- `collect:exchange-rates`는 `maintenance`가 이미 담당하므로 따로 상시 실행할 필요 없음
- `backup:labeled`, `cleanup:normalized-stale`, `cleanup:retention`도 `maintenance`가 이미 담당하므로 수동 실행은 점검/디버깅용일 때만 사용

### ETL 실행 시점

`training_features_raw`, `training_features_clean`, `training_features_labeled`는 상시 서버가 아니라 배치 작업입니다.

권장 방식:

- 수집을 하루 이상 돌린 뒤 수동 실행
- 또는 별도 `cron`/`launchd`로 주기 실행

대표 예시:

```bash
npm run build:training-features
```

```bash
npm run build:training-features-clean
```

```bash
npm run build:training-features-labeled
```

## Ingestion Activity Summary

장기 추세 확인용으로 작은 summary 테이블을 유지합니다.

저장 테이블:

- `ingestion_activity_summaries`

핵심 컬럼:

- `summary_source`: `raw_response`, `normalized_listing`, `exchange_rate_snapshot`
- `bucket_granularity`: `hour`, `day`
- `bucket_start`
- `event_count`
- `auxiliary_count`

의도:

- `raw_api_responses`가 24시간 retention으로 지워져도 일별/시간별 수집량 추세는 계속 남김
- 시즌 말 유저 감소처럼 장기 추세를 나중에 비교 가능하게 만듦
- `reports_docs`용 차트의 원천 테이블로 활용 가능

수동 확인:

```bash
npm run inspect:summary
```

### 현재 시점의 중요한 주의사항

1. `training_features_labeled`는 `source_updated_at` 이전 최신 환율 스냅샷이 있어야 생성됩니다.
2. 환율 스냅샷을 모으기 시작하기 전의 과거 매물은 당장은 `missing_historical_exchange_rate`로 제외될 수 있습니다.
3. 따라서 앞으로 `collector + maintenance`를 함께 계속 돌릴수록 labeled 데이터가 점점 정상적으로 쌓이게 됩니다.

### 운영 팁

- `collector`와 `maintenance`는 동시에 실행해도 되도록 구현되어 있습니다.
- `maintenance`의 purge는 삭제 직전에 stale 조건을 다시 확인하므로 collector와 병행 가능하도록 처리되어 있습니다.
- DB I/O가 부담되면 `NORMALIZED_CLEANUP_LIMIT`, `MAINTENANCE_NORMALIZED_CLEANUP_INTERVAL_MS`, `LABELED_BACKUP_LIMIT`, `MAINTENANCE_LABELED_BACKUP_INTERVAL_MS`, `MAINTENANCE_EXCHANGE_RATE_INTERVAL_MS`를 조절하면 됩니다.
- 규칙을 크게 바꾼 뒤에는 `training_features_clean`, `training_features_labeled`를 다시 만드는 편이 깔끔합니다.

## Training Feature ETL

초기 CatBoost용 중간 계층은 `training_features_raw -> training_features_clean -> training_features_labeled` 순으로 생성됩니다.

권장 실행 방식은 통합 러너 `etl:training`입니다.

통합 풀 백필:

```bash
npm run etl:training -- --reset-cursors --limit=10000
```

통합 연속 실행(daemon):

```bash
npm run etl:training -- --daemon --limit=10000 --max-batches-per-stage=10 --poll-interval-ms=60000
```

설명:

- 기본 `etl:training`은 `raw -> clean -> labeled`를 stage 단위로 순환하면서 따라잡고 종료합니다.
- `--daemon`을 붙이면 각 단계 cursor를 이어받으며 반복 실행합니다.
- 중간에 프로세스가 종료되어도 재실행 시 각 단계의 cursor 기준으로 이어서 진행됩니다.
- `--reset-cursors`는 `raw/clean/labeled` 3개 cursor를 모두 초기화하고 다시 시작합니다.
- `--limit`은 세 단계 공통 batch 크기입니다.
- 필요하면 `--raw-limit`, `--clean-limit`, `--labeled-limit`으로 단계별 override도 가능합니다.
- one-off 실행에도 `--max-batches-per-stage`, `--raw-max-batches`, `--clean-max-batches`, `--labeled-max-batches`를 줄 수 있습니다.

운영 가이드:

- `etl:training`은 항상 **단일 프로세스만** 유지하는 것을 권장합니다.
- 특히 `--daemon` 모드 재시작 전에는 잔류 ETL 프로세스가 없는지 먼저 확인합니다.
- 과거 daemon이 남아 있으면 advisory lock 때문에 cycle이 skip되거나, 어떤 프로세스가 실제로 진행 중인지 판단이 흐려질 수 있습니다.

실행 전 잔류 확인 예:

```bash
ps -axo pid=,ppid=,etime=,state=,command= | rg "run-training-etl.ts|etl:training"
```

잔류 프로세스가 있으면 먼저 종료:

```bash
kill <PID>
```

여러 개가 남아 있으면 모두 정리한 뒤 다시 확인:

```bash
ps -axo pid=,ppid=,etime=,state=,command= | rg "run-training-etl.ts|etl:training"
```

그 다음에만 새 ETL을 시작하는 것을 권장합니다.

개별 단계 스크립트도 여전히 유지되지만, 디버깅이나 특정 단계만 재실행할 때만 쓰는 것을 권장합니다.

`training_features_raw`만 개별 생성:

기본 실행:

```bash
npm run build:training-features
```

처음부터 끝까지 풀 백필:

```bash
npm run build:training-features -- --reset-cursor --until-end
```

커서를 리셋하고 처음부터 다시 스캔:

```bash
npm run build:training-features -- --reset-cursor
```

배치 크기/배치 수 조절 예시:

```bash
npm run build:training-features -- --limit=500 --max-batches=20
```

현재 `training_features_raw`에 들어가는 항목:

- 공통: `listing_key`, `source_inserted_at`, `source_updated_at`, `league`, `base_type`, `rarity`, `frame_type`, `ilvl`, 가격 정보
- 상태/구조: `identified`, `corrupted`, `fractured`, `synthesised`, influence 플래그, 소켓/링크 수
- mod 요약: prefix/suffix 수, explicit/implicit/crafted/fractured/enchant mod 수
- 장비 요약: `quality`, `armour`, `evasion`, `energy_shield`, `physical_dps`, `elemental_dps`, `attack_speed`, `crit_chance`, `move_speed`
- 간단 요약합: `life_roll_sum`, `resistance_roll_sum`, `attribute_roll_sum`
- 주얼 요약: `jewel_type`, `cluster_size`, `cluster_passive_count`, `notable_count`
- 젬 요약: `gem_level`, `gem_quality`, `is_awakened`, `is_vaal`, `is_support_gem`, `gem_tags`

현재 ETL 특성:

1. `normalized_priced_items`를 `updated_at + listing_key` 커서 기준으로 증분 처리
2. `training_features_raw`는 `listing_key` 기준 upsert
3. 초기 규칙은 보수적인 요약 피처 중심
4. mod의 세부 정규화 key/roll 파싱은 아직 다음 단계
5. `updated_at` / `source_updated_at`는 판매 시각이 아니라 마지막 관측 시각
6. 현재 ETL은 가격 회귀용 스냅샷 라벨만 만들며, `sold_at` 또는 inferred removal 라벨은 만들지 않음

`training_features_clean` 생성:

```bash
npm run build:training-features-clean
```

처음부터 끝까지 풀 백필:

```bash
npm run build:training-features-clean -- --reset-cursor --until-end
```

처음부터 다시 스캔:

```bash
npm run build:training-features-clean -- --reset-cursor
```

현재 `training_features_clean` 기준:

1. `training_features_raw`에서 모델 후보군만 선별
2. 가격 통화는 우선 `chaos`, `divine`만 허용
3. `Rare equipment`, `Jewel`, `Skill Gem`, NeverSink strict allowlist 기반 `Unique equipment` 포함
4. `Map`은 외부 시세 추종 대상으로 제외
5. `Timeless Jewel`은 2차 대상으로 현재 제외
6. `unidentified Rare/Jewel/Unique`는 학습 피처가 부족하므로 현재 제외
7. Unique는 NeverSink strict 상위 블록과 예외 조건을 코드화한 초기 allowlist를 사용

`training_features_labeled` 생성:

```bash
npm run build:training-features-labeled
```

처음부터 끝까지 풀 백필:

```bash
npm run build:training-features-labeled -- --reset-cursor --until-end
```

처음부터 다시 스캔:

```bash
npm run build:training-features-labeled -- --reset-cursor
```

현재 `training_features_labeled` 단계:

1. `training_features_clean`의 `target_price_currency` 기준 환율을 조회
2. `source_updated_at` 이전 최신 `exchange_rate_snapshots`를 사용
3. `target_price_chaos = target_price_amount * exchange_rate_chaos_equivalent`
4. `target_price_log1p = log1p(target_price_chaos)` 생성

주의:

- 환율 스냅샷을 최근에 모으기 시작했다면, 그 이전 시점의 `training_features_clean` row는 일단 `missing_historical_exchange_rate`로 라벨링에서 제외될 수 있습니다.
- 즉 과거 이미 수집된 매물에 대해서는 시점 이전 환율 스냅샷이 없으면 `training_features_labeled`에 아직 안 들어갈 수 있습니다.
- 현재 `training_features_labeled`의 타깃은 `target_price_chaos`, `target_price_log1p`뿐이며, public listing에서의 disappearance 추정은 추후 별도 실험 과제입니다.

### 실제 학습용 export

`training_features_labeled`가 쌓인 뒤에는 최근 N일 구간을 학습용 CSV로 export할 수 있습니다.

기본 예시:

```bash
npm run export:training-dataset -- --days=7
```

세그먼트 제한 예시:

```bash
npm run export:training-dataset -- --days=7 --segments=rare_equipment,jewel
```

출력:

- 기본 경로: `artifacts/datasets/`
- CSV와 동일 이름의 `.manifest.json`

주의:

- export는 `training_features_labeled`만 대상으로 합니다.
- 즉 실제 CatBoost 학습 직전 단계의 canonical dataset export 용도입니다.

### 추천 실행 순서

실제 1차 학습을 준비할 때는 아래처럼 **통합 ETL -> export** 순서가 가장 단순합니다.

1. `npm run etl:training -- --reset-cursors --limit=10000`
2. `npm run export:training-dataset -- --days=7`

설명:

- 현재는 아래처럼 통합 실행을 기본 권장합니다:

```bash
npm run etl:training -- --reset-cursors --limit=10000
```

- 운영 중 ETL을 계속 따라잡고 싶으면 daemon 모드도 사용할 수 있습니다:

```bash
npm run etl:training -- --daemon --limit=10000 --max-batches-per-stage=10
```

- 개별 단계 스크립트는 디버깅/부분 재실행용으로 남겨둡니다.
- `collector`, `maintenance`는 계속 켜둬도 되지만, DB 부하가 크면 ETL 실행 중에는 상태를 보면서 조절하는 것이 좋습니다.

## ML 디렉토리

학습 코드는 저장소 내부 `ml/` 경로로 분리했습니다.

구성:

- `ml/train_catboost.py`: 첫 `CatBoost` 회귀 학습 골격
- `ml/requirements.txt`: Python 학습 의존성
- `ml/README.md`: 학습 실행 가이드

기본 실행 예시:

```bash
python3 -m venv ml/.venv
source ml/.venv/bin/activate
pip install -r ml/requirements.txt
python ml/train_catboost.py --dataset artifacts/datasets/YOUR_FILE.csv
```

현재 학습 스크립트 특징:

1. 시간 순서 기준 `train / valid / test` 분할
2. 기본 타깃은 `target_price_log1p`
3. 기본적으로 `src/config/clipboard-safe-feature-policy.json`의 클립보드 호환 화이트리스트만 feature로 사용
4. `observed_hour_utc`, `observed_weekday_utc`는 `source_updated_at`에서 파생 생성
5. 결과물로 `model.cbm`, `metrics.json`, `feature_importance.csv`, `run_info.json` 저장

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
- 현재 권장 운영은 `raw_api_responses` 24시간 보관, `normalized_priced_items`는 `updated_at` 기준 7일 stale cleanup, 장기 canonical backup은 `training_features_labeled` 중심으로 가져가는 구조

## 현재 범위 밖

- 최종 운영형 ML 학습 파이프라인
- overlay/UI
- AWS 배포
- 모든 가격 메모 edge case 대응
- 고급 mod 정규화/환율 타깃 파이프라인

## 관련 문서

- 문서 인덱스 / 현재 기준선: `docs/README.md`
- 현재 학습/ETL 기준 문서: `docs/TRAINING_ETL_OVERVIEW.md`
- 최신 handoff 요약: `docs/REPORT_HANDOFF.md`
- 모델 스코프: `docs/MODEL_SCOPE.md`
- 아이템 라우팅 분류표: `docs/ITEM_ROUTING.md`
- 현재 학습 피처 문서: `docs/TRAINING_FEATURES.md`
- 현재 저장 정책 문서: `docs/STORAGE_POLICY.md`
- 클립보드 호환 감사: `docs/CLIPBOARD_COMPATIBILITY_AUDIT.md`
- affix dictionary 준비사항: `docs/AFFIX_DICTIONARY_REQUIREMENTS.md`
- legacy 구현 메모: `docs/IMPLEMENTATION_NOTES.md`
- legacy 초기 계획: `docs/PLAN.md`

## Third-party notice

This product isn't affiliated with or endorsed by Grinding Gear Games in any way.
