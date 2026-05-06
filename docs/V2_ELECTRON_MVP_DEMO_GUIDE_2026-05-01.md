# V2 Electron MVP Demo Guide

이 문서는 최종 발표용 Windows 로컬 유틸리티 앱 MVP의 현재 구현과 시연 절차를 정리한다.

## 구현 범위

앱 위치:

```text
desktop/
```

현재 앱은 다음 흐름을 제공한다.

1. 영문 PoE1 `Ctrl+C` 아이템 텍스트 입력
2. 클립보드 읽기 또는 textarea paste
3. 저장된 영문 demo sample fallback 입력
4. `npm run v2:clipboard-features`로 parser + V2 feature builder 실행
5. `ml/predict_item_value.py`를 Python subprocess로 호출
6. `low listed value`, `search-worthy`, `high-value candidate` 중 하나를 판단 카드로 표시

자동 클릭, 자동 판매, overlay, 게임 조작 자동화는 포함하지 않는다.

## 실행 준비

앱은 Electron을 별도 package로 둔다.

```bash
cd desktop
npm install
npm start
```

앱 실행 전 프로젝트 루트에서 V2 모델이 준비되어 있어야 한다.

```bash
npm run stage:v2-mod-aware -- \
  --days=7 \
  --output-dir=artifacts/v2-mod-aware-staging/latest

ml/.venv/bin/python ml/run_v2_classifier_comparison.py \
  --staged-manifest artifacts/v2-mod-aware-staging/latest/manifest.json \
  --iterations 1000 \
  --depth 8 \
  --learning-rate 0.05 \
  --output-dir ml/runs/v2_classifier_latest
```

## 앱 입력값

앱 UI에서 다음 경로를 확인한다. 현재 앱은 아래 기본값을 자동으로 채운다.

```text
model.cbm
feature_schema.json
decision threshold
```

예시:

```text
ml/runs/v2_classifier_latest/v2_mod_aware/global/model.cbm
ml/runs/v2_classifier_latest/v2_mod_aware/global/feature_schema.json
0.40
```

기본 파일이 아직 없으면 앱 상단에 `model missing`, `schema missing` 경고가 표시된다. 이 경우 학습이 완료된 다른 run의 `model.cbm`과 `feature_schema.json` 경로를 직접 입력한다.

`2026-05-01_full_7d` threshold 평가 기준으로 `0.40`은 V2 global 모델의 test split에서 F1과 recall 균형이 가장 좋았다. 발표 데모에서는 기본값 `0.40`을 사용하고, 더 보수적으로 high-value candidate를 줄이고 싶으면 `0.50` 이상을 비교한다.

## 데모 절차

1. 앱 상단에서 model/schema/threshold 상태를 확인한다.
2. PoE1 영문 클라이언트에서 아이템에 마우스를 올리고 `Ctrl+C`를 누른다.
3. 앱에서 `Read Clipboard`를 클릭한다.
4. `Analyze Item`을 클릭한다.
5. 판단 카드에서 decision, score, threshold, recommendation을 보여준다.
6. `Item Summary`에서 rarity, item class, base type, slot, warning을 보여준다.
7. 필요하면 `Technical Details`를 열어 raw prediction JSON, feature JSON, affix line을 보여준다.

실제 클립보드 연동이 불안정하면 저장된 영문 샘플을 textarea에 paste해서 같은 흐름으로 시연한다.

## 샘플 기반 데모

앱의 `Demo Samples` selector는 `samples/clipboard/en/` 아래의 영문 샘플을 불러온다. 발표 당일에는 먼저 demo sample로 흐름을 보여준 뒤, 가능하면 실제 PoE 클라이언트 clipboard 입력을 추가로 보여주는 순서가 안전하다.

권장 시나리오:

1. `rare-equipment-001` 또는 다른 rare equipment 샘플로 정상 분석 흐름 확인
2. `unique-equipment-001` 샘플로 unique equipment 분석 흐름 확인
3. `skill-gem-001` 샘플로 `unsupported item type` fallback 확인

## 지원 범위와 fallback

현재 MVP는 다음 정책을 따른다.

- 영문 Ctrl+C 텍스트 우선
- rare equipment와 unique equipment 중심
- skill gem, jewel, map, currency 등은 모델 추론을 건너뛰고 직접 검색 권장 메시지 표시
- parser warning, unsupported item, inference failure는 사용자가 이해할 수 있는 메시지로 표시

이 정책은 앱이 모든 아이템을 억지로 예측하는 것보다, 현재 모델의 실제 학습 범위를 명확히 보여주기 위한 것이다.

## 추론 방식과 latency

현재 앱은 요청마다 TypeScript feature builder와 Python predictor를 subprocess로 실행한다. `rare-equipment-001` 기준 feature 생성 단계는 개발 환경에서 약 `0.4s`로 측정됐다.

앱은 분석 후 feature/prediction latency를 화면에 표시한다. 전체 end-to-end prediction이 반복적으로 `2-3s`를 넘으면 persistent Python worker를 추가 검토한다. 현재 MVP 단계에서는 단순 subprocess 구조를 유지한다.

## 주의 문구

앱 결과는 실제 체결가가 아니라 priced listing 기반 판단이다. 따라서 발표에서는 다음처럼 설명한다.

> 이 앱은 아이템의 정확한 판매가를 보장하지 않고, 공개 등록 매물 기반으로 검색하거나 판매 시도할 가치가 있는지 빠르게 판단하는 로컬 보조 도구입니다.

## 현재 한계

- 영어 클라이언트 기준
- 기본 경로는 자동 입력되지만, 모델 파일이 없으면 학습 run 경로를 직접 지정해야 함
- high-value candidate는 binary classifier score band 기반 표시
- threshold는 앱 UI에서 수동 지정
- segment routing은 아직 없음
- persistent Python worker는 아직 없음
- true trash detector가 아니라 low listed value와 search-worthy 분류 모델
