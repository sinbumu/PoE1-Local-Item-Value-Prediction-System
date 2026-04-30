# V2 Model Comparison Guide

이 문서는 V2 mod-aware classifier 학습 파이프라인의 현재 구현과 실행 순서를 정리한다.

## 목표

V2의 1차 모델 목표는 exact price regression이 아니라 `is_search_worthy` binary classification이다.

```text
is_search_worthy = target_price_chaos >= 30
```

V1 summary feature baseline과 V2 mod-aware feature classifier를 동일한 snapshot, 동일한 time split으로 비교한다.

## Staging

```bash
npm run stage:v2-mod-aware -- \
  --days=7 \
  --segments=rare_equipment,unique_equipment \
  --output-dir=artifacts/v2-mod-aware-staging/latest
```

생성되는 manifest:

```text
artifacts/v2-mod-aware-staging/latest/manifest.json
```

manifest 안에는 `v1_summary`와 `v2_mod_aware` feature set이 함께 들어간다. 두 feature set은 같은 row 순서와 같은 train/valid/test split을 사용한다.

## 학습/비교

```bash
ml/.venv/bin/python ml/run_v2_classifier_comparison.py \
  --staged-manifest artifacts/v2-mod-aware-staging/latest/manifest.json \
  --iterations 1000 \
  --depth 8 \
  --learning-rate 0.05 \
  --output-dir ml/runs/v2_classifier_latest
```

빠른 smoke test:

```bash
ml/.venv/bin/python ml/run_v2_classifier_comparison.py \
  --staged-manifest artifacts/v2-mod-aware-staging/latest/manifest.json \
  --iterations 200 \
  --depth 6 \
  --learning-rate 0.05 \
  --output-dir ml/runs/v2_classifier_smoke
```

## 산출물

- `v2_classifier_comparison_summary.csv`
- `v2_classifier_comparison_summary.json`
- `run_info.json`
- feature set별 `model.cbm`
- feature set별 `feature_schema.json`
- feature importance CSV

## Winner 기준

앱 MVP 관점에서는 비싼 아이템을 놓치지 않는 것이 중요하므로 winner는 다음 순서로 판정한다.

1. recall이 높은 모델
2. F1이 높은 모델
3. precision이 높은 모델

즉 false positive가 조금 늘더라도 `search-worthy` 아이템을 `low listed value`로 놓치는 모델은 불리하게 본다.

## 앱 연결 모델

Electron 앱에 연결할 때는 선택된 run의 다음 두 파일을 지정한다.

```text
ml/runs/v2_classifier_latest/<feature_set>/global/model.cbm
ml/runs/v2_classifier_latest/<feature_set>/global/feature_schema.json
```

segment 모델을 앱에 붙일 경우에는 앱에서 segment routing을 추가해야 한다. 현재 MVP skeleton은 먼저 단일 모델 경로를 직접 지정하는 방식이다.
