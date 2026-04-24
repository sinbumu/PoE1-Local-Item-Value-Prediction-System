# ML Workflow

이 디렉토리는 `training_features_labeled`를 CatBoost 실험으로 연결하는 경로입니다. 현재 기본 경로는 `CSV 전체 적재 -> pandas`가 아니라, `DB -> staged split CSV -> CatBoost file Pool`입니다.

## 목적

- ETL이 만든 최근 7일 labeled 데이터를 공통 split spec으로 고정
- 같은 스냅샷으로 `글로벌 1개 모델`과 `model_segment`별 모델을 비교
- 대용량 데이터에서도 `pandas.read_csv()` 전체 적재 병목을 피하기

## ETL 완료 판독

최근 7일 ETL을 아래처럼 실행했다면:

```bash
npm run etl:training -- --reset-cursors --since-hours=168 --prune-before-run --limit=10000 --max-batches-per-stage=1
```

로그 마지막이 아래 조건이면 현재 7일 범위 백필은 정상 종료로 본다.

- `rawReachedEnd: true`
- `cleanReachedEnd: true`
- `labeledReachedEnd: true`
- 마지막 종료 코드 `0`

이 상태면 export만 하던 이전 흐름 대신, 바로 `stage -> train/compare`로 넘어가면 된다.

## Python 환경

```bash
python3 -m venv ml/.venv
source ml/.venv/bin/activate
pip install -r ml/requirements.txt
```

## 권장 흐름

1. 최근 7일 ETL 완료 확인
2. 스테이징 파일 생성
3. 글로벌 모델 또는 세그먼트 모델 학습
4. 비교 리포트 생성

## 1. 학습 스테이징 생성

기본 예시:

```bash
npm run stage:training-dataset -- --days=7 --output-dir=artifacts/training-staging/last_7d
```

특정 세그먼트만 스테이징하고 싶다면:

```bash
npm run stage:training-dataset -- --days=7 --segments=rare_equipment,jewel --output-dir=artifacts/training-staging/last_7d_focus
```

출력:

- `manifest.json`
- `split_spec.json`
- `target_price_log1p.cd`
- `target_price_chaos.cd`
- `global/train.csv`, `global/valid.csv`, `global/test.csv`
- `segments/<model_segment>/train.csv`, `valid.csv`, `test.csv`

핵심:

- split은 전역 시간순 row 경계를 기준으로 한 번만 계산된다.
- 세그먼트별 파일도 같은 split spec을 공유하므로 공정 비교가 가능하다.
- 학습 입력 컬럼은 `src/config/clipboard-safe-feature-policy.json`의 active/derived feature만 사용한다.

스테이징 디렉터리 정리 규칙:

- 가장 안전한 방법은 **매번 새 `--output-dir`를 쓰는 것**이다.
- 현재 `stage:training-dataset` 스크립트는 `train.csv`, `valid.csv`, `test.csv`, `manifest.json`, `split_spec.json`은 다시 쓰지만, 기존 output dir 안의 **사용하지 않게 된 오래된 세그먼트 하위 디렉터리까지 자동 삭제하지는 않는다**.
- 따라서 이전 결과를 완전히 버리고 같은 경로를 다시 쓰고 싶다면, **직접 해당 staging 디렉터리를 지운 뒤 실행**하는 편이 확실하다.

예:

```bash
rm -rf artifacts/training-staging/post_report_rare_equipment
```

또는 더 권장:

```bash
npm run stage:training-dataset -- --days=7 --segments=rare_equipment --output-dir=artifacts/training-staging/post_report_rare_equipment_20260418
```

## 2. 글로벌 모델 학습

```bash
python ml/train_catboost.py \
  --staged-manifest artifacts/training-staging/last_7d/manifest.json \
  --output-dir ml/runs/global_last_7d
```

주요 옵션:

```bash
python ml/train_catboost.py \
  --staged-manifest artifacts/training-staging/last_7d/manifest.json \
  --target-column target_price_log1p \
  --iterations 3000 \
  --learning-rate 0.03 \
  --depth 8 \
  --thread-count 8 \
  --output-dir ml/runs/global_last_7d_tuned
```

## 3. 세그먼트 모델 학습

예: `rare_equipment`만 별도 학습

```bash
python ml/train_catboost.py \
  --staged-manifest artifacts/training-staging/last_7d/manifest.json \
  --segment rare_equipment \
  --output-dir ml/runs/segment_rare_equipment
```

주의:

- 세그먼트 학습도 같은 `split_spec.json`을 그대로 사용한다.
- `model_segment` 컬럼은 세그먼트 파일에도 남겨 두지만 값이 상수라 CatBoost가 사실상 무시하게 된다.

## 4. 글로벌 vs 세그먼트 비교

```bash
python ml/run_training_comparison.py \
  --staged-manifest artifacts/training-staging/last_7d/manifest.json \
  --output-dir ml/runs/comparison_last_7d
```

출력:

- `global/` 아래 글로벌 모델 산출물
- `segments/<segment>/` 아래 세그먼트 모델 산출물
- `comparison_summary.csv`
- `comparison_summary.json`
- `run_info.json`

비교 기준:

- `target_price_log1p` RMSE / MAE
- `target_price_chaos` RMSE / MAE / MAPE
- 세그먼트별 winner 판정
- 학습 시간과 메모리 사용량

현재 winner 판정 규칙:

- 1순위: `target_price_log1p_rmse`
- 동률 시: `target_price_log1p_mae`
- 최종 동률 시: `target_price_chaos_rmse`

## 현재 기준선

현재 저장소 기준 실질적인 운영 해석에 쓰는 최근 7일 전체 비교 런은 아래 결과다.

- 스테이징 스냅샷: `artifacts/training-staging/post_report_all_segments`
- 비교 런: `ml/runs/comparison_post_report_300iter_d8_log1p_winner`
- 설정: `target_price_log1p`, `iterations=300`, `depth=8`, `learning_rate=0.05`

핵심 결과:

- 글로벌 모델 전체 test `target_price_log1p_rmse`: `1.7061`
- `rare_equipment`, `jewel`, `unique_equipment`는 세그먼트 모델이 더 낮은 RMSE를 기록
- `skill_gem`은 글로벌 모델이 더 낮은 RMSE를 기록
- 따라서 현재 1차 기준선은 **전 세그먼트 일괄 분리**보다 **혼합 운영 기준선**으로 보는 것이 적절하다

세그먼트별 test `target_price_log1p_rmse`:

- `jewel`: `1.7409 -> 1.6959`
- `rare_equipment`: `1.6615 -> 1.6346`
- `skill_gem`: `1.5986 -> 1.6145`
- `unique_equipment`: `1.8573 -> 1.7203`

운영 판단:

- V1 로컬 유틸리티 앱은 `model_segment` 판별 후 `rare_equipment`, `jewel`, `unique_equipment`는 세그먼트 모델을 우선 사용한다.
- `skill_gem`은 현재 글로벌 모델 fallback을 기본안으로 둔다.
- 글로벌 모델은 비교 기준선이자 일부 세그먼트 fallback 용도로 유지한다.

## 보고 이후 권장 실행 순서

현재 기준으로는 아래 순서를 권장한다.

1. ETL이 최근 7일 범위를 다시 따라잡게 둔다.
2. ETL 최신화가 끝나면 **새 output dir**로 새 staged snapshot을 만든다.
3. 바로 전체 비교를 다시 돌리지 말고, 먼저 `rare_equipment` 같은 단일 세그먼트만 학습한다.
4. 단일 세그먼트 결과와 리소스 사용이 문제 없으면, 그 다음 전체 세그먼트 비교나 전체 세그먼트 학습으로 확장한다.

### A. ETL 최신화 후 rare 장비만 먼저 검증

```bash
npm run stage:training-dataset -- \
  --days=7 \
  --segments=rare_equipment \
  --output-dir=artifacts/training-staging/post_report_rare_equipment
```

```bash
ml/.venv/bin/python ml/train_catboost.py \
  --staged-manifest artifacts/training-staging/post_report_rare_equipment/manifest.json \
  --segment rare_equipment \
  --iterations 300 \
  --depth 8 \
  --learning-rate 0.05 \
  --output-dir ml/runs/rare_equipment_post_report_300iter_d8
```

### B. 이상 없으면 전체 세그먼트 비교로 확장

```bash
npm run stage:training-dataset -- \
  --days=7 \
  --output-dir=artifacts/training-staging/post_report_all_segments
```

```bash
ml/.venv/bin/python ml/run_training_comparison.py \
  --staged-manifest artifacts/training-staging/post_report_all_segments/manifest.json \
  --iterations 300 \
  --depth 8 \
  --learning-rate 0.05 \
  --output-dir ml/runs/comparison_post_report_300iter_d8
```

정리:

- **직접 지워야 하는가?**  
  같은 staging 경로를 재사용한다면 지우는 편이 확실하다.
- **스크립트가 자동 정리하는가?**  
  핵심 파일은 덮어쓰지만, output dir 전체를 깨끗하게 비우지는 않는다.
- **지금 추천 흐름은?**  
  ETL 최신화 후 `rare_equipment` 단일 세그먼트 먼저, 문제 없으면 전체 확장.

## 레거시 CSV 모드

작은 샘플을 빠르게 실험할 때는 기존 CSV 직접 학습도 그대로 쓸 수 있다.

```bash
python ml/train_catboost.py --dataset artifacts/datasets/YOUR_FILE.csv
```

이 모드는 여전히 전체 CSV를 pandas로 올리므로, 최근 7일 전체 학습의 기본 경로로는 권장하지 않는다.
