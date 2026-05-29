# Captions

## Figures

- 그림 7-1 Electron desktop 앱의 end-to-end 실행 흐름. PoE1 `Ctrl+C` 텍스트가 clipboard watcher, signature gate, feature builder, manifest router를 거쳐 model 또는 fallback decision으로 표시되는 과정을 나타낸다.
- 그림 7-2 Desktop 앱의 model manifest routing layer. 아이템 유형에 따라 V2 classifier, V1 regressor, external lookup, parse failed fallback으로 분기된다.
- 그림 7-3 Windows installer로 배포된 packaged app의 runtime resource layout. 설치판은 `resources/dist`, `resources/models`, `resources/ml`, `resources/python`을 사용해 Node.js/Python 별도 설치 없이 추론을 수행한다.
- 그림 8-1 최종 demo sequence. 앱 실행, 환경 점검, demo 또는 실제 `Ctrl+C`, auto watch 분석, floating card 표시, tray fallback 흐름을 요약한다.

## Tables

- 표 7-1 Desktop 앱 요구사항과 구현 여부.
- 표 7-2 Desktop 앱 구성 요소와 관련 파일.
- 표 7-3 현재 item type별 routing 정책.
- 표 7-4 Decision label의 의미와 사용자 안내 문구.
- 표 7-5 Windows packaged app resource 구조.
- 표 7-6 모델 출력값과 앱 Decision Label 변환 정책.
- 표 8-1 Windows smoke test 결과 요약.
- 표 8-2 발표용 demo scenario 목록.
- 표 8-3 Windows installer release artifact 요약.
- 표 8-4 현재 알려진 앱 이슈와 대응 상태.
- 표 8-5 Prediction latency 기록 현황.
- 표 8-6 Desktop model bundle manifest 요약.
- 부록 표 A-1 Release artifact manifest.
- 부록 표 A-2 Environment check details.
- 부록 표 A-3 Demo sample inventory.
- 부록 표 A-4 Reference documents.
