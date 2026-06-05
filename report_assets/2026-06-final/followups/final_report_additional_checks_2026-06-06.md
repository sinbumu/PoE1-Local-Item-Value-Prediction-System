# Final Report Additional Checks - 2026-06-06

## 5.1 Collector poll_interval_ms 실제 값

저장소 기본값 기준 `POLL_INTERVAL_MS`는 `10000ms`다. 단, collector loop는 완전한 고정 interval이 아니라 수집 결과에 따라 대기 시간을 바꾼다.

- `filtered stashCount > 0`: 다음 cycle 전 `1000ms` 대기
- `filtered stashCount === 0`: `env.POLL_INTERVAL_MS` 대기, 기본 `10000ms`
- cycle error 발생: `env.POLL_INTERVAL_MS` 대기, 기본 `10000ms`
- `POLL_INTERVAL_MS`는 환경 변수로 override 가능

보고서 표 4-1에는 `10000ms 기본값, 수집 결과에 따라 1000ms/10000ms 동적 대기` 또는 `상황별 동적 조정`으로 쓰는 것이 정확하다.

관련 표: `chapter4/table_collector_polling_behavior.md`

## 5.2 chaos RMSE 동일 수치 원인

원본 `comparison_summary.json` 기준 값은 다음과 같다.

- jewel global: `34669705.782915264`
- jewel segment: `34669705.806647025`
- skill_gem global: `99038867.96617351`
- skill_gem segment: `99038867.9751355`

한 줄 코멘트: 보고서에서 동일하게 보이는 것은 정수 또는 낮은 소수 자리 반올림 영향이며, 두 모델의 chaos RMSE가 실제로도 매우 근접하다. chaos scale RMSE는 초고가 이상치에 크게 지배되어 log1p RMSE/MAE보다 모델 간 구분력이 낮게 보일 수 있다.

관련 표: `chapter6/table_chaos_rmse_exact_values.md`

## 5.3 참고문헌 보강용 출처 목록

공식 문서/웹문서 후보 목록은 `references/final_report_reference_candidates.md`에 정리했다. 각 항목은 title, organization/author, URL, accessed date, usage note를 포함한다.

## 5.4 feature importance 본문 축약표

본문용 top-3 feature importance 요약표를 생성했다.

관련 표: `chapter6/table_feature_importance_top3_summary.md`

전체 top-8 목록은 기존 `report_assets/2026-04-24/chapter6/table_feature_importance_topn.md`를 부록으로 이동하는 방식이 적절하다.

## 5.5 용어 정리 보강

`appendix/glossary_app_terms.md`에 요청된 PoE/모델 용어를 추가했다.

## 5.6 현재 OS/실행 환경 표기

로컬 개발 환경은 다음처럼 쓰면 된다.

- macOS 26.3.1 (a), build 25D771280a
- Apple Silicon, arm64
- CPU: Apple M3 Max

Windows installer 검증 환경의 정확한 Windows 10/11 버전은 저장소 문서에 없다. 보고서 표에는 `Windows installer 검증 환경: 추가 확인 필요`로 두거나, 사용자가 직접 검증한 Windows PC의 `winver` 결과를 반영해야 한다.

관련 표: `chapter3/table_execution_environment_readable_os.md`
