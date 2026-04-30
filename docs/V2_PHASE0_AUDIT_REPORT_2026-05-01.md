# V2 Phase 0 Audit Guide

이 문서는 `docs/V2_ONE_SEMESTER_MVP_LOCKED_PLAN.md`의 Phase 0을 실행하기 위한 프로젝트 내 구현 상태와 실행 방법을 정리한다.

## 목적

Phase 0은 모델 학습 전에 기존 수집 데이터가 V2 mod-aware feature를 만들 수 있는지 확인하는 단계다.

확인 항목:

- `normalized_priced_items.item_json`에 `explicitMods`, `craftedMods`, `fracturedMods`, `enchantMods`가 보존되어 있는지
- `training_features_labeled`의 `rare_equipment`, `unique_equipment` row가 충분한지
- RePoE `base_items.json` 기반 `base_type -> equipment_slot` mapping이 가능한지
- 영문 affix dictionary match / ambiguous / unmatched 비율이 어느 정도인지
- `is_search_worthy`와 high-value 보조 target 분포가 어떤지

## 실행

```bash
npm run audit:v2-mod-aware -- \
  --days=7 \
  --segments=rare_equipment,unique_equipment \
  --batch-size=1000 \
  --output-dir=artifacts/v2_mod_audit/latest
```

대용량 전체 확인 전에 빠르게 smoke test를 할 때:

```bash
npm run audit:v2-mod-aware -- \
  --days=7 \
  --limit=5000 \
  --output-dir=artifacts/v2_mod_audit/smoke
```

## 산출물

- `summary.json`: segment/slot별 row count, mod line 보존율, match rate, label 분포
- `summary.md`: 보고서에 바로 옮기기 쉬운 요약표
- `base_type_equipment_slot_map.json`: RePoE 기반 임시 slot mapping
- `affix_match_sample.csv`: match 상태를 수동 점검하기 위한 샘플

## 판정 기준

이 단계는 DB schema를 변경하지 않고 artifact만 생성한다. 결과에서 `rare_equipment`와 `unique_equipment`의 row 수, explicit mod 보존율, affix match rate가 실험 가능한 수준이면 V2 feature staging으로 진행한다.

match rate가 낮아도 바로 폐기하지 않는다. 이 경우 unmatched/ambiguous sample을 기준으로 affix dictionary 보강 또는 feature 범위 축소를 결정한다.
