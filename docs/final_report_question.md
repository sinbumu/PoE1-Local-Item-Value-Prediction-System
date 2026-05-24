최종 보고서 제7장~제9장 작성을 위해 저장소 기준 최신 desktop app 산출물과 검증 자료를 정리해 주세요.

목표:
- 보고서 작성 담당자가 제7장 로컬 보조 애플리케이션 설계 및 구현, 제8장 통합 실행 결과 및 고찰, 제9장 결론 및 향후 과제를 작성할 수 있도록 실제 구현 근거와 표/그림/스크린샷/검증 결과를 제공한다.
- 새 기능 개발이 아니라, 현재 구현 상태를 보고서에 넣을 수 있게 정리하는 것이 목적이다.
- 과장 금지. 실제 검증되지 않은 항목은 “미검증” 또는 “추가 확인 필요”로 명시한다.

참고해야 할 현재 문서:
- docs/DESKTOP_APP_FINAL_MVP_STATUS_2026-05-24.md
- desktop/README.md
- README.md
- docs/README.md
- docs/MODEL_SCOPE.md
- docs/TRAINING_FEATURES.md
- docs/TRAINING_BASELINE_REPORT_2026-04-19.md
- docs/TRAINING_FEATURE_IMPORTANCE_SUMMARY_2026-04-23.md
- docs/REPORT_HANDOFF.md

생성 위치:
report_assets/2026-06-final/
또는 현재 날짜 기준 report_assets/<date>/ 아래에 생성

필수 생성물:

1. README.md
- 이번 report asset 묶음의 목적
- 어떤 파일을 어느 장에서 쓰면 되는지 설명
- 검증 완료/미완료 항목 요약

2. manifest.json
- 생성된 모든 표/그림/스크린샷 파일 목록
- 각 파일의 설명
- 추천 삽입 장/절
- 생성 시각
- 사용한 commit hash
- release tag 또는 installer 파일명, 있으면 포함

3. captions.md
- 보고서에 바로 붙일 수 있는 한국어 그림/표 캡션
- 예:
  - 그림 7-1 Electron 앱 전체 동작 흐름
  - 표 7-1 Desktop 앱 구성 요소
  - 표 8-1 최종 MVP smoke test 결과

4. chapter7 자료
폴더:
report_assets/<date>/chapter7/

필수 표:
- table_desktop_requirements.csv / .md
  - 요구사항, 구현 여부, 비고
  - 예: Ctrl+C 입력, Auto Watch, Signature Gate, Model Routing, Floating Card, Tray, Installer
- table_desktop_components.csv / .md
  - 구성 요소, 역할, 관련 파일
  - 예: Electron main, preload, renderer, feature builder, Python predictor, model manifest
- table_item_routing_current.csv / .md
  - 아이템 유형별 처리 방식
  - rare equipment: V2 mod-aware classifier
  - unique equipment: V2 mod-aware classifier
  - jewel: V1 summary regressor
  - skill gem: V1 summary regressor
  - currency/map/divination card: external price lookup recommendation
  - malformed input: parse failed fallback
- table_decision_labels.csv / .md
  - decision label, 의미, 사용자 안내 문구
  - low listed value, manual check, search-worthy, high-value candidate, external price lookup recommended, direct search recommended, parse failed
- table_packaging_structure.csv / .md
  - packaged resources 구조
  - resources/dist, resources/models/v2_mvp, resources/ml, resources/python, resources/samples 등

필수 그림/도식:
- figure_desktop_app_flow.png
  - PoE Ctrl+C → Clipboard Auto Watch → Signature Gate → Feature Builder → Model Manifest Router → Model/Fallback → Decision Card → Floating Card
- figure_model_routing_layer.png
  - item type별 routing 도식
- figure_packaged_app_runtime_layout.png
  - installer/resource 구조 도식

필수 스크린샷:
- screenshot_main_window.png
- screenshot_run_check_ok.png
- screenshot_floating_card_search_worthy.png
- screenshot_floating_card_low_or_manual.png
- screenshot_tray_menu.png
- screenshot_settings_or_technical_details.png

스크린샷이 자동 생성이 어렵다면, 어떤 화면을 캡처해야 하는지 checklist 파일을 만들고 placeholder 파일명을 정리해 주세요.

5. chapter8 자료
폴더:
report_assets/<date>/chapter8/

필수 표:
- table_windows_smoke_test.csv / .md
  - 항목, 결과, 환경, 비고
  - Windows dev mode 실행
  - Run Check
  - demo sample rare
  - demo sample unique
  - demo sample jewel
  - demo sample skill gem
  - currency external lookup route
  - parse failed route
  - actual PoE1 Ctrl+C
  - floating card
  - tray restore
  - installer installed app launch
  - installed app model prediction
- table_demo_scenarios.csv / .md
  - 시연 샘플 ID, 아이템 유형, 예상 routing, 실제 decision, 비고
- table_release_installer_summary.csv / .md
  - release tag, installer filename, installer size, commit hash, build environment, known issues
- table_app_known_issues.csv / .md
  - 이슈, 영향, 대응 상태
  - 예: listed price label limitation, floating card fullscreen issue, embedded Python size, external lookup recommendation only 등
- table_prediction_latency_summary.csv / .md
  - 가능하면 demo sample별 feature generation ms, prediction ms, total ms
  - 측정하지 못했으면 N/A로 두고 측정 불가 사유 작성
- table_model_bundle_manifest.csv / .md
  - model_manifest.json 기준 모델 번들 목록
  - rare/unique classifier, jewel regressor, skill gem regressor

필수 그림/스크린샷:
- screenshot_demo_rare_result.png
- screenshot_demo_unique_result.png
- screenshot_demo_jewel_result.png
- screenshot_demo_skill_gem_result.png
- screenshot_external_lookup_result.png
- screenshot_parse_failed_result.png
- figure_end_to_end_demo_sequence.png

6. appendix 자료
폴더:
report_assets/<date>/appendix/

필수:
- table_release_artifact_manifest.csv / .md
- table_environment_check_details.csv / .md
- table_demo_sample_inventory.csv / .md
- table_reference_documents.csv / .md
- glossary_app_terms.md
  - Auto Watch
  - Signature Gate
  - Model Manifest Router
  - Floating Result Card
  - External Lookup Recommendation
  - Listed Price
  - Search-worthy
  - High-value Candidate

7. report writing handoff
파일:
report_assets/<date>/FINAL_REPORT_CH7_8_9_HANDOFF.md

내용:
- 제7장에 넣을 핵심 문장 초안
- 제8장에 넣을 핵심 문장 초안
- 제9장에 넣을 핵심 문장 초안
- 현재 상태에서 안전하게 주장 가능한 문장
- 아직 주장하면 안 되는 문장
- 최종 보고서에서 반드시 명시해야 할 한계

반드시 구분할 것:
- 검증 완료
- 부분 검증
- 미검증
- 발표용 demo fallback

주의사항:
- GGG OAuth secret, access token, 개인 정보, .env 내용은 절대 포함하지 말 것.
- raw log 전체를 대량 첨부하지 말고 요약표로 정리할 것.
- 실제 검증하지 않은 항목을 완료로 쓰지 말 것.
- “정확한 실제 판매가 예측”이라는 표현을 쓰지 말 것.
- “listing price 기반 검색/판매 시도 우선순위 판단”으로 표현할 것.
- 내부 구현 경로는 본문용 표에서는 간단히 쓰고, 자세한 경로는 manifest나 부록용 표에 넣을 것.

최종적으로 보고서 작성 담당자가 아래 내용을 바로 쓸 수 있어야 함:
- 7장: 앱 요구사항, 구조, routing, Auto Watch, Floating Card, Installer 구현 설명
- 8장: 통합 실행 결과, demo scenario, smoke test, 앱 한계와 고찰
- 9장: 프로젝트 요약, 의의, 한계, 향후 개선 방향