# 2026-06-05 최종 주간 리포트

## 1. 이번 주 목표

이번 주의 목표는 추가 기능 개발이나 신규 모델 실험이 아니라, 최종 발표 전 저장소 상태를 정리하고 실제 제출/발표에 사용할 근거 자료를 확정하는 것이었다.

이번 주 작업의 성격은 다음과 같다.

- Windows installer 기반 최종 desktop MVP 상태 확인
- 최종 보고서 제7장~제9장 작성에 필요한 asset 정리
- screenshot checklist, release 정보, decision policy 근거 표 보완
- 마지막 training ETL 실행 상태 확인
- 차주 최종 발표 전 추가 데이터 수집과 신규 개발을 중단하고 프로젝트 상태를 동결

## 2. 최종 산출물 상태

### 2.1 Electron desktop MVP

최종 발표 대상 desktop 앱은 단순 CLI 실험이 아니라 Windows에서 실행 가능한 로컬 보조 유틸리티 형태까지 정리되었다.

현재 핵심 기능:

- PoE1 영문 `Ctrl+C` clipboard text 입력
- Clipboard Auto Watch
- PoE item signature gate
- item type별 model manifest routing
- rare/unique equipment용 V2 mod-aware classifier
- jewel/skill gem용 V1 summary regressor
- currency/map/divination card 등 external price lookup recommendation
- parse failed fallback
- always-on-top floating result card
- tray restore/quit
- Windows NSIS installer
- embedded Python runtime 및 model bundle 포함 구조

최종 앱은 “정확한 실제 판매가 예측기”가 아니라, 공개 listed price 기반으로 검색/판매 시도 우선순위를 빠르게 판단하는 local triage utility로 정리했다.

### 2.2 Release 정보

최종 보고서 asset에는 release 정보를 다음과 같이 반영했다.

| 항목 | 값 |
| --- | --- |
| release tag | `desktop-v0.1.0` |
| installer | `PoE1.Item.Value.Triage.Setup.0.1.0.exe` |
| installer size | `266 MB` |
| release commit | `8a82b4c9cad68ec5173896d60bdbfdef409921ba` |
| release URI | `https://github.com/sinbumu/PoE1-Local-Item-Value-Prediction-System/releases/tag/desktop-v0.1.0` |

Windows installer 설치 후 앱 실행 및 모델 예측 정상 동작까지 확인된 상태로 보고서 asset에 반영했다.

## 3. 최종 보고서 자료 정리

최종 보고서용 자료는 `report_assets/2026-06-final/` 아래에 정리했다.

주요 파일:

- `README.md`: asset 묶음 사용 가이드와 검증 상태 요약
- `manifest.json`: 생성 asset 목록, release 정보, screenshot placeholder 상태
- `captions.md`: 그림/표 캡션
- `FINAL_REPORT_CH7_8_9_HANDOFF.md`: 제7장~제9장 작성용 핵심 문장과 한계
- `chapter7/table_decision_policy_mapping.md`: 모델 출력값과 decision label 변환 정책
- `chapter8/table_windows_smoke_test.md`: 최종 smoke test 상태
- `references/domain_data_limitations.md`: Public Stash API와 listed price label 한계 설명
- `screenshots/screenshot_capture_checklist.md`: 최종 보고서용 screenshot 목록

보고서에서 반드시 유지해야 할 표현도 정리했다.

- 사용 가능: “listed price 기반 검색/판매 시도 우선순위 판단”
- 피해야 함: “정확한 실제 판매가 예측”, “체결가 예측”, “자동 가격 확정”

## 4. 마지막 ETL 실행 상태

최종 발표 전 마지막으로 실행한 training ETL은 정상 종료되었다.

실행 명령:

```bash
npm run etl:training-- --since-hours=168 --limit=10000 --max-batches-per-stage=1
```

마지막 로그 기준 처리 결과:

| 항목 | 값 |
| --- | ---: |
| cycles | `480` |
| raw processed rows | `4,795,715` |
| clean processed rows | `4,795,715` |
| clean kept rows | `3,400,585` |
| clean dropped rows | `1,395,130` |
| labeled processed rows | `3,400,585` |
| raw reached end | `true` |
| clean reached end | `true` |
| labeled reached end | `true` |

최종 cursor:

| stage | updatedAt | listingKey |
| --- | --- | --- |
| raw | `2026-06-05 08:26:17.886824+00` | `ba2e9a7d681894472a73690841bd9b5febd8390777cfc502a7146214fd321b1a` |
| clean | `2026-06-05 08:26:17.886824+00` | `ba2e9a7d681894472a73690841bd9b5febd8390777cfc502a7146214fd321b1a` |
| labeled | `2026-06-05 08:26:17.86907+00` | `5797d2007c2a8669bcbc752b25fa217facca508217a491e6c18330b3762c3190` |

이 실행은 `rawReachedEnd=true`, `cleanReachedEnd=true`, `labeledReachedEnd=true`로 종료되었으므로, 지정한 최근 168시간 범위의 training ETL은 마지막 cursor까지 따라간 상태로 볼 수 있다.

## 5. 현재 검증 상태

검증 완료로 정리한 항목:

- Windows development mode 기본 동작
- Windows installer 설치판 실행
- 설치판에서 model path 문제 수정 후 모델 예측 정상 동작
- rare/jewel/skill gem model route
- currency/map/divination card external lookup route
- malformed input parse failed route
- floating card 표시/이동/reset 개선
- tray 기반 utility app 동작 구현
- release metadata 반영

부분 검증 또는 보고서에서 보수적으로 표현할 항목:

- 실제 PoE1 `Ctrl+C -> Auto Watch -> Floating Card` 장시간 안정성
- exclusive fullscreen 환경에서 floating card always-on-top 동작
- demo unique sample 최종 screenshot
- tray menu screenshot
- latency 정량 측정

정량 latency는 보고서 asset에서 `N/A`로 유지했다. 앱 내부에서 timing을 볼 수 있는 구조는 있으나, 최종 보고서에 넣을 정도로 동일 환경에서 반복 측정한 수치가 없기 때문이다.

## 6. 이번 주 결정 사항

차주가 최종 발표이므로, 저장소는 여기서 기능적으로 동결한다.

더 진행하지 않기로 한 항목:

- 신규 데이터 수집 확대
- 신규 모델 구조 실험
- item type 추가 확장
- Korean client 지원
- OCR/screen reading
- 자동 클릭/자동 판매
- 실제 판매 체결가 예측 주장

이후 작업은 코드 변경보다 발표/보고서 보강에 한정한다.

필요하면 남은 작업:

1. `report_assets/2026-06-final/screenshots/` 아래 screenshot 파일 채우기
2. 최종 발표 슬라이드에 release URI와 installer 정보를 반영
3. 보고서에서 listed price 한계를 명시
4. 실제 demo가 흔들릴 경우 `samples/clipboard/en/` 기반 fallback 시연 사용

## 7. 현재 상태 요약

이번 주 기준 프로젝트는 데이터 수집, ETL, 모델 학습, desktop 앱 구현, Windows installer 배포, 보고서 asset 정리까지 연결된 최종 발표 준비 상태다.

마지막 ETL은 정상 종료되었고, 현재 추가 데이터 수집은 중단해도 되는 상태로 판단한다. 남은 핵심 작업은 저장소 개발이 아니라 최종 보고서와 발표 자료에 구현 근거를 정확히 반영하는 것이다.

최종 발표에서는 다음 메시지를 중심으로 설명하는 것이 적절하다.

- Public listing data를 기반으로 한 local item value triage system이다.
- 실제 체결가 예측이 아니라 검색/판매 시도 우선순위 판단이다.
- item type별로 classifier, regressor, external lookup, parse failed fallback을 선택하는 routing system이다.
- 최종 산출물은 Windows installer로 실행 가능한 Electron desktop utility다.
