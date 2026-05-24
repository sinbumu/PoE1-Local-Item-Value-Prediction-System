# Desktop App Final MVP Status

## 목적

이 문서는 2026-05-24 기준 Electron desktop 앱의 최종 MVP 상태를 정리한다. 최종 보고서, 발표 자료, 제출 전 점검, 후속 개발 계획 작성 시 이 문서를 기준으로 보면 된다.

## 한 줄 요약

Electron desktop 앱은 `Ctrl+C` clipboard auto watch, item type별 모델 라우팅, floating result card, Windows installer 배포까지 구현 및 기본 검증이 완료된 상태다.

## 현재 완료된 핵심 기능

### 1. 모델 라우팅

앱은 단일 모델에 모든 아이템을 넣지 않고, `desktop/models/v2_mvp/model_manifest.json` 기준으로 아이템 타입별 처리 경로를 선택한다.

| 아이템 유형 | 처리 |
| --- | --- |
| Rare equipment | V2 mod-aware classifier |
| Unique equipment | V2 mod-aware classifier |
| Jewel | V1 summary regressor |
| Skill gem | V1 summary regressor |
| Currency / Map / Divination card | External price lookup recommendation |
| Malformed PoE-like text | Parse failed fallback |

Decision label:

- `low listed value`
- `manual check`
- `search-worthy`
- `high-value candidate`
- `external price lookup recommended`
- `direct search recommended`
- `parse failed`

### 2. Desktop 모델 자동 배치

Mac 개발 환경에서 다음 명령으로 desktop 앱용 모델 번들을 생성한다.

```bash
npm run prepare:desktop-models -- --days=7
```

생성되는 주요 artifact:

```text
desktop/models/v2_mvp/model_manifest.json
desktop/models/v2_mvp/rare_unique_classifier/
desktop/models/v2_mvp/jewel_regressor/
desktop/models/v2_mvp/skill_gem_regressor/
```

Windows installer 빌드 시에는 이 완성된 모델 번들을 그대로 포함한다. Windows에서 모델 재학습은 기본 흐름이 아니다.

### 3. Clipboard Auto Watch

구현된 watcher 정책:

- `clipboard.readText()` polling
- polling interval `250ms`
- debounce `100ms`
- 동일 아이템 cooldown `2s`
- PoE item signature gate
- 일반 텍스트는 조용히 무시
- hash 기반 중복 분석 방지
- in-flight guard와 latest pending only 정책
- watcher 상태 리셋 버튼 제공

Windows 실제 테스트 중 clipboard 갱신이 일시적으로 꼬일 수 있는 상황을 고려해 `Reset Watch` 버튼을 추가했다. 이 버튼은 앱 재시작 없이 watcher 내부 hash/pending 상태를 초기화한다.

### 4. Floating Result Card

게임 중 결과를 빠르게 확인할 수 있도록 always-on-top floating card를 구현했다.

현재 기능:

- 분석 결과 자동 표시
- `Auto hide` / `Keep visible`
- opacity slider
- drag 이동
- 위치 저장
- position reset
- settings 영역 접기/펼치기
- decision별 배경색
- score 또는 predicted chaos 표시

Decision color 방향:

- `search-worthy`: blue
- `high-value candidate`: gold/brown
- `low listed value`: green
- `manual check`: yellow/brown
- fallback / parse failed: red

### 5. Tray 유틸리티 앱 동작

Windows 우하단 tray에서 앱을 다시 열 수 있도록 tray 동작을 추가했다.

동작:

- 메인 창 X 클릭: 앱 종료가 아니라 tray로 숨김
- tray 메뉴에서 main window 열기
- tray 메뉴에서 floating card 표시/숨김
- tray 메뉴에서 완전 종료
- 앱/tray/installer icon 교체 완료

이로써 일반 Windows utility app에 가까운 동작을 갖게 되었다.

### 6. Windows Installer

Windows installer 빌드 및 설치 후 실행 확인까지 완료했다.

구성:

- `electron-builder`
- NSIS installer
- app icon / installer icon 적용
- embedded Python runtime 포함 준비 구조
- `desktop/models/v2_mvp/` model bundle 포함
- root `dist/` 포함
- `ml/predict_desktop_item_value.py` 포함
- demo samples 포함

패키지 모드 경로:

```text
resources/dist/
resources/models/v2_mvp/
resources/ml/predict_desktop_item_value.py
resources/python/
resources/samples/clipboard/en/
```

설치판에서 발견된 모델 경로 문제도 수정했다. 기존 manifest가 `desktop/models/v2_mvp/...`를 가리켜 packaged resources에서 모델을 찾지 못하던 문제가 있었고, 현재는 manifest 위치 기준 상대 경로를 사용하도록 수정했다.

## 최근 Windows 테스트 중 발견 및 대응한 이슈

### 1. Floating card가 보이지 않거나 위치가 애매한 문제

가능 원인:

- 저장된 위치가 화면 밖
- opacity가 너무 낮음
- auto hide로 빠르게 숨김

대응:

- `Reset Floating Position` 추가
- floating card 자체에 `Reset Pos` 추가
- opacity 조절 제공
- `Keep visible` 모드 제공

### 2. 메인 창을 닫으면 floating만 남는 문제

기존 문제:

- 메인 창을 닫으면 floating card만 남고 main window를 다시 열 방법이 부족했다.

대응:

- tray menu 추가
- main window close 시 tray로 hide
- tray에서 main window 재오픈 가능
- tray에서 floating show/hide 가능
- tray에서 Quit 가능

### 3. Windows 한글 recommendation 깨짐

가능 원인:

- Python subprocess stdout/stderr encoding
- Windows console code page

대응:

- Node subprocess env에 `PYTHONIOENCODING=utf-8`, `PYTHONUTF8=1` 지정
- Python predictor에서 stdout/stderr UTF-8 reconfigure

### 4. Installer 설치판 모델 파일 없음 fallback

기존 문제:

```text
이 아이템 타입의 로컬 모델 파일이 없습니다. 거래소 직접 검색을 권장합니다.
```

원인:

- packaged app의 실제 model 위치는 `resources/models/v2_mvp/...`
- 기존 manifest는 `desktop/models/v2_mvp/...`를 가리킴

대응:

- manifest를 `jewel_regressor/model.cbm`처럼 manifest-relative path로 변경
- predictor가 기존 `desktop/models/v2_mvp/...` 경로도 호환 처리하도록 보강

### 5. Floating card 하단 controls 잘림

대응:

- floating window height 증가
- grid layout 적용
- settings controls 접기 기능 추가

## 현재 검증된 사항

검증된 항목:

- Mac 개발 환경에서 모델 준비
- `prepare:desktop-models` 실행 및 모델 bundle 생성
- rare/jewel/skill gem routed prediction
- external lookup / parse failed route
- Windows `npm start` 개발모드 실행
- Windows 실제 사용 중 auto watch 기본 동작
- floating card 표시/조작
- tray 동작
- Windows installer 생성
- installer 설치 후 앱 실행
- installer 설치판에서 모델 경로 문제 수정 후 검증 필요

최신 수정 이후 다시 확인하면 좋은 항목:

1. installer 재빌드
2. 설치판에서 rare/jewel/skill gem 모델 예측 확인
3. tray icon / app icon 확인
4. floating card controls 잘림 여부 확인
5. 한글 recommendation 표시 확인
6. Reset Watch 동작 확인

## 발표용 추천 시연 흐름

1. 앱 실행
2. `Run Check`
3. Demo sample로 전체 routing 확인
   - `rare-equipment-001`
   - `normal-jewel-001`
   - `skill-gem-001`
   - `currency-001`
   - `parse-failure-001`
4. 실제 PoE1 클라이언트에서 아이템 `Ctrl+C`
5. floating card가 자동으로 업데이트되는 모습 시연
6. tray로 숨겼다가 다시 여는 utility app 동작 시연

## 최종 MVP 판단

현재 상태는 최종 제출용 MVP로 충분한 수준이다. 추가 기능 개발보다는 다음 작업이 더 중요하다.

- 최종 smoke test 결과 캡처
- README와 보고서 반영
- commit 대상 정리
- installer 파일 보관
- 발표용 시연 순서 확정

추가 개발을 한다면 기능 확장보다는 안정화가 우선이다.

가능한 후속 개선:

- demo sample validation script
- Recent Results 클릭 시 상세 복원
- compact floating card preset
- external lookup URL 연동
- debug logging mode

## 최종 결론

Electron desktop 앱은 초기 수동 분석 MVP에서 실제 Windows utility app 형태로 발전했다. 모델 라우팅, auto watch, floating UI, tray, installer까지 갖추었고, 최종 발표/제출 전에는 기능 추가보다 Windows smoke test와 문서 정리를 우선하는 것이 적절하다.
