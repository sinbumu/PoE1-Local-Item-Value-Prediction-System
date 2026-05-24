# App Terms Glossary

- **Auto Watch**: Electron 앱이 일정 주기로 클립보드를 읽어 PoE 아이템 텍스트를 자동 감지하는 기능.
- **Signature Gate**: 일반 텍스트를 모델에 넣지 않기 위해 `Rarity:`, `--------`, `Item Class:` 등 PoE 텍스트 특징을 확인하는 필터.
- **Model Manifest Router**: `model_manifest.json` 기준으로 item type별 모델 또는 fallback을 선택하는 라우팅 계층.
- **Floating Result Card**: 게임 화면 위에서 결과를 빠르게 볼 수 있도록 표시되는 always-on-top 보조 창.
- **External Lookup Recommendation**: currency/map/card처럼 외부 시세 조회가 더 적합한 품목에 모델 예측 대신 제공하는 안내.
- **Listed Price**: 공개 listing에 표시된 호가. 실제 체결가가 아니므로 보고서에서 구분해야 한다.
- **Search-worthy**: 검색 또는 판매 시도 가치가 있을 가능성이 있다는 decision label.
- **High-value Candidate**: 고가 후보로 분류된 decision label. 실제 가격 확정이 아니라 거래소 확인 우선순위가 높다는 의미.
