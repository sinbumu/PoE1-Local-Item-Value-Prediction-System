# App Terms Glossary

- **Auto Watch**: Electron 앱이 일정 주기로 클립보드를 읽어 PoE 아이템 텍스트를 자동 감지하는 기능.
- **Signature Gate**: 일반 텍스트를 모델에 넣지 않기 위해 `Rarity:`, `--------`, `Item Class:` 등 PoE 텍스트 특징을 확인하는 필터.
- **Model Manifest Router**: `model_manifest.json` 기준으로 item type별 모델 또는 fallback을 선택하는 라우팅 계층.
- **Floating Result Card**: 게임 화면 위에서 결과를 빠르게 볼 수 있도록 표시되는 always-on-top 보조 창.
- **External Lookup Recommendation**: currency/map/card처럼 외부 시세 조회가 더 적합한 품목에 모델 예측 대신 제공하는 안내.
- **Listed Price**: 공개 listing에 표시된 호가. 실제 체결가가 아니므로 보고서에서 구분해야 한다.
- **Search-worthy**: 검색 또는 판매 시도 가치가 있을 가능성이 있다는 decision label.
- **High-value Candidate**: 고가 후보로 분류된 decision label. 실제 가격 확정이 아니라 거래소 확인 우선순위가 높다는 의미.
- **Chaos Orb / chaos equivalent**: PoE 거래에서 널리 쓰이는 기준 통화와 그 환산값으로, divine 등 다른 통화 가격을 하나의 비교 단위로 맞출 때 사용한다.
- **Listing Price**: 판매자가 공개 stash나 거래소에 표시한 희망 판매 가격이며, 실제 거래가 성사된 체결가는 아니다.
- **ilvl**: item level의 약자로, 아이템이 가질 수 있는 옵션 범위와 제작 가능성에 영향을 주는 내부 레벨 값이다.
- **Fractured**: 특정 modifier가 고정되어 일반적인 재제작 과정에서도 유지되는 특수 아이템 상태다.
- **Synthesised**: synthesis implicit modifier를 가질 수 있는 특수 아이템 상태로, 일반 아이템과 다른 추가 implicit 가치를 가질 수 있다.
- **NeverSink**: PoE 커뮤니티에서 널리 쓰이는 loot filter 프로젝트로, 본 프로젝트에서는 일부 unique item allowlist 판단의 참고 기준으로 사용했다.
- **V1 Summary Regressor**: 아이템의 요약 통계 feature를 사용해 listed price의 log-scale 값을 예측하는 CatBoost 회귀 모델이다.
- **V2 Mod-aware Classifier**: explicit modifier line과 affix dictionary 기반 feature를 사용해 아이템이 검색할 가치가 있는지 분류하는 CatBoost classifier다.
