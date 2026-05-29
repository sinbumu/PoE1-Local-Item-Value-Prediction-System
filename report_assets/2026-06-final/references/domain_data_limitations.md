# PoE Domain Data Limitations

## 요약

본 프로젝트의 모델 target은 실제 최종 판매 체결가가 아니라 공개 listing price 기반 값이다. 따라서 최종 보고서와 발표에서는 앱 출력을 “정확한 실제 판매가 예측”이 아니라 “listing price 기반 검색/판매 시도 우선순위 판단”으로 설명해야 한다.

## Public Stash API 한계

- Public Stash API는 공개 stash tab에 올라온 item listing 정보를 제공한다.
- API로 관측 가능한 값은 판매자가 공개한 asking/listed price이며, 실제 거래가 체결되었는지 또는 최종 체결가가 얼마였는지는 제공하지 않는다.
- 판매 취소, 가격 변경, 미판매 listing, 비정상 호가가 섞일 수 있으므로 label noise가 존재한다.

## 본 프로젝트에서의 해석

- 학습 label은 public listing price를 근사 target으로 사용한다.
- 모델 출력은 “이 아이템을 거래소에서 검색하거나 판매 시도할 우선순위”를 정하는 보조 신호다.
- Currency, map, divination card처럼 시장 평균가 조회가 더 적합한 품목은 local model 예측 대신 external price lookup recommendation으로 처리한다.

## 보고서 표현 권장

- 사용 가능: “공개 listing price 기반 가치 판단”, “검색/판매 시도 우선순위”, “거래소 직접 확인을 보조하는 triage utility”
- 피해야 함: “실제 판매가 예측”, “체결가 예측”, “자동 가격 확정”
