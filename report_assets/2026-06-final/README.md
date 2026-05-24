# Final Report Assets for Chapters 7-9

생성 시각: `2026-05-24T14:26:17.639184+00:00`  
기준 commit: `fd4d81a`  
release tag: `미지정`  
installer filename: `추가 확인 필요: Windows build machine의 desktop/release/ 산출물명 기입`

## 목적

이 asset 묶음은 최종 보고서 제7장, 제8장, 제9장 작성을 위해 desktop app 구현 근거, 표, 도식, 스크린샷 체크리스트, 문장 초안을 제공한다.

## 사용 가이드

- 제7장 로컬 보조 애플리케이션 설계 및 구현:
  - `chapter7/table_desktop_requirements.*`
  - `chapter7/table_desktop_components.*`
  - `chapter7/table_item_routing_current.*`
  - `chapter7/table_decision_labels.*`
  - `chapter7/table_packaging_structure.*`
  - `figures/figure_desktop_app_flow.png`
  - `figures/figure_model_routing_layer.png`
  - `figures/figure_packaged_app_runtime_layout.png`

- 제8장 통합 실행 결과 및 고찰:
  - `chapter8/table_windows_smoke_test.*`
  - `chapter8/table_demo_scenarios.*`
  - `chapter8/table_release_installer_summary.*`
  - `chapter8/table_app_known_issues.*`
  - `chapter8/table_prediction_latency_summary.*`
  - `chapter8/table_model_bundle_manifest.*`
  - `figures/figure_end_to_end_demo_sequence.png`
  - `screenshots/screenshot_capture_checklist.md`

- 제9장 결론 및 향후 과제:
  - `FINAL_REPORT_CH7_8_9_HANDOFF.md`
  - `appendix/glossary_app_terms.md`
  - `appendix/table_reference_documents.*`

## 검증 완료/미완료 요약

### 검증 완료

- rare/jewel/skill gem model route CLI 검증
- currency/map/divination card external lookup route 검증
- parse failure route 검증
- Windows development mode 기본 동작 사용자 확인
- Windows installer 설치판 실행 사용자 확인
- Windows installer 설치판 모델 예측 정상 동작 사용자 확인

### 부분 검증

- 실제 PoE1 `Ctrl+C` auto watch: 기본 동작 확인, 장시간 안정성 추가 확인 권장
- floating card fullscreen behavior: 환경별 추가 확인 권장

### 미완료 / 추가 확인 필요

- 최종 installer 파일명과 크기
- release tag
- 보고서에 넣을 실제 screenshot PNG
- 정량 latency 측정표

## 주의

- OAuth secret, access token, `.env` 내용은 포함하지 않았다.
- raw log 원문은 포함하지 않고 요약표만 작성했다.
- 실제 검증하지 않은 항목은 `부분 검증`, `미기록`, `추가 확인 필요`, `N/A`로 표시했다.
- 앱의 판단은 정확한 실제 판매가 예측이 아니라 listed price 기반 검색/판매 시도 우선순위 판단이다.
