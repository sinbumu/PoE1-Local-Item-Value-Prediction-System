# Electron MVP Current Status

작성일: `2026-05-20`

이 문서는 최근 1~2주 동안 진행한 **Electron 기반 로컬 MVP 앱 개발 상태**를 최종 리포트/발표 논의용으로 정리한 것이다. 기존 `docs/ELECTRON_APP_MVP_PLAN.md`가 계획서라면, 이 문서는 현재 구현 상태와 테스트 결과, 남은 의사결정 사항을 공유하기 위한 현황 문서다.

## 1. 현재 목표

현재 Electron MVP 앱의 목표는 정확한 판매가를 숫자로 예측하는 것이 아니다. 목표는 다음에 가깝다.

> 사용자가 PoE1 영문 클라이언트에서 아이템을 `Ctrl+C`로 복사하면, 로컬 앱이 해당 아이템이 검색하거나 판매 시도할 가치가 있는지 빠르게 판단하도록 돕는다.

즉, 발표에서 보여줄 핵심 흐름은 다음이다.

```text
PoE1 Ctrl+C item text
-> Electron app
-> TypeScript clipboard parser
-> V2 mod-aware feature builder
-> Python CatBoost classifier
-> decision card 표시
```

앱이 표시하는 판단 라벨은 현재 다음 세 가지와 fallback 메시지로 구성된다.

| 출력 | 의미 |
| --- | --- |
| `low listed value` | 현재 모델 기준 검색 우선순위가 낮음 |
| `search-worthy` | 검색 또는 판매 시도 후보 |
| `high-value candidate` | 높은 점수의 후보, 직접 검색/가격 확인 권장 |
| `unsupported item type` | 현재 MVP 모델 지원 범위 밖 |

## 2. 최근 구현 사항

최근 작업의 중심은 기존 V2 모델 실험을 Electron 앱으로 연결하고, Windows 테스트가 가능한 형태로 정리하는 것이었다.

| 영역 | 구현/정리 내용 |
| --- | --- |
| Electron 앱 기본 구조 | `desktop/` 아래 Electron main/preload/renderer 구성 |
| 입력 방식 | clipboard read, manual paste, demo sample 로드 지원 |
| feature 생성 | `npm run v2:clipboard-features`를 통해 TypeScript parser + V2 feature builder 호출 |
| 모델 추론 | `ml/predict_item_value.py`를 Python subprocess로 호출 |
| 모델 파일 위치 | `desktop/models/v2_mvp/model.cbm`, `feature_schema.json`, `run_info.json` |
| 결과 UI | raw JSON 중심에서 decision card, score, threshold, recommendation, item summary 중심으로 개편 |
| 상세 정보 | raw prediction JSON, feature JSON, affix line은 `Technical Details` 안에 표시 |
| unsupported 처리 | skill gem, jewel, map, currency 등은 직접 검색 권장 fallback 표시 |
| 실행환경 진단 | 앱 내 `Run Check` 버튼 추가 |
| Windows setup | `desktop/scripts/setup-windows.ps1` 추가 |
| 문서 | `desktop/README.md`, 루트 `README.md`, 주간 리포트 갱신 |

## 3. 현재 앱 구성

주요 파일은 다음과 같다.

| 파일 | 역할 |
| --- | --- |
| `desktop/main.js` | Electron main process, IPC, subprocess 실행, 환경 진단 |
| `desktop/preload.js` | renderer에 안전한 IPC API 노출 |
| `desktop/renderer/index.html` | 앱 화면 구조 |
| `desktop/renderer/renderer.js` | UI 이벤트, 결과 카드 렌더링 |
| `desktop/renderer/styles.css` | 앱 스타일 |
| `desktop/models/v2_mvp/` | Git에 포함하는 MVP용 모델 파일 위치 |
| `desktop/scripts/setup-windows.ps1` | Windows 테스트용 setup/검증 스크립트 |
| `desktop/README.md` | 앱 실행 및 Windows 테스트 가이드 |

현재 앱은 installer나 패키징된 `.exe`가 아니라, 저장소를 pull한 뒤 `npm start`로 실행하는 MVP 형태다.

## 4. Windows 테스트 흐름

Windows에서는 환경 문제를 먼저 줄이기 위해 다음 흐름을 권장한다.

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\desktop\scripts\setup-windows.ps1
cd desktop
npm start
```

앱 실행 후에는 바로 `Analyze Item`을 누르기보다 `Run Check`를 먼저 누른다.

`Run Check`는 다음 항목을 확인한다.

| 항목 | 설명 |
| --- | --- |
| MVP model file | `desktop/models/v2_mvp/model.cbm` 존재 여부 |
| feature schema | `desktop/models/v2_mvp/feature_schema.json` 존재 여부 |
| npm | root TypeScript script 실행에 필요한 npm 사용 가능 여부 |
| Python executable | `ml/.venv` 또는 system Python 사용 가능 여부 |
| Python packages | `catboost`, `pandas` import 가능 여부 |
| feature builder | 샘플 아이템으로 `v2:clipboard-features` 실행 가능 여부 |

이 과정을 추가한 이유는 실제 Windows 테스트에서 다음 문제가 확인됐기 때문이다.

1. root `npm install`이 안 되어 `tsx`를 찾지 못함
2. Python venv가 없거나 Electron에서 Python 실행 파일을 찾지 못함
3. system Python에는 `catboost`가 설치되어 있지 않음
4. `model.cbm`이 없는 상태에서는 feature 생성 이후 예측 단계에서 실패함

## 5. 현재 지원 범위

현재 MVP 앱의 지원 범위는 의도적으로 좁게 잡았다.

지원:

- 영문 PoE1 클라이언트 `Ctrl+C` 텍스트
- rare equipment
- unique equipment
- demo sample 기반 fallback 시연
- parser warning / inference failure / unsupported item 메시지

지원하지 않음:

- 한국어 클라이언트 완전 지원
- skill gem / jewel / map / currency 예측
- 자동 클릭, 자동 판매, OCR, 화면 읽기
- 정확한 체결가 보장
- 상용 수준 installer / auto update

`skill gem` 샘플에서 `unsupported item type`이 뜨는 것은 현재 기준으로 버그가 아니다. 현재 V2 MVP 모델이 `rare_equipment`, `unique_equipment` 중심으로 구성되어 있어, 모델 범위 밖 아이템은 억지로 예측하지 않고 직접 검색 권장으로 보낸다.

## 6. 실제 테스트에서 확인한 이슈

### 6.1 Search-worthy가 너무 많이 뜨는 문제

실제 인게임 아이템 테스트에서 `search-worthy`로 분류되는 아이템이 너무 많다는 문제가 확인됐다. 체감상 실제로는 `1 chaos` 매물이 많고 판매 가능성이 낮은데, 앱이 검색 후보로 표시하는 경우가 많았다.

현재 원인 후보:

- V2 global classifier가 recall 우선으로 사용되고 있음
- 기본 threshold가 `0.40`이라 보수적이라기보다 넓게 잡는 설정임
- 학습 라벨은 listed price 기반이며 실제 판매/체결 데이터가 아님
- 매물 포화도, 최저가 경쟁, 실제 수요 없음 같은 시장 요소는 feature에 충분히 들어가 있지 않음

현재 해석:

- `search-worthy`는 “비싸게 팔릴 확정”이 아니라 “모델 score 기준 검색 후보”에 가깝다.
- 실사용 느낌에 맞추려면 앱 decision policy를 더 보수적으로 바꿔야 한다.

논의 후보:

| 방향 | 설명 |
| --- | --- |
| threshold 상향 | 기본값 `0.40`에서 `0.55~0.65` 정도로 조정 |
| 중간 라벨 추가 | `manual check` 또는 `uncertain` 구간 추가 |
| 라벨 문구 완화 | `search-worthy` 대신 `manual search candidate`처럼 표현 |
| 모델 재학습 | 더 높은 chaos 기준 또는 segment별 기준으로 classifier 재학습 |

발표용으로는 `0.40`이 recall 중심이라는 설명이 가능하지만, 실제 앱 시연에서는 너무 많은 false positive가 나오면 신뢰도가 떨어질 수 있다. 따라서 최종 데모 전에는 threshold 또는 결과 문구 조정이 필요하다.

### 6.2 실행환경 문제

초기 Windows 테스트에서는 Electron 앱 자체보다 실행환경 문제가 더 컸다.

- root `npm install` 누락
- Python venv 누락
- `catboost` 누락
- `model.cbm` 누락

이에 대응해 setup script와 `Run Check` 기능을 추가했다. 최종 발표 전에는 Windows PC에서 이 체크가 모두 `OK`인지 먼저 확인해야 한다.

### 6.3 Python subprocess 구조

현재 앱은 요청마다 TypeScript feature builder와 Python predictor를 subprocess로 실행한다. 이 구조는 제품형 앱으로는 비효율적일 수 있지만, MVP 단계에서는 구현 단순성과 디버깅 가능성이 장점이다.

현재 판단:

- feature builder 자체는 샘플 기준 약 `0.4s` 수준으로 확인됨
- 전체 예측이 반복적으로 `2~3s`를 넘으면 persistent Python worker 검토
- 지금은 worker보다 setup 안정성과 decision policy 조정이 우선

## 7. 최종 리포트/발표에서 보여줄 수 있는 포인트

발표에서 강조할 수 있는 포인트는 다음이다.

1. 데이터 수집/ETL/모델 학습이 앱 시연까지 연결되었다.
2. 단순 CSV 예측 실험이 아니라 실제 PoE `Ctrl+C` 텍스트를 입력으로 사용한다.
3. TypeScript parser와 Python CatBoost 모델을 Electron 앱에서 연결했다.
4. 모델 범위를 벗어난 아이템은 억지 예측하지 않고 `unsupported`로 처리한다.
5. Windows 환경 진단과 demo sample fallback을 넣어 발표 리스크를 줄였다.

발표 시 추천 시연 순서:

1. 앱 실행 후 `Run Check`가 모두 `OK`임을 보여준다.
2. demo sample rare equipment를 불러와 분석한다.
3. demo sample unique equipment를 불러와 분석한다.
4. skill gem sample을 넣어 `unsupported item type` fallback을 보여준다.
5. 가능하면 실제 PoE 영문 클라이언트에서 `Ctrl+C -> Read Clipboard -> Analyze Item` 흐름을 보여준다.

## 8. 현재 한계

현재 한계는 명확히 설명하는 편이 좋다.

- 모델은 실제 판매/체결 데이터가 아니라 listed price 기반이다.
- `search-worthy`가 너무 넓게 나올 수 있다.
- 현재 앱은 정확한 가격 산출기라기보다 triage 도구다.
- 한국어 클라이언트는 MVP 범위 밖이다.
- skill gem, jewel 등은 아직 별도 모델/정책이 없다.
- installer 형태 배포는 아직 하지 않았다.
- CatBoost/Python 환경은 Windows setup script로 준비해야 한다.

## 9. 다음 개발 방향 논의안

최종 발표 전 우선순위는 다음 순서가 적절하다.

### 1순위. Decision policy 보수화

실사용 테스트에서 false positive가 많으므로, 모델을 바로 다시 학습하기보다 앱의 decision policy를 먼저 조정한다.

후보:

```text
score < 0.50        -> low listed value
0.50 <= score < 0.65 -> manual check
score >= 0.65       -> search-worthy
score >= 0.85       -> high-value candidate
```

또는 기본 threshold를 `0.40`에서 `0.60`으로 올린다.

### 2순위. 발표용 샘플 고정

발표에서 사용할 rare/unique/unsupported 샘플을 3~5개로 고정한다. 실제 인게임 테스트는 환경 변수와 매물 상태에 따라 흔들릴 수 있으므로, demo sample fallback을 반드시 준비한다.

### 3순위. Windows 실행 안정화

Windows PC에서 다음을 최종 확인한다.

- `setup-windows.ps1` 성공
- 앱 `Run Check` 전부 `OK`
- demo sample 분석 성공
- 실제 PoE 영문 `Ctrl+C` 분석 성공

### 4순위. 모델 고도화는 발표 이후 또는 보조 실험

모델 자체를 고도화하려면 다음이 필요하다.

- 더 보수적인 라벨 기준 재정의
- segment별 classifier 또는 V1/V2 hybrid fallback
- 매물 포화도/최저가 경쟁/수요 없음 proxy feature 추가
- skill gem / jewel 전용 모델 또는 정책 추가

다만 최종 발표 직전에는 모델 재학습보다 앱 정책과 데모 안정화가 더 현실적이다.

## 10. 현재 결론

현재 Electron MVP 앱은 “작동하는 응용 산출물”로서의 골격은 갖췄다. 다만 실사용 관점에서는 `search-worthy`가 너무 넓게 나오는 문제가 있어, 최종 리포트/발표 전에는 **결과 문구와 threshold 정책을 보수적으로 정리하는 작업**이 필요하다.

현재 가장 적절한 방향은 다음이다.

1. 앱은 최종 발표의 핵심 시연물로 유지한다.
2. “정확한 가격 예측기”가 아니라 “검색 우선순위 triage 도구”로 설명한다.
3. skill gem 등 unsupported 처리는 의도된 안전장치로 설명한다.
4. Windows 실행은 `setup-windows.ps1` + `Run Check`를 공식 절차로 둔다.
5. 다음 개발은 모델 재학습보다 decision policy 조정과 발표 샘플 고정에 집중한다.
