| component | role | chapter_use |
| --- | --- | --- |
| collector | OAuth 인증, Public Stash tailing, league filtering, normalized 적재, state 갱신 | 수집 계층 설명 |
| maintenance | raw cleanup, stale normalized cleanup, labeled backup 등 저장소 관리 | 운영 정책 설명 |
| training_etl | normalized -> raw -> clean -> labeled 변환 | 학습 데이터 계층 설명 |
| staging | 최근 7일 labeled snapshot을 train/valid/test split CSV로 고정 | 재현 가능한 실험 설명 |
| training_comparison | global vs segment CatBoost 비교와 기준선 도출 | 모델 실험 설명 |
| clipboard_parser | 영문 Ctrl+C 텍스트 파싱과 affix dictionary V1 기반 추론 입력 준비 | 향후 앱 입력 경로 설명 |
