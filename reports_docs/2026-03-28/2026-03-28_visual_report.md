# 2026-03-28 시각화 리포트

이 문서는 같은 폴더에 생성된 PNG 차트를 한 번에 스크롤하며 볼 수 있도록 만든 발표용 뷰어 문서입니다.

## 주의

- `last 72h` 차트는 최근 시간 구간의 실제 집계입니다.
- `sample-based` 차트는 `normalized_priced_items TABLESAMPLE SYSTEM (0.2)` 기반 탐색용 시각화입니다.
- 즉, 운영 상태 차트는 비교적 직접적인 수치이고, 샘플 차트는 시장 구조와 패턴을 설명하는 용도로 보는 것이 적절합니다.

## 시간대별 Raw 수집량

수집기가 실제로 연속 동작 중이며 시간대별로 raw 응답이 꾸준히 들어오고 있음을 보여줍니다.

![시간대별 Raw 수집량](./2026-03-28_raw_collection_last_72h.png)

## Divine Orb 환율 추이

향후 `target_price_chaos` 라벨링을 위한 환율 스냅샷이 이미 누적되고 있다는 점을 보여줍니다.

![Divine Orb 환율 추이](./2026-03-28_divine_exchange_last_72h.png)

## PostgreSQL 테이블 규모

raw와 normalized의 저장 비용 차이, 그리고 왜 retention/archive 정책이 필요한지 설명하기 좋습니다.

![PostgreSQL 테이블 규모](./2026-03-28_table_sizes.png)

## 가격 통화 분포

실제 매물 가격이 주로 `chaos`와 `divine`에 몰려 있음을 보여주며, 환율 정규화 필요성을 설명하는 데 유용합니다.

![가격 통화 분포](./2026-03-28_currency_share_sample.png)

## 상위 아이템 타입 분포

현재 시장에 많이 올라오는 아이템 타입을 보여주며, 어떤 도메인 구간이 데이터셋에서 두드러지는지 설명할 수 있습니다.

![상위 아이템 타입 분포](./2026-03-28_top_item_types_sample.png)

## 희귀도 구성

Rare와 Unique가 큰 비중을 차지하고 있어 향후 모델 후보군과 실제 수집 데이터가 어느 정도 맞물리는지 설명할 수 있습니다.

![희귀도 구성](./2026-03-28_rarity_share_sample.png)

## Chaos 가격 분포

저가 매물이 매우 많고 고가 매물은 상대적으로 적은 롱테일 구조를 시각적으로 보여줍니다.

![Chaos 가격 분포](./2026-03-28_chaos_price_hist_sample.png)

## 관측 유지 시간 분포

한 번 관측된 매물이 짧은 시간 안에 다시 보이지 않게 되는 경우만 있는 것이 아니라, 일정 시간 이상 반복 관측되는 경우도 많다는 점을 보여줍니다.

![관측 유지 시간 분포](./2026-03-28_listing_lifetime_sample.png)
