# Screenshot Capture Checklist

- `screenshot_main_window.png`: Windows 설치판 기준 main window 전체. Auto Watch/Run Check/Recent Results가 보이면 좋음.
- `screenshot_run_check_ok.png`: Run Check 성공 상태. Node/Python/model bundle이 정상으로 보이는 화면.
- `screenshot_auto_watch_enabled.png`: Auto Watch가 켜진 상태. 가능하면 PoE1 `Ctrl+C` 후 자동 분석 대기/완료 상태 포함.
- `screenshot_floating_card_search_worthy.png`: search-worthy decision이 표시된 floating card.
- `screenshot_floating_card_high_value_or_manual_check.png`: high-value candidate 또는 manual check decision이 표시된 floating card.
- `screenshot_external_lookup_recommended.png`: currency/map/divination card 등 external price lookup recommendation 결과.
- `screenshot_parse_failed.png`: malformed input 또는 비정상 텍스트의 parse failed 결과.
- `screenshot_tray_menu.png`: Windows tray menu에서 main window 열기, floating card 표시/숨김, quit 메뉴가 보이는 화면.
- `screenshot_installed_app_start.png`: Windows installer로 설치한 앱을 시작한 직후 화면.
- `screenshot_release_page_or_installer_file.png`: GitHub release page 또는 installer 파일명/크기(`PoE1.Item.Value.Triage.Setup.0.1.0.exe`, 266 MB)가 보이는 화면.

## 캡처 조건

- 가능하면 Windows installed app에서 캡처한다.
- 실제 PoE1 client 화면 캡처가 가능하면 `Ctrl+C -> Auto Watch -> Floating Card` 흐름이 보이는 이미지를 `screenshot_auto_watch_enabled.png` 또는 별도 보조 이미지로 저장한다.
- `.env`, OAuth secret, access token, 개인 계정명 등 민감 정보가 보이면 반드시 가린다.
- 시간이 부족하면 실제 캡처 대신 이 checklist를 근거로 발표용 demo sample 화면을 우선 캡처한다.
