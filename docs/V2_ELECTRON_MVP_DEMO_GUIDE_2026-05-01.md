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
3. `npm run v2:clipboard-features`로 parser + V2 feature builder 실행
4. `ml/predict_item_value.py`를 Python subprocess로 호출
5. `low listed value`, `search-worthy`, `high-value candidate` 중 하나를 표시

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

앱 UI에서 다음 경로를 입력한다.

```text
model.cbm
feature_schema.json
```

예시:

```text
ml/runs/v2_classifier_latest/v2_mod_aware/global/model.cbm
ml/runs/v2_classifier_latest/v2_mod_aware/global/feature_schema.json
```

## 데모 절차

1. PoE1 영문 클라이언트에서 아이템에 마우스를 올리고 `Ctrl+C`
2. 앱에서 `Read Clipboard` 클릭
3. 모델/스키마 경로 확인
4. `Analyze Item` 클릭
5. 판단 결과, score, parser warning, 추출 feature를 보여준다

실제 클립보드 연동이 불안정하면 저장된 영문 샘플을 textarea에 paste해서 같은 흐름으로 시연한다.

## 주의 문구

앱 결과는 실제 체결가가 아니라 priced listing 기반 판단이다. 따라서 발표에서는 다음처럼 설명한다.

> 이 앱은 아이템의 정확한 판매가를 보장하지 않고, 공개 등록 매물 기반으로 검색하거나 판매 시도할 가치가 있는지 빠르게 판단하는 로컬 보조 도구입니다.

## 현재 한계

- 영어 클라이언트 기준
- 단일 모델 경로를 직접 지정하는 MVP 구조
- high-value candidate는 binary classifier score band 기반 표시
- true trash detector가 아니라 low listed value와 search-worthy 분류 모델
