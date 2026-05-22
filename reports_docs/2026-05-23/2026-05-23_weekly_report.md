# 2026-05-23 주간 리포트

## 1. 이번 주 목표

이번 주 작업의 핵심 목표는 기존 Electron MVP를 발표 가능한 로컬 유틸리티 형태로 확장하는 것이었다. 기존 앱은 `rare_equipment`, `unique_equipment` 중심의 V2 classifier를 수동 입력으로 호출하는 구조였으나, 이번 주에는 다음 범위를 추가했다.

- `jewel`, `skill_gem`까지 desktop 앱 판단 대상으로 확장
- ETL 이후 학습부터 desktop 모델 배치까지 자동화
- `Ctrl+C` clipboard auto watch 구현
- always-on-top floating result card 구현
- 발표용 demo sample/fallback 경로 정리
- 최종 제출용 Windows installer 가능성을 검토하고 패키징 준비 구조 구현

## 2. 주요 구현 결과

### 2.1 Desktop 모델 라우팅 확장

Electron 앱이 하나의 모델에 모든 아이템을 넣는 방식에서 벗어나 `model_manifest.json` 기반 라우팅 구조로 변경되었다.

현재 라우팅 기준:

- `rare_equipment`, `unique_equipment`: V2 mod-aware classifier
- `jewel`: V1 summary regressor
- `skill_gem`: V1 summary regressor
- `currency`, `map`, `fragment`, `divination card` 등: `external price lookup recommended`
- 구조를 파악하기 어려운 텍스트: `parse failed`

이를 위해 `desktop/models/v2_mvp/model_manifest.json`을 중심으로 모델 종류, feature set, schema, run info, decision policy를 관리하도록 했다.

### 2.2 모델 학습/배치 자동화

`npm run prepare:desktop-models` 명령을 추가하여 ETL 이후 desktop 앱용 모델 번들을 한 번에 만들 수 있게 했다.

자동화 범위:

1. V2 rare/unique staging
2. V2 classifier 학습
3. V1 jewel/skill_gem staging
4. V1 segment regressor 학습
5. `desktop/models/v2_mvp/`로 모델/스키마/run info 복사
6. `model_manifest.json` 생성

실행 후 다음 모델 경로가 생성되고 실제 라우팅 예측까지 확인했다.

```text
desktop/models/v2_mvp/rare_unique_classifier/
desktop/models/v2_mvp/jewel_regressor/
desktop/models/v2_mvp/skill_gem_regressor/
```

검증 결과 예시:

- rare 장비: `rare_unique_classifier` 사용, `search-worthy`
- jewel: `jewel_regressor` 사용, 약 `76.6 chaos`, `search-worthy`
- skill gem: `skill_gem_regressor` 사용, 약 `25.2 chaos`, `manual check`

### 2.3 Clipboard-safe V1 feature builder

`jewel`, `skill_gem` 회귀 모델은 기존 V2 mod-aware feature가 아니라 V1 summary feature를 기대하므로, clipboard text에서 V1 summary feature를 만들 수 있는 adapter를 추가했다.

추가된 핵심 파일:

- `src/services/clipboard-v1-summary-feature-builder.service.ts`
- `src/services/desktop-feature-payload.service.ts`
- `src/scripts/build-desktop-features-from-clipboard.ts`

이제 desktop feature payload는 V1/V2 feature set을 모두 포함한다.

```text
featureSets.v1_summary
featureSets.v2_mod_aware
```

Python predictor는 manifest의 `featureSet`에 따라 필요한 feature set을 선택한다.

### 2.4 통합 Python predictor

기존 classifier 전용 predictor와 별도로 desktop 앱용 통합 predictor를 추가했다.

- 파일: `ml/predict_desktop_item_value.py`
- classifier: probability score 반환
- regressor: `target_price_log1p` 예측 후 chaos 값으로 환산
- fallback: external lookup / direct search / parse failed 처리

Decision policy는 보수적으로 조정했다.

Classifier:

```text
score < 0.50          -> low listed value
0.50 <= score < 0.70  -> manual check
0.70 <= score < 0.88  -> search-worthy
score >= 0.88         -> high-value candidate
```

Regressor:

```text
predicted chaos < 5   -> low listed value
5 <= chaos < 30       -> manual check
30 <= chaos < 300     -> search-worthy
>= 300                -> high-value candidate
```

## 3. Electron 앱 기능 확장

### 3.1 Clipboard Auto Watch

앱에 polling 기반 clipboard watcher를 추가했다.

구현 내용:

- `Auto Watch Clipboard` ON/OFF
- 기본 polling interval: `700ms`
- PoE item signature gate
- 일반 텍스트는 조용히 무시
- clipboard hash 기반 중복 분석 방지
- `250ms` debounce
- 동일 아이템 `2초` cooldown
- 분석 중 새 아이템이 들어오면 latest pending 하나만 유지

맥 환경에서 메모장/샘플 기준으로 auto watch 기능이 동작하는 것을 간단히 확인했다.

### 3.2 Floating result card

분석 결과를 게임 위에서 빠르게 볼 수 있도록 always-on-top floating card를 추가했다.

기능:

- 결과 완료 시 작은 floating card 표시
- `Auto hide` / `Keep visible` 선택
- 투명도 `25% ~ 100%` 조절
- 상단 바 drag로 위치 이동
- 이동 위치 저장
- card 자체에서 mode/opacity/hide 조작 가능

맥 환경에서 간단한 UI 동작은 확인되었다.

### 3.3 Demo sample 안정화

발표 중 실제 게임/클립보드 환경이 흔들릴 때를 대비하여 demo sample 범위를 확장했다.

추천 발표 샘플:

- `rare-equipment-001`: rare equipment classifier route
- `unique-equipment-001`: unique equipment classifier route
- `normal-jewel-001`: jewel regressor route
- `skill-gem-001`: skill gem regressor route
- `currency-001`: external price lookup route
- `map-001`: external price lookup route
- `divination-card-001`: external price lookup route
- `parse-failure-001`: parse failed fallback route

CLI 검증 결과 `currency`, `map`, `divination card`는 `external price lookup recommended`, malformed sample은 `parse failed`로 정상 처리되었다.

## 4. Windows installer 패키징 준비

최종 제출 시점에는 사용자가 Node.js/Python을 따로 설치하지 않아도 실행할 수 있는 Windows installer를 목표로 설정했다.

이번 주 구현한 준비 작업:

- `electron-builder` 도입
- Windows NSIS installer target 설정
- `desktop/vendor/python-win/` embedded Python runtime 준비 스크립트 추가
- packaged mode에서 `process.resourcesPath` 기준으로 모델/스크립트/Python 경로를 해석하도록 변경
- packaged mode에서 `npm run desktop:clipboard-features`를 호출하지 않도록 feature builder를 build된 JS 모듈로 직접 호출하는 구조 추가
- packaging prerequisite check 스크립트 추가

중요한 구조 변화:

```text
개발 모드:
repo root + npm/tsx + ml/.venv 또는 system python

패키지 모드:
resources/dist + resources/models + resources/ml + resources/python
```

현재 macOS 환경에서는 실제 Windows installer 생성/설치 테스트는 수행하지 못했다. Windows 환경에서 다음 두 가지가 남아 있다.

1. `npm run dist:win`으로 실제 installer 생성
2. 설치 후 PoE1 클라이언트에서 `Ctrl+C` auto watch 및 floating card 동작 검증

## 5. 검증한 항목

이번 주 로컬에서 수행한 주요 검증:

- `npm run typecheck`
- `npm run build`
- Electron JavaScript syntax check
- Python script syntax check
- rare/jewel/skill_gem routed prediction
- currency/map/divination card external lookup route
- parse failure route
- desktop feature builder CLI
- build된 `dist/services/desktop-feature-payload.service.js` 직접 호출
- packaging prerequisite script 동작 확인

확인된 정상 결과:

- rare item은 새 `rare_unique_classifier` 경로를 사용
- jewel/skill gem은 fallback이 아니라 regressor 모델을 사용
- external price 대상은 unsupported가 아니라 external lookup으로 표시
- parse failure sample은 parse failed로 표시

## 6. 남은 작업

가장 중요한 남은 작업은 Windows 실제 환경 검증이다.

우선순위:

1. Windows에서 embedded Python 준비
   - `desktop/scripts/prepare-embedded-python.ps1`
   - `catboost`, `pandas`, `numpy` import 확인
2. Windows installer 빌드
   - `cd desktop`
   - `npm run verify:package-prereqs`
   - `npm run dist:win`
3. 설치 후 app `Run Check` 확인
4. demo sample 전체 확인
5. 실제 PoE1 클라이언트에서 `Ctrl+C` auto watch 확인
6. floating card가 게임 위에서 항상 위에 뜨는지 확인
7. Windows에서 Python subprocess 경로와 packaged resources 경로 문제 확인

## 7. 현재 상태 요약

이번 주 결과로 Electron 앱은 단순 수동 분석 도구에서 실제 로컬 유틸리티에 가까운 형태로 확장되었다. 모델 라우팅, 자동 감지, floating UI, fallback 샘플, installer 준비까지 주요 기능은 구현되었고, 남은 리스크는 Windows 실제 실행 환경에서의 패키징/클립보드/always-on-top 동작 검증이다.

보고서나 발표에서는 다음 메시지를 강조할 수 있다.

- 단일 가격 예측기가 아니라 item type별로 모델과 fallback을 선택하는 routing system이다.
- 게임 자동화가 아니라 사용자가 복사한 clipboard text를 읽는 보조 유틸리티다.
- listed price 기반 판단이므로 실제 체결가 보장은 아니며, 검색/판매 우선순위를 빠르게 판단하는 도구다.
- 최종 제출을 위해 installer 배포까지 고려한 구조로 발전했다.
