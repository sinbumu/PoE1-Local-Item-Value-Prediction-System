# TRAINING_BASELINE_REPORT_2026-04-19.md

## 문서 목적

이 문서는 `2026-04-19` 기준 최근 7일 snapshot으로 실행한 전체 학습 비교 결과를 중간정리하기 위한 보고서다.

특히 아래 내용을 남긴다.

- 어떤 명령으로 staged dataset과 학습 비교를 실행했는지
- 글로벌 모델과 세그먼트 모델 중 어느 쪽이 실제로 더 나았는지
- 현재 1차 기준선을 어떻게 해석해야 하는지
- 다음 실험을 어떤 방향으로 이어가야 하는지

## 실행 요약

이번 비교는 아래 두 단계로 실행했다.

1. 최근 7일 전체 staged dataset 생성

```bash
npm run stage:training-dataset -- \
  --days=7 \
  --output-dir=artifacts/training-staging/post_report_all_segments
```

2. 글로벌 vs 세그먼트 비교 학습

```bash
ml/.venv/bin/python ml/run_training_comparison.py \
  --staged-manifest artifacts/training-staging/post_report_all_segments/manifest.json \
  --iterations 300 \
  --depth 8 \
  --learning-rate 0.05 \
  --output-dir ml/runs/comparison_post_report_300iter_d8
```

결과 산출물:

- staged snapshot: `artifacts/training-staging/post_report_all_segments`
- 비교 결과: `ml/runs/comparison_post_report_300iter_d8`
- 요약 CSV: `ml/runs/comparison_post_report_300iter_d8/comparison_summary.csv`
- 상세 JSON: `ml/runs/comparison_post_report_300iter_d8/comparison_summary.json`

## 데이터 규모

이번 전체 비교 런의 글로벌 split 기준 row 수:

- train: `10,662,539`
- valid: `1,332,817`
- test: `1,332,818`

즉 최근 7일 전체 snapshot 중 약 `13.33M` row를 글로벌 모델 기준으로 학습/검증/테스트에 사용했다.

세그먼트별 test row 수:

| 세그먼트 | test row 수 |
| --- | ---: |
| `rare_equipment` | `641,286` |
| `jewel` | `482,680` |
| `unique_equipment` | `126,063` |
| `skill_gem` | `82,789` |

## 글로벌 모델 결과

글로벌 모델 전체 test 성능:

- `target_price_log1p_rmse`: `1.7061`
- `target_price_log1p_mae`: `1.3756`
- `target_price_chaos_rmse`: `42,792,802.08`
- `target_price_chaos_mae`: `93,501.66`
- `target_price_chaos_mape`: `390.25`

학습 시간:

- 글로벌 모델 학습만 약 `7분 43초`

## 세그먼트별 비교 결과

`comparison_summary.csv` 기준:

| 세그먼트 | 글로벌 `log1p RMSE` | 세그먼트 `log1p RMSE` | 해석 |
| --- | ---: | ---: | --- |
| `jewel` | `1.7409` | `1.6959` | 세그먼트 모델 우세 |
| `rare_equipment` | `1.6615` | `1.6346` | 세그먼트 모델 우세 |
| `skill_gem` | `1.5986` | `1.6145` | 글로벌 모델 우세 |
| `unique_equipment` | `1.8573` | `1.7203` | 세그먼트 모델 우세 |

즉 **1차 기준인 `target_price_log1p RMSE`만 보면 4개 중 3개 세그먼트에서 세그먼트 모델이 더 좋고, `skill_gem`만 글로벌 모델이 더 좋다.**

## `winner` 컬럼 해석과 현재 판정 규칙

`2026-04-19`에 생성된 기존 `comparison_summary.csv`의 `winner`는 내부적으로 `target_price_chaos_rmse` 기준으로 판정되었다.

따라서 이번 결과에서:

- `jewel`은 `log1p RMSE` 기준으로는 세그먼트 모델이 더 좋지만
- `chaos RMSE` 기준으로는 글로벌이 아주 근소하게 더 낮아서 `winner=global`로 기록되었다

즉 문서를 읽을 때는 아래를 구분해야 한다.

1. **현재 1차 학습 목표**: `target_price_log1p` RMSE / MAE
2. 현재 자동 `winner` 판정: `target_price_chaos_rmse`

현재 프로젝트에서 회귀 타깃 기본값이 `target_price_log1p`인 점을 감안하면, 이번 중간판단에서는 `winner` 컬럼보다 **`target_price_log1p_rmse` 비교를 우선 해석하는 것이 더 자연스럽다.**

추가로 `2026-04-22`부터 `ml/run_training_comparison.py`의 `winner` 판정 로직은 아래 순서로 바뀌었다.

1. `target_price_log1p_rmse`
2. 동률이면 `target_price_log1p_mae`
3. 그래도 동률이면 `target_price_chaos_rmse`

즉 앞으로 새로 생성되는 비교 결과에서는 `jewel`도 자동으로 `segment` 승자로 기록되는 것이 맞다.

## 세그먼트별 해석

### 1. `rare_equipment`

- 별도 단일 학습에서도 `test RMSE 1.6346`이 확인되었음
- row 수도 가장 크고 (`641k` test)
- 로컬 앱의 핵심 판단 대상과도 가장 잘 맞음

따라서 현재 기준으로는 **가장 우선적으로 유지/고도화할 세그먼트**다.

### 2. `jewel`

- `log1p RMSE` 기준으로 세그먼트 모델이 더 좋음
- 다만 `chaos RMSE` 기준 차이는 매우 작아서 글로벌과 세그먼트가 거의 비슷하게 나오는 구간이 있음

즉 `jewel`은 세그먼트 모델 우세로 보되, 해석 시 `winner` 컬럼만 그대로 읽으면 혼동할 수 있다.

### 3. `unique_equipment`

- 개선 폭이 가장 크게 보이는 구간 중 하나
- 글로벌 `1.8573` -> 세그먼트 `1.7203`

즉 `unique_equipment`는 세그먼트 분리의 이점이 꽤 분명하게 나타난다.

### 4. `skill_gem`

- 이번 비교에서는 글로벌 모델이 더 좋게 나옴
- 이유 후보:
  - row 수가 다른 세그먼트보다 상대적으로 적음
  - gem 계열 피처가 아직 단순해서 분리 모델 이점이 작을 수 있음
  - 글로벌 모델이 다른 세그먼트 정보까지 함께 보며 regularization 효과를 받았을 가능성

추가 점검으로 `skill_gem` 세그먼트 단독 학습을 한 번 더 실행했다.

- 실행: `ml/runs/skill_gem_post_report_500iter_d6`
- 설정: `iterations=500`, `depth=6`, `learning_rate=0.05`
- 결과: test `target_price_log1p_rmse = 1.6180`

이는 기존 글로벌 모델의 `1.5986`보다 여전히 나쁘다. 즉 현재 기준으로 `skill_gem`은 **무조건 세그먼트 분리**보다 **글로벌 fallback 유지**가 더 타당하다.

## 현재 기준선 결론

이번 `300 iter` 전체 비교 결과를 기준으로 하면:

1. 전체 파이프라인은 최근 7일 snapshot 기준으로 실제 운영 가능한 수준이다.
2. `rare_equipment`, `jewel`, `unique_equipment`는 세그먼트 모델 우선이 더 자연스럽다.
3. `skill_gem`은 아직 글로벌 모델이 더 낫게 나왔다.

따라서 현재 1차 기준선은 아래처럼 잡는 것이 가장 현실적이다.

- `rare_equipment`: 세그먼트 모델
- `jewel`: 세그먼트 모델
- `unique_equipment`: 세그먼트 모델
- `skill_gem`: 글로벌 모델 유지

즉, **“모든 세그먼트를 무조건 분리”**보다 **“혼합 운영 기준선”**이 현재 결과와 더 잘 맞는다.

## 권장 다음 단계

우선순위:

1. `rare_equipment` 단독 모델을 현재 핵심 기준선으로 유지
2. `jewel`, `unique_equipment`도 세그먼트 모델 유지
3. `skill_gem`은 글로벌/세그먼트 중 글로벌 우선
4. 비교 스크립트는 이제 `target_price_log1p_rmse` 우선 판정으로 유지
5. 추후 로컬 앱 라우팅은 “세그먼트별 모델 + 일부 글로벌 fallback” 구조로 설계

## 한 줄 요약

`2026-04-19` 기준 최근 7일 전체 `300 iter` 비교 런에서는 **세그먼트 분리가 전반적으로 유리하지만, `skill_gem`만은 글로벌 모델이 더 나았기 때문에 현재 기준선은 세그먼트 일괄 분리보다 혼합 운영 쪽이 더 적절하다.**
