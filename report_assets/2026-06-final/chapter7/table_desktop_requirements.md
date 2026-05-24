| 요구사항 | 구현 여부 | 근거/관련 기능 | 비고 |
| --- | --- | --- | --- |
| PoE1 Ctrl+C 입력 | 구현 완료 | Electron clipboard read 및 manual paste | 영문 클라이언트 기준 |
| Auto Watch Clipboard | 구현 완료 | 250ms polling, 100ms debounce, hash dedupe | 실제 Windows/PoE 테스트 기본 동작 확인 |
| Signature Gate | 구현 완료 | Rarity/구분선/Item Class 등 PoE 텍스트 후보 검사 | 일반 텍스트는 조용히 무시 |
| Model Routing | 구현 완료 | model_manifest.json 기반 item type route | 모든 입력을 단일 모델에 넣지 않음 |
| Rare/Unique classifier | 구현 완료 | V2 mod-aware CatBoost classifier | listed price 기반 search-worthy classifier |
| Jewel/Skill gem regressor | 구현 완료 | V1 summary CatBoost regressor | chaos 환산값 기반 decision |
| External lookup fallback | 구현 완료 | currency/map/divination card route | 외부 시세 조회 권장 |
| Floating Result Card | 구현 완료 | always-on-top, opacity, drag, reset position | fullscreen 환경은 추가 확인 권장 |
| Tray Utility 동작 | 구현 완료 | 닫기 시 tray hide, tray restore/quit | Windows utility 앱 형태 |
| Windows Installer | 검증 완료 | electron-builder NSIS + embedded Python 구조 | 설치판 실행 및 모델 예측 정상 동작 사용자 확인 |
