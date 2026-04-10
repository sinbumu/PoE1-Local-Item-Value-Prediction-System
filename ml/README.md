# ML Workflow

이 디렉토리는 수집기/maintenance/ETL과 분리된 `CatBoost` 학습 실험 공간입니다.

## 목적

- Node/TypeScript 쪽은 `collector`, `maintenance`, ETL, DB 관리 유지
- Python 쪽은 exported dataset 기반 학습/평가/모델 저장 담당

## 권장 흐름

1. `training_features_raw` 백필
2. `training_features_clean` 백필
3. `training_features_labeled` 백필
4. labeled dataset CSV export
5. `CatBoost` 학습 실행

## ETL 백필 예시

```bash
npm run build:training-features -- --reset-cursor --until-end
```

```bash
npm run build:training-features-clean -- --reset-cursor --until-end
```

```bash
npm run build:training-features-labeled -- --reset-cursor --until-end
```

주의:

- 세 단계는 보통 **동시에 돌리기보다 순차 실행**이 안전합니다.
- `collector`와 `maintenance`는 계속 켜둬도 되지만, DB 부하가 크면 ETL 중에는 잠시 관찰이 필요합니다.

## 학습용 CSV export

최근 7일 labeled row 전체 export:

```bash
npm run export:training-dataset -- --days=7
```

특정 세그먼트만 export:

```bash
npm run export:training-dataset -- --days=7 --segments=rare_equipment,jewel
```

출력:

- 기본 경로: `artifacts/datasets/`
- CSV와 `.manifest.json`이 함께 생성됨

## Python 환경

```bash
python3 -m venv ml/.venv
source ml/.venv/bin/activate
pip install -r ml/requirements.txt
```

## 첫 학습 실행

```bash
python ml/train_catboost.py --dataset artifacts/datasets/YOUR_FILE.csv
```

옵션 예시:

```bash
python ml/train_catboost.py \
  --dataset artifacts/datasets/YOUR_FILE.csv \
  --target-column target_price_log1p \
  --output-dir ml/runs/first_full_run
```

## 현재 학습 스크립트 특징

- 시간 순서 기준 `train / valid / test` 분할
- 기본 타깃은 `target_price_log1p`
- feature leakage 방지를 위해 아래 컬럼은 자동 제외
  - `target_price_amount`
  - `target_price_currency`
  - `exchange_rate_*`
  - `target_price_chaos`
  - `target_price_log1p`
- 실행 결과로 아래 파일 생성
  - `model.cbm`
  - `metrics.json`
  - `feature_importance.csv`
  - `run_info.json`

## 다음 확장 후보

- segment별 별도 모델
- outlier clipping / target winsorization
- categorical/text feature 확장
- mod key 정규화 후 피처 추가
- 학습 결과 비교용 실험 관리 파일 추가
