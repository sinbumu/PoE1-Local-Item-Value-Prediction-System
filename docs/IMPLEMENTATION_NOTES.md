# IMPLEMENTATION_NOTES.md

## 문서 목적

이 문서는 초기 `docs/PLAN.md` 작성 이후 실제 구현 및 실측 과정에서 확인된 변경사항, 현재 의사결정, 운영 이슈를 정리하기 위한 메모입니다.

`PLAN.md`의 대체 문서가 아니라, 실제 작업 중 드러난 차이와 후속 판단 근거를 남기기 위한 문서입니다.

## 초기 계획 대비 달라진 점

### 1. 수집 시작 전략 변경

초기 계획에서는 `START_NEXT_CHANGE_ID`를 주거나 처음부터 stream을 따라가는 정도로 생각했지만, 실제 검증 결과 더 나은 전략이 확인되었습니다.

현재 권장 전략:

- 첫 수집 시작 시 `latest psapi change-id`를 조회해서 시작
- 수집 중에는 응답의 `next_change_id`를 저장
- 재시작 시 저장된 최신 `next_change_id`부터 이어서 수집

이유:

- 오래된 backlog를 따라가면 현재 목적과 무관한 과거/비시즌 데이터 비중이 매우 높을 수 있음
- 최신 cursor부터 시작하면 현재 시점의 live stream을 tailing할 수 있음
- 실제 관측에서 `latest` 시작 후 일정 시간 지나자 `Mirage` 관련 데이터가 다량 등장함

관련 엔드포인트:

- `https://www.pathofexile.com/api/trade/data/change-ids`

### 2. 실제 league 분포에 대한 이해 변경

초기에는 `public-stash-tabs`의 `league` 값이 주로 `Standard`, `Hardcore`, `null`만 보이는 것처럼 보였으나, 이는 backlog 성격의 구간을 봤기 때문이었습니다.

`latest psapi change-id`에서 시작한 뒤 10분 관측한 결과:

- `Mirage`
- `Hardcore Mirage`
- `SSF Mirage`
- `Ruthless Mirage`
- 여러 private league 이름

등이 실제로 관측되었습니다.

즉 현재 시즌 데이터는 실제 stream에 존재하며, 문제는 "어느 구간에서 보느냐"였습니다.

### 3. 시즌 softcore만 대상으로 좁히는 방향이 유효해짐

프로젝트 목표상 `Mirage` 소프트코어 경제 데이터만 수집하는 방향이 더 적절하다는 판단이 강해졌습니다.

이유:

- `Hardcore Mirage`는 별도 생태계로 보는 것이 자연스러움
- `SSF Mirage`, `Ruthless Mirage`, private league는 경제 구조가 다름
- 추후 MVP 학습 데이터셋은 league 혼합보다 특정 시장 하나를 고정하는 편이 더 안정적임

현재 남은 작업:

- collector를 `league === "Mirage"` 중심으로 좁히기
- private league, hardcore, SSF, ruthless를 어떤 규칙으로 제외할지 명확히 정하기

### 4. Raw 저장 전략 재검토 필요

초기 계획은 raw + normalized 2계층 저장이었고, 현재 구현도 그 방향을 따르고 있습니다.

하지만 실제 응답 크기와 수집량을 보면 raw 전체 장기 보관은 부담이 큽니다.

실무적으로 고려할 옵션:

- raw 전체 저장 + 짧은 보관 기간
- raw 샘플링 저장
- normalized 위주 저장
- raw는 PostgreSQL이 아니라 압축 파일로 저장

현재 결론:

- PoC 단계에서는 raw 저장이 유용함
- 장기 로컬 수집 운영 단계에서는 보관 정책을 반드시 다시 정해야 함

## 실측 결과 요약

### A. backlog 관측 시

초기 관측에서는 `Standard`, `Hardcore`, `null` 비중이 높게 나타났습니다.

이 구간만 보면 시즌 데이터가 거의 없는 것처럼 보일 수 있습니다.

### B. latest cursor 관측 시

`--start-latest`로 10분 관측한 결과, 실제로 `Mirage` 관련 데이터가 매우 많이 들어왔습니다.

핵심 관측 예:

- `pagesChecked`: 231
- `emptyPages`: 36
- `totalStashes`: 23047
- `totalItems`: 960633
- `mirageStashes`: 21889
- `mirageItems`: 863301

이 결과는 "최신 cursor부터 현재 시점 데이터를 추적"하는 방식이 프로젝트 목적에 훨씬 잘 맞는다는 근거가 됩니다.

## 현재 구현 상태

이미 구현된 부분:

- OAuth 토큰 발급
- Public Stash API 호출
- target league subset raw 저장
- normalized priced item 저장
- `collector_state` 기반 재시작
- `latest psapi change-id` 시작 옵션
- league 관측 스크립트

실행 옵션:

- collector: `--start-latest`
- observer: `--start-latest`

현재 기본 수집 league:

- `TARGET_LEAGUE=Mirage` 기본값 적용
- exact match만 허용
- `Hardcore Mirage`, `SSF Mirage`, `Ruthless Mirage`, private league는 기본 제외

## 작업 중 이슈

### 1. OAuth 요청에도 User-Agent가 필요했음

처음에는 token 요청 시 기본 `axios` UA로 나가면서 Cloudflare 403이 발생했습니다.

수정 후:

- token 요청에도 `POE_USER_AGENT`를 명시적으로 설정

### 2. `stash.league`와 `item.league`가 항상 단순 시즌명만 오지 않음

실제 응답에서는 다음과 같은 값이 섞여 들어왔습니다.

- `Mirage`
- `Hardcore Mirage`
- `SSF Mirage`
- `Ruthless Mirage`
- `HC SSF Mirage`
- private league 이름
- `Standard`
- `Hardcore`
- `(null)`

즉 단순히 `"Mirage"` 포함 여부만으로는 softcore 시즌만 정확히 필터링하기 어렵고, 허용/제외 규칙이 필요합니다.

### 3. 가격 정보 위치가 item note에만 있지 않음

실제 응답에서는 가격 정보가 item-level note뿐 아니라 stash 이름에도 있을 수 있음이 확인되었습니다.

따라서 이후 normalization에서는 다음을 함께 봐야 합니다.

- `item.note`
- `item.forum_note`
- `stash` 이름의 가격 패턴

## 로컬 MacBook 운영 메모

### 기본 방향

클라우드가 필수는 아닙니다.

`Mirage` 소프트코어 위주로 필터링하고, raw 보관 정책만 잘 잡으면 MacBook 로컬 운영도 충분히 현실적입니다.

### 권장 분리

로컬 운영 시 다음처럼 분리하는 편이 안전합니다.

- PostgreSQL: 독립 프로세스 또는 Docker 컨테이너
- collector: 별도 Node.js 프로세스
- 추후 가공/분석 작업: collector와 별도 프로세스

이유:

- collector 수정/재시작이 DB 안정성에 직접 영향 주지 않음
- 나중에 데이터 가공 작업이 추가되어도 역할 분리가 쉬움
- collector 장애와 DB 장애를 분리해서 볼 수 있음

### 현실적인 권장 구성

MacBook 한 대에서 운영한다면 다음 구성이 무난합니다.

1. PostgreSQL은 Docker Compose 또는 로컬 서비스로 독립 실행
2. collector는 `pm2`, `launchd`, `tmux` 같은 방식으로 별도 실행
3. 데이터 가공 스크립트는 collector와 분리해서 필요 시 수동/예약 실행

## 당장 다음으로 고려할 작업

1. collector를 `Mirage` 소프트코어만 저장하도록 좁히기
2. private league / SSF / ruthless / hardcore 제외 규칙 문서화
3. raw 저장 보관 정책 정하기
4. 장시간 로컬 수집 시 디스크/DB 증가량 추적하기
