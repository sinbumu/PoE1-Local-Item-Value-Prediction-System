# PoE1 Local Item Value Prediction System  
## 프로젝트 결과보고서 본문 초안(제2장~제6장)

> 본 문서는 기존에 작성된 **제1장 서론**과 확정한 **목차 초안**을 유지한 상태에서,  
> 현재 저장소 및 첨부 문서를 기준으로 **제2장부터 제6장까지**를 우선 작성한 보고서 초안이다.  
> 제7장~제9장은 추후 MVP 애플리케이션 구현 및 종합 고찰 정리 이후 별도로 보완한다.  
> 최종 편집 시 그림 번호, 표 번호, 페이지 번호, 차례는 학교 양식에 맞추어 재정렬한다.

---

# 제2장 관련 배경 및 도메인 분석

## 2.1 Path of Exile 1 거래 생태계와 시즌제 경제 구조

Path of Exile 1은 시즌제 리그 기반의 경제 구조를 갖는 온라인 액션 RPG로, 동일한 계열의 아이템이라도 리그 시점, 수요-공급 상황, 메타 변화, 사용 빌드의 유행 여부에 따라 거래 가치가 빠르게 달라진다. 특히 시즌 초반에는 레벨링과 기본 파밍에 필요한 품목의 거래가 활발하고, 시즌 중반 이후에는 특정 엔드게임 세팅에 필요한 희귀 장비, 고유 장비, 고가 보석류의 가치가 더 세분화된다. 이러한 경제 구조는 정적인 아이템 사전만으로 설명하기 어렵고, 일정 기간 동안 실제로 노출되는 거래 매물을 지속적으로 수집하여 해석해야 한다는 점에서 일반적인 게임 아이템 데이터 처리와 차이가 있다.

또한 PoE1의 거래 시장은 아이템 유형별로 가격 형성 방식이 크게 다르다. 화폐, 파편, 오일, 스캐럽, 지도와 같은 고정형 품목은 시장 가격이 비교적 빠르게 수렴하는 편이지만, 희귀 장비나 일부 고유 장비는 베이스 타입, 아이템 레벨, 옵션 조합, 수치 롤, 제작 여부, 오염 여부, 보석 링크 구조 등에 따라 가치 편차가 크게 발생한다. 따라서 본 프로젝트는 “모든 아이템을 하나의 방식으로 평가한다”는 접근보다, **가격 형성 방식이 단순한 품목과 예측 가치가 큰 품목을 분리해 다루는 구조**가 더 적절하다고 판단하였다.

## 2.2 아이템 분류와 가격 형성 요소

PoE1의 아이템은 크게 고정형 품목과 옵션 의존형 품목으로 나눌 수 있다. 고정형 품목은 화폐, 파편, 일반 지도, 일부 유니크, 카드류처럼 이름과 등급만으로도 외부 시세 조회가 쉬운 경우가 많다. 반면 옵션 의존형 품목은 장비류, 주얼류, 스킬 젬류처럼 추가 속성이나 상태에 따라 가격 차이가 크게 발생한다. 본 프로젝트에서 특히 주목한 대상은 다음과 같다.

첫째, **희귀 장비(Rare Equipment)** 는 베이스 타입과 아이템 레벨이 기본 가격대를 형성하고, 그 위에 crafted mod 수, implicit mod 수, 생명력 및 저항 계열 롤 합계, fractured 여부와 같은 요소가 실질적인 사용 가치를 결정한다. 이는 단순히 “좋은 옵션이 몇 줄 붙었다”는 수준이 아니라, 베이스-상태-핵심 롤이 조합적으로 가격에 영향을 준다는 의미다.

둘째, **주얼 계열(Jewel / Cluster Jewel 포함)** 은 일반 장비보다 방어 수치나 DPS 같은 전형적 장비 지표보다, explicit mod 구성과 jewel subtype, utility 계열 옵션, notable 여부가 가격 형성에 더 큰 비중을 차지한다. 따라서 주얼은 장비류와 구분된 모델 또는 별도 해석 기준이 필요하다.

셋째, **고유 장비(Unique Equipment)** 는 희귀 장비와 달리 base type 자체와 고유 옵션 패키지가 가격을 크게 좌우한다. 다만 동일한 고유 장비라도 속성치 합계, 저항 합계, quality, corrupted 여부 등에 따라 가격 편차가 발생할 수 있어 단순 이름 매칭만으로 충분하지 않은 경우가 있다.

넷째, **스킬 젬(Skill Gem)** 은 gem level, gem quality, awakened 여부, vaal 여부, corruption 여부 등 매우 제한적이지만 강력한 피처가 가격 형성의 핵심이 된다. 이는 장비류보다 훨씬 압축된 가격 구조를 가지며, 세그먼트별 학습 전략을 비교할 필요성을 만든다.

이러한 도메인 특성을 바탕으로 본 프로젝트는 이후 학습 데이터 파이프라인에서 `rare_equipment`, `jewel`, `unique_equipment`, `skill_gem`의 네 가지 세그먼트를 중심으로 모델링 범위를 정의하였다.

## 2.3 Public Stash API 및 관련 데이터 소스

본 프로젝트의 주 데이터 원천은 Path of Exile 공식 개발자 문서를 통해 접근 가능한 `public-stash-tabs` API이다. 본 API는 OAuth `client_credentials` 기반 인증과 `service:psapi` 권한을 통해 접근하며, 응답의 `next_change_id`를 이어받는 방식으로 공개 거래 매물 변화를 지속 추적할 수 있다. 프로젝트 초기에는 모든 backlog를 처음부터 따라가는 방식도 검토했으나, 실제 운영 환경에서는 오래된 Standard/Hardcore 구간과 null league 구간의 비중이 매우 높아 최신 시즌 경제 데이터를 확보하기 어렵다는 문제가 있었다. 이에 따라 현재는 **latest psapi change-id에서 시작한 뒤, live cursor를 따라가는 tailing 방식**을 채택하였다.

공식 Public Stash 데이터만으로는 가격을 chaos 기준으로 직접 비교하기 어려우므로, 보조 데이터 소스로는 `poe.ninja`의 환율 스냅샷을 활용하였다. collector는 주기적으로 `currencyoverview` 성격의 환율 정보를 수집하여 `exchange_rate_snapshots` 테이블에 저장하며, 이후 ETL 단계에서 개별 listing의 통화 단위를 chaos equivalent로 환산하는 데 사용한다. 이 선택은 공식 `currency-exchange` API보다 구현이 단순하고, `sample_time_utc`와 `chaosEquivalent`를 직접 활용할 수 있다는 점에서 초기 학습 파이프라인 구성에 유리하였다.

또한 향후 로컬 유틸리티 앱의 입력 경로를 준비하기 위해, 게임 클라이언트의 `Ctrl+C` 클립보드 텍스트를 파싱하는 경로도 별도로 유지하고 있다. 현재는 영어 클라이언트 기준 clipboard parser와 RePoE 기반 English affix dictionary V1이 연결되어 있으며, 이를 통해 향후 학습된 모델과 로컬 입력을 이어주는 추론 경로를 준비하고 있다. 다만 본 보고서 시점에서는 앱 UI와 실시간 추론까지는 범위에 포함하지 않고, **수집·정제·학습 파이프라인과 클립보드 입력 준비**까지만 구현 범위로 본다.

## 2.4 기존 시세 조회 방식과 한계

PoE1에서 일반적으로 사용되는 시세 확인 방식은 공식 거래소 검색, poe.ninja 같은 외부 시세 사이트, 또는 오버레이 도구를 통한 개별 조회이다. 이러한 방식은 고정형 품목이나 거래량이 매우 많은 카테고리에는 효과적이지만, 옵션 조합과 수치 롤 차이에 따라 가치가 크게 달라지는 아이템군에는 한계가 있다.

첫째, 기존 시세 조회 방식은 대부분 **사용자가 아이템을 직접 확인하고 검색 조건을 조정하는 과정**을 필요로 한다. 즉 “거래할 가치가 있는지 여부를 빠르게 판단하는 문제”와 “정확한 거래 조건을 찾아가는 문제”를 동시에 사용자가 해결해야 한다.

둘째, 공개 거래 데이터는 실제 판매 완료 가격이 아니라 **관측 시점의 listing price**이므로, 단순 조회 결과를 그대로 학습 라벨로 사용하면 노이즈가 포함될 수 있다. 그럼에도 불구하고 장기간에 걸친 반복 관측과 정제 과정을 거치면, 특정 세그먼트에 대해 상대적 가치 구조를 학습하는 데는 충분한 정보가 될 수 있다.

셋째, 기존 도구 다수는 “현재 시세를 사람이 찾아보는 도구”에 가깝고, **로컬에서 즉시 ‘가치가 있는 후보인지’를 분류해 주는 추론형 구조**는 상대적으로 약하다. 본 프로젝트는 이 지점을 해결 대상으로 삼아, 수집된 공개 listing 데이터를 기반으로 가격 구조를 학습하고, 향후 클립보드 입력에서 즉시 활용 가능한 형태로 연결하려고 한다.

## 2.5 외부 시세 기반 판단과 모델 예측의 역할 분담

본 프로젝트는 모든 아이템을 기계학습 모델로 처리하는 방향보다, **외부 시세 기반 판단이 더 적절한 대상**과 **모델 예측이 더 가치 있는 대상**을 구분하는 쪽이 실용적이라고 판단하였다.

외부 시세 기반 판단이 우선인 품목은 화폐, 파편, 스캐럽, 에센스, 화석, 오일, 카드류, 일반 지도, 옵션 차이가 거의 없는 일부 유니크 등이다. 이러한 품목은 시장 가격이 비교적 빠르게 수렴하고, 외부 가격 소스로부터 충분한 기준 가격을 얻을 수 있으므로 모델이 개입할 실익이 상대적으로 작다.

반면 모델 예측이 우선인 품목은 희귀 장비, 주얼 및 클러스터 주얼, 옵션 롤 차이가 큰 유니크 장비, 스킬 젬 등이다. 이들 품목은 base type, ilvl, 옵션 구성, crafted 여부, gem level/quality 같은 복합 피처가 가격을 좌우하므로, 단순 조회만으로는 적정가 판단이 어렵다. 따라서 본 프로젝트의 모델링 범위는 “모든 아이템의 절대 가격을 맞히는 것”보다, **검색만으로 적정가 판단이 어려운 품목군의 상대적 가치 구조를 학습하는 것**에 더 가깝다.

이와 같은 역할 분담은 보고서 후반부의 모델 설계 및 로컬 보조 애플리케이션 설계 장에서 다시 활용될 것이다. 즉 외부 시세 소스는 일부 카테고리의 기준선 역할을 하고, 모델은 그보다 복잡한 품목군에 대해 추가 의사결정 지원 역할을 담당하는 구조가 된다.

---

# 제3장 시스템 요구사항 및 전체 구조

## 3.1 프로젝트 범위와 목표 재정의

프로젝트 초기 목표는 PoE Public Stash API를 안정적으로 수집하고, raw 응답과 normalized 데이터를 분리 저장하며, `next_change_id` 기반 재시작 가능한 수집 PoC를 구현하는 것이었다. 그러나 실제 수집과 분석이 진행되면서 프로젝트 범위는 보다 구체적으로 재정의되었다.

첫째, 수집 리그 범위는 PoE1 전체가 아니라 **Mirage softcore 경제권**으로 축소하였다. 이는 Hardcore Mirage, SSF Mirage, Ruthless Mirage, private league까지 함께 포함하면 가격 분포가 섞여 모델 해석과 학습 안정성이 크게 낮아지기 때문이다. 따라서 collector는 `TARGET_LEAGUE=Mirage` 기준 exact match 필터를 사용하고, 다른 league 변형은 수집 대상에서 제외한다.

둘째, 아이템 범위는 “모든 아이템”이 아니라 **예측 가치가 큰 세그먼트 중심**으로 재정의하였다. 이에 따라 ETL 단계에서 `rare_equipment`, `jewel`, `unique_equipment`, `skill_gem`을 주 대상 세그먼트로 분리하고, 외부 시세 우선 대상인 품목은 초기 학습 데이터셋에서 제외하였다.

셋째, 최종 목표도 “정확한 실제 판매가 예언”이 아니라, **로컬 유틸리티 앱에서 거래 등록할 가치가 있는지, 잡템에 가까운지 빠르게 판단할 수 있는 보조 시스템**으로 정리하였다. 이는 중간평가 시점에서 앱 UI 자체는 아직 구현되지 않았지만, 데이터 수집–정제–학습–클립보드 입력 준비까지 이어지는 파이프라인을 구축했다는 점에서 캡스톤 프로젝트의 MVP 방향과도 일치한다.

## 3.2 전체 시스템 아키텍처

현재 시스템은 크게 네 개의 계층으로 구성된다.

첫째, **Collector 계층**은 OAuth 인증, Public Stash API 호출, 리그 필터링, priced item 정규화, 환율 스냅샷 수집, `next_change_id` 저장을 담당한다. 이 계층은 실시간 거래 시장의 노출 매물을 지속적으로 따라가며 원천 데이터를 확보하는 역할을 한다.

둘째, **Storage / Maintenance 계층**은 `raw_api_responses`, `normalized_priced_items`, `collector_state`, `exchange_rate_snapshots`, `ingestion_activity_summaries`와 같은 저장 구조를 유지하고, raw cleanup, stale normalized cleanup, labeled backup 등의 maintenance 작업을 담당한다. 즉 수집기가 장시간 로컬에서 동작하더라도 저장소가 무한정 증가하지 않도록 정책을 적용하는 계층이다.

셋째, **ETL / Training Data 계층**은 `training_features_raw`, `training_features_clean`, `training_features_labeled`를 생성한다. 이 계층은 원시 listing 데이터를 모델이 직접 학습 가능한 구조로 변환하고, 통화 환산과 필터링을 수행하여 최종 학습용 라벨을 만든다.

넷째, **Model / Inference Preparation 계층**은 staged dataset 생성, CatBoost 학습, 글로벌 vs 세그먼트 모델 비교, clipboard parser 및 English affix dictionary V1 준비를 포함한다. 이 계층은 현재는 주로 오프라인 학습 및 추론 준비를 담당하며, 이후 로컬 앱과의 연결은 제7장에서 다룰 예정이다.

위 구조를 데이터 흐름 기준으로 요약하면 다음과 같다.

`public-stash-tabs`  
→ `raw_api_responses`  
→ `normalized_priced_items`  
→ `training_features_raw`  
→ `training_features_clean`  
→ `training_features_labeled`  
→ `stage-training-dataset`  
→ `CatBoost global / segment models`

이 구조는 단순한 수집기 구현을 넘어, 공개 거래 데이터로부터 실제 모델 실험까지 이어지는 일련의 파이프라인을 하나의 로컬 환경 안에서 재현 가능하게 만든다는 점에 의미가 있다.

## 3.3 개발 및 실행 환경

본 프로젝트는 현재 **로컬 MacBook + PostgreSQL + Node.js + Python** 환경에서 운영된다. 데이터 수집기와 ETL, maintenance 로직은 Node.js/TypeScript 기반으로 구현되었고, PostgreSQL은 Docker Desktop 또는 로컬 Postgres를 통해 구동할 수 있도록 구성하였다. 환경 변수는 `.env` 파일로 관리하며, 필수적으로 PoE OAuth client id, client secret, User-Agent, database URL이 필요하다.

ML 학습 코드는 저장소의 `ml/` 디렉토리로 분리되어 있으며, Python 가상환경에서 CatBoost를 중심으로 동작한다. 학습 데이터는 DB에서 직접 읽지 않고, 먼저 staged split CSV로 export한 뒤 CatBoost file pool 형태로 읽어 들인다. 이 설계는 수천만 row 규모에서 `pandas.read_csv()` 전체 적재를 피하고, 로컬 머신에서도 재현 가능한 시계열 split 기반 실험을 수행하기 위한 것이다.

또한 장기간 수집 운영 중 로컬 디스크 증가 문제가 실제로 발생한 경험을 반영하여, 현재는 raw retention, stale normalized cleanup, labeled backup, Google Drive 업로드, ingestion summary 누적과 같은 운영 기능이 함께 구성되어 있다. 이는 보고서 기준으로 단순한 프로토타입이 아니라 **장시간 실행 가능한 로컬 실험 인프라**를 직접 설계하고 운용한 사례로 볼 수 있다.

## 3.4 데이터 흐름 설계

본 프로젝트의 데이터 흐름은 다음 원칙을 따른다.

첫째, **원천 데이터와 학습 데이터는 분리**한다. collector는 API 응답 또는 필터링된 raw subset을 그대로 보존하고, ETL은 여기서 다시 학습용 구조를 생성한다. 이렇게 해야 파서나 필터링 규칙을 변경했을 때 원본에서 다시 재가공할 수 있다.

둘째, **최근 데이터 우선 처리 구조**를 채택한다. Public Stash backlog 전체를 처음부터 소진하는 접근은 Mirage 시즌 데이터를 얻는 데 지나치게 오래 걸리므로, 최신 live cursor에서 시작해 현재 시즌 경제 데이터를 우선 확보하는 방식이 더 실용적이었다. ETL도 최근 7일 범위를 빠르게 처리할 수 있는 fast-lane 옵션과 복합 인덱스 기반 row comparison pagination을 사용해, 모델 실험이 수집 backlog에 의해 무한정 지연되지 않도록 설계하였다.

셋째, **수집과 학습을 느슨하게 결합**한다. collector는 지속적으로 `normalized_priced_items`를 쌓고, ETL은 필요 시점에 `training_features_*` 계층을 생성한다. 그 위에서 `stage-training-dataset`이 일정 기간 snapshot을 만들어 주면, ML 학습은 해당 snapshot에 대해 독립적으로 수행된다. 이 구조 덕분에 수집기가 계속 동작하는 상태에서도 ETL과 학습을 별도로 제어할 수 있다.

넷째, **추후 로컬 앱과 연결 가능한 입력 경로를 별도로 준비**한다. 현재는 학습 피처의 상당 부분이 stash listing 기반 ETL에서 오지만, 최종적으로는 clipboard parser를 통해 동일하거나 유사한 피처를 생성해 추론으로 연결할 계획이다. 이 때문에 `clipboard-safe-feature-policy`와 English affix dictionary V1 같은 보조 구조도 함께 준비되었다.

## 3.5 데이터 저장 계층 구조

데이터 저장 계층은 크게 다음과 같이 나뉜다.

- `raw_api_responses`: collector가 API 응답에서 추출한 raw subset 또는 원천 응답을 짧은 기간 보관하는 계층  
- `normalized_priced_items`: priced listing을 item 단위로 정규화한 핵심 중간 계층  
- `exchange_rate_snapshots`: 환율 기반 chaos equivalent 계산을 위한 스냅샷 계층  
- `collector_state`: `next_change_id`를 저장하여 재시작 시 이어받기를 가능하게 하는 상태 계층  
- `training_features_raw / clean / labeled`: 학습용 feature engineering과 라벨링 계층  
- `ingestion_activity_summaries`: 일별·시간별 수집 추세를 장기 보존하기 위한 요약 계층  

이 구조의 핵심은 “모든 것을 하나의 거대한 테이블에 모으지 않고, 목적별로 계층을 분리해 유지한다”는 점이다. 수집 계층은 재현성과 디버깅을, normalized 계층은 질의 가능성을, labeled 계층은 학습 효율성을 우선시한다. 이를 통해 저장소 제약과 로컬 운영 부담을 관리하면서도, 보고서에서 설명 가능한 명확한 데이터 흐름을 유지할 수 있었다.

---

# 제4장 데이터 수집 파이프라인 설계 및 구현

## 4.1 OAuth 인증 및 API 접근 구조

본 프로젝트의 수집 파이프라인은 공식 Path of Exile 개발자 문서를 따르는 OAuth `client_credentials` 인증 구조를 사용한다. Collector는 환경 변수로부터 `POE_CLIENT_ID`, `POE_CLIENT_SECRET`, `POE_USER_AGENT`를 읽어 access token을 발급받고, 이를 사용해 `public-stash-tabs` 엔드포인트를 호출한다. User-Agent는 공식 문서 요구사항에 맞게 `OAuth ...` 형식을 유지해야 하며, 실제 구현에서도 이 헤더가 누락되면 API 접근이 정상적으로 이루어지지 않는 문제가 확인되었다.

초기에는 Access token 발급과 API 호출 자체가 기술적 병목일 것으로 예상했으나, 실제 프로젝트 진행 과정에서 더 큰 병목은 최신 시즌 경제 데이터에 도달하는 방법과, 로컬 저장소를 어떻게 관리할 것인가에 있었다. 따라서 현재 파이프라인에서 인증 구조는 안정적으로 자동화된 기본 요소이고, 실질적인 설계 포인트는 다음 절에서 다루는 수집 흐름과 이어받기 전략에 있다.

## 4.2 Public Stash 수집 흐름

Collector는 기본적으로 다음 순서로 동작한다.

1. OAuth 토큰 발급  
2. Public Stash API 호출  
3. 응답에서 `TARGET_LEAGUE`와 정확히 일치하는 stash/item만 필터링  
4. 필터링된 raw subset 저장  
5. priced item 정규화 및 `normalized_priced_items` 적재  
6. 응답의 최신 `next_change_id` 저장  
7. 일정 주기마다 환율 스냅샷 추가 수집  
8. 다음 반복으로 진행  

이 흐름에서 중요한 점은 **전체 Public Stash 응답을 무조건 모두 저장하는 것이 아니라, 현재 목표 리그와 priced listing 중심으로 정규화 작업을 병행한다는 점**이다. 현재 collector는 `Mirage` exact match만 허용하고, priced item 정규화는 최소한 `~b/o`, `~price` 형식의 note를 인식하는 가격 파서를 통해 수행한다. 이로 인해 raw 응답 대비 데이터량이 크게 감소하고, 이후 ETL이 학습 가치가 높은 listing만 대상으로 동작할 수 있게 된다.

또한 collector 내부에서 `poe.ninja` 환율 스냅샷을 함께 수집하도록 구성해, 별도 외부 배치 없이도 `exchange_rate_snapshots`가 주기적으로 누적되도록 하였다. 이는 향후 `training_features_labeled` 생성 시 관측 시점 이전 최신 환율을 매칭하는 데 필요하다.

## 4.3 `next_change_id` 기반 이어받기 전략

Public Stash API는 응답마다 `next_change_id`를 반환하며, 다음 호출은 이 값을 `id` 쿼리 파라미터로 넘겨 이어가는 방식으로 이루어진다. 이 구조를 이용하면 수집기 프로세스가 중단되더라도 마지막 상태부터 복구할 수 있다. 본 프로젝트에서는 이를 위해 `collector_state` 테이블에 최신 `next_change_id`를 저장하고, 재시작 시 해당 값을 우선적으로 사용하도록 구현하였다.

실제 운영 과정에서 가장 큰 시행착오는 “처음부터 backlog를 모두 따라가면 최신 시즌 데이터에 도달할 수 있을 것”이라는 가정이었다. 그러나 오래된 Public Stash backlog는 Standard, Hardcore, null league 응답이 매우 많고, 이를 모두 소진하는 데 과도한 시간이 걸렸다. 이 문제를 해결하기 위해 현재는 **초기 부트스트랩 시 `--start-latest` 옵션을 사용하여 latest psapi change-id에서 시작하고, 이후부터는 저장된 state를 따라가는 전략**으로 변경하였다. 이 방식은 Mirage 시즌 live 데이터에 빠르게 진입할 수 있고, 시즌 종료 전 한정된 프로젝트 기간에도 의미 있는 수집량을 확보할 수 있다는 장점이 있다.

## 4.4 리그 필터링 및 수집 범위 결정

본 프로젝트의 1차 수집 대상은 `Mirage` softcore 경제권이다. 실제 collector는 `TARGET_LEAGUE` 값을 exact match로 비교하기 때문에, `Hardcore Mirage`, `SSF Mirage`, `Ruthless Mirage`, private league와 같은 변형 리그는 저장 대상에서 제외된다. 이는 서로 다른 경제권의 listing을 한 모델로 함께 학습하면 가격 분포가 섞여 버리는 문제를 방지하기 위한 설계다.

또한 item 단위로도 league 관련 값이 관측될 수 있으므로, 필요 시 stash 수준과 item 수준 모두에서 league 관측 스크립트를 통해 점검할 수 있게 하였다. 초기 관측 스크립트는 10분 단위로 새로 발견된 `stash.league`, `item.league`, 페이지별 상위 league 분포를 출력하게 하여, 실제 live tailing 구간에서 `Mirage` 관련 데이터가 충분히 관측되는지 확인하는 데 사용되었다. 이 과정은 “현재 시점의 live cursor를 따라가면 시즌 리그 데이터가 충분히 들어온다”는 사실을 검증하는 데 중요한 역할을 했다.

## 4.5 Raw / Normalized 데이터 저장 구조

수집 파이프라인은 raw 계층과 normalized 계층을 분리해 유지한다.

`raw_api_responses`는 collector가 수집한 API 응답 또는 필터링된 raw subset을 보관하는 테이블이다. 이 테이블은 파서 오류 디버깅, 후속 정제 규칙 검증, 응답 구조 분석에 유용하지만, 데이터 증가량이 매우 크다는 문제가 있다. 실제로 장시간 로컬 수집 중 PostgreSQL 저장소가 급격히 증가하여 Docker volume 한계에 도달한 사례가 있었고, 그 결과 raw 장기 보관은 현실적이지 않다는 운영 결론에 도달하였다.

반면 `normalized_priced_items`는 priced listing을 item 단위로 펼친 핵심 중간 테이블로, 이후 ETL과 학습 데이터 생성의 직접 입력원이 된다. 이 테이블은 listing key, 업데이트 시각, 가격 통화 및 금액, 기본 아이템 속성, 일부 상태 정보, 향후 feature engineering에 필요한 필드를 유지한다. 현재 프로젝트는 raw 전체 장기 보관보다 **normalized_priced_items를 1차 분석 기반으로 보고, raw는 짧은 retention 정책을 적용**하는 방향으로 운영된다.

## 4.6 Collector / Maintenance / ETL 준비 구조

본 프로젝트는 장시간 수집 운영에서 발생하는 실제 문제를 해결하기 위해, collector와 maintenance를 분리된 역할로 설계하였다.

Collector는 실시간 수집에 집중한다. 즉 OAuth 인증, Public Stash tailing, league filtering, priced item normalization, 환율 스냅샷 수집, `collector_state` 갱신이 collector의 책임이다. 반면 maintenance는 저장소 관리와 후속 작업을 담당한다. raw retention cleanup, stale normalized cleanup, labeled backup, ingestion summary 누적과 같은 작업은 maintenance 루프가 주기적으로 수행한다.

이 구조는 두 가지 장점을 가진다. 첫째, collector는 실시간 tailing에 집중할 수 있어 API 응답 지연이나 DB cleanup 부하의 영향을 덜 받는다. 둘째, ETL과 학습 준비 작업을 필요 시점에만 별도로 수행할 수 있어, 수집–정제–학습이 하나의 단일 프로세스에 강하게 결합되는 것을 피할 수 있다. 결과적으로 이 구조는 로컬 MacBook 환경에서도 장기간 수집과 후속 ML 실험을 병행할 수 있게 한 핵심 설계라 볼 수 있다.

---

# 제5장 데이터 정제 및 학습 데이터 파이프라인

## 5.1 Raw retention 및 archive 정책

프로젝트 중반부에 가장 먼저 드러난 운영 문제는 저장소 증가량이었다. 로컬 환경에서 raw 데이터까지 장기 보관하려 하자 PostgreSQL 저장소가 빠르게 증가했고, 실제로 Docker 내부 저장 공간 부족으로 수집기가 중단되는 사례가 발생하였다. 이 경험을 바탕으로 현재는 raw 전체를 장기 보관하기보다, **raw는 짧게 보관하고 normalized 및 labeled 계층을 더 중요하게 유지하는 정책**으로 변경하였다.

현재 정책의 핵심은 다음과 같다.

- `raw_api_responses`는 `RAW_RETENTION_HOURS` 기준으로 일정 시간이 지나면 삭제  
- `normalized_priced_items`는 `updated_at` 기준으로 `NORMALIZED_RETENTION_HOURS`보다 오래된 stale listing을 batch delete  
- `training_features_labeled`는 장기 보관 대상으로 보고 Google Drive로 증분 백업  
- `ingestion_activity_summaries`는 raw가 지워져도 수집 추세를 남기기 위해 계속 유지  

이 정책을 통해 raw 테이블의 폭증을 억제하면서도, 학습과 보고서 작성에 필요한 핵심 데이터는 장기적으로 보존할 수 있도록 했다. 즉 저장소 운용 자체가 프로젝트의 부차적인 문제가 아니라, 데이터 수집 시스템을 실제로 돌려 보며 얻은 중요한 설계 경험으로 이어졌다.

## 5.2 `normalized_priced_items` 구성

`normalized_priced_items`는 priced listing을 item 단위로 정규화한 핵심 중간 테이블이다. Collector는 Public Stash 응답에서 `Mirage` exact match 조건을 만족하는 listing 중 가격 메모가 존재하는 item만 추출하고, 이를 item 단위 row로 정리하여 이 테이블에 저장한다. 이 과정에서 최소한 다음과 같은 정보가 유지된다.

- listing key 및 source timestamp  
- league  
- base type / rarity / frame type / ilvl  
- 가격 통화 및 가격 금액  
- 상태 정보(identified, corrupted, fractured, synthesised 등)  
- 소켓/링크 구조, influence 관련 플래그  
- 이후 raw feature 생성에 필요한 기본 property 및 mod count 계열 정보  

즉 `normalized_priced_items`는 단순 캐시가 아니라, collector와 ETL 사이를 연결하는 **핵심 데이터 계약 계층**의 역할을 한다. 이 테이블의 구조가 안정화되면서, 이후 ETL 단계에서는 모든 로직을 raw 응답 파싱이 아닌 normalized row 처리로 전환할 수 있었고, 학습용 데이터 생성을 더 예측 가능하게 만들 수 있었다.

## 5.3 Exchange rate snapshot과 chaos 환산

Path of Exile 거래 가격은 chaos, divine 등 다양한 통화로 표현된다. 따라서 모델 타깃을 단일 회귀값으로 만들기 위해서는 서로 다른 가격 단위를 공통 기준으로 환산할 필요가 있다. 본 프로젝트는 이를 위해 `exchange_rate_snapshots` 테이블을 두고, collector가 주기적으로 `poe.ninja` 환율 정보를 수집하도록 구성하였다.

현재 구현에서는 `currencyoverview` 성격의 스냅샷에서 `chaosEquivalent`와 `sample_time_utc`를 저장한다. 이후 labeled ETL 단계는 각 listing의 `source_updated_at` 이전 최신 환율 스냅샷을 찾아, `target_price_amount * exchange_rate_chaos_equivalent`로 `target_price_chaos`를 계산한다. 그리고 CatBoost의 주 타깃으로는 `target_price_log1p = log1p(target_price_chaos)`를 사용한다.

이 방식은 고가 이상치가 매우 큰 시장 데이터에서 회귀 안정성을 높이는 효과가 있다. 동시에 “현재 라벨은 chaos equivalent로 환산한 관측 시점 listing price”라는 점을 명확히 정의할 수 있게 해 주며, 이후 보고서에서 모델 타깃을 설명할 때도 기준이 분명해진다.

## 5.4 `training_features_raw` 생성

`training_features_raw`는 `normalized_priced_items`에서 모델 후보군을 추출하여, 상대적으로 보수적인 요약 피처를 붙인 첫 번째 학습용 계층이다. 현재 이 계층에는 다음과 같은 유형의 피처가 포함된다.

- 공통 식별 정보: `listing_key`, `source_inserted_at`, `source_updated_at`, `league`, `base_type`, `rarity`, `frame_type`, `ilvl`  
- 상태 정보: `identified`, `corrupted`, `fractured`, `synthesised`, influence 플래그  
- 구조 정보: `socket_count`, `link_count`, `white_socket_count`  
- mod 요약: `prefix_count`, `suffix_count`, `explicit_mod_count`, `implicit_mod_count`, `crafted_mod_count`, `fractured_mod_count`, `enchant_mod_count`  
- 장비 요약: `quality`, `armour`, `evasion`, `energy_shield`, `physical_dps`, `elemental_dps`, `attack_speed`, `crit_chance`, `move_speed`  
- 합산형 피처: `life_roll_sum`, `resistance_roll_sum`, `attribute_roll_sum`  
- 주얼/젬 전용 요약: `jewel_type`, `cluster_size`, `cluster_passive_count`, `notable_count`, `gem_level`, `gem_quality`, `is_awakened`, `is_vaal`, `is_support_gem`, `gem_tags`  

이 계층의 특징은 “정교한 affix 세부 정규화보다, 먼저 안정적으로 수집 가능한 요약 피처를 확보한다”는 점이다. 이는 ETL 초기 단계에서 feature engineering complexity보다 학습 가능성 검증을 우선시한 설계 선택이다.

## 5.5 `training_features_clean` 생성

`training_features_clean`은 `training_features_raw`에서 실제 모델 후보군만 선별한 계층이다. 여기서는 단순히 “데이터가 있다”는 이유만으로 모두 학습에 넣지 않고, 프로젝트 목적과 도메인 분석을 반영해 대상 범위를 더 좁힌다.

현재 clean 단계의 주요 규칙은 다음과 같다.

- 가격 통화는 우선 `chaos`, `divine`만 허용  
- 모델 대상은 `Rare equipment`, `Jewel`, `Skill Gem`, NeverSink strict allowlist 기반 `Unique equipment` 중심  
- `Map`은 외부 시세 추종 대상으로 제외  
- `Timeless Jewel`은 2차 대상으로 현재 제외  
- `unidentified Rare/Jewel/Unique`는 학습 피처가 부족하므로 제외  
- Unique는 NeverSink strict 상위 블록과 예외 조건을 반영한 allowlist 사용  

이 과정의 목적은 모델 학습 대상과 비대상을 혼합하지 않고, **예측 가치가 큰 세그먼트 중심의 데이터셋**을 확보하는 데 있다. 특히 clean 단계는 보고서에서 “왜 어떤 아이템군을 모델로 보고, 어떤 품목은 외부 가격 소스로 처리하는가”를 설명하는 핵심 장치가 된다.

## 5.6 `training_features_labeled` 생성

`training_features_labeled`는 `training_features_clean`에 환율 스냅샷을 붙여 최종 회귀 타깃을 생성한 계층이다. 이 단계의 핵심 로직은 다음과 같다.

1. `training_features_clean` row의 `target_price_currency`를 확인  
2. 해당 row의 `source_updated_at` 이전 최신 `exchange_rate_snapshots`를 조회  
3. `target_price_chaos = target_price_amount * exchange_rate_chaos_equivalent` 계산  
4. `target_price_log1p = log1p(target_price_chaos)` 생성  

이 단계가 필요한 이유는 CatBoost의 학습 타깃을 단일 통화 기준으로 통합해야 하기 때문이다. 또한 시계열적으로 “해당 listing이 관측된 시점까지 알려진 환율만 사용한다”는 원칙을 지키기 위해, `source_updated_at` 이전 최신 snapshot을 찾는 구조를 사용하였다.

다만 환율 스냅샷 수집을 최근에 시작했기 때문에, 과거에 먼저 수집된 일부 clean row는 시점 이전 환율이 없어 `missing_historical_exchange_rate`로 labeled 단계에서 제외될 수 있다. 이는 운영 초반부의 자연스러운 데이터 공백이며, 시간이 지나면서 환율 스냅샷이 누적되면 점차 해소될 수 있다.

## 5.7 데이터 라벨 정의와 한계

현재 프로젝트의 라벨은 **실제 판매 완료 가격이 아니라 관측 시점의 listing price**이다. 이는 데이터 해석에서 매우 중요한 전제다. 즉 `target_price_chaos`와 `target_price_log1p`는 “이 item이 현재 공개 listing에서 얼마에 노출되어 있었는가”를 chaos equivalent 기준으로 표현한 값이지, 최종 거래 체결가를 의미하지 않는다.

또한 `updated_at` 또는 `source_updated_at`는 판매 완료 시각이 아니라 마지막 관측 시각이며, 아직 `sold_at`, `removed_at`, `time_to_sale` 같은 라벨은 생성하지 않는다. Public Stash 데이터만으로는 listing이 사라진 이유가 판매인지, 가격 수정인지, 계정 이동인지, 단순 비공개 전환인지 명확하지 않기 때문이다.

따라서 현재 모델은 “실제 체결가 예측기”라기보다, **현재 노출 가격 구조를 학습한 상대적 가치 추정기**로 이해하는 것이 더 정확하다. 이 한계는 최종 결과 해석에서 반드시 명시되어야 하며, 동시에 본 프로젝트가 “현재 가치가 있는 후보를 빠르게 골라내기 위한 보조 시스템”이라는 목적과도 부합한다.

---

# 제6장 가격 예측 모델 설계 및 실험

## 6.1 모델링 대상 아이템 범위 정의

현재 모델링 대상 세그먼트는 `rare_equipment`, `jewel`, `unique_equipment`, `skill_gem`의 네 가지다. 이는 PoE1 경제 구조에서 각 세그먼트가 서로 다른 가격 형성 규칙을 가지고 있고, 동시에 외부 시세 조회만으로 적정가 판단이 어려운 대표적 범주이기 때문이다.

`rare_equipment`는 희귀 장비 전반을 포함하며, 베이스와 옵션 품질의 조합적 가치 판단이 핵심이다. `jewel`은 일반 장비와 다른 가격 결정 구조를 가지므로 별도 세그먼트로 다루었다. `unique_equipment`는 고유 베이스 정체성과 상태 차이가 핵심이며, `skill_gem`은 레벨·품질·awakened/vaal 여부처럼 상대적으로 압축된 피처 구조를 가진다.

이 범위 정의는 단순히 카테고리 이름을 나누는 수준이 아니라, **어떤 세그먼트는 별도 모델이 더 유리한지, 어떤 세그먼트는 글로벌 모델의 regularization 이점이 더 큰지**를 실험적으로 비교하기 위한 전제이기도 하다.

## 6.2 Feature 설계 방향

모델 입력 피처는 “현재 stash listing에서 안정적으로 수집 가능한 정보”를 우선 사용하였다. 이는 향후 로컬 clipboard 추론 경로와의 연결 가능성도 염두에 둔 선택이다. 현재 피처는 크게 다음 세 범주로 나눌 수 있다.

첫째, **범용 식별 피처**다. `base_type`, `rarity`, `frame_type`, `ilvl`, `quality`와 같은 정보는 거의 모든 세그먼트에서 공통적으로 의미를 갖는다. 특히 `base_type`과 `ilvl`은 전체 아이템군을 크게 가르는 핵심 변수로 작동한다.

둘째, **구조 및 상태 피처**다. `explicit_mod_count`, `implicit_mod_count`, `crafted_mod_count`, `fractured_mod_count`, `corrupted`, `synthesised`, influence 플래그, socket/link 관련 변수들은 item의 상태와 완성도를 나타낸다. 이들은 장비류와 주얼류에서 특히 중요하다.

셋째, **세그먼트 특화 피처**다. 예를 들어 희귀 장비에서는 `life_roll_sum`, `resistance_roll_sum`, `attribute_roll_sum` 같은 집계형 옵션 피처가 의미 있고, 주얼은 `jewel_type`, `notable_count`, `utility_mod_count` 등이 중요하다. 스킬 젬은 `gem_level`, `gem_quality`, `is_awakened`, `is_vaal`이 핵심이며, unique 장비는 base type 외에도 속성치와 저항 합계, corrupted 여부가 영향을 준다.

현재 구현에서는 clipboard 경로와의 장기적 호환성을 위해 영어 affix dictionary V1과 clipboard-safe feature 정책도 함께 준비하고 있으나, 본 장의 실험 결과는 우선 ETL 경로에서 생성된 학습 피처를 중심으로 해석한다.

## 6.3 CatBoost 선정 이유

본 프로젝트의 1차 모델은 CatBoost를 기준선으로 사용하였다. 그 이유는 다음과 같다.

첫째, 현재 데이터셋은 `base_type`, `model_segment`, `jewel_type`, `gem_tags`와 같은 범주형 피처와, `ilvl`, `quality`, `life_roll_sum`, `explicit_mod_count` 같은 수치형 피처가 혼합되어 있다. CatBoost는 이러한 혼합 피처 구조를 비교적 자연스럽게 처리할 수 있어, 복잡한 전처리 없이도 1차 기준선을 만들기에 적합하다.

둘째, 로컬 환경에서 staged CSV 기반으로 학습을 수행할 수 있도록 구성하기 쉬웠다. 본 프로젝트는 DB에서 직접 전체 데이터를 읽어 학습하지 않고, `stage-training-dataset`을 통해 split spec이 고정된 CSV snapshot을 만든 뒤 CatBoost file pool로 학습한다. 이는 로컬 머신에서 수천만 row 규모 데이터를 다루면서도 재현 가능한 실험 구조를 유지하는 데 도움이 되었다.

셋째, 현재 프로젝트의 목표가 딥러닝 기반 대규모 표현 학습이 아니라, **ETL로 생성된 요약형 피처를 바탕으로 가격 구조를 빠르게 검증하는 것**이라는 점도 CatBoost 선택에 영향을 주었다. 즉 CatBoost는 최종 해법이라기보다, 현재 feature engineering 단계에서 도메인 직관이 실제 성능 차이로 이어지는지 확인하기 위한 실용적 기준선 모델로 기능한다.

## 6.4 학습 및 검증 데이터 구성

현재 1차 학습 기준은 최근 7일 snapshot이다. 이 데이터셋은 다음 절차를 통해 생성된다.

1. `training_features_labeled`를 기반으로 `stage-training-dataset` 실행  
2. 시계열 순서를 유지한 `train / valid / test` split 생성  
3. `manifest.json`, `split_spec.json`, 세그먼트별 CSV, CatBoost `.cd` 파일 생성  
4. 같은 snapshot과 같은 split 경계를 글로벌/세그먼트 실험에 공통 사용  

최근 7일 전체 비교 런의 글로벌 split 기준 row 수는 다음과 같다.

| split | row 수 |
| --- | ---: |
| train | 10,662,539 |
| valid | 1,332,817 |
| test | 1,332,818 |

세그먼트별 test row 수는 다음과 같다.

| 세그먼트 | test row 수 |
| --- | ---: |
| rare_equipment | 641,286 |
| jewel | 482,680 |
| unique_equipment | 126,063 |
| skill_gem | 82,789 |

즉 본 프로젝트는 최근 7일 snapshot 기준으로 약 1,333만 row 규모의 labeled 데이터를 바탕으로, 글로벌 모델과 세그먼트 모델을 동일 조건에서 비교할 수 있는 학습 구조를 확보하였다. 이는 중간평가 시점의 프로젝트 상태가 단순 아이디어나 소규모 샘플 실험 수준을 넘어섰음을 보여 주는 중요한 근거다.

## 6.5 실험 절차 및 평가 기준

현재 기준 실험은 `target_price_log1p`를 주 타깃으로 둔다. 이는 chaos equivalent price의 분포가 매우 긴 꼬리를 가지므로, 원시 chaos 값에 대한 직접 회귀보다 `log1p` 변환이 상대적 가격 구조를 더 안정적으로 반영한다고 판단했기 때문이다.

기준 실험 설정은 다음과 같다.

- 최근 7일 staged snapshot 사용  
- `iterations=300`, `depth=8`, `learning_rate=0.05`  
- 글로벌 1개 모델과 `model_segment`별 분리 모델 비교  
- 공통 `split_spec.json` 기반 시계열 split 유지  

비교 시 주 평가지표는 다음 순서를 따른다.

1. `target_price_log1p_rmse`  
2. 동률이면 `target_price_log1p_mae`  
3. 그래도 동률이면 `target_price_chaos_rmse`  

이 판정 기준은 프로젝트 초기의 `chaos RMSE` 우선 방식에서 수정된 것이다. 특히 `jewel` 세그먼트처럼 raw chaos RMSE에서는 글로벌과 세그먼트 차이가 작지만, log1p 기준에서는 세그먼트가 더 유리한 경우가 있어, 현재 프로젝트의 주 타깃과 비교 로직을 일치시키기 위해 winner 규칙을 재정의하였다.

추가로 `skill_gem`은 전체 비교에서 유일하게 글로벌 모델이 더 나은 결과를 보여, `iterations=500`, `depth=6` 설정의 단독 재점검 런을 한 번 더 수행하였다. 이 추가 실험도 세그먼트 분리의 우위를 보여주지 못했으며, 이 결과는 현재 혼합 기준선을 정하는 데 사용되었다.

## 6.6 실험 결과 분석

### 6.6.1 글로벌 모델과 세그먼트 모델 비교

최근 7일 전체 비교 런에서 각 세그먼트의 test `target_price_log1p RMSE`는 다음과 같이 나타났다.

| 세그먼트 | 글로벌 모델 | 세그먼트 모델 | 현재 권장 |
| --- | ---: | ---: | --- |
| rare_equipment | 1.6615 | 1.6346 | 세그먼트 모델 |
| jewel | 1.7409 | 1.6959 | 세그먼트 모델 |
| unique_equipment | 1.8573 | 1.7203 | 세그먼트 모델 |
| skill_gem | 1.5986 | 1.6145 | 글로벌 모델 |

이 결과를 보면 `rare_equipment`, `jewel`, `unique_equipment`에서는 세그먼트 분리 모델이 더 낮은 오차를 보였다. 반면 `skill_gem`은 전체 비교에서도 글로벌 모델이 더 낮은 RMSE를 보였고, 추가 단독 점검 런에서도 세그먼트 모델이 글로벌 기준선을 넘지 못했다. 따라서 현재 1차 운영 기준선은 “모든 세그먼트를 무조건 분리”하는 방식이 아니라, **세그먼트별 분기 + 일부 글로벌 fallback을 함께 쓰는 혼합 구조**로 정리할 수 있다.

즉 현재 권장 구조는 다음과 같다.

- `rare_equipment`: 세그먼트 모델  
- `jewel`: 세그먼트 모델  
- `unique_equipment`: 세그먼트 모델  
- `skill_gem`: 글로벌 모델 fallback  

이 혼합 기준선은 실제 도메인 해석과도 잘 맞는다. 장비류·주얼류·고유 장비는 각기 다른 가격 형성 규칙을 가지므로 분리 이점이 크고, 스킬 젬은 상대적으로 피처 공간이 제한적이어서 글로벌 모델의 regularization 효과를 더 많이 받는 것으로 볼 수 있다.

### 6.6.2 Feature Importance 해석

Feature importance 결과는 모델이 무작위 노이즈가 아니라 도메인적으로 타당한 피처에 반응하고 있음을 보여 준다.

- 글로벌 모델은 `base_type`, `ilvl`, `quality`, `implicit_mod_count`, `crafted_mod_count`, `explicit_mod_count`가 상위에 위치했다. 이는 전체 아이템군을 한 번에 볼 때 먼저 item identity와 기본 완성도가 가격을 크게 가른다는 의미다.
- `rare_equipment`에서는 `ilvl`, `base_type`, `crafted_mod_count`, `implicit_mod_count`, `quality`, `life_roll_sum`이 중요했다. 이는 희귀 장비에서 베이스와 아이템 레벨이 기본 가격대를 형성하고, crafted 상태와 핵심 롤 품질이 실제 가치 차이를 만든다는 해석과 일치한다.
- `jewel`에서는 `explicit_mod_count`, `implicit_mod_count`, `fractured`, `utility_mod_count`, `jewel_type`이 중요하게 나타났다. 이는 주얼이 일반 장비와 달리 옵션 조합 그 자체가 가격 형성의 중심이라는 점을 보여 준다.
- `unique_equipment`는 `base_type`, `attribute_roll_sum`, `resistance_roll_sum`, `ilvl`, `corrupted`가 상위에 위치했다. 즉 고유 아이템은 어떤 베이스인가가 가장 중요하고, 그 위에 상태 차이가 추가적인 가치 편차를 만든다고 해석할 수 있다.
- `skill_gem`은 `gem_level`, `gem_quality`, `is_awakened`, `is_vaal`, `base_type`, `corrupted`가 핵심이었다. 젬 계열에서 레벨과 품질이 거의 모든 것을 설명한다는 도메인 직관과 부합한다.

이러한 feature importance 해석은 “모델이 납득 가능한 기준으로 가격 구조를 보고 있다”는 근거를 제공하며, 캡스톤 프로젝트에서 단순 성능 수치 외에도 도메인 타당성을 설명하는 데 중요한 역할을 한다.

### 6.6.3 현재 결과의 의의와 한계

현재까지의 결과는 다음과 같은 의의를 가진다.

첫째, Public Stash 수집 → ETL → staged snapshot → CatBoost 비교 실험까지 하나의 파이프라인으로 실제 연결하는 데 성공하였다. 즉 본 프로젝트는 더 이상 수집기 PoC에 머물지 않고, **실제 학습 가능한 데이터셋과 비교 가능한 기준선 모델**을 확보한 단계에 도달했다.

둘째, 단일 글로벌 모델만으로는 충분하지 않으며, 세그먼트별 분기와 글로벌 fallback을 조합하는 혼합 기준선이 더 현실적이라는 점을 실험적으로 확인하였다. 이는 향후 로컬 앱 추론 설계에서도 중요한 출발점이 된다.

셋째, English clipboard parser와 affix dictionary V1을 통해 향후 추론 입력 경로도 준비되었다. 비록 본 보고서 시점에서는 UI와 실제 앱 통합이 아직 완료되지 않았지만, 학습 파이프라인과 추론 입력 준비가 동일 프로젝트 안에서 만나고 있다는 점은 캡스톤 프로젝트의 방향성을 분명히 보여 준다.

다만 현재 모델의 한계도 명확하다. 라벨은 실제 거래 체결가가 아니라 관측 시점 listing price이며, `skill_gem` 세그먼트는 아직 별도 모델 이점이 없다. 한국어 clipboard 지원은 현재 범위 밖이고, UI 및 로컬 앱 완성본도 아직 구현되지 않았다. 따라서 현재 결과는 “최종 완성형 예측 서비스”보다는, **실제 가치 예측 시스템의 핵심 백엔드와 1차 기준선 모델을 검증한 단계**로 보는 것이 적절하다.

---

> **작성 메모**  
> - 제1장 서론은 기존 초안을 유지한다.  
> - 제7장 로컬 보조 애플리케이션 설계 및 구현, 제8장 통합 실행 결과 및 고찰, 제9장 결론 및 향후 과제는 추후 작성한다.  
> - 최종본에서는 본문에 들어갈 그림(전체 시스템 구조도, 데이터 흐름도, ETL 계층도, 글로벌/세그먼트 성능 비교표, feature importance 시각화)을 추가하고, 그림 차례·표 차례를 함께 정리한다.
